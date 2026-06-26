import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

// Lightweight in-browser alarm: checks task due times every minute
export default function AlarmSystem({ tasks = [] }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const upcoming = (tasks || []).filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const due = new Date(t.dueDate);
        const diff = (due - now) / 60000; // minutes
        return diff >= 0 && diff <= 15;
      });

      upcoming.forEach(t => {
        setAlerts(prev => {
          if (prev.find(a => a.id === t.id)) return prev;
          return [...prev, { id: t.id, title: t.title, dueDate: t.dueDate }];
        });
      });
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [tasks]);

  const dismiss = (id) => setAlerts(prev => prev.filter(a => a.id !== id));

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="bg-red-600 text-white rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-pulse"
        >
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">{alert.title}</p>
            <p className="text-sm text-red-100">
              Due: {new Date(alert.dueDate).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            className="p-1 hover:bg-red-500 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
