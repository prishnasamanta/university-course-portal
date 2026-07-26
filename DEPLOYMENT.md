# 🚀 Unified Single-URL Full-Stack Render Deployment

Your entire application (React Web UI + Express API Backend + Firebase Database) is now configured to run under **ONE single URL** on Render.

---

## 🎯 Single URL Architecture

| Component | URL Path | Description |
|---|---|---|
| 🖥️ **Full Web Application (UI)** | `https://university-portal-api.onrender.com/` | Interactive React frontend website |
| ⚙️ **Backend API** | `https://university-portal-api.onrender.com/api/...` | Express API endpoints |
| 🗄️ **Database** | Firebase Firestore | Cloud data persistence |

---

## 📋 Render Settings (If setting up manually)

If you created your service manually on Render, update your Web Service settings in **Render Dashboard**:

| Setting Field | Exact Value |
|---|---|
| **Root Directory** | *(Leave Empty / Blank)* |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |

Render will automatically run `npm run build` to compile the React UI, install dependencies, and start the server.

---

## 🔑 Login Credentials

Open your single Render URL (`https://university-portal-api.onrender.com`):

| Role | Email | Password |
|---|---|---|
| **Student** | `alice@student.uni.edu` | `student123` |
| **Instructor** | `dr.smith@uni.edu` | `inst123` |
| **Academic Staff** | `staff@uni.edu` | `staff123` |
| **Dept Head (HOD)** | `head@uni.edu` | `head123` |
| **Admin** | `admin@uni.edu` | `admin123` |
