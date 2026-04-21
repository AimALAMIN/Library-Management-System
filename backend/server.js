const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Import Routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const issueRoutes = require('./routes/issues');
const userRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);

// Basic catch-all to serve index.html (Express 5.0 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
