import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { blockApi } from '../services/adminApi';

export default function ProfileMe() {
  const { user, reloadUser } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    department: '',
    course: '',
    studyYear: '1st Year',
  });

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'blocked'

  useEffect(() => {
    Promise.all([
      api('/users/me'),
      blockApi.getBlocked().catch(() => []),
    ])
      .then(([userData, blocked]) => {
        setForm({
          fullName: userData.fullName || '',
          department: userData.department || '',
          course: userData.course || '',
          studyYear: userData.studyYear || '1st Year',
        });
        setAvatarPreview(userData.profileImageUrl || null);
        setBlockedUsers(blocked || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load profile');
        setLoading(false);
      });
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const fd = new FormData();
      fd.append('fullName', form.fullName.trim());
      if (form.department) fd.append('department', form.department.trim());
      if (form.course) fd.append('course', form.course.trim());
      if (form.studyYear) fd.append('studyYear', form.studyYear.trim());
      if (avatarFile) fd.append('photo', avatarFile);

      await api('/users/me', {
        method: 'PUT',
        body: fd,
      });

      await reloadUser();
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedUserId) => {
    try {
      await blockApi.unblock(blockedUserId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedUserId));
      setSuccess('User unblocked');
    } catch (err) {
      setError(err.message || 'Failed to unblock user');
    }
  };

  if (loading) {
    return (
      <div className="state">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 720, margin: '30px auto' }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'var(--brand-100)',
            display: 'grid',
            placeItems: 'center',
            fontSize: '2rem',
            border: '2px solid var(--border)',
          }}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            '🎓'
          )}
        </div>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>{user?.fullName}</h1>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            {user?.email} · {user?.verified ? (
              <span style={{ color: '#059669', fontWeight: 600 }}>✓ Verified Student</span>
            ) : (
              <span>
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ Unverified</span>
                <Link to="/verify-email" style={{ color: 'var(--brand-600)', marginLeft: '8px', fontWeight: 600 }}>
                  Verify Email →
                </Link>
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="pills" style={{ marginBottom: 20 }}>
        <button
          className={'pill' + (activeTab === 'profile' ? ' on' : '')}
          onClick={() => setActiveTab('profile')}
        >
          Profile Settings
        </button>
        <button
          className={'pill' + (activeTab === 'blocked' ? ' on' : '')}
          onClick={() => setActiveTab('blocked')}
        >
          Blocked Students ({blockedUsers.length})
        </button>
      </div>

      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}
      {success && <p className="ok" style={{ marginBottom: 16 }}>{success}</p>}

      {activeTab === 'profile' ? (
        <form className="form" onSubmit={handleSave} style={{ margin: 0 }}>
          <label>
            Profile Picture
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Photo
              </button>
              {avatarFile && <span className="muted" style={{ fontSize: '0.85rem' }}>{avatarFile.name}</span>}
            </div>
          </label>

          <label>
            Full Name *
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </label>

          <div className="grid2">
            <label>
              Department
              <input
                placeholder="e.g. Computer Science"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </label>
            <label>
              Year of Study
              <select
                value={form.studyYear}
                onChange={(e) => setForm({ ...form, studyYear: e.target.value })}
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
            </label>
          </div>

          <label>
            Course / Program
            <input
              placeholder="e.g. B.Tech IT, B.Sc Nursing"
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
            />
          </label>

          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Blocked Students</h3>
          <p className="muted" style={{ fontSize: '0.88rem', marginBottom: 16 }}>
            Blocked students cannot send you item requests, initiate conversations, or message you.
          </p>

          {blockedUsers.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
              You have not blocked any users.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {blockedUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--surface-raised)',
                  }}
                >
                  <div>
                    <strong>{u.fullName}</strong>
                    {u.department && <span className="muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>({u.department})</span>}
                  </div>
                  <button
                    className="btn ghost"
                    style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                    onClick={() => handleUnblock(u.id)}
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
