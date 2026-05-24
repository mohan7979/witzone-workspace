# Witzone Workspace — Phase 1

## Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env        # Fill in your MySQL + SMTP details
npm install
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### 3. Desktop Agent (per employee machine)
```bash
cd desktop-agent
pip install -r requirements.txt
python agent.py
# System tray icon appears — click Login to authenticate
```

### 4. Build agent executable
```bash
cd desktop-agent
chmod +x build.sh
./build.sh
# dist/WitzoneWorkspaceAgent — distribute to all employee machines
```

## Default Admin Setup
The first HR user must be created directly in MySQL:
```sql
INSERT INTO users (id, employee_id, first_name, last_name, email, password, role, status)
VALUES (UUID(), 'EMP0001', 'Admin', 'HR', 'hr@company.com',
  '$2a$12$...bcrypt_hash_of_password...', 'hr', 'active');
```
Or use the seed script: `npm run migrate`

## Deployment (Railway)

1. **Backend**: Push `backend/` folder to Railway. Set env vars from `.env.example`.
2. **Frontend**: Push `frontend/` folder to Railway. Set `VITE_API_URL` if backend is on a different domain.
3. **Database**: Add MySQL plugin in Railway dashboard or use PlanetScale free tier.

## Architecture
```
frontend/     React + Vite + Tailwind (Employee & HR portals)
backend/      Node.js + Express + Sequelize (REST API + Socket.io)
desktop-agent/ Python tray app (idle monitoring per machine)
```
