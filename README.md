# AI Task Manager

A full-stack task manager with Firebase, AI-powered priority detection (Gemini), real-time alarms via Socket.IO, and a React + Tailwind frontend.

---

## 📁 Project Structure

```
ai-task-manager/
├── frontend/          ← React + Vite + Tailwind
└── backend/           ← Node.js + Express + Firebase Admin
```

---

## 🚀 Quick Start

### 1. Firebase Setup (required)
1. Go to https://console.firebase.google.com
2. Create a new project
3. Enable **Authentication** → Email/Password
4. Enable **Firestore Database** (start in test mode)
5. Download a **Service Account Key** (Project Settings → Service Accounts → Generate new private key) and save as `backend/serviceAccountKey.json`
6. Copy the **Web App config** (Project Settings → General → Your apps)

---

### 2. Gemini API Key (optional, for AI features)
1. Go to https://aistudio.google.com/app/apikey
2. Create an API key

---

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in your Firebase web config values in .env
npm install
npm run dev
```

---

### 4. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in GEMINI_API_KEY and FIREBASE_PROJECT_ID in .env
# Place your serviceAccountKey.json in the backend/ folder
npm install
npm run dev
```

---

## 🔧 Environment Variables

### frontend/.env
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_URL=http://localhost:5000/api
```

### backend/.env
```
PORT=5000
GEMINI_API_KEY=...
FIREBASE_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FRONTEND_URL=http://localhost:5173
```

---

## ✨ Features

- 🔐 Firebase Auth (email/password)
- 📝 Task CRUD with Firestore
- 🤖 Gemini AI priority & category detection
- ⏰ Alarm system (browser + backend cron)
- 📊 Analytics dashboard
- 🔄 Daily recurring tasks
- 📅 AI Day Planner

---

## 🔒 Firestore Security Rules (paste in Firebase Console)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /notifications/{notifId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, React Router |
| Backend | Node.js, Express, Socket.IO, node-cron |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| AI | Google Gemini Pro |
