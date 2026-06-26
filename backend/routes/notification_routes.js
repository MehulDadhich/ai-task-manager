const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth_middleware');
const { getAdmin } = require('../config/firebase');

router.use(authMiddleware);

const db = () => getAdmin().firestore();

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    let q = db().collection('notifications').where('userId', '==', req.user.uid);
    if (req.query.unreadOnly === 'true') q = q.where('read', '==', false);
    const snap = await q.orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, notifications: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    await db().collection('notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', async (req, res) => {
  try {
    const snap = await db().collection('notifications')
      .where('userId', '==', req.user.uid).where('read', '==', false).get();
    const batch = db().batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    await db().collection('notifications').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
