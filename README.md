# 🧠 AI Task Manager

> A full-stack intelligent task management app powered by Google Gemini AI, Firebase, and real-time alarms — built with React + Node.js.

<div align="center">

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-10-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-Pro-4285F4?style=for-the-badge&logo=google&logoColor=white)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Priority Detection** | Google Gemini analyzes task text and auto-assigns priority (High / Medium / Low) |
| 📅 **Smart Scheduling** | Extracts dates and times from natural language ("meeting at 3pm today") |
| 🔄 **Daily Recurring Tasks** | Tag tasks as daily — they automatically reset every morning |
| ⏰ **Real-time Alarms** | Browser alarms fire 15 minutes before any task is due |
| 📊 **Analytics Dashboard** | Visual breakdown of tasks by priority and category |
| 🗂️ **Smart Filtering** | Filter by Active, Upcoming, or High Priority with time-sorted ordering |
| 🔐 **Secure Auth** | Firebase Authentication (email/password) with persistent sessions |
| 📱 **Responsive UI** | Works on desktop and mobile with animated particle background |

---

### Login Page
- Animated blue particle network on white background
- Split layout: feature highlights on left, auth card on right
- Login / Sign Up tab switcher

### Dashboard
- Sidebar navigation (Tasks · Completed · Analytics)
- Stats cards: Total, Completed, Active, High Priority
- AI Day Planner — shows today's scheduled tasks chronologically
- Task cards with priority, category, daily badges, and due time

---

## 🗂️ Project Structure

```
ai-task-manager/
│
├── frontend/                          # React + Vite app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Auth.jsx               # Login / Sign Up page
│   │   │   └── Dashboard.jsx          # Main app dashboard
│   │   ├── components/
│   │   │   └── AlarmSystem.jsx        # Browser alarm popups
│   │   ├── services/
│   │   │   ├── firebaseAuth.js        # Auth (login, register, logout)
│   │   │   ├── firebaseDB.js          # Firestore task CRUD
│   │   │   └── geminiService.js       # AI analysis (calls backend)
│   │   ├── stores/
│   │   │   └── authStore.js           # Zustand auth state
│   │   ├── config/
│   │   │   └── firebase.js            # Firebase client SDK init
│   │   ├── styles/
│   │   │   └── global.css             # Tailwind + custom utilities
│   │   ├── App.jsx                    # Router + global providers
│   │   └── main.jsx                   # React entry point
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                           # Node.js + Express API
│   ├── config/
│   │   └── firebase.js                # Firebase Admin SDK init
│   ├── middleware/
│   │   └── auth_middleware.js         # JWT token verification
│   ├── routes/
│   │   ├── task_routes.js             # GET/POST/PUT/DELETE /api/tasks
│   │   ├── ai_routes.js               # POST /api/ai/analyze-task
│   │   └── notification_routes.js     # Notification CRUD
│   ├── services/
│   │   ├── aiAgent_service.js         # Gemini AI integration
│   │   ├── reminder_service.js        # Cron job — fires alarms
│   │   └── socket_service.js          # Socket.IO real-time events
│   ├── server.js                      # Express app entry point
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Firebase](https://console.firebase.google.com/) project
- A [Gemini API key](https://aistudio.google.com/app/apikey) *(optional — app works without it)*

---

### Step 1 — Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** → Sign-in method → **Email/Password**
3. Enable **Firestore Database** → Start in test mode
4. Go to **Project Settings → Service Accounts → Generate new private key**
   - Save the downloaded file as `backend/serviceAccountKey.json`
5. Go to **Project Settings → General → Your apps → Add app → Web**
   - Copy the config object (you'll need it for the frontend `.env`)

---

### Step 2 — Frontend Setup

```bash
cd ai-task-manager/frontend
cp .env.example .env
```

Open `.env` and fill in your Firebase web config:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_URL=http://localhost:5000/api
```

Then install and run:

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

### Step 3 — Backend Setup

```bash
cd ai-task-manager/backend
cp .env.example .env
```

