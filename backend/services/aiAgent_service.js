const { GoogleGenerativeAI } = require('@google/generative-ai');

class AiAgentService {
  constructor() {
    this.genAI = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
  }

  async analyzeTask(input) {
    if (!this.genAI) return this._basicParse(input);

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      const prompt = `Analyze this task and respond ONLY with valid JSON (no markdown, no explanation):
Task: "${input}"
Return this exact structure:
{
  "title": "cleaned title (remove date/time from title)",
  "priority": "high|medium|low",
  "category": "work|health|learning|personal",
  "dueDate": "ISO8601 string or null",
  "tags": ["array", "of", "relevant", "tags"],
  "isRecurring": true|false,
  "recurrencePattern": "daily|weekly|null"
}
Today's date is ${new Date().toISOString()}.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const bt = '`';
      const json = text.replace(new RegExp(bt+bt+bt+'json?\n?', 'g'), '').replace(new RegExp(bt+bt+bt, 'g'), '').trim();
      return JSON.parse(json);
    } catch {
      return this._basicParse(input);
    }
  }

  async analyzePriority(title, description = '', dueDate = null) {
    if (!this.genAI) return this._keywordPriority(title, description, dueDate);
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      const prompt = `Analyze priority of this task. Respond ONLY in JSON:
Title: "${title}"
Description: "${description}"
Due: ${dueDate || 'not set'}
Return: { "priority": "high|medium|low", "confidence": 0.0-1.0, "reasoning": "brief reason" }`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/\`\`\`json?\n?/g, '').replace(/\`\`\`/g, '');
      return JSON.parse(text);
    } catch {
      return this._keywordPriority(title, description, dueDate);
    }
  }

  async smartSchedule(tasks) {
    if (!tasks || tasks.length === 0) return { recommendedOrder: [], summary: 'No tasks to schedule' };
    const sorted = [...tasks].sort((a, b) => {
      const pw = { high: 3, medium: 2, low: 1 };
      const pa = pw[a.priority] || 2;
      const pb = pw[b.priority] || 2;
      if (pa !== pb) return pb - pa;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
    return {
      recommendedOrder: sorted.map((t, i) => ({ ...t, scheduledPosition: i + 1 })),
      summary: `${sorted.length} tasks ordered by priority and due date`,
    };
  }

  _basicParse(input) {
    const text = input.toLowerCase();
    return {
      title: input.trim(),
      priority: this._keywordPriority(input).priority,
      category: this._detectCategory(text),
      dueDate: null,
      tags: text.includes('daily') ? ['daily'] : [],
      isRecurring: text.includes('daily') || text.includes('every day'),
      recurrencePattern: text.includes('daily') ? 'daily' : null,
    };
  }

  _keywordPriority(title, description = '', dueDate = null) {
    const t = `${title} ${description}`.toLowerCase();
    if (['urgent','asap','emergency','critical','immediately','deadline'].some(k => t.includes(k)))
      return { priority: 'high', confidence: 0.8, reasoning: 'Urgent keyword detected', fallback: true };
    if (['important','soon','tomorrow','this week','meeting','report'].some(k => t.includes(k)))
      return { priority: 'medium', confidence: 0.6, reasoning: 'Medium-priority keyword detected', fallback: true };
    if (dueDate) {
      const diff = (new Date(dueDate) - new Date()) / 3600000;
      if (diff < 24) return { priority: 'high', confidence: 0.9, reasoning: 'Due within 24 hours', fallback: true };
      if (diff < 48) return { priority: 'medium', confidence: 0.7, reasoning: 'Due within 48 hours', fallback: true };
    }
    return { priority: 'low', confidence: 0.5, reasoning: 'No urgency signals found', fallback: true };
  }

  _detectCategory(text) {
    if (['meeting','client','project','work','office','email','report'].some(k => text.includes(k))) return 'work';
    if (['gym','exercise','doctor','hospital','health','medicine'].some(k => text.includes(k))) return 'health';
    if (['study','learn','course','book','read','research','exam'].some(k => text.includes(k))) return 'learning';
    return 'personal';
  }
}

module.exports = AiAgentService;
