const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth_middleware');
const { getAdmin } = require('../config/firebase');

router.use(authMiddleware);

const db = () => getAdmin().firestore();

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const snap = await db().collection('tasks')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const task = { ...req.body, userId: req.user.uid, createdAt: new Date(), updatedAt: new Date() };
    const ref = await db().collection('tasks').add(task);
    res.json({ success: true, task: { id: ref.id, ...task } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  try {
    const ref = db().collection('tasks').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== req.user.uid)
      return res.status(404).json({ error: 'Task not found' });
    await ref.update({ ...req.body, updatedAt: new Date() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const ref = db().collection('tasks').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== req.user.uid)
      return res.status(404).json({ error: 'Task not found' });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
