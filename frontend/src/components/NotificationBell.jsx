// components/NotificationBell.jsx — In-app notification dropdown with SVG icon
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();

  const load = async () => {
    try {
      const d = await api('/notifications');
      setData(d || { items: [], unreadCount: 0 });
    } catch (_) {}
  };

  // Poll every 30 seconds for new notifications
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (n) => {
    if (!n.is_read) {
      try { await api(`/notifications/${n.id}/read`, { method: 'PATCH' }); } catch (_) {}
    }
    setOpen(false);
    // Navigate to relevant resource — message notifications go to inbox
    if (n.reference_type === 'MESSAGE' || n.reference_type === 'CONVERSATION') nav('/messages');
    else if (n.reference_type === 'REQUEST') nav('/requests');
    else if (n.reference_type === 'LISTING') nav('/my-listings');
    else if (n.reference_type === 'USER') nav('/profile/me');
    else nav('/messages'); // default: inbox
    load();
  };

  const markAllRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      load();
    } catch (_) {}
  };

  const unread = data.unreadCount || 0;
  const items = data.items || [];

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        className="notif-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={`${unread} notifications`}
        title="Notifications"
      >
        <BellIcon />
        {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link" style={{ fontSize: '0.78rem' }} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  className={`notif-item${!n.is_read ? ' unread' : ''}`}
                  onClick={() => markRead(n)}
                >
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-body">{n.body}</div>
                  <div className="notif-time">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
