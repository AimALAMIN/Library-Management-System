const express = require('express');
const pool = require('../db');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (roles = []) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  next();
};

// 1. Request Book (Student) or Issue Directly (Staff)
router.post('/', auth, async (req, res) => {
  const { book_id, student_id } = req.body;
  const targetStudentId = req.user.role === 'student' ? req.user.id : student_id;
  const status = req.user.role === 'student' ? 'pending' : 'issued';

  try {
    // Check if available
    const bookRes = await pool.query('SELECT available_copies FROM books WHERE id = $1', [book_id]);
    if (bookRes.rows.length === 0) return res.status(404).json({ message: 'Book not found' });
    if (bookRes.rows[0].available_copies <= 0) return res.status(400).json({ message: 'No copies available' });

    // Calculate return date
    const settingsRes = await pool.query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsRes.rows[0];
    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + settings.max_issue_duration);

    await pool.query('BEGIN');
    const issueRes = await pool.query(
      'INSERT INTO issued_books (book_id, student_id, issued_date, return_date, status) VALUES ($1, $2, CURRENT_DATE, $3, $4) RETURNING *',
      [book_id, targetStudentId, returnDate, status]
    );

    if (status === 'issued') {
      await pool.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = $1', [book_id]);
    }

    await pool.query('COMMIT');
    res.status(201).json(issueRes.rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. Approve Issue (Staff/Admin)
router.put('/:id/approve', auth, authorize(['admin', 'staff']), async (req, res) => {
  try {
    await pool.query('BEGIN');
    const issueRes = await pool.query('SELECT * FROM issued_books WHERE id = $1', [req.params.id]);
    if (issueRes.rows.length === 0) throw new Error('Not found');
    const issue = issueRes.rows[0];

    if (issue.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be approved' });

    // Update status and decrement book count
    await pool.query('UPDATE issued_books SET status = $1 WHERE id = $2', ['issued', req.params.id]);
    await pool.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = $1', [issue.book_id]);

    await pool.query('COMMIT');
    res.json({ message: 'Issue approved' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  }
});

// 3. Request Return (Student)
router.post('/:id/request-return', auth, async (req, res) => {
  try {
    const issueRes = await pool.query('SELECT * FROM issued_books WHERE id = $1', [req.params.id]);
    if (issueRes.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    const issue = issueRes.rows[0];

    if (req.user.role === 'student' && issue.student_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    if (issue.status !== 'issued') return res.status(400).json({ message: 'Book is not in issued state' });

    await pool.query('UPDATE issued_books SET status = $1 WHERE id = $2', ['return_pending', req.params.id]);
    res.json({ message: 'Return request submitted. Please return the book physically.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 4. Confirm Return (Staff/Admin)
router.post('/:id/confirm-return', auth, authorize(['admin', 'staff']), async (req, res) => {
  try {
    await pool.query('BEGIN');
    const issueRes = await pool.query('SELECT * FROM issued_books WHERE id = $1', [req.params.id]);
    if (issueRes.rows.length === 0) throw new Error('Not found');
    const issue = issueRes.rows[0];

    if (issue.status !== 'return_pending' && issue.status !== 'issued') {
      return res.status(400).json({ message: 'Cannot confirm return in current state' });
    }

    // Calculate fine
    let fine = 0;
    const now = new Date();
    const returnDate = new Date(issue.return_date);
    if (now > returnDate) {
      const settingsRes = await pool.query('SELECT * FROM settings WHERE id = 1');
      fine = Math.ceil(Math.abs(now - returnDate) / (1000 * 60 * 60 * 24)) * settingsRes.rows[0].fine_per_day;
    }

    await pool.query(
      'UPDATE issued_books SET status = $1, actual_return_date = CURRENT_DATE, fine = $2 WHERE id = $3',
      ['returned', fine, req.params.id]
    );
    await pool.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = $1', [issue.book_id]);

    await pool.query('COMMIT');
    res.json({ message: 'Return confirmed', fine });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  }
});

// View all (with filters)
router.get('/', auth, async (req, res) => {
  try {
    let query = `
      SELECT i.*, b.title as book_title, u.name as student_name, u.email as student_email 
      FROM issued_books i
      JOIN books b ON i.book_id = b.id
      JOIN users u ON i.student_id = u.id
    `;
    let params = [];
    if (req.user.role === 'student') {
      query += ' WHERE i.student_id = $1';
      params.push(req.user.id);
    }
    query += ' ORDER BY i.id DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
