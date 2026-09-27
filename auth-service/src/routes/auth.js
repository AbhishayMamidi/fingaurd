const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const db = require('../db');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');
const { authLoginsTotal, authRegistrationsTotal } = require('../metrics');

const router = express.Router();

// Helper to sign JWT
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// POST /register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body || {};

    // Input Validation
    if (!email || !validator.isEmail(String(email).trim())) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'A valid email address is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Password must be at least 8 characters long.',
      });
    }

    const cleanFullName = String(full_name || '').trim();
    if (!cleanFullName || cleanFullName.length < 2) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Full name must be at least 2 characters long.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'ConflictError',
        message: 'An account with this email address already exists.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, created_at`,
      [normalizedEmail, passwordHash, cleanFullName]
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser);

    authRegistrationsTotal.inc({ status: 'success' });
    console.log(`[auth-service] User registered successfully: user_id=${newUser.id}`);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        createdAt: newUser.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);

    if (result.rows.length === 0) {
      authLoginsTotal.inc({ status: 'failure' });
      // Prevent user enumeration by returning generic error
      return res.status(401).json({
        error: 'AuthenticationError',
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(String(password), user.password_hash);
    if (!isMatch) {
      authLoginsTotal.inc({ status: 'failure' });
      return res.status(401).json({
        error: 'AuthenticationError',
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);
    authLoginsTotal.inc({ status: 'success' });
    console.log(`[auth-service] User logged in: user_id=${user.id}`);

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /me
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'NotFoundError',
        message: 'User profile not found.',
      });
    }

    const user = result.rows[0];
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /verify - token verification utility
router.post('/verify', (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ valid: false, message: 'Token is required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return res.json({ valid: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ valid: false, message: err.message });
  }
});

module.exports = router;
