const bcrypt = require('bcryptjs');
const db = require('../../config/db');

async function seed() {
  try {
    console.log('Seeding initial users...');

    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('password123', salt);
    const currentYear = new Date().getFullYear();

    // 1. HR Admin
    const [adminResult] = await db.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, role, department_id)
       VALUES ('ADM-001', 'Admin', 'User', 'admin@system.com', ?, 'admin', 2)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [defaultPasswordHash]
    );
    const adminId = adminResult.insertId;

    // 2. Supervisor (IT Dept)
    const [supResult] = await db.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, role, department_id)
       VALUES ('SUP-001', 'John', 'Supervisor', 'supervisor@system.com', ?, 'supervisor', 1)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [defaultPasswordHash]
    );
    const supervisorId = supResult.insertId;

    // 3. Employee (Assigned to Supervisor and IT Dept)
    const [empResult] = await db.query(
      `INSERT INTO users (employee_id, first_name, last_name, email, password_hash, role, department_id, supervisor_id)
       VALUES ('EMP-001', 'Jane', 'Employee', 'employee@system.com', ?, 'employee', 1, ?)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
      [defaultPasswordHash, supervisorId]
    );
    const employeeId = empResult.insertId;

    // Initialize leave credits for the test employee
    const [leaveTypes] = await db.query('SELECT id, default_days_per_year FROM leave_types');
    for (const lt of leaveTypes) {
      await db.query(
        `INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_credits, used_credits, pending_credits)
         VALUES (?, ?, ?, ?, 0.00, 0.00)`,
        [employeeId, lt.id, currentYear, lt.default_days_per_year]
      );
    }

    console.log('Successfully seeded test users and balances!');
    console.log('All accounts have the password: password123');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();