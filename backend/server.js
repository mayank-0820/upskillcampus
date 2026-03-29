const express = require('express');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const FRONTEND_DIR = path.resolve(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

const JWT_SECRET = process.env.JWT_SECRET || 'preppulse_cms_secret_2024';
const PORT = Number(process.env.PORT) || 5001;

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'blogs.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, port: PORT });
});

// ─── DB CONNECTION ────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '#MyRootApp@0820!',
  database: process.env.DB_NAME || 'cms_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// ─── INIT DB ──────────────────────────────────────────────────────────────────
async function initDB() {
  const conn = await pool.getConnection();
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content LONGTEXT NOT NULL,
      author_id INT NOT NULL,
      author_email VARCHAR(255),
      slug VARCHAR(500) UNIQUE,
      published BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      layout LONGTEXT NOT NULL,
      author_id INT NOT NULL,
      published BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  conn.release();
  console.log('✅ Database tables ready');
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (email, password) VALUES (?, ?)', [email, hashed]
    );
    const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.insertId, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: rows[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: rows[0].id, email } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) {
      // Remove any old tokens for this email
      await pool.execute('DELETE FROM password_resets WHERE email = ?', [email]);

      const resetToken = crypto.randomBytes(32).toString('hex');
      await pool.execute(
        'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
        [email, resetToken]
      );

      console.log(`[RESET TOKEN] email=${email} token=${resetToken}`);

      // Send reset email via Gmail
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASS,
        },
      });

      const resetLink = `http://localhost:${PORT}/reset-password.html?token=${resetToken}`;

      await transporter.sendMail({
        from: '"InkCMS" <noreply@inkcms.com>',
        replyTo: process.env.GMAIL_USER,
        to: email,
        subject: 'Ink.CMS — Password Reset',
        html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p><p>If you did not request this, ignore this email.</p>`,
      });
    }
    res.json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.json({ message: 'If this email exists, a reset link has been sent.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });

    const [rows] = await pool.execute(
      'SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset link.' });

    const email = rows[0].email;
    const hashed = await bcrypt.hash(password, 10);
    await pool.execute('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
    await pool.execute('DELETE FROM password_resets WHERE email = ?', [email]);

    res.json({ message: 'Password reset successful.' });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── BLOG ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/posts', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, content, author_email, slug, created_at FROM posts WHERE published = 1 ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/posts/:slug', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM posts WHERE slug = ?', [req.params.slug]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/posts', authMiddleware, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  try {
    const [result] = await pool.execute(
      'INSERT INTO posts (title, content, author_id, author_email, slug) VALUES (?, ?, ?, ?, ?)',
      [title, content, req.user.id, req.user.email, slug]
    );
    res.json({ id: result.insertId, slug, message: 'Post published!' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/posts/:id', authMiddleware, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  try {
    const [result] = await pool.execute(
      'UPDATE posts SET title = ?, content = ? WHERE id = ? AND author_id = ?',
      [title, content, req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Post not found or not authorized' });
    }
    res.json({ message: 'Post updated!' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
  try {
    await pool.execute('DELETE FROM posts WHERE id = ? AND author_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PAGE BUILDER ROUTES ──────────────────────────────────────────────────────
function parseLayout(layout) {
  if (Array.isArray(layout)) return layout;
  if (typeof layout !== 'string') return [];
  try {
    const parsed = JSON.parse(layout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

app.get('/api/pages', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, created_at FROM pages WHERE published = 1 ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/pages/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid page id' });
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, layout, created_at FROM pages WHERE id = ? AND published = 1',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Page not found' });
    const row = rows[0];
    res.json({ ...row, layout: parseLayout(row.layout) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/my-pages', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, layout, published, created_at FROM pages WHERE author_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows.map(r => ({ ...r, layout: parseLayout(r.layout) })));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/pages', authMiddleware, async (req, res) => {
  const { title, layout } = req.body;
  if (!title || !layout) return res.status(400).json({ error: 'Title and layout required' });
  const normalizedLayout = parseLayout(layout);
  if (!normalizedLayout.length) return res.status(400).json({ error: 'Add at least one block' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO pages (title, layout, author_id) VALUES (?, ?, ?)',
      [title, JSON.stringify(normalizedLayout), req.user.id]
    );
    res.json({ id: result.insertId, message: 'Page saved!' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/pages/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid page id' });
  const { title, layout } = req.body;
  if (!title || !layout) return res.status(400).json({ error: 'Title and layout required' });
  const normalizedLayout = parseLayout(layout);
  if (!normalizedLayout.length) return res.status(400).json({ error: 'Add at least one block' });

  try {
    const [result] = await pool.execute(
      'UPDATE pages SET title = ?, layout = ? WHERE id = ? AND author_id = ?',
      [title, JSON.stringify(normalizedLayout), id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Page not found or not authorized' });
    res.json({ message: 'Page updated!' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/pages/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid page id' });
  try {
    const [result] = await pool.execute(
      'DELETE FROM pages WHERE id = ? AND author_id = ?',
      [id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Page not found or not authorized' });
    res.json({ message: 'Page deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large. Compress images or use smaller files.' });
  }
  if (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
  next();
});

// ─── START ────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 CMS Server running on http://localhost:${PORT}`));
});
