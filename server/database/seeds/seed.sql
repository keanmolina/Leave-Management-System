CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  role ENUM('employee', 'supervisor', 'admin') DEFAULT 'employee',
  department_id INT
);

INSERT INTO users (employee_id, first_name, last_name, email, password_hash, role, department_id) 
VALUES 
('EMP-001', 'Admin', 'User', 'admin@system.com', '$2b$10$39WNYjPz0a8fD0zZ1E1yJ.8O9o8z1E1yJ.8O9o8z1E1yJ.8O9o8zK', 'admin', 1),
('EMP-002', 'Supervisor', 'User', 'supervisor@system.com', '$2b$10$39WNYjPz0a8fD0zZ1E1yJ.8O9o8z1E1yJ.8O9o8z1E1yJ.8O9o8zK', 'supervisor', 1),
('EMP-003', 'Employee', 'User', 'employee@system.com', '$2b$10$39WNYjPz0a8fD0zZ1E1yJ.8O9o8z1E1yJ.8O9o8z1E1yJ.8O9o8zK', 'employee', 1)
ON DUPLICATE KEY UPDATE email=email;