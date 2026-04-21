const express = require('express');
const pool = require('../db');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

// Middleware to protect routes
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// Get all books (Search/View) - All roles
router.get('/', auth, async (req, res) => {
  try {
    const searchQuery = req.query.q || '';
    let query = 'SELECT * FROM books';
    let params = [];
    
    if (searchQuery) {
      query += ' WHERE title ILIKE $1 OR author ILIKE $1';
      params.push(`%${searchQuery}%`);
    }
    query += ' ORDER BY id ASC';

    const books = await pool.query(query, params);
    res.json(books.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a book - Admin, Staff
router.post('/', auth, authorize(['admin', 'staff']), async (req, res) => {
  const { title, author, total_copies } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO books (title, author, total_copies, available_copies) VALUES ($1, $2, $3, $3) RETURNING *',
      [title, author, total_copies]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a book - Admin, Staff
router.put('/:id', auth, authorize(['admin', 'staff']), async (req, res) => {
  const { title, author, total_copies, available_copies } = req.body;
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE books SET title = $1, author = $2, total_copies = $3, available_copies = $4 WHERE id = $5 RETURNING *',
      [title, author, total_copies, available_copies, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Book not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a book - Admin, Staff
router.delete('/:id', auth, authorize(['admin', 'staff']), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM books WHERE id = $1', [id]);
    res.json({ message: 'Book deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
