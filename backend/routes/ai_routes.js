const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth_middleware');
const AiAgentService = require('../services/aiAgent_service');

const ai = new AiAgentService();

router.use(authMiddleware);

// POST /api/ai/analyze-task
router.post('/analyze-task', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: 'input is required' });
    const analysis = await ai.analyzeTask(input);
    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai/analyze-priority
router.post('/analyze-priority', async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    const result = await ai.analyzePriority(title, description, dueDate);
    res.json({ success: true, analysis: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai/smart-schedule
router.post('/smart-schedule', async (req, res) => {
  try {
    const { tasks } = req.body;
    const schedule = await ai.smartSchedule(tasks);
    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
