// Calls the backend Gemini endpoint; falls back to local keyword matching if unavailable.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function analyzeTaskPriority(input) {
  try {
    const stored = localStorage.getItem('auth-storage');
    const token = stored ? JSON.parse(stored)?.state?.token : null;

    const response = await fetch(`${API_URL}/ai/analyze-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) throw new Error('AI API request failed');

    const data = await response.json();
    return {
      priority: data.analysis?.priority || 'medium',
      category: data.analysis?.category || 'personal',
      dueDate: data.analysis?.dueDate || null,
    };
  } catch {
    return localFallback(input);
  }
}

function localFallback(input) {
  const text = input.toLowerCase();
  const high = ['urgent', 'asap', 'emergency', 'critical', 'immediately', 'deadline'];
  const medium = ['important', 'soon', 'tomorrow', 'this week', 'meeting', 'report'];
  const work = ['meeting', 'client', 'project', 'work', 'office', 'email', 'report'];
  const health = ['gym', 'exercise', 'doctor', 'hospital', 'health', 'medicine'];
  const learning = ['study', 'learn', 'course', 'book', 'read', 'research', 'exam'];

  const priority = high.some(k => text.includes(k)) ? 'high'
    : medium.some(k => text.includes(k)) ? 'medium' : 'low';

  const category = work.some(k => text.includes(k)) ? 'work'
    : health.some(k => text.includes(k)) ? 'health'
    : learning.some(k => text.includes(k)) ? 'learning' : 'personal';

  return { priority, category, dueDate: null };
}
