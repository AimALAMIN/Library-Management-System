const pool = require('./db');
const bcrypt = require('bcryptjs');

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('admin', 'staff', 'student')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        total_copies INTEGER NOT NULL,
        available_copies INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS issued_books (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        issued_date DATE NOT NULL,
        return_date DATE NOT NULL,
        actual_return_date DATE,
        fine NUMERIC DEFAULT 0,
        status VARCHAR(20) CHECK (status IN ('pending', 'issued', 'return_pending', 'returned')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        fine_per_day NUMERIC DEFAULT 2,
        max_issue_duration INTEGER DEFAULT 14
      );
    `);
    console.log('Tables created');

    // Insert default settings
    const settingsRes = await pool.query("SELECT * FROM settings WHERE id = 1");
    if (settingsRes.rows.length === 0) {
      await pool.query("INSERT INTO settings (id, fine_per_day, max_issue_duration) VALUES (1, 2, 14)");
      console.log('Default settings created');
    }

    // Insert default admin
    const res = await pool.query("SELECT * FROM users WHERE email = 'admin@library.com'");
    if (res.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin123', salt);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Admin User', 'admin@library.com', $1, 'admin')",
        [hash]
      );
      console.log('Default admin created: admin@library.com / admin123');
    }

    // Insert dummy staff and student
    const resStaff = await pool.query("SELECT * FROM users WHERE email = 'staff@library.com'");
    if (resStaff.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('staff123', salt);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Staff User', 'staff@library.com', $1, 'staff')",
        [hash]
      );
      console.log('Default staff created: staff@library.com / staff123');
    }

    const resStudent = await pool.query("SELECT * FROM users WHERE email = 'student@library.com'");
    if (resStudent.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('student123', salt);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Student User', 'student@library.com', $1, 'student')",
        [hash]
      );
      console.log('Default student created: student@library.com / student123');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  }
};

createTables();
