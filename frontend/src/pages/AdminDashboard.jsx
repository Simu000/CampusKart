// pages/admin/AdminDashboard.jsx — Full admin interface
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { adminApi } from '../services/adminApi.js';
import { api } from '../api.js';

// ── Shared helper components ──────────────────────────────────────────────────
const Err = ({ msg }) => (msg ? <p className="error" role="alert">{msg}</p> : null);
const Ok = ({ msg }) => (msg ? <p className="ok">{msg}</p> : null);
const StatusBadge = ({ s }) => <span className={`status-${s}`}>{s}</span>;

function ConfirmModal({ message, onConfirm, onCancel, children }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <p style={{ marginBottom: 20 }}>{message}</p>
        {children}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Overview Stats ────────────────────────────────────────────────────────────
function AdminOverview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminApi.getDashboard().then(setData).catch(e => setErr(e.message));
  }, []);

  if (err) return <p className="error">{err}</p>;
  if (!data) return <p className="muted">Loading dashboard...</p>;

  const stats = [
    { label: 'Total Users', value: data.totalUsers, icon: '👤' },
    { label: 'Verified Students', value: data.verifiedUsers, icon: '✓' },
    { label: 'Active Listings', value: data.activeListings, icon: '📦' },
    { label: 'Pending Reports', value: data.pendingReports, icon: '🚨' },
    { label: 'Total Requests', value: data.totalRequests, icon: '📋' },
    { label: 'Completed Exchanges', value: data.completedExchanges, icon: '🎉' },
  ];

  return (
    <>
      <h2 style={{ marginBottom: 20 }}>Dashboard Overview</h2>
      <div className="admin-stats">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-val">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── User Management ────────────────────────────────────────────────────────────
function AdminUsers() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = () => {
    setData(null);
    adminApi.getUsers({ search, page, size: 20 })
      .then(setData).catch(e => setErr(e.message));
  };

  useEffect(() => { load(); }, [search, page]);

  const suspend = async (user) => {
    try {
      await adminApi.suspendUser(user.id, 'Moderation action');
      setMsg(`Account for ${user.fullName} suspended.`);
      load();
    } catch (e) { setErr(e.message); }
    setConfirm(null);
  };

  const reactivate = async (user) => {
    try {
      await adminApi.reactivateUser(user.id, 'Appeal approved');
      setMsg(`Account for ${user.fullName} reactivated.`);
      load();
    } catch (e) { setErr(e.message); }
    setConfirm(null);
  };

  return (
    <>
      <h2>User Management</h2>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{ flex: 1 }}
        />
      </div>
      <Err msg={err} />
      <Ok msg={msg} />
      {confirm && (
        <ConfirmModal
          message={`Are you sure you want to ${confirm.action} ${confirm.user.fullName}?`}
          onConfirm={() => confirm.action === 'suspend' ? suspend(confirm.user) : reactivate(confirm.user)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {!data ? (
        <p className="muted">Loading...</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Verified</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map(u => (
                <tr key={u.id}>
                  <td><Link to={`/profile/${u.id}`} target="_blank">{u.fullName}</Link></td>
                  <td style={{ fontSize: '0.82rem' }}>{u.email}</td>
                  <td>{u.verified ? '✓' : '✗'}</td>
                  <td><span className={u.role === 'ADMIN' ? 'badge-admin' : ''}>{u.role}</span></td>
                  <td><StatusBadge s={u.status} /></td>
                  <td style={{ fontSize: '0.82rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    {u.role !== 'ADMIN' && (
                      u.status === 'ACTIVE' ? (
                        <button className="btn danger" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => setConfirm({ user: u, action: 'suspend' })}>
                          Suspend
                        </button>
                      ) : (
                        <button className="btn" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => setConfirm({ user: u, action: 'reactivate' })}>
                          Reactivate
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {data.items?.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-500)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
          <div className="pager">
            <button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="muted">Page {page + 1}</span>
            <button className="btn ghost" disabled={data.items?.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Listing Management ─────────────────────────────────────────────────────────
function AdminListings() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = () => {
    setData(null);
    adminApi.getListings({ search, page, size: 20 })
      .then(setData).catch(e => setErr(e.message));
  };

  useEffect(() => { load(); }, [search, page]);

  const remove = async (item) => {
    try {
      await adminApi.removeListing(item.id, 'Moderation action');
      setMsg(`Listing "${item.title}" removed.`);
      load();
    } catch (e) { setErr(e.message); }
    setConfirm(null);
  };

  return (
    <>
      <h2>Listing Management</h2>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <input
          placeholder="Search listings..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{ flex: 1 }}
        />
      </div>
      <Err msg={err} />
      <Ok msg={msg} />
      {confirm && (
        <ConfirmModal
          message={`Remove listing "${confirm.title}"? This action notifies the seller.`}
          onConfirm={() => remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {!data ? (
        <p className="muted">Loading...</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Seller</th><th>Type</th><th>Price</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.items?.map(l => (
                <tr key={l.id}>
                  <td><Link to={`/listing/${l.id}`} target="_blank">{l.title}</Link></td>
                  <td style={{ fontSize: '0.82rem' }}>{l.sellerName}</td>
                  <td><span className={`tag tag-${l.transactionType}`}>{l.transactionType}</span></td>
                  <td>{l.transactionType === 'LEND' ? 'Free' : `₹${l.price}`}</td>
                  <td><StatusBadge s={l.status} /></td>
                  <td style={{ fontSize: '0.82rem' }}>{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td>
                    {l.status !== 'REMOVED' && (
                      <button className="btn danger" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => setConfirm(l)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.items?.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-500)' }}>No listings found</td></tr>
              )}
            </tbody>
          </table>
          <div className="pager">
            <button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="muted">Page {page + 1}</span>
            <button className="btn ghost" disabled={data.items?.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Report Management ──────────────────────────────────────────────────────────
function AdminReports() {
  const [data, setData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ status: '', adminNotes: '' });

  const load = () => {
    setData(null);
    adminApi.getReports({ status: statusFilter, page, size: 20 })
      .then(setData).catch(e => setErr(e.message));
  };

  useEffect(() => { load(); }, [statusFilter, page]);

  const openEdit = (r) => {
    setEditing(r);
    setEditForm({ status: r.status, adminNotes: r.adminNotes || '' });
  };

  const saveEdit = async () => {
    try {
      await adminApi.updateReport(editing.id, editForm);
      setMsg('Report updated.');
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h2>Report Management</h2>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">All Reports</option>
          <option value="PENDING">Pending</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>
      <Err msg={err} />
      <Ok msg={msg} />
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Review Report #{editing.id}</h3>
            <p className="muted" style={{ margin: '8px 0 16px' }}>
              Reason: <strong>{editing.reason}</strong><br />
              {editing.description && <>Details: {editing.description}<br /></>}
              Reporter: {editing.reporterName || 'Unknown'}
            </p>
            <label>
              Status
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>
            </label>
            <label style={{ marginTop: 12 }}>
              Admin Notes
              <textarea
                rows={3}
                value={editForm.adminNotes}
                onChange={e => setEditForm(f => ({ ...f, adminNotes: e.target.value }))}
                placeholder="Internal notes about this report..."
              />
            </label>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
      {!data ? (
        <p className="muted">Loading...</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>ID</th><th>Reason</th><th>Target</th><th>Reporter</th><th>Status</th><th>Filed</th><th>Action</th></tr>
            </thead>
            <tbody>
              {data.items?.map(r => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td style={{ fontSize: '0.82rem' }}>{r.reason.replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {r.listingTitle ? <>Listing: {r.listingTitle}</> : ''}
                    {r.reportedUserName ? <>User: {r.reportedUserName}</> : ''}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{r.reporterName || '—'}</td>
                  <td><StatusBadge s={r.status} /></td>
                  <td style={{ fontSize: '0.82rem' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn ghost" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(r)}>Review</button>
                  </td>
                </tr>
              ))}
              {data.items?.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-500)' }}>No reports</td></tr>
              )}
            </tbody>
          </table>
          <div className="pager">
            <button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="muted">Page {page + 1}</span>
            <button className="btn ghost" disabled={data.items?.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Category Management ────────────────────────────────────────────────────────
function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ name: '', description: '', displayOrder: 0 });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    adminApi.getCategories().then(setCats).catch(e => setErr(e.message));
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createCategory(form);
      setMsg('Category created.');
      setForm({ name: '', description: '', displayOrder: 0 });
      load();
    } catch (e) { setErr(e.message); }
  };

  const update = async () => {
    try {
      await adminApi.updateCategory(editing.id, editForm);
      setMsg('Category updated.');
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
  };

  const toggle = async (cat) => {
    try {
      await adminApi.toggleCategory(cat.id);
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h2>Category Management</h2>
      <Err msg={err} />
      <Ok msg={msg} />
      <form onSubmit={create} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 14 }}>Add New Category</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>Name <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
          <label>Description <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
          <label>Display Order <input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: +e.target.value }))} /></label>
          <button type="submit" className="btn" style={{ width: 'fit-content' }}>Create Category</button>
        </div>
      </form>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Category</h3>
            <div style={{ display: 'grid', gap: 12, margin: '16px 0' }}>
              <label>Name <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></label>
              <label>Description <input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></label>
              <label>Display Order <input type="number" value={editForm.displayOrder ?? 0} onChange={e => setEditForm(f => ({ ...f, displayOrder: +e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" onClick={update}>Save</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {cats.map(cat => (
          <div key={cat.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: cat.active ? 1 : 0.5 }}>
            <div>
              <strong>{cat.name}</strong>
              {!cat.active && <span className="muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>(Inactive)</span>}
              {cat.description && <p className="muted" style={{ fontSize: '0.82rem', marginTop: 2 }}>{cat.description}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => { setEditing(cat); setEditForm({ name: cat.name, description: cat.description || '', displayOrder: cat.display_order || 0 }); }}>Edit</button>
              <button className={`btn ${cat.active ? 'ghost' : ''}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => toggle(cat)}>{cat.active ? 'Deactivate' : 'Activate'}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Audit Logs ─────────────────────────────────────────────────────────────────
function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminApi.getAuditLogs({ page: 0, size: 50 }).then(setLogs).catch(e => setErr(e.message));
  }, []);

  return (
    <>
      <h2>Audit Logs</h2>
      <Err msg={err} />
      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th><th>Time</th></tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td style={{ fontSize: '0.82rem' }}>{l.actor_name || l.actor_id}</td>
                <td><code style={{ fontSize: '0.78rem' }}>{l.action}</code></td>
                <td style={{ fontSize: '0.82rem' }}>{l.target_type} #{l.target_id}</td>
                <td style={{ fontSize: '0.82rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.reason}</td>
                <td style={{ fontSize: '0.78rem' }}>{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-500)' }}>No audit logs yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main Admin Layout ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">🛡️ Admin Panel</div>
        <nav>
          <NavLink to="/admin" end>📊 Overview</NavLink>
          <NavLink to="/admin/users">👤 Users</NavLink>
          <NavLink to="/admin/listings">📦 Listings</NavLink>
          <NavLink to="/admin/reports">🚨 Reports</NavLink>
          <NavLink to="/admin/categories">🏷️ Categories</NavLink>
          <NavLink to="/admin/audit">📋 Audit Logs</NavLink>
        </nav>
      </aside>
      <main className="admin-content">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="audit" element={<AdminAuditLogs />} />
        </Routes>
      </main>
    </div>
  );
}
