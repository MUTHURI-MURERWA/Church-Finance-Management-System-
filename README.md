# ⛪ CFMS – Church Finance Management System

## Project Structure
```
cfms-backend/
├── server.js              ← Express app entry point
├── db.js                  ← PostgreSQL connection pool
├── seed.js                ← Database seeder (run once)
├── package.json
├── .env.example           ← Copy to .env and fill in values
├── middleware/
│   └── auth.js            ← JWT token verification
├── routes/
│   ├── auth.js            ← Login, change password
│   ├── members.js         ← Member CRUD + transactions
│   ├── groups.js          ← Group CRUD + members
│   ├── transactions.js    ← Contributions, expenses, summaries
│   ├── sunday.js          ← Sunday basket collections
│   ├── projects.js        ← Church projects
│   └── villages.js        ← Villages list
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
Then run all the CREATE TABLE statements from the schema you already created.

### 5. Seed the database (run ONCE)
```bash
node seed.js
```
This creates:
- The Finance Secretary user (password: `admin123`)
- Default church groups (Youths, Women Fellowship, etc.)
- Sample villages

### 6. Start the server
```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

### 7. Open the system
Go to: **http://localhost:3000**

Login with password: `admin123`
You will be prompted to change it immediately.

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with password |
| POST | `/api/auth/change-password` | Change password (auth required) |
| GET | `/api/members` | All members with groups & village |
| GET | `/api/members/:memberId` | Single member (e.g. "001") |
| POST | `/api/members` | Register new member |
| GET | `/api/members/:memberId/transactions` | Member's transaction history |
| GET | `/api/groups` | All groups with member count |
| GET | `/api/groups/:id/members` | Members in a group |
| POST | `/api/groups` | Register new group |
| GET | `/api/transactions` | All transactions (supports ?type=&limit=) |
| POST | `/api/transactions` | Record contribution or expense |
| GET | `/api/transactions/summary/overview` | Total by type |
| GET | `/api/transactions/summary/monthly` | Monthly income/expense |
| GET | `/api/sunday` | All Sunday collections |
| GET | `/api/sunday/last` | Most recent Sunday |
| GET | `/api/sunday/totals` | Total Sunday offering & tithing |
| POST | `/api/sunday` | Record Sunday collection |
| GET | `/api/projects` | All projects with collected amount |
| POST | `/api/projects` | Add new project |
| GET | `/api/villages` | All villages |
| POST | `/api/villages` | Add new village |

---

## 🔐 Security Notes
- Passwords are hashed with **bcrypt** (never stored in plain text)
- All protected routes require a **JWT token** (sent as `Authorization: Bearer <token>`)
- Tokens expire after **8 hours**
- The frontend automatically logs out if the token is invalid or expired

---

## 🚀 Deploy to a Server (Optional)
1. Copy the entire `cfms-backend` folder to your server
2. Install Node.js on the server
3. Run `npm install --production`
4. Set up your `.env` with the server's PostgreSQL details
5. Use **PM2** to keep it running:
   ```bash
   npm install -g pm2
   pm2 start server.js --name cfms
   pm2 save
   pm2 startup
   ```
6. Point your domain/IP to port 3000 (or use Nginx as a reverse proxy on port 80)
