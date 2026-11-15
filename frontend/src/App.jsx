import { useState, useEffect } from 'react';
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

/* --------------------------------------------------------------------------
   SVG Icon helpers (no emoji)
   -------------------------------------------------------------------------- */
function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  );
}

function IconMessage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

/* Campus "C" logo mark — no emoji */
function BrandMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <text x="2" y="18" fontFamily="system-ui" fontSize="18" fontWeight="800" fill="white">C</text>
    </svg>
  );
}

/* --------------------------------------------------------------------------
   Dark / Light mode hook
   -------------------------------------------------------------------------- */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return { theme, toggle };
}

/* --------------------------------------------------------------------------
   Verification Banner (only for logged-in unverified users)
   -------------------------------------------------------------------------- */
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
        Your university email (<strong>{user.email}</strong>) is not verified yet. You must verify before posting listings or making requests.
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

/* --------------------------------------------------------------------------
   Navigation Avatar — shows profile picture or initials
   -------------------------------------------------------------------------- */
function NavAvatar({ user }) {
  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <Link to="/profile/me" className="nav-avatar" title="My Profile">
      {user?.profileImageUrl ? (
        <img src={user.profileImageUrl} alt={user.fullName || 'Profile'} />
      ) : (
        <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{initials}</span>
      )}
    </Link>
  );
}

/* --------------------------------------------------------------------------
   Top Navigation Bar
   -------------------------------------------------------------------------- */
function Nav({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link to={user ? '/browse' : '/'} className="brand">
          <div className="brand-icon">
            <BrandMark />
          </div>
          <span>Campus Exchange</span>
        </Link>
        <nav>
          {user && (
            <>
              <NavLink to="/browse">Browse</NavLink>
              <NavLink to="/my-listings">My Listings</NavLink>
              <NavLink to="/requests">Requests</NavLink>
              <NavLink to="/messages">Messages</NavLink>
              {user.role === 'ADMIN' && (
                <NavLink to="/admin" style={{ color: 'var(--danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IconShield /> Admin
                </NavLink>
              )}
            </>
          )}
        </nav>
        <div className="nav-end">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle theme">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          {user ? (
            <>
              <NotificationBell />
              <Link to="/sell" className="btn" style={{ padding: '7px 16px', fontSize: '0.88rem' }}>
                + List Item
              </Link>
              <NavAvatar user={user} />
              <button
                className="link"
                style={{ fontSize: '0.88rem' }}
                onClick={async () => {
                  await logout();
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

/* --------------------------------------------------------------------------
   Mobile Bottom Navigation
   -------------------------------------------------------------------------- */
function MobileNav() {
  const { user } = useAuth();

  return (
    <nav className="mobile-bottom-nav">
      {user ? (
        <>
          <NavLink to="/browse" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <IconGrid />
            <span>Browse</span>
          </NavLink>
          <NavLink to="/sell" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <IconPlus />
            <span>Sell</span>
          </NavLink>
          <NavLink to="/requests" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <IconClipboard />
            <span>Requests</span>
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <IconMessage />
            <span>Messages</span>
          </NavLink>
          <NavLink to="/my-listings" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <IconBox />
            <span>Listings</span>
          </NavLink>
          <NavLink to="/profile/me" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
            <IconUser />
            <span>Profile</span>
          </NavLink>
        </>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
          <IconKey />
          <span>Sign In</span>
        </NavLink>
      )}
    </nav>
  );
}

/* --------------------------------------------------------------------------
   Protected route — requires login + verified email
   -------------------------------------------------------------------------- */
function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="wrap muted" style={{ paddingTop: '40px' }}>Loading session...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.verified) {
    return (
      <div className="state form narrow" style={{ textAlign: 'center', margin: '40px auto' }}>
        <h2>Email Verification Required</h2>
        <p className="muted" style={{ margin: '12px 0' }}>
          Your university account (<strong>{user.email}</strong>) is not verified yet.
        </p>
        <p>
          Please check your university inbox for the verification link before accessing marketplace features.
        </p>
        <div style={{ marginTop: '20px' }}>
          <Link to="/verify-email" className="btn">Check Verification Status / Resend Email</Link>
        </div>
      </div>
    );
  }
  return children;
}

/* --------------------------------------------------------------------------
   Landing Page — shown to unauthenticated visitors at "/"
   -------------------------------------------------------------------------- */
function LandingPage({ theme, toggleTheme }) {
  return (
    <div className="landing-page">
      <button className="theme-toggle landing-theme-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>

      <div className="landing-logo">
        <div className="landing-logo-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <text x="3" y="19" fontFamily="system-ui" fontSize="18" fontWeight="800" fill="white">C</text>
          </svg>
        </div>
        <span>Campus Exchange</span>
      </div>

      <div className="landing-hero">
        <h1>Your campus marketplace, built for students</h1>
        <p>Buy, sell, rent, and borrow items securely within your university. Only verified Chitkara students can join.</p>
      </div>

      <div className="landing-actions">
        <Link to="/register" className="landing-btn-primary">
          Join Campus
        </Link>
        <div className="landing-divider">or</div>
        <Link to="/login" className="landing-btn-secondary">
          Sign In
        </Link>
      </div>

      <div className="landing-trust">
        <div className="landing-trust-item">
          <span className="landing-trust-num">100%</span>
          <span className="landing-trust-label">Verified students only</span>
        </div>
        <div className="landing-trust-item" style={{ width: 1, height: 36, background: 'var(--border)' }} />
        <div className="landing-trust-item">
          <span className="landing-trust-num">Free</span>
          <span className="landing-trust-label">No listing fees</span>
        </div>
        <div className="landing-trust-item" style={{ width: 1, height: 36, background: 'var(--border)' }} />
        <div className="landing-trust-item">
          <span className="landing-trust-num">Secure</span>
          <span className="landing-trust-label">Campus-only community</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   App Root
   -------------------------------------------------------------------------- */
export default function App() {
  const { ready, user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  if (!ready) return null;

  return (
    <>
      {/* Landing "/" route: show landing for guests, redirect auth users to /browse */}
      <Routes>
        <Route
          path="/"
          element={
            user
              ? <Navigate to="/browse" replace />
              : <LandingPage theme={theme} toggleTheme={toggleTheme} />
          }
        />
        {/* All other routes get the full Nav layout */}
        <Route path="/*" element={
          <>
            <VerificationBanner />
            <Nav theme={theme} toggleTheme={toggleTheme} />
            <main className="wrap">
              <Routes>
                <Route path="/browse" element={<Browse />} />
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
                      <Link to={user ? '/browse' : '/'} className="btn">Back to Home</Link>
                    </div>
                  }
                />
              </Routes>
            </main>
            <MobileNav />
          </>
        } />
      </Routes>
    </>
  );
}
