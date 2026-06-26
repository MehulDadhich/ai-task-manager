const { getAdmin } = require('../config/firebase');

function initializeSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const admin = getAdmin();
      const decoded = await admin.auth().verifyIdToken(token);
      socket.userId = decoded.uid;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.userId})`);
    socket.join(`user:${socket.userId}`);

    socket.on('alarm:acknowledge', ({ alarmId }) => {
      console.log(`Alarm acknowledged: ${alarmId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initializeSocket };
