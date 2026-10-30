# 🏢 Real Estate CRM — Complete Setup & Getting Started Guide

A comprehensive, beginner-friendly guide covering all software requirements, installation steps, database seeding, credentials, and troubleshooting to run this project locally.

---

## 📋 Table of Contents
1. [Required Software & System Requirements](#1-required-software--system-requirements)
2. [Project Architecture Overview](#2-project-architecture-overview)
3. [Repository Directory Structure](#3-repository-directory-structure)
4. [Step-by-Step Installation & Setup](#4-step-by-step-installation--setup)
5. [Database Seeding Options](#5-database-seeding-options)
6. [Demo User Credentials](#6-demo-user-credentials)
7. [Running the Application](#7-running-the-application)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. Required Software & System Requirements

Before running the project, make sure you have the following software installed:

| Software | Required Version | Download Link | Purpose |
|---|---|---|---|
| **Node.js** | **v18.x, v20.x (LTS recommended), or v22.x** | [nodejs.org](https://nodejs.org/) | JavaScript runtime for both backend server & frontend tooling (Vite). Includes `npm`. |
| **MongoDB** | **v6.0 or v7.0+** | [MongoDB Community Server](https://www.mongodb.com/try/download/community) | NoSQL database storing firms, users, inventory, bookings, etc. |
| **Modern Web Browser** | Latest Version | Chrome / Edge / Brave / Firefox | Accessing the web application interface. |

### Optional But Highly Recommended Tools:
- **[MongoDB Compass](https://www.mongodb.com/try/download/compass)**: Visual desktop GUI to view and inspect database collections, documents, and records.
- **[Visual Studio Code](https://code.visualstudio.com/)**: Recommended IDE with extensions for JavaScript, React, and Tailwind CSS.
- **[Git](https://git-scm.com/)**: For repository version control.

### Verify Installed Versions
Open **PowerShell** or your terminal and run:
```powershell
node -v      # Must return >= v18.0.0
npm -v       # Must return >= 9.x.x
mongod --version   # (If using local MongoDB Community Server)
```

---

## 2. Project Architecture Overview

This project is a multi-tenant Real Estate CRM supporting four hierarchical roles:

- **Frontend (`my-app/`)**: React 19, Vite, Tailwind CSS v4, React Router v7, Axios.
- **Backend (`server/`)**: Node.js, Express, MongoDB with Mongoose, JWT Authentication (access token + httpOnly refresh cookie), Role-Based Access Control (RBAC).
- **Communication**: Frontend runs on port `5173` and proxies `/api` calls to the backend on port `5000`.

---

## 3. Repository Directory Structure

```text
Real Estate/
├── my-app/                          # Frontend Application (React + Vite)
│   ├── src/
│   │   ├── api/                    # API client wrappers (Axios)
│   │   ├── components/             # Reusable UI components & layouts
│   │   │   └── layout/             # DashboardLayout, ExecutiveLayout
│   │   ├── context/                # AuthContext, ToastContext
│   │   ├── pages/                  # Role-based pages (admin, executive, etc.)
│   │   │   ├── executive/          # Sales Executive specific pages
│   │   │   ├── admin/              # Firm Owner / Admin pages
│   │   │   ├── subadmin/           # Branch Manager pages
│   │   │   └── superadmin/         # Platform Owner pages
│   │   └── routes/                 # ProtectedRoute & role guards
│   ├── package.json
│   └── vite.config.js
│
├── server/                          # Backend API (Express + MongoDB)
│   ├── src/
│   │   ├── config/                 # RBAC matrix, database connection
│   │   ├── controllers/            # Business logic handlers
│   │   ├── middleware/             # Auth, role check, error handler
│   │   ├── models/                 # Mongoose schemas (Customer, Unit, etc.)
│   │   ├── routes/                 # REST API endpoints
│   │   └── utils/                  # Seed scripts & helpers
│   ├── .env.example                # Environment variables template
│   ├── package.json
│   └── uploads/                    # Local storage for uploaded files
│
├── SALES_EXECUTIVE_GUIDE.md         # Detailed executive flow guide
├── README.md                        # High-level overview & endpoints
└── PROJECT_SETUP_GUIDE.md           # This setup file
```

---

## 4. Step-by-Step Installation & Setup

### Step 4.1: Database Setup

#### Option A: Local MongoDB (Default)
Ensure your MongoDB service is running locally on port `27017`:
```powershell
# In PowerShell / Command Prompt (if running as Windows Service, it starts automatically):
net start MongoDB
```

#### Option B: MongoDB Atlas (Cloud)
If you prefer cloud MongoDB:
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Get your connection URI: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/real_estate_crm?retryWrites=true&w=majority`.
3. Put this URI into `server/.env`.

---

### Step 4.2: Backend Configuration & Installation

1. Navigate to the backend folder:
   ```powershell
   cd "d:\Projects\Real Estate\server"
   ```

2. Create a `.env` file from the example (if `.env` does not already exist):
   ```powershell
   copy .env.example .env
   ```

3. Review the `.env` settings:
   ```env
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173
   MONGO_URI=mongodb://127.0.0.1:27017/real_estate_crm

   JWT_ACCESS_SECRET=your_super_secret_access_key_12345
   JWT_REFRESH_SECRET=your_super_secret_refresh_key_12345
   JWT_ACCESS_EXPIRES=15m
   JWT_REFRESH_EXPIRES=7d

   SESSION_IDLE_TIMEOUT_MIN=30

   SEED_SUPERADMIN_NAME=Platform Owner
   SEED_SUPERADMIN_EMAIL=superadmin@crm.local
   SEED_SUPERADMIN_PASSWORD=SuperAdmin@123
   ```

4. Install backend dependencies:
   ```powershell
   npm install
   ```

---

### Step 4.3: Frontend Installation

1. Open a new terminal tab/window and navigate to `my-app`:
   ```powershell
   cd "d:\Projects\Real Estate\my-app"
   ```

2. Install frontend dependencies:
   ```powershell
   npm install
   ```

---

## 5. Database Seeding Options

To populate the database with realistic test data, run one of the following seed scripts from the `server/` directory:

| Command | What It Does | When to Use |
|---|---|---|
| `npm run seed:demo` | **Recommended:** Clears and seeds complete demo dataset (1 Super Admin, 3 Firms, Admins, Sub-Admins, Executives, Builders, Projects, Inventory Units, Customers, Bookings, Loans, and Possession cases). | **First-time setup** or when you want fully interactive test data. |
| `npm run seed` | Seeds only the default Super Admin user account. | When setting up a clean, production-like environment from scratch. |
| `npm run seed:branches` | Seeds branch office records for multi-branch firms. | Multi-branch testing. |

```powershell
cd "d:\Projects\Real Estate\server"
npm run seed:demo
```

---

## 6. Demo User Credentials

When seeded with `npm run seed:demo`, all accounts use the standard password:

> **Universal Password:** `Password@123`  
> *(Super Admin exception: `SuperAdmin@123`)*

| Role | Firm / Company | Email | Password |
|---|---|---|---|
| **Super Admin** | Platform System | `superadmin@crm.local` | `SuperAdmin@123` |
| **Admin** (Firm Owner) | Skyline Realty | `admin@skylinerealty.com` | `Password@123` |
| **Sub-Admin** (Branch Mgr) | Skyline Realty | `subadmin1@skylinerealty.com` | `Password@123` |
| **Sales Executive** | Skyline Realty | `exec1@skylinerealty.com` | `Password@123` |
| **Sales Executive** | Skyline Realty | `exec2@skylinerealty.com` | `Password@123` |
| **Admin** (Firm 2) | Metro Homes | `admin@metrohomes.com` | `Password@123` |
| **Admin** (Firm 3) | Coastal Estates | `admin@coastalestates.com` | `Password@123` |

---

## 7. Running the Application

You need two active terminals to run the system:

### Terminal 1: Backend API
```powershell
cd "d:\Projects\Real Estate\server"
npm run dev
```
*Backend runs on: **`http://localhost:5000`***  
*Health Check endpoint: **`http://localhost:5000/api/health`***

### Terminal 2: Frontend Client
```powershell
cd "d:\Projects\Real Estate\my-app"
npm run dev
```
*Frontend runs on: **`http://localhost:5173`***

### Accessing the Web Application
Open your browser and navigate to:
👉 **`http://localhost:5173`**

Log in using any of the credentials listed in Section 6.

---

## 8. Troubleshooting & FAQs

### Q1: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
- **Cause**: MongoDB is not running on your machine.
- **Fix**: Open Windows Services (`services.msc`), find **MongoDB Server**, and click **Start**. Alternatively, run `net start MongoDB` in an administrative command prompt, or check your `MONGO_URI` in `server/.env`.

### Q2: Port 5000 or 5173 is already in use
- **Cause**: Another process or previous node instance is occupying the port.
- **Fix**: In PowerShell, find and kill the process:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
  ```
  Or change `PORT=5001` in `server/.env` and update the proxy in `my-app/vite.config.js`.

### Q3: `Invalid credentials` when attempting to log in
- **Cause**: The database might not be seeded or was reset.
- **Fix**: Run `npm run seed:demo` inside `server/` to recreate all demo users with `Password@123`.

### Q4: CORS error in browser console
- **Cause**: `CLIENT_URL` in `server/.env` does not match the frontend port.
- **Fix**: Ensure `CLIENT_URL=http://localhost:5173` in `server/.env`.

---

## 📚 Related Documentation
- [README.md](file:///d:/Projects/Real%20Estate/README.md) — Multi-tenant architecture and full API endpoint specifications.
- [SALES_EXECUTIVE_GUIDE.md](file:///d:/Projects/Real%20Estate/SALES_EXECUTIVE_GUIDE.md) — Deep-dive into Sales Executive workflows, pages, and logic.
- [CREDENTIALS.md](file:///d:/Projects/Real%20Estate/CREDENTIALS.md) — Comprehensive user list for all firms.
