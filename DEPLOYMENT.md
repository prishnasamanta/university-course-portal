# 🚀 Render Cloud Deployment Guide (Backend API + Frontend)

This guide provides step-by-step instructions for deploying your **University Course Portal Backend API** to **Render** ([render.com](https://render.com)) connected to live **Firebase Firestore**.

---

## 🛠️ Step 1: Push Project to GitHub

Make sure your project repository is committed and pushed to GitHub:
```bash
git add .
git commit -m "Configure Render deployment and Firebase Firestore"
git push origin main
```

---

## ⚡ Step 2: Deploy Backend API on Render (2 Simple Options)

### Option A: Using Render Blueprints (Automatic 1-Click Setup)
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository (`university-course-portal`).
4. Render will automatically detect the [`render.yaml`](file:///c:/Users/Prishna%20Samanta/Projects/university-course-portal/render.yaml) blueprint!
5. In the Environment Variables prompt:
   - `FIREBASE_CLIENT_EMAIL`: Your client email from `serviceAccountKey.json`.
   - `FIREBASE_PRIVATE_KEY`: Your private key string from `serviceAccountKey.json`.
6. Click **Apply**. Render will build and deploy your API!

---

### Option B: Manual Web Service Setup on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) > **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Fill in the following settings:

| Setting | Value |
|---|---|
| **Name** | `university-portal-api` |
| **Root Directory** | `server` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

4. Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DB_TYPE` | `firebase` |
| `FIREBASE_PROJECT_ID` | `university-reg-portal` |
| `FIREBASE_CLIENT_EMAIL` | *(From your serviceAccountKey.json)* |
| `FIREBASE_PRIVATE_KEY` | *(From your serviceAccountKey.json)* |

5. Click **Create Web Service**. 
   Render will deploy your server and provide a live URL like:  
   👉 `https://university-portal-api.onrender.com`

---

## 🌐 Step 3: Connect Frontend to Render API

1. In `client/.env.production` (or `client/.env`), set:
   ```env
   VITE_API_URL=https://university-portal-api.onrender.com/api
   ```
2. Build and deploy frontend to Firebase Hosting:
   ```bash
   cd client
   npm run build
   npx firebase-tools deploy --only hosting
   ```

🎉 Both your **Backend API on Render** and **Frontend Web App on Firebase Hosting** are live in the cloud!