Open `.env` and fill in:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_key_here
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FRONTEND_URL=http://localhost:5173
```

Then install and run:

```bash
npm install
npm run dev
# → http://localhost:5000
```

> **Note:** The app works without the backend running — tasks, auth, and priority detection all still work via Firebase and local keyword matching. The backend adds Gemini AI and real-time alarm notifications.

---

### Step 4 — Firestore Security Rules

In Firebase Console → Firestore → **Rules** tab, paste:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /tasks/{taskId} {
      allow read, update, delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }

    match /users/{userId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;
    }

    match /notifications/{notifId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }
  }
}
```

Click **Publish**.

---

## 🔧 How It Works

### Task Creation Flow

```
User types task
      ↓
Frontend calls backend /api/ai/analyze-task
      ↓
Backend sends to Gemini Pro →  priority, category, dueDate, tags
      ↓                        (falls back to keyword matching if Gemini is down)
Task saved to Firestore
      ↓
UI updates instantly
```

### Daily Task Reset Flow

```
User marks daily task as "done"
      ↓
completedDate = "YYYY-MM-DD" saved to Firestore
      ↓
Every minute: app checks all daily tasks
      ↓
If completedDate < today → reset status to "todo"
      ↓
Task reappears in ACTIVE tab and AI Day Planner next morning
```

### Alarm Flow

```
Backend cron runs every minute
      ↓
Scans Firestore for tasks due in next 15 minutes
      ↓
Emits Socket.IO event to user's browser
      ↓
AlarmSystem component shows popup notification
```

---

## 🧠 AI Features

The app uses **Google Gemini Pro** for:

- **Priority analysis** — classifies tasks as High / Medium / Low based on context, urgency words, and due dates
- **Category detection** — Work, Health, Learning, or Personal
- **Natural language dates** — understands "tomorrow at 2pm", "today at 10am"
- **Smart scheduling** — orders tasks by priority + due date

All AI calls include a **keyword-matching fallback** so the app works even without a Gemini key.

---

## 📝 Task Input Examples

```
"Urgent client presentation at 3pm today"
→ Priority: HIGH | Category: WORK | Due: today 3:00 PM

"daily gym at 7am"
→ Priority: LOW | Category: HEALTH | Tag: 🔄 DAILY | Resets every morning

"Study for exam tomorrow"
→ Priority: MEDIUM | Category: LEARNING | Due: tomorrow

"Buy groceries this weekend"
→ Priority: LOW | Category: PERSONAL
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| State management | Zustand |
| Routing | React Router v6 |
| Icons | Lucide React |
| Notifications | React Hot Toast |
| Backend framework | Node.js + Express |
| Real-time | Socket.IO |
| Scheduler | node-cron |
| Database | Firebase Firestore |
| Authentication | Firebase Auth |
| AI | Google Gemini Pro |
| Deployment (frontend) | Vercel |

---

## 🚢 Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
# Upload the dist/ folder to Vercel
# Or connect your GitHub repo and Vercel auto-deploys
```

Set these environment variables in Vercel dashboard (same as your `.env`).

### Backend → Railway / Render

1. Push backend folder to GitHub
2. Connect to [Railway](https://railway.app) or [Render](https://render.com)
3. Set all environment variables from `.env`
4. For `serviceAccountKey.json`, paste the JSON contents into `FIREBASE_SERVICE_ACCOUNT_JSON` env var instead

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page on `localhost:5173` | Make sure you ran `npm run dev` not opened `index.html` directly |
| "Firebase: No app" error | Check your `.env` has all `VITE_FIREBASE_*` values filled in |
| Tasks not loading | Check Firestore security rules are published |
| AI badge not showing | Backend may not be running — tasks still work with keyword fallback |
| Daily tasks not resetting | Check `completedDate` field is being saved (open Firestore in Firebase Console) |
| `Cannot GET /` on backend | Normal — open `localhost:5000/api/health` to confirm backend is alive |

---
