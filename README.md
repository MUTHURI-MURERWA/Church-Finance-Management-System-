# ⛪ CFMS – Church Finance Management System

**🚀 Live Access:** [https://church-finance-management-system.onrender.com/](https://church-finance-management-system.onrender.com/)

A multi-tenant backend application for managing church finances, members, and projects.

## Architecture

CFMS is built with a **Multi-Tenant Architecture**, allowing a single instance to serve multiple independent churches securely.
All church data (transactions, members, groups, projects, etc.) is strictly isolated using a `church_id` scope.

## Project Structure
```
cfms-backend/
├── server.js              ← Express app entry point
├── db.js                  ← PostgreSQL connection pool
├── package.json
├── .env.example           ← Copy to .env and fill in values
├── middleware/
│   ├── auth.js            ← JWT token verification
│   └── superadmin.js      ← Super Admin role middleware
├── routes/
│   ├── auth.js            ← Login, change password, reset password
│   ├── members.js         ← Member CRUD + transactions
│   ├── groups.js          ← Group CRUD + members
│   ├── transactions.js    ← Contributions, expenses
│   ├── sunday.js          ← Sunday basket collections
│   ├── projects.js        ← Church projects
│   ├── villages.js        ← Villages list
│   ├── analytics.js       ← Overview & Monthly summaries
│   └── superadmin.js      ← Manage churches and user passwords
└── public/
    └── index.html         ← Complete frontend (served by Express)
```

---

## ✅ Setup Steps

### 1. Install Node.js
Download from https://nodejs.org (v18 or higher recommended)

### 2. Install dependencies
```bash
cd cfms-backend
npm install
```

### 3. Create your .env file
```bash
cp .env.example .env
```
Open `.env` and fill in your PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cfms_db
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password
JWT_SECRET=pick_any_long_random_string_here
PORT=3000
```

### 4. Create the PostgreSQL database
In psql or pgAdmin, run:
```sql
CREATE DATABASE cfms_db;
```

### 5. Start the server
```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

### 6. Initialize Database schemas and seed data
Once the server is running, visit the setup route to initialize all tables and default data.
Open your browser to: **http://localhost:3000/setup**

This will create:
- The multi-tenant schema with constraints.
- A Super Admin account.
- A Sample Church ("My Church") with a Finance Secretary account.
- Default church groups horizontally isolated by `church_id`.
- Sample villages logically categorized.

> **⚠️ WARNING:** Delete or comment out the `/setup` route in `server.js` after initial deployment to prevent unauthorized recreation of your database.

### 7. Open the system
Go to: **http://localhost:3000**

You can login with two default roles:

🔑 **Super Admin:**
*   Church Code: `ADMIN`
*   Password: `admin123`

⛪ **Finance Secretary (Sample Church):**
*   Church Code: `CHURCH001`
*   Password: `admin123`

*(You will be prompted to change default passwords immediately after your first login).*

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Auth** | | |
| POST | `/api/auth/login` | Login with Church Code + Password |
| POST | `/api/auth/change-password` | Initial password change or user-initiated reset |
| POST | `/api/auth/forgot-password` | Contact super admin (secretary function) |
| **Super Admin** | | |
| GET | `/api/superadmin/churches` | Get list of all registered churches |
| POST | `/api/superadmin/churches` | Register a new church + system generates a secretary login |
| POST | `/api/superadmin/reset-password`| Reset any church's secretary password |
| **Members** | | |
| GET | `/api/members` | All members for the logged-in church |
| GET | `/api/members/search?id=...`| Member Contribution Search by ID |
| GET | `/api/members/:memberId` | Single member details |
| POST | `/api/members` | Register new member |
| **Finance & Transactions** | | |
| GET | `/api/transactions` | All transactions (filtered by query) |
| POST | `/api/transactions` | Record new contribution/expense/tithe |
| GET | `/api/analytics/summary` | Overview and total by types |
| **Others** | | |
| GET/POST | `/api/groups` | Manage Groups & Memberships |
| GET/POST | `/api/projects` | Manage Building/Development Projects |
| GET/POST | `/api/sunday` | Sunday Tithes and Offerings tracking |

---

## 🔐 Security Notes
- Passwords are hashed with **bcrypt** (never stored in plain text)
- All protected routes require a **JWT token** (sent as `Authorization: Bearer <token>`) containing the authenticated `church_id`.
- Queries are strictly scoped to `req.user.church_id` ensuring Multi-Tenant Data Isolation.
- Tokens expire after **8 hours**.

---

## 🚀 Deployment (Render.com)

1. Connect your Github Repository to Render.
2. Create a new **Web Service**.
3. Set the build command to `npm install`.
4. Set the start command to `npm start`.
5. Add all standard Environment Variables in Render's dashboard (`DB_HOST`, `DB_PASSWORD`, `JWT_SECRET`, etc.). For database hosting, Render's PostgreSQL managed instances are recommended.
6. Trigger manual deploy.

*(Note: If migrating from previous single-tenant versions, please run the included `migration_multitenant.js` tool against your database first, or use the `/setup` endpoint for fresh deployments).*
