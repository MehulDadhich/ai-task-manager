require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const cron = require('node-cron');

const taskRoutes = require('./routes/task_routes');
const aiRoutes = require('./routes/ai_routes');
const notificationRoutes = require('./routes/notification_routes');
const { initializeSocket } = require('./services/socket_service');
const { checkReminders } = require('./services/reminder_service');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Socket.IO
initializeSocket(io);

// Cron: check reminders every minute
cron.schedule('* * * * *', () => checkReminders(io));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`\n🚀 Backend running on http://localhost:${PORT}\n`));
