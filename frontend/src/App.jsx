import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth.jsx';
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
        ⚠️ Your university email (<strong>{user.email}</strong>) is not verified yet. Marketplace posting and requests require email verification.
      </span>
      {sentMsg ? (
        <span style={{ fontWeight: 700 }}>{sentMsg}</span>
      ) : (
        <button onClick={resend} disabled={sending}>
          {sending ? 'Sending...' : 'Resend verification link'}
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
            </>
          )}
        </nav>
        <div className="nav-end">
          {user ? (
            <>
              {user.verified && <span className="badge-verified">✓ Verified Student</span>}
              <Link to="/sell" className="btn">+ Sell an Item</Link>
              <button
                className="link"
                onClick={() => {
                  logout();
                  nav('/');
                }}
              >
                Sign out ({user.fullName?.split(' ')[0]})
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

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="wrap muted" style={{ paddingTop: '40px' }}>Loading session...</p>;
  return user ? children : <Navigate to="/login" replace />;
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
          <Route path="/my-listings" element={<Protected><MyListings /></Protected>} />
          <Route path="/requests" element={<Protected><Requests /></Protected>} />
          <Route path="/chat/:id" element={<Protected><Chat /></Protected>} />
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
    </>
  );
}
