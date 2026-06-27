import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getTasks, createTask, updateTask, deleteTask } from '../services/firebaseDB';
import { logoutUser } from '../services/firebaseAuth';
import { analyzeTaskPriority } from '../services/geminiService';
import toast from 'react-hot-toast';
import AlarmSystem from '../components/AlarmSystem';
import {
  Plus, CheckCircle2, Clock, Calendar, Target, Trash2,
  LogOut, AlertCircle, Search, TrendingUp,
  BarChart3, PieChart, Activity, Home, CheckSquare,
  Briefcase, User, Heart, Book, Brain
} from 'lucide-react';

// ── Animated canvas background ───────────────────────────────────────────────
const AnimatedBackground = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const N = 60;
    const DIST = 150;
    class P {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.r = Math.random() * 2 + 2;
      }
      update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37,99,235,0.6)';
        ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(37,99,235,0.4)';
        ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    for (let i = 0; i < N; i++) particles.push(new P());
    let animId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      for (let i = 0; i < particles.length; i++)
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(37,99,235,${0.3 * (1 - d / DIST)})`;
            ctx.lineWidth = 1.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      animId = requestAnimationFrame(animate);
    };
    animate();
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ background: '#fff' }} />;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const detectCategory = (title) => {
  const t = title.toLowerCase();
  if (['meeting','client','project','work','office','presentation','email','report'].some(k => t.includes(k))) return 'work';
  if (['gym','exercise','doctor','hospital','health','medicine','workout','run','yoga'].some(k => t.includes(k))) return 'health';
  if (['study','learn','course','book','read','research','exam','homework'].some(k => t.includes(k))) return 'learning';
  return 'personal';
};

const detectPriority = (title) => {
  const t = title.toLowerCase();
  if (['urgent','asap','emergency','critical','immediately','deadline','overdue'].some(k => t.includes(k))) return 'high';
  if (['important','soon','tomorrow','this week','project','meeting','report'].some(k => t.includes(k))) return 'medium';
  return 'low';
};

const parseNaturalDate = (input) => {
  const text = input.toLowerCase();
  const timeRx = /(\d{1,2})\s*(am|pm)/i;
  let date = null;
  if (text.includes('today')) date = new Date();
  else if (text.includes('tomorrow')) { date = new Date(); date.setDate(date.getDate() + 1); }
  if (!date) return null;
  const m = text.match(timeRx);
  if (m) {
    let h = parseInt(m[1]);
    if (m[2].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (m[2].toLowerCase() === 'am' && h === 12) h = 0;
    date.setHours(h, 0, 0, 0);
  }
  return date.toISOString();
};

const getCategoryIcon = (cat) => ({ work: Briefcase, health: Heart, learning: Book, personal: User }[cat] || User);
const getCategoryColor = (cat) => ({
  work: 'bg-blue-100 text-blue-700 border-blue-300',
  personal: 'bg-purple-100 text-purple-700 border-purple-300',
  health: 'bg-red-100 text-red-700 border-red-300',
  learning: 'bg-green-100 text-green-700 border-green-300',
}[cat] || 'bg-gray-100 text-gray-700 border-gray-300');

// ── Key helper: get today's date string "YYYY-MM-DD" ────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Check if a daily task was completed on a PREVIOUS day (so it should reset) ──
const dailyTaskShouldReset = (task) => {
  if (!task.tags?.includes('daily')) return false;
  if (task.status !== 'done') return false;
  const completedOn = task.completedDate; // we store this when completing
  if (!completedOn) return true; // no date stored → assume old, reset it
  return completedOn !== todayStr(); // completed on a different day → reset
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user, token, logout, isAuthenticated } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ACTIVE');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [activeView, setActiveView] = useState('tasks');

  useEffect(() => {
    if (!isAuthenticated || !token) { navigate('/login'); return; }
    loadTasks();
  }, [isAuthenticated, token]);

  // ── Check every minute if a new day started and reset daily tasks ──────────
  useEffect(() => {
    const resetDailyTasks = async () => {
      const toReset = tasks.filter(dailyTaskShouldReset);
      if (toReset.length === 0) return;

      const updated = await Promise.all(
        toReset.map(async (t) => {
          await updateTask(t.id, { status: 'todo', completedDate: null });
          return { ...t, status: 'todo', completedDate: null };
        })
      );

      setTasks(prev =>
        prev.map(t => {
          const reset = updated.find(u => u.id === t.id);
          return reset || t;
        })
      );
    };

    resetDailyTasks(); // run immediately on load
    const interval = setInterval(resetDailyTasks, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [tasks]);

  const loadTasks = async () => {
    try {
      if (user?.uid) {
        const fetched = await getTasks(user.uid);
        setTasks(fetched);
      }
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskInput.trim()) { toast.error('Please enter a task'); return; }
    try {
      let priority, category, dueDate = null;
      try {
        const aiResult = await analyzeTaskPriority(newTaskInput);
        priority = aiResult.priority;
        category = aiResult.category || detectCategory(newTaskInput);
        dueDate = aiResult.dueDate || parseNaturalDate(newTaskInput);
      } catch {
        priority = detectPriority(newTaskInput);
        category = detectCategory(newTaskInput);
        dueDate = parseNaturalDate(newTaskInput);
      }

      const isDaily = /daily|every day/i.test(newTaskInput);
      const taskData = {
        title: newTaskInput.trim(),
        description: '',
        priority,
        category,
        status: 'todo',
        userId: user.uid,
        tags: isDaily ? ['daily'] : [],
        subtasks: [],
        dueDate,
        isRecurring: isDaily,
        recurrencePattern: isDaily ? 'daily' : null,
        completedDate: null,
      };

      const created = await createTask(taskData);
      setTasks(prev => [created, ...prev]);
      toast.success(`✓ Task added! Priority: ${priority} | Category: ${category}`);
      setNewTaskInput('');
      setTimeout(loadTasks, 500);
    } catch { toast.error('Failed to create task'); }
  };

  const handleDeleteTask = async (id) => {
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task deleted');
    } catch { toast.error('Failed to delete task'); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const task = tasks.find(t => t.id === id);
      const updates = { status: newStatus };

      // When completing a daily task, store today's date so we know when to reset
      if (newStatus === 'done' && task?.tags?.includes('daily')) {
        updates.completedDate = todayStr();
        await updateTask(id, updates);
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        toast.success('✓ Daily task completed! Will reset tomorrow.');
        return;
      }

      await updateTask(id, updates);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      if (newStatus === 'done') toast.success('✓ Task completed!');
      setTimeout(loadTasks, 500);
    } catch { toast.error('Failed to update task'); }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      logout();
      toast.success('Logged out');
      navigate('/login');
    } catch { toast.error('Logout failed'); }
  };

  // ── Time helper ──────────────────────────────────────────────────────────
  const getTimeMin = (task) => {
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      return d.getHours() * 60 + d.getMinutes();
    }
    const m = task.title.match(/at (\d{1,2})\s*(am|pm)/i);
    if (m) {
      let h = parseInt(m[1]);
      if (m[2].toLowerCase() === 'pm' && h !== 12) h += 12;
      if (m[2].toLowerCase() === 'am' && h === 12) h = 0;
      return h * 60;
    }
    return 9999;
  };

  // ── Filtering ────────────────────────────────────────────────────────────
  const getFilteredTasks = () => {
    let f = [...tasks];
    const now = new Date();

    switch (filter) {
      case 'ACTIVE':
        // Daily tasks: always show in ACTIVE (completed ones show as done visually but stay here)
        // Regular tasks: hide when done
        f = f.filter(t => {
          if (t.tags?.includes('daily')) return true;
          return t.status !== 'done';
        });
        break;

      case 'UPCOMING': {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        f = f.filter(t => {
          // Daily tasks always show in upcoming
          if (t.tags?.includes('daily')) return true;
          if (t.dueDate) {
            const dd = new Date(t.dueDate);
            return dd >= tomorrowStart;
          }
          return false;
        });
        break;
      }

      case 'HIGH':
        f = f.filter(t => t.priority === 'high' && t.status !== 'done');
        break;
    }

    f.sort((a, b) => getTimeMin(a) - getTimeMin(b));

    if (searchQuery.trim()) {
      f = f.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return f;
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  // Count ALL completed tasks including daily ones (they stay 'done' until next day)
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  // Active = incomplete non-daily tasks + all daily tasks (daily always show in active)
  const activeTasks = tasks.filter(t => {
    if (t.tags?.includes('daily')) return true; // daily always counts as active
    return t.status !== 'done';
  }).length;
  const highPriorityCount = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const priorityBreakdown = {
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length,
  };
  const categoryBreakdown = {
    work: tasks.filter(t => t.category === 'work').length,
    personal: tasks.filter(t => t.category === 'personal').length,
    health: tasks.filter(t => t.category === 'health').length,
    learning: tasks.filter(t => t.category === 'learning').length,
  };

  // ── AI Day Planner: show today's upcoming + daily tasks ──────────────────
  const now = new Date();
  const todaySchedule = tasks
    .filter(t => {
      if (t.status === 'done' && !t.tags?.includes('daily')) return false;
      if (t.tags?.includes('daily')) {
        const m = t.title.match(/at (\d{1,2})\s*(am|pm)/i);
        if (!m) return true; // daily task without time → always show
        let h = parseInt(m[1]);
        if (m[2].toLowerCase() === 'pm' && h !== 12) h += 12;
        if (m[2].toLowerCase() === 'am' && h === 12) h = 0;
        return h > now.getHours() || (h === now.getHours() && now.getMinutes() < 59);
      }
      if (t.dueDate) {
        const td = new Date(t.dueDate);
        return td.toDateString() === now.toDateString() && td > now;
      }
      return false;
    })
    .sort((a, b) => getTimeMin(a) - getTimeMin(b));

  const filteredTasks = getFilteredTasks();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <AnimatedBackground />
        <AlarmSystem tasks={[]} />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative flex">
      <AnimatedBackground />
      <AlarmSystem tasks={tasks} />

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className="w-20 bg-white/80 backdrop-blur-xl border-r border-gray-200 relative z-10 flex flex-col items-center py-6 shadow-lg">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-8 shadow-lg">
          <Brain className="w-7 h-7 text-white" />
        </div>
        <nav className="flex-1 flex flex-col items-center space-y-4">
          {[
            { view: 'tasks', Icon: Home, color: 'blue' },
            { view: 'completed', Icon: CheckSquare, color: 'green' },
            { view: 'analytics', Icon: BarChart3, color: 'purple' },
          ].map(({ view, Icon, color }) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              title={view.charAt(0).toUpperCase() + view.slice(1)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                activeView === view
                  ? `bg-${color}-600 text-white shadow-lg`
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </nav>
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 relative z-10 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="w-40" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI Task Manager
            </h1>
            <div className="w-40 flex justify-end">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white rounded-xl transition-colors shadow-lg"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold">{user?.displayName || 'User'}</p>
                  <p className="text-xs opacity-90">{user?.email}</p>
                </div>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">

          {/* ════════════════════════════════════════════════
              TASKS VIEW
          ════════════════════════════════════════════════ */}
          {activeView === 'tasks' && (
            <div className="max-w-6xl mx-auto space-y-6">

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Tasks', value: totalTasks, Icon: Target, color: 'blue', showBar: true, barWidth: 100, barRate: 100 },
                  { label: 'Completed', value: completedTasks, Icon: CheckCircle2, color: 'green', showBar: true, barWidth: completionRate, barRate: completionRate },
                  { label: 'Active', value: activeTasks, Icon: Clock, color: 'orange', showBar: false },
                  { label: 'High Priority', value: highPriorityCount, Icon: AlertCircle, color: 'red', showBar: false },
                ].map(({ label, value, Icon, color, showBar, barWidth, barRate }) => (
                  <div key={label} className={`bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-${color}-200 shadow-lg`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-600">{label}</h3>
                      <Icon className={`w-6 h-6 text-${color}-600`} />
                    </div>
                    <p className="text-4xl font-black text-gray-900">{value}</p>
                    {showBar && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className={`flex-1 h-2 bg-${color}-100 rounded-full overflow-hidden`}>
                          <div className={`h-full bg-${color}-600 rounded-full transition-all`} style={{ width: `${barWidth}%` }} />
                        </div>
                        <span className={`text-xs font-bold text-${color}-600`}>{barRate}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Task */}
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-gray-200 shadow-lg">
                <form onSubmit={handleAddTask} className="flex gap-3">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={e => setNewTaskInput(e.target.value)}
                    placeholder="Add a task... (e.g., 'urgent client meeting at 3pm today', 'daily gym at 7am')"
                    className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 outline-none font-medium transition-all"
                  />
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Plus className="w-5 h-5" /> Add Task
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-3">
                  💡 AI auto-detects priority & category. Include "daily" for recurring tasks (e.g. "daily gym at 7am")
                </p>
              </div>

              {/* AI Day Planner */}
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-8 h-8" />
                    <div>
                      <h3 className="text-xl font-black">AI Day Planner</h3>
                      <p className="text-sm text-white/80">{todaySchedule.length} tasks scheduled for today</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAIPlanner(!showAIPlanner)}
                    className="px-5 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition-colors"
                  >
                    {showAIPlanner ? 'Hide' : 'Show'}
                  </button>
                </div>

                {showAIPlanner && (
                  <div className="space-y-3 mt-4">
                    {todaySchedule.length === 0 ? (
                      <div className="text-center py-8 text-white/80">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No tasks scheduled for today</p>
                        <p className="text-sm mt-1 opacity-75">Add tasks with times like "daily gym at 7am" or "meeting at 3pm today"</p>
                      </div>
                    ) : todaySchedule.map((task, idx) => {
                      let timeStr = task.dueDate
                        ? new Date(task.dueDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : '🔄 Daily';
                      const m = !task.dueDate && task.title.match(/at (\d{1,2})\s*(am|pm)/i);
                      if (m) timeStr = `${m[1]} ${m[2].toUpperCase()} (Daily)`;

                      return (
                        <div key={task.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between border border-white/20 hover:bg-white/20 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">{idx + 1}</div>
                            <div>
                              <p className="font-bold text-white">{task.title}</p>
                              <p className="text-sm text-white/70 flex items-center gap-2 mt-1">
                                <Clock className="w-3 h-3" /> {timeStr}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                            task.priority === 'high' ? 'bg-red-500/40' :
                            task.priority === 'medium' ? 'bg-yellow-500/40' : 'bg-green-500/40'
                          }`}>
                            {task.priority?.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Filters + Search */}
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-4 border-2 border-gray-200 shadow-lg">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none font-medium"
                    />
                  </div>
                  <div className="flex gap-2">
                    {['ACTIVE', 'UPCOMING', 'HIGH'].map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-5 py-3 rounded-xl font-bold text-sm transition-all ${
                          filter === f ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Task List */}
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="bg-white/90 rounded-2xl p-16 text-center border-2 border-gray-200 shadow-lg">
                    <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-400">No tasks found</h3>
                    <p className="text-gray-400 mt-2">Add your first task above!</p>
                  </div>
                ) : filteredTasks.map(task => {
                  const CatIcon = getCategoryIcon(task.category);
                  const done = task.status === 'done';
                  return (
                    <div key={task.id} className="bg-white/90 backdrop-blur-lg rounded-xl p-5 border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all group">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          onClick={() => handleStatusChange(task.id, done ? 'todo' : 'done')}
                          className={`mt-1 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            done ? 'bg-green-600 border-green-600' : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {done && <CheckCircle2 className="w-5 h-5 text-white" />}
                        </button>

                        {/* Content */}
                        <div className="flex-1">
                          <p className={`font-bold text-lg mb-2 ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {task.title}
                          </p>

                          {/* Badges — NO AI badge */}
                          <div className="flex flex-wrap gap-2">
                            {/* Priority */}
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              task.priority === 'high' ? 'bg-red-500 text-white' :
                              task.priority === 'medium' ? 'bg-orange-500 text-white' :
                              'bg-green-500 text-white'
                            }`}>
                              {task.priority?.toUpperCase()}
                            </span>

                            {/* Category */}
                            {task.category && (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 flex items-center gap-1 ${getCategoryColor(task.category)}`}>
                                <CatIcon className="w-3 h-3" /> {task.category.toUpperCase()}
                              </span>
                            )}

                            {/* Daily badge */}
                            {task.tags?.includes('daily') && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500 text-white flex items-center gap-1">
                                🔄 DAILY
                              </span>
                            )}

                            {/* Due date */}
                            {task.dueDate && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border-2 border-blue-300 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(task.dueDate).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric',
                                  hour: 'numeric', minute: '2-digit', hour12: true
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete (on hover) */}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              COMPLETED VIEW
          ════════════════════════════════════════════════ */}
          {activeView === 'completed' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 border-2 border-gray-200 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <CheckSquare className="w-8 h-8 text-green-600" />
                  <h2 className="text-3xl font-black text-gray-900">Completed Tasks</h2>
                </div>
                <div className="space-y-3">
                  {tasks.filter(t => t.status === 'done').length === 0 ? (
                    <div className="text-center py-16">
                      <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">No completed tasks yet</p>
                    </div>
                  ) : tasks.filter(t => t.status === 'done').map(task => (
                    <div key={task.id} className="bg-green-50 border-2 border-green-200 rounded-xl p-5 flex items-center justify-between group hover:bg-green-100 transition-all">
                      <div className="flex items-center gap-4">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="font-bold text-gray-900 line-through">{task.title}</p>
                          {task.completedDate && (
                            <p className="text-xs text-gray-500 mt-0.5">Completed: {task.completedDate}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              ANALYTICS VIEW
          ════════════════════════════════════════════════ */}
          {activeView === 'analytics' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 border-2 border-gray-200 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <Activity className="w-8 h-8 text-purple-600" />
                  <h2 className="text-3xl font-black text-gray-900">Smart Analysis</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Priority breakdown */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
                    <h3 className="font-bold text-xl text-gray-900 mb-5 flex items-center gap-2">
                      <PieChart className="w-6 h-6 text-blue-600" /> Priority Distribution
                    </h3>
                    <div className="space-y-4">
                      {[
                        { label: 'High Priority', count: priorityBreakdown.high, color: 'bg-red-500' },
                        { label: 'Medium Priority', count: priorityBreakdown.medium, color: 'bg-orange-500' },
                        { label: 'Low Priority', count: priorityBreakdown.low, color: 'bg-green-500' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 ${item.color} rounded-lg`} />
                            <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-gray-900">{item.count}</span>
                            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full`}
                                style={{ width: `${totalTasks > 0 ? (item.count / totalTasks * 100) : 0}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category breakdown */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                    <h3 className="font-bold text-xl text-gray-900 mb-5 flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-purple-600" /> Category Distribution
                    </h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Work', count: categoryBreakdown.work, Icon: Briefcase, color: 'bg-blue-500' },
                        { label: 'Personal', count: categoryBreakdown.personal, Icon: User, color: 'bg-purple-500' },
                        { label: 'Health', count: categoryBreakdown.health, Icon: Heart, color: 'bg-red-500' },
                        { label: 'Learning', count: categoryBreakdown.learning, Icon: Book, color: 'bg-green-500' },
                      ].map(({ label, count, Icon: Ic, color }) => (
                        <div key={label} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 ${color} rounded-lg flex items-center justify-center`}>
                              <Ic className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-gray-900">{count}</span>
                            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full ${color} rounded-full`}
                                style={{ width: `${totalTasks > 0 ? (count / totalTasks * 100) : 0}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Completion rate */}
                <div className="mt-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-2xl p-6 border-2 border-green-200">
                  <h3 className="font-bold text-xl text-gray-900 mb-4 flex items-center gap-2">
                    <Target className="w-6 h-6 text-green-600" /> Overall Progress
                  </h3>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-700 font-medium">Completion Rate</span>
                    <span className="text-4xl font-black text-green-600">{completionRate}%</span>
                  </div>
                  <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${completionRate}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-white rounded-xl p-4 border-2 border-green-200">
                      <p className="text-sm text-gray-600 mb-1">Completed</p>
                      <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border-2 border-orange-200">
                      <p className="text-sm text-gray-600 mb-1">Remaining</p>
                      <p className="text-3xl font-bold text-orange-600">{activeTasks}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}