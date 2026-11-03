const db = require('../config/db');
const { sendEmail } = require('../utils/mailer');

// Helper to calculate working days (skipping weekends & declared holidays)
async function calculateWorkingDays(startDateStr, endDateStr) {
  const [holidays] = await db.query('SELECT holiday_date FROM holidays');
  const holidaySet = new Set(
    holidays.map((h) => new Date(h.holiday_date).toISOString().split('T')[0])
  );

  let count = 0;
  let cur = new Date(startDateStr);
  const end = new Date(endDateStr);

  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    const dateStr = cur.toISOString().split('T')[0];
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// 1. Get calendar events
exports.getCalendarEvents = async (req, res) => {
  try {
    const [leaves] = await db.query(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.status, lr.leave_type_id,
              u.first_name, u.last_name, u.department_id, d.name AS department_name, lt.name AS leave_type
       FROM leave_requests lr
       LEFT JOIN users u ON lr.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.status = 'approved'`
    );

    const [holidays] = await db.query('SELECT * FROM holidays ORDER BY holiday_date ASC');
    const [departments] = await db.query('SELECT * FROM departments ORDER BY name ASC');
    const [leaveTypes] = await db.query('SELECT * FROM leave_types ORDER BY name ASC');

    res.status(200).json({ leaves, holidays, departments, leaveTypes });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving calendar data.', error: error.message });
  }
};

// 2. Check overlap collision during filing
exports.checkOverlap = async (req, res) => {
  const userId = req.user.id;
  const userDeptId = req.user.department_id;
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ message: 'Start and end dates are required.' });
  }

  try {
    const [overlappingLeaves] = await db.query(
      `SELECT lr.id, lr.start_date, lr.end_date, u.first_name, u.last_name, lt.name AS leave_type
       FROM leave_requests lr
       LEFT JOIN users u ON lr.user_id = u.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE u.department_id = ?
         AND lr.user_id != ?
         AND lr.status IN ('approved', 'pending_supervisor', 'pending_hr')
         AND (
           (lr.start_date <= ? AND lr.end_date >= ?) OR
           (lr.start_date <= ? AND lr.end_date >= ?) OR
           (lr.start_date >= ? AND lr.end_date <= ?)
         )`,
      [userDeptId, userId, start_date, start_date, end_date, end_date, start_date, end_date]
    );

    res.status(200).json({ overlappingLeaves });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying schedule overlap.', error: error.message });
  }
};

// 3. Employee: My leaves & balance
exports.getMyLeaves = async (req, res) => {
  const userId = req.user.id;
  const currentYear = new Date().getFullYear();

  try {
    const [balances] = await db.query(
      `SELECT lb.*, lt.name AS leave_type_name
       FROM leave_balances lb
       LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = ? AND lb.year = ?`,
      [userId, currentYear]
    );

    const [requests] = await db.query(
      `SELECT lr.*, lt.name AS leave_type_name
       FROM leave_requests lr
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.user_id = ?
       ORDER BY lr.id DESC`,
      [userId]
    );

    res.status(200).json({ balances, requests });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving employee leaves.', error: error.message });
  }
};

// 4. Employee: Apply for leave (With Personal Leave 1-Day Limit)
exports.applyLeave = async (req, res) => {
  const userId = req.user.id;
  const userDeptId = req.user.department_id;
  const currentYear = new Date().getFullYear();
  const { leave_type_id, start_date, end_date, reason } = req.body;
  const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const workingDays = await calculateWorkingDays(start_date, end_date);
    if (workingDays <= 0) {
      return res.status(400).json({ message: 'Selected date range contains 0 working days.' });
    }

    // Restriction check: Personal leave max 1 working day per application
    const [typeCheck] = await db.query('SELECT name FROM leave_types WHERE id = ?', [leave_type_id]);
    if (typeCheck.length > 0 && typeCheck[0].name.toLowerCase().includes('personal')) {
      if (workingDays > 1) {
        return res.status(400).json({
          message: 'Personal Leave can only be filed for a maximum of 1 working day per application.',
        });
      }
    }

    const [balances] = await db.query(
      `SELECT * FROM leave_balances 
       WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [userId, leave_type_id, currentYear]
    );

    if (balances.length === 0) {
      return res.status(400).json({ message: 'Leave balance record not found for this category.' });
    }

    const balance = balances[0];
    const availableCredits =
      parseFloat(balance.total_credits) -
      (parseFloat(balance.used_credits) + parseFloat(balance.pending_credits));

    if (workingDays > availableCredits) {
      return res.status(400).json({
        message: `Insufficient leave balance. Required: ${workingDays}, Available: ${availableCredits}`,
      });
    }

    // Deduct pending balance
    await db.query(
      `UPDATE leave_balances 
       SET pending_credits = pending_credits + ? 
       WHERE id = ?`,
      [workingDays, balance.id]
    );

    // Insert leave request
    const [result] = await db.query(
      `INSERT INTO leave_requests 
       (user_id, leave_type_id, start_date, end_date, total_days, reason, attachment_url, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_supervisor')`,
      [userId, leave_type_id, start_date, end_date, workingDays, reason, attachment_url]
    );

    // Collision check for notification
    const [overlaps] = await db.query(
      `SELECT lr.id FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       WHERE u.department_id = ? AND lr.user_id != ?
         AND lr.status IN ('approved', 'pending_supervisor', 'pending_hr')
         AND ((lr.start_date <= ? AND lr.end_date >= ?) OR (lr.start_date <= ? AND lr.end_date >= ?))`,
      [userDeptId, userId, start_date, start_date, end_date, end_date]
    );

    // Notify supervisor
    const [supervisorRow] = await db.query(
      `SELECT s.email, s.first_name, u.first_name AS emp_fname, u.last_name AS emp_lname 
       FROM users u 
       JOIN users s ON u.supervisor_id = s.id 
       WHERE u.id = ?`,
      [userId]
    );

    if (supervisorRow.length > 0) {
      sendEmail({
        to: supervisorRow[0].email,
        subject: `New Leave Request Filed: ${supervisorRow[0].emp_fname} ${supervisorRow[0].emp_lname}`,
        html: `<p>Hello ${supervisorRow[0].first_name},</p><p>${supervisorRow[0].emp_fname} ${supervisorRow[0].emp_lname} filed a leave request for <b>${workingDays} days</b> (${start_date} to ${end_date}). Please review it on your supervisor dashboard.</p>`,
      });
    }

    res.status(201).json({
      message: 'Leave application filed successfully.',
      computedWorkingDays: workingDays,
      departmentCollisionDetected: overlaps.length > 0,
      requestId: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error filing leave application.', error: error.message });
  }
};

// 5. Employee: Cancel Leave
exports.cancelLeave = async (req, res) => {
  const userId = req.user.id;
  const requestId = req.params.id;
  const currentYear = new Date().getFullYear();

  try {
    const [requests] = await db.query(
      `SELECT * FROM leave_requests WHERE id = ? AND user_id = ?`,
      [requestId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    const leave = requests[0];
    if (leave.status !== 'pending_supervisor' && leave.status !== 'pending_hr') {
      return res.status(400).json({ message: 'Only pending requests can be cancelled.' });
    }

    // Refund pending quota
    await db.query(
      `UPDATE leave_balances 
       SET pending_credits = GREATEST(0, pending_credits - ?) 
       WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
      [leave.total_days, userId, leave.leave_type_id, currentYear]
    );

    await db.query(`UPDATE leave_requests SET status = 'cancelled' WHERE id = ?`, [requestId]);

    res.status(200).json({ message: 'Leave request cancelled and pending quota refunded.' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling leave request.', error: error.message });
  }
};

// 6. Supervisor: Queue
exports.getSupervisorQueue = async (req, res) => {
  const supervisorId = req.user.id;

  try {
    const [pendingRequests] = await db.query(
      `SELECT lr.*, u.first_name, u.last_name, u.employee_id, u.department_id, lt.name AS leave_type_name
       FROM leave_requests lr
       LEFT JOIN users u ON lr.user_id = u.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE u.supervisor_id = ? AND lr.status = 'pending_supervisor'
       ORDER BY lr.id ASC`,
      [supervisorId]
    );

    for (let reqItem of pendingRequests) {
      const [collisions] = await db.query(
        `SELECT lr2.start_date, lr2.end_date, u2.first_name, u2.last_name, lt2.name AS leave_type
         FROM leave_requests lr2
         LEFT JOIN users u2 ON lr2.user_id = u2.id
         LEFT JOIN leave_types lt2 ON lr2.leave_type_id = lt2.id
         WHERE u2.department_id = ? AND lr2.user_id != ?
           AND lr2.status IN ('approved', 'pending_supervisor', 'pending_hr')
           AND (
             (lr2.start_date <= ? AND lr2.end_date >= ?) OR
             (lr2.start_date <= ? AND lr2.end_date >= ?)
           )`,
        [reqItem.department_id, reqItem.user_id, reqItem.start_date, reqItem.start_date, reqItem.end_date, reqItem.end_date]
      );
      reqItem.collisions = collisions;
    }

    res.status(200).json({ pendingRequests });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving supervisor review queue.', error: error.message });
  }
};

// 7. Supervisor: Review Action
exports.reviewSupervisor = async (req, res) => {
  const requestId = req.params.id;
  const { action, rejection_reason } = req.body;
  const currentYear = new Date().getFullYear();

  try {
    const [requests] = await db.query(
      `SELECT lr.*, u.first_name, u.email 
       FROM leave_requests lr 
       LEFT JOIN users u ON lr.user_id = u.id 
       WHERE lr.id = ?`,
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const leave = requests[0];

    if (action === 'approve') {
      await db.query(
        `UPDATE leave_requests 
         SET status = 'pending_hr' 
         WHERE id = ?`,
        [requestId]
      );

      // Notify HR Admin
      const [admins] = await db.query(`SELECT email FROM users WHERE role = 'admin' LIMIT 1`);
      if (admins.length > 0) {
        sendEmail({
          to: admins[0].email,
          subject: `HR Sign-off Required: Leave Request for ${leave.first_name}`,
          html: `<p>A leave request for ${leave.first_name} was endorsed by their supervisor and is now pending final HR authorization.</p>`,
        });
      }

      return res.status(200).json({ message: 'Request approved and forwarded to HR Admin.' });
    } else if (action === 'reject') {
      // Refund pending balance
      await db.query(
        `UPDATE leave_balances 
         SET pending_credits = GREATEST(0, pending_credits - ?) 
         WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
        [leave.total_days, leave.user_id, leave.leave_type_id, currentYear]
      );

      await db.query(
        `UPDATE leave_requests 
         SET status = 'rejected', 
             rejection_reason = ? 
         WHERE id = ?`,
        [rejection_reason || 'Rejected by supervisor', requestId]
      );

      sendEmail({
        to: leave.email,
        subject: `Leave Request Update: Not Approved`,
        html: `<p>Hello ${leave.first_name}, your leave request was not approved by your supervisor. Reason: ${rejection_reason || 'None specified'}.</p>`,
      });

      return res.status(200).json({ message: 'Leave request rejected and balance restored.' });
    } else {
      return res.status(400).json({ message: 'Invalid review action.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error processing supervisor action.', error: error.message });
  }
};

// 8. Admin: HR Queue (Safe LEFT JOINs and ORDER BY lr.id DESC)
exports.getAdminQueue = async (req, res) => {
  try {
    const [pendingRequests] = await db.query(
      `SELECT lr.*, 
              COALESCE(u.first_name, 'Unknown') AS first_name, 
              COALESCE(u.last_name, '') AS last_name, 
              COALESCE(u.employee_id, 'N/A') AS employee_id, 
              COALESCE(d.name, 'General') AS department_name, 
              COALESCE(lt.name, 'Standard Leave') AS leave_type_name
       FROM leave_requests lr
       LEFT JOIN users u ON lr.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.status = 'pending_hr'
       ORDER BY lr.id DESC`
    );

    res.status(200).json({ pendingRequests });
  } catch (error) {
    console.error('Admin queue query error:', error);
    res.status(500).json({ message: 'Error retrieving HR admin queue.', error: error.message });
  }
};

// 9. Admin: HR Final Review
exports.reviewAdmin = async (req, res) => {
  const requestId = req.params.id;
  const { action, rejection_reason } = req.body;
  const currentYear = new Date().getFullYear();

  try {
    const [requests] = await db.query(
      `SELECT lr.*, u.first_name, u.email 
       FROM leave_requests lr 
       LEFT JOIN users u ON lr.user_id = u.id 
       WHERE lr.id = ?`,
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    const leave = requests[0];

    if (action === 'approve') {
      // Move pending credits into used credits
      await db.query(
        `UPDATE leave_balances 
         SET pending_credits = GREATEST(0, pending_credits - ?),
             used_credits = used_credits + ?
         WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
        [leave.total_days, leave.total_days, leave.user_id, leave.leave_type_id, currentYear]
      );

      await db.query(
        `UPDATE leave_requests 
         SET status = 'approved' 
         WHERE id = ?`,
        [requestId]
      );

      sendEmail({
        to: leave.email,
        subject: `Leave Request Approved!`,
        html: `<p>Good news ${leave.first_name}, your leave request has received final HR approval and has been recorded in the company calendar.</p>`,
      });

      return res.status(200).json({ message: 'Final HR approval granted. Credits deducted and calendar updated.' });
    } else if (action === 'reject') {
      // Refund pending balance
      await db.query(
        `UPDATE leave_balances 
         SET pending_credits = GREATEST(0, pending_credits - ?) 
         WHERE user_id = ? AND leave_type_id = ? AND year = ?`,
        [leave.total_days, leave.user_id, leave.leave_type_id, currentYear]
      );

      await db.query(
        `UPDATE leave_requests 
         SET status = 'rejected', 
             rejection_reason = ? 
         WHERE id = ?`,
        [rejection_reason || 'Rejected by HR', requestId]
      );

      sendEmail({
        to: leave.email,
        subject: `Leave Request Update: Rejected by HR`,
        html: `<p>Hello ${leave.first_name}, your leave request was rejected during final HR review.</p>`,
      });

      return res.status(200).json({ message: 'Leave rejected by HR. Pending credits returned.' });
    } else {
      return res.status(400).json({ message: 'Invalid action.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error executing HR decision.', error: error.message });
  }
};