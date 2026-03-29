# Ink.CMS — Setup Guide

## What's included
- `frontend/` — All HTML pages (Register, Login, All Blogs, Editor, Page Builder)
- `backend/` — Node.js + MySQL REST API

---

## Step 1: MySQL Setup

Open MySQL and run:

```sql
CREATE DATABASE quillora_db;
```

That's it! The server auto-creates the tables on first run.

---

## Step 2: Backend Setup

```bash
cd backend
npm install
```

Edit `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password_here
DB_NAME=quillora_db
JWT_SECRET=any_random_string_here
```

Start the server:
```bash
npm start
# or for auto-restart:
npm run dev
```

Server runs at: http://localhost:5002

---

## Step 3: Frontend

Open `frontend/blogs.html` in your browser (use Live Server in VS Code).

Or serve it with:
```bash
cd frontend
npx serve .
```

---

## Pages

| Page | File | Auth Required |
|------|------|--------------|
| All Blogs | `blogs.html` | No |
| Register | `register.html` | No |
| Login | `login.html` | No |
| Blog Editor | `editor.html` | Yes |
| Page Builder | `builder.html` | Yes |
| Public Built Page | `pages.html?id=<pageId>` | No |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/register | No | Create account |
| POST | /api/login | No | Login |
| GET | /api/posts | No | Get all posts |
| POST | /api/posts | Yes | Create post |
| DELETE | /api/posts/:id | Yes | Delete post |
| GET | /api/pages | No | Get all pages |
| GET | /api/pages/:id | No | Get one published page |
| GET | /api/my-pages | Yes | Get logged-in user's pages |
| POST | /api/pages | Yes | Save page |
| PUT | /api/pages/:id | Yes | Update own page |
| DELETE | /api/pages/:id | Yes | Delete own page |

---

## Tech Stack
- **Frontend**: HTML, CSS, Vanilla JS, Quill.js (rich text editor)
- **Backend**: Node.js, Express.js
- **Database**: MySQL (via mysql2)
- **Auth**: JWT + bcrypt

---

## Java (Safe Approach)

A ready Java starter is included in `java-safe-integration/`:

- `ReadOnlyJdbcCheck` (JDBC read-only)
- `ApiWriteDemo` (writes through Node API)

See:
- `java-safe-integration/README.md`
