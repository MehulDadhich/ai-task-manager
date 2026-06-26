const { getAdmin } = require('../config/firebase');

const REMINDER_LEAD_MINUTES = 15;

async function checkReminders(io) {
  try {
    const admin = getAdmin();
    const db = admin.firestore();
    const now = new Date();

    const upcoming = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60 * 1000);

    const snap = await db.collection('tasks')
      .where('status', '!=', 'done')
      .get();

    snap.docs.forEach(async (doc) => {
      const task = { id: doc.id, ...doc.data() };
      if (!task.dueDate) return;

      const due = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      const diffMin = (due - now) / 60000;

      if (diffMin >= 0 && diffMin <= REMINDER_LEAD_MINUTES) {
        // Emit alarm via socket
        io.to(`user:${task.userId}`).emit('alarm:trigger', {
          taskId: task.id,
          task,
          message: `"${task.title}" is due in ${Math.round(diffMin)} minutes!`,
          alarmLevel: task.priority === 'high' ? 'HIGH' : 'MEDIUM',
        });

        // Create notification
        await db.collection('notifications').add({
          userId: task.userId,
          taskId: task.id,
          title: task.title,
          message: `Due in ${Math.round(diffMin)} minutes`,
          read: false,
          createdAt: new Date(),
        });
      } else if (diffMin < 0 && diffMin > -5) {
        io.to(`user:${task.userId}`).emit('alarm:overdue', {
          taskId: task.id,
          task,
          message: `"${task.title}" is OVERDUE!`,
          alarmLevel: 'CRITICAL',
        });
      }
    });
  } catch (err) {
    console.error('Reminder check error:', err.message);
  }
}

module.exports = { checkReminders };
