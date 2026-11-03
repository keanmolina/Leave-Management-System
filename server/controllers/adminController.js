const db = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. Get employees, departments, and potential supervisors for admin dropdowns/tables
exports.getAdminDirectory = async (req, res) => {
  try {
    // Fetch departments
    const [departments] = await db.query('SELECT * FROM departments ORDER BY name ASC');

    // Fetch potential supervisors
    const [supervisors] = await db.query(
      `SELECT id, employee_id, first_name, last_name, email 
       FROM users 
       WHERE role IN ('supervisor', 'admin') 
       ORDER BY first_name ASC`
    );

    // Fetch all active employees with department names
    const [users] = await db.query(
      `SELECT u.id, u.employee_id, u.first_name, u.last_name, u.email, u.role, 
              u.department_id, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.id ASC`
    );

    // Fetch all current leave balances for current year
    const currentYear = new Date().getFullYear();
    const [balances] = await db.query(
      `SELECT lb.*, lt.name AS leave_type_name
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.year = ?`,
      [currentYear]
    );

    // Attach balances array to each user
    const employees = users.map((user) => ({
      ...user,
      balances: balances.filter((b) => b.user_id === user.id),
    }));

    res.status(200).json({
      departments,
      supervisors,
      employees,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch admin directory data.', error: error.message });
  }
};

// 2. Create new employee and auto-allocate standard leave credits
exports.createEmployee = async (req, res) => {
  const { employee_id, first_name, last_name, email, department_id, supervisor_id, role } = req.body;
  const currentYear = new Date().getFullYear();

  try {
    // Check if email or employee_id already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? OR employee_id = ?',
      [email, employee_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Employee ID or email already registered.' });
    }

    // Default password: password123
    const hashedPassword = await bcrypt.hash('password123', 10);

    const [result] = await db.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, role, department_id, supervisor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee_id,
        first_name,
        last_name,
        email,
        hashedPassword,
        role || 'employee',
        department_id || null,
        supervisor_id || null,
      ]
    );

    const newUserId = result.insertId;

    // Auto-allocate balances for every active leave type
    const [leaveTypes] = await db.query('SELECT * FROM leave_types');
    for (const lt of leaveTypes) {
      await db.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, total_credits, used_credits, pending_credits, year)
         VALUES (?, ?, ?, 0, 0, ?)`,
        [newUserId, lt.id, lt.default_days || 15, currentYear]
      );
    }

    res.status(201).json({ message: `Successfully enrolled ${first_name} ${last_name}. Default password is password123.` });
  } catch (error) {
    res.status(500).json({ message: 'Error creating employee account.', error: error.message });
  }
};

// 3. Adjust an employee's leave balance
exports.adjustBalance = async (req, res) => {
  const { user_id, leave_type_id, total_credits } = req.body;
  const currentYear = new Date().getFullYear();

  try {
    const [exists] = await db.query(
      'SELECT id FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?',
      [user_id, leave_type_id, currentYear]
    );

    if (exists.length > 0) {
      await db.query(
        'UPDATE leave_balances SET total_credits = ? WHERE id = ?',
        [total_credits, exists[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, total_credits, used_credits, pending_credits, year)
         VALUES (?, ?, ?, 0, 0, ?)`,
        [user_id, leave_type_id, total_credits, currentYear]
      );
    }

    res.status(200).json({ message: 'Employee quota balance updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error adjusting leave quota.', error: error.message });
  }
};

// 4. Export CSV audit dump
exports.exportAuditLog = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT lr.id, u.employee_id, u.first_name, u.last_name, lt.name AS leave_type,
              lr.start_date, lr.end_date, lr.total_days, lr.status, lr.reason
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       ORDER BY lr.id DESC`
    );

    let csv = 'ID,Employee ID,First Name,Last Name,Type,Start Date,End Date,Days,Status,Reason\n';
    rows.forEach((r) => {
      const safeReason = (r.reason || '').replace(/"/g, '""');
      csv += `${r.id},"${r.employee_id}","${r.first_name}","${r.last_name}","${r.leave_type}","${r.start_date.toISOString().split('T')[0]}","${r.end_date.toISOString().split('T')[0]}",${r.total_days},"${r.status}","${safeReason}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`Leave_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  } catch (error) {
    res.status(500).send('Error generating CSV export.');
  }
};