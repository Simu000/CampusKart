import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import EditListing from './pages/EditListing.jsx';
import ProfileMe from './pages/ProfileMe.jsx';
import Messages from './pages/Messages.jsx';
import {
  Browse,
  ListingDetail,
  Sell,
  MyListings,
  Requests,
  Chat,
  Login,
  Register,
  VerifyEmail,
  ForgotPassword,
  ResetPassword,
  PublicProfile,
} from './pages.jsx';

function VerificationBanner() {
  const { user } = useAuth();
  const [sentMsg, setSentMsg] = useState('');
  const [sending, setSending] = useState(false);

  if (!user || user.verified) return null;

  const resend = async () => {
    setSending(true);
    setSentMsg('');
    try {
      await api('/auth/resend-verification', { method: 'POST', body: { email: user.email } });
      setSentMsg('Verification link sent! Check your university inbox.');
    } catch {
      setSentMsg('Could not send verification email. Please try again shortly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="verify-banner">
      <span>
        ⚠️ Your university email (<strong>{user.email}</strong>) is not verified yet. You must verify your email before posting listings or making requests.
      </span>
      {sentMsg ? (
        <span style={{ fontWeight: 700, marginLeft: '8px' }}>{sentMsg}</span>
      ) : (
        <button onClick={resend} disabled={sending} style={{ marginLeft: '8px' }}>
          {sending ? 'Sending email...' : 'Resend verification email'}
        </button>
      )}
    </div>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link to="/" className="brand">
          <div className="brand-icon">🎓</div>
          <span>Campus Exchange</span>
        </Link>
        <nav>
          <NavLink to="/">Browse</NavLink>
          {user && (
            <>
              <NavLink to="/my-listings">My Listings</NavLink>
              <NavLink to="/requests">Requests</NavLink>
              <NavLink to="/messages">Messages</NavLink>
              {user.role === 'ADMIN' && (
                <NavLink to="/admin" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                  🛡️ Admin
                </NavLink>
              )}
            </>
          )}
        </nav>
        <div className="nav-end">
          {user ? (
            <>
              <NotificationBell />
              {user.verified && <span className="badge-verified">✓ Verified</span>}
              <Link to="/sell" className="btn">+ Sell an Item</Link>
              <Link
                to="/profile/me"
                className="btn ghost"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '20px',
                }}
              >
                <span>👤</span>
                <span>{user.fullName ? user.fullName.split(' ')[0] : 'Profile'}</span>
              </Link>
              <button
                className="link"
                style={{ fontSize: '0.88rem' }}
                onClick={() => {
                  logout();
                  nav('/');
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="link">Sign in</Link>
              <Link to="/register" className="btn">Join Campus</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const { user } = useAuth();

  return (
    <nav className="mobile-bottom-nav">
      <NavLink to="/" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
        <span className="icon">🏠</span>
        <span>Browse</span>
      </NavLink>
      {user && (
        <>
          <NavLink to="/sell" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <span className="icon">➕</span>
            <span>Sell</span>
          </NavLink>
          <NavLink to="/requests" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <span className="icon">📋</span>
            <span>Requests</span>
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <span className="icon">💬</span>
            <span>Messages</span>
          </NavLink>
          <NavLink to="/my-listings" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <span className="icon">📦</span>
            <span>Listings</span>
          </NavLink>
          <NavLink to="/profile/me" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <span className="icon">👤</span>
            <span>Profile</span>
          </NavLink>
        </>
      )}
      {!user && (
        <NavLink to="/login" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
          <span className="icon">🔑</span>
          <span>Sign In</span>
        </NavLink>
      )}
    </nav>
  );
}

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="wrap muted" style={{ paddingTop: '40px' }}>Loading session...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.verified) {
    return (
      <div className="state form narrow" style={{ textAlign: 'center', margin: '40px auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⚠️</div>
        <h2>Email Verification Required</h2>
        <p className="muted" style={{ margin: '12px 0' }}>
          Your university account (<strong>{user.email}</strong>) is not verified yet.
        </p>
        <p>
          You cannot proceed to marketplace features before verifying your student email. Please check your university inbox for the verification link.
        </p>
        <div style={{ marginTop: '20px' }}>
          <Link to="/verify-email" className="btn">Check Verification Status / Resend Email</Link>
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { ready } = useAuth();
  if (!ready) return null;

  return (
    <>
      <VerificationBanner />
      <Nav />
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile/:id" element={<PublicProfile />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/sell" element={<Protected><Sell /></Protected>} />
          <Route path="/edit-listing/:id" element={<Protected><EditListing /></Protected>} />
          <Route path="/my-listings" element={<Protected><MyListings /></Protected>} />
          <Route path="/requests" element={<Protected><Requests /></Protected>} />
          <Route path="/messages" element={<Protected><Messages /></Protected>} />
          <Route path="/chat/:id" element={<Protected><Chat /></Protected>} />
          <Route path="/profile/me" element={<Protected><ProfileMe /></Protected>} />
          <Route path="/admin/*" element={<Protected><AdminDashboard /></Protected>} />
          <Route
            path="*"
            element={
              <div className="state">
                <h2>Page Not Found</h2>
                <p>The page you are looking for does not exist.</p>
                <Link to="/" className="btn">Back to Catalog</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <MobileNav />
    </>
  );
}
