import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Browse, ListingDetail, Sell, MyListings, Requests, Chat, Login, Register } from './pages.jsx';

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link to="/" className="brand">Campus Exchange</Link>
        <nav>
          <NavLink to="/">Browse</NavLink>
          {user && <><NavLink to="/my-listings">My listings</NavLink><NavLink to="/requests">Requests</NavLink></>}
        </nav>
        <div className="nav-end">
          {user ? <>
            <Link to="/sell" className="btn">Sell an item</Link>
            <button className="link" onClick={() => { logout(); nav('/'); }}>Sign out ({user.fullName.split(' ')[0]})</button>
          </> : <><Link to="/login" className="link">Sign in</Link><Link to="/register" className="btn">Join</Link></>}
        </div>
      </div>
    </header>
  );
}

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="wrap muted">Loading…</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { ready } = useAuth();
  if (!ready) return null;
  return (
    <>
      <Nav />
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/sell" element={<Protected><Sell /></Protected>} />
          <Route path="/my-listings" element={<Protected><MyListings /></Protected>} />
          <Route path="/requests" element={<Protected><Requests /></Protected>} />
          <Route path="/chat/:id" element={<Protected><Chat /></Protected>} />
          <Route path="*" element={<p>Page not found. <Link to="/">Back to browse</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
