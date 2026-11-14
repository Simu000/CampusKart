import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/conversations')
      .then((data) => {
        setConversations(data || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load conversations');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text, #111827)' }}>
          Private Messages
        </h1>
        <p className="muted">
          Active conversations for your accepted marketplace requests (powered by MongoDB).
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && <p className="muted">Loading conversations...</p>}

      {!loading && conversations.length === 0 && (
        <div
          className="state"
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid var(--border, #e5e7eb)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💬</div>
          <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>No Active Conversations</h3>
          <p className="muted" style={{ maxWidth: '420px', margin: '0 auto 16px' }}>
            Private chat unlocks as soon as an item request is accepted by the seller.
          </p>
          <Link to="/requests" className="btn">
            View My Requests
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {conversations.map((c) => {
          const isBuyer = user?.id === c.buyerId;
          const peerName = isBuyer ? c.sellerName : c.buyerName;
          const roleBadge = isBuyer ? 'Seller' : 'Buyer';
          const timeStr = c.lastMessageAt
            ? new Date(c.lastMessageAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <Link
              key={c.id || c.requestId}
              to={`/chat/${c.requestId}`}
              style={{
                display: 'block',
                background: '#fff',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border, #e5e7eb)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '1.05rem',
                      color: 'var(--text, #111827)',
                    }}
                  >
                    {peerName}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: '#f3f4f6',
                      color: '#4b5563',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {roleBadge}
                  </span>
                </div>
                {timeStr && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted, #6b7280)' }}>
                    {timeStr}
                  </span>
                )}
              </div>

              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--primary, #2563eb)',
                  fontSize: '0.9rem',
                  marginBottom: '4px',
                }}
              >
                📦 {c.listingTitle}
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--muted, #6b7280)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.lastMessage ? c.lastMessage : 'Tap to open chat and coordinate exchange...'}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
