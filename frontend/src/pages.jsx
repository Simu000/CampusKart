import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, conditionText, priceText } from './api';
import { useAuth } from './auth.jsx';

const Err = ({ msg }) => (msg ? <p className="error" role="alert">{msg}</p> : null);
const Tag = ({ t }) => <span className={'tag tag-' + t}>{t}</span>;

function Card({ l }) {
  const thumb = l.imageUrl || (l.images && l.images.length > 0 ? l.images[0] : null);
  return (
    <Link to={`/listing/${l.id}`} className="card">
      <div className="thumb">
        {thumb ? <img src={thumb} alt={l.title} loading="lazy" /> : <span>No photo</span>}
      </div>
      <div className="card-body">
        <div className="row">
          <strong className="price">{priceText(l)}</strong>
          <Tag t={l.transactionType} />
        </div>
        <h3>{l.title}</h3>
        <p className="muted">{l.categoryName} · <span className="badge-cond">{conditionText(l.itemCondition)}</span></p>
        <p className="muted" style={{ marginTop: 'auto', paddingTop: '8px' }}>
          Posted by {l.sellerName}{l.status !== 'AVAILABLE' && ' · (Unavailable)'}
        </p>
      </div>
    </Link>
  );
}

/* ==========================================================================
   1. Browse Marketplace Catalog
   ========================================================================== */
export function Browse() {
  const [f, setF] = useState({ q: '', type: '', category: 0, sort: 'newest', page: 0 });
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const set = (patch) => setF((p) => ({ ...p, page: 0, ...patch }));

  useEffect(() => {
    api('/categories').then(setCats).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setData(null);
    setError('');
    const qs = new URLSearchParams({
      q: f.q,
      type: f.type,
      category: f.category,
      sort: f.sort,
      page: f.page,
      size: 12,
    });
    api('/listings?' + qs).then(setData).catch((e) => setError(e.message));
  }, [f]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <section className="hero">
        <h1>Find what you need. Sell what you don't.</h1>
        <p>Buy, sell, rent, and borrow essentials securely within your campus.</p>
        <div className="search-bar-wrap">
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search Arduino, calculators, lab coats, textbooks..."
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
      </section>

      <div className="filters">
        <div className="pills">
          {[
            ['', 'All Items'],
            ['SELL', 'For Sale'],
            ['RENT', 'For Rent'],
            ['LEND', 'To Borrow'],
          ].map(([v, label]) => (
            <button
              key={v}
              className={'pill' + (f.type === v ? ' on' : '')}
              onClick={() => set({ type: v })}
            >
              {label}
            </button>
          ))}
        </div>

        <select value={f.category} onChange={(e) => set({ category: Number(e.target.value) })}>
          <option value={0}>All Categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">Newest First</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {error ? (
        <div className="state">
          <p className="error">{error}</p>
          <button className="btn" onClick={load}>Retry Loading</button>
        </div>
      ) : !data ? (
        <div className="grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="card skeleton" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="state">
          <h3>No items match your search.</h3>
          <p>Be the first to list this product for your classmates!</p>
          <Link to="/sell" className="btn">+ Create Listing</Link>
        </div>
      ) : (
        <>
          <div className="grid">
            {data.items.map((l) => (
              <Card key={l.id} l={l} />
            ))}
          </div>

          <div className="pager">
            <button
              className="btn ghost"
              disabled={f.page === 0}
              onClick={() => setF({ ...f, page: f.page - 1 })}
            >
              Previous
            </button>
            <span className="muted">
              Page {data.page + 1} of {Math.max(data.totalPages, 1)}
            </span>
            <button
              className="btn ghost"
              disabled={f.page + 1 >= data.totalPages}
              onClick={() => setF({ ...f, page: f.page + 1 })}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}

/* ==========================================================================
   2. Listing Details Screen
   ========================================================================== */
export function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [l, setL] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const presets = [
    "Hi, I'm interested in this item. Is it available?",
    "Can we discuss meeting on campus?",
    "I'd like to inspect this in person.",
  ];

  useEffect(() => {
    api('/listings/' + id)
      .then(setL)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="state"><p className="error">{error}</p></div>;
  if (!l) return <p className="muted" style={{ padding: '40px 0' }}>Loading item details...</p>;

  const mine = user && user.id === l.sellerId;
  const isUnverified = user && !user.verified;

  const send = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!user) return nav('/login');
    if (isUnverified) {
      return setError('Please verify your university email before sending item requests.');
    }
    try {
      await api('/requests', {
        method: 'POST',
        body: { listingId: l.id, quantity: Number(qty), note },
      });
      setMsg('Request sent! You can track the seller\'s response under Requests.');
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    if (!confirm('Are you sure you want to remove this listing?')) return;
    try {
      await api('/listings/' + l.id, { method: 'DELETE' });
      nav('/my-listings');
    } catch (err) {
      setError(err.message);
    }
  };

  const thumb = l.imageUrl || (l.images && l.images.length > 0 ? l.images[0] : null);

  return (
    <div className="detail">
      <div className="gallery">
        <div className="main-photo">
          {thumb ? (
            <img src={thumb} alt={l.title} />
          ) : (
            <div className="no-photo">No Photo Available</div>
          )}
        </div>
      </div>

      <div className="info">
        <div className="row">
          <Tag t={l.transactionType} />
          <span className="muted">{l.categoryName}</span>
        </div>
        <h1>{l.title}</h1>
        <p className="price-lg">{priceText(l)}</p>
        <p className="muted">
          Condition: <span className="badge-cond">{conditionText(l.itemCondition)}</span> · Available: <strong>{l.qtyAvailable}</strong> of {l.qtyTotal}
        </p>
        <p className="desc">{l.description}</p>

        <div className="seller-box">
          <p className="muted">Campus Seller</p>
          <p className="seller-name">{l.sellerName}</p>
        </div>

        {mine ? (
          <div className="mine-actions" style={{ background: '#f1f5f9', padding: '16px', borderRadius: '10px' }}>
            <p className="muted" style={{ marginBottom: '10px' }}>This is your listing.</p>
            <button className="btn danger ghost" onClick={remove}>Remove Listing</button>
          </div>
        ) : l.status !== 'AVAILABLE' || l.qtyAvailable <= 0 ? (
          <div className="box">
            <p className="muted">This item is currently reserved or unavailable.</p>
          </div>
        ) : (
          <form className="req-form" onSubmit={send}>
            <h3>Request This Item</h3>
            {isUnverified && (
              <p className="error" style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '6px' }}>
                ⚠️ You must verify your university email before you can request items. Check your inbox for the link.
              </p>
            )}
            <label>
              Quantity Needed
              <input
                type="number"
                min="1"
                max={l.qtyAvailable}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </label>
            <label>
              Introductory Note (Optional)
              <textarea
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Suggest a meetup location or ask a quick question..."
              />
            </label>
            <div className="presets">
              {presets.map((p) => (
                <button type="button" key={p} className="chip" onClick={() => setNote(p)}>
                  {p}
                </button>
              ))}
            </div>
            <Err msg={error} />
            {msg && <p className="ok">{msg}</p>}
            <button className="btn" disabled={!l.qtyAvailable || isUnverified}>
              Send Request to Seller
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   3. Create Product Listing
   ========================================================================== */
export function Sell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [f, setF] = useState({
    title: '',
    categoryId: '',
    description: '',
    itemCondition: 'GOOD',
    transactionType: 'SELL',
    quantity: 1,
    price: '',
    priceBasis: 'PER_DAY',
    imageUrl: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then((c) => {
      setCats(c);
      if (c[0]) setF((prev) => ({ ...prev, categoryId: c[0].id }));
    });
  }, []);

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user && !user.verified) {
    return (
      <div className="state form" style={{ textAlign: 'center', margin: '40px auto' }}>
        <h2>University Email Verification Required</h2>
        <p className="muted">
          To maintain a safe community, only verified students can list items for sale, rent, or lending.
        </p>
        <p>Please check your university email (<strong>{user.email}</strong>) to activate your account.</p>
        <Link to="/" className="btn ghost" style={{ marginTop: '12px' }}>Return to Browse</Link>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...f,
        categoryId: Number(f.categoryId),
        quantity: Number(f.quantity),
        price: f.transactionType === 'LEND' ? 0 : Number(f.price || 0),
        priceBasis: f.transactionType === 'RENT' ? f.priceBasis : 'NONE',
      };
      const res = await api('/listings', { method: 'POST', body: payload });
      nav('/listing/' + res.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>List an Item for Campus Exchange</h1>
      <p className="muted">Fill out the details below to offer your product to peers on campus.</p>

      <label>
        Product Title
        <input
          required
          placeholder="e.g. Arduino Uno R3, Scientific Calculator fx-991EX"
          value={f.title}
          onChange={up('title')}
        />
      </label>

      <label>
        Category
        <select value={f.categoryId} onChange={up('categoryId')}>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label>
        Description & Campus Pickup Details
        <textarea
          required
          rows={4}
          placeholder="Describe the condition, included parts, and preferred meetup spot (e.g. Central Library, Engineering Block)."
          value={f.description}
          onChange={up('description')}
        />
      </label>

      <div className="grid2">
        <label>
          Item Condition
          <select value={f.itemCondition} onChange={up('itemCondition')}>
            <option value="NEW">New (Unopened)</option>
            <option value="LIKE_NEW">Like New</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
          </select>
        </label>
        <label>
          Quantity Available
          <input type="number" min="1" required value={f.quantity} onChange={up('quantity')} />
        </label>
      </div>

      <label>Transaction Type</label>
      <div className="pills">
        {[
          ['SELL', 'Sell Permanently'],
          ['RENT', 'Rent Temporarily'],
          ['LEND', 'Lend for Free'],
        ].map(([v, l]) => (
          <button
            type="button"
            key={v}
            className={'pill' + (f.transactionType === v ? ' on' : '')}
            onClick={() => setF({ ...f, transactionType: v })}
          >
            {l}
          </button>
        ))}
      </div>

      {f.transactionType !== 'LEND' && (
        <div className="grid2">
          <label>
            Price (₹ INR)
            <input
              type="number"
              min="1"
              step="1"
              required
              value={f.price}
              onChange={up('price')}
              placeholder="350"
            />
          </label>
          {f.transactionType === 'RENT' && (
            <label>
              Rental Pricing Basis
              <select value={f.priceBasis} onChange={up('priceBasis')}>
                <option value="PER_DAY">per day</option>
                <option value="PER_WEEK">per week</option>
                <option value="PER_MONTH">per month</option>
              </select>
            </label>
          )}
        </div>
      )}

      <label>
        Photo URL (or Image link)
        <input
          type="url"
          placeholder="https://images.unsplash.com/..."
          value={f.imageUrl}
          onChange={up('imageUrl')}
        />
      </label>

      <Err msg={error} />
      <button className="btn" disabled={submitting}>
        {submitting ? 'Publishing Listing...' : 'Publish Listing'}
      </button>
    </form>
  );
}

/* ==========================================================================
   4. My Listings Screen
   ========================================================================== */
export function MyListings() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/listings/mine').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Remove this listing from the campus marketplace?')) return;
    try {
      await api('/listings/' + id, { method: 'DELETE' });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (error) return <div className="state"><p className="error">{error}</p></div>;
  if (!items) return <p className="muted" style={{ padding: '40px 0' }}>Loading your listings...</p>;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', margin: '20px 0' }}>
        <h1>My Listed Items</h1>
        <Link to="/sell" className="btn">+ New Listing</Link>
      </div>

      {items.length === 0 ? (
        <div className="state">
          <p>You haven't listed any items for sale, rent, or lending yet.</p>
          <Link to="/sell" className="btn">Post Your First Item</Link>
        </div>
      ) : (
        <div className="grid">
          {items.map((l) => (
            <div key={l.id} className="card">
              <div className="thumb">
                {l.imageUrl ? <img src={l.imageUrl} alt="" /> : <span>No photo</span>}
              </div>
              <div className="card-body">
                <div className="row">
                  <strong className="price">{priceText(l)}</strong>
                  <Tag t={l.transactionType} />
                </div>
                <h3>{l.title}</h3>
                <p className="muted">Available: {l.qtyAvailable} · Reserved: {l.qtyReserved}</p>
                <div className="row" style={{ marginTop: 'auto', gap: '.5rem', paddingTop: '12px' }}>
                  <Link to={'/listing/' + l.id} className="btn ghost" style={{ flex: 1 }}>View</Link>
                  <button className="btn danger ghost" onClick={() => remove(l.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ==========================================================================
   5. Requests Screen
   ========================================================================== */
export function Requests() {
  const [tab, setTab] = useState('received');
  const [sent, setSent] = useState(null);
  const [recv, setRecv] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api('/requests/sent').then(setSent).catch((e) => setError(e.message));
    api('/requests/received').then(setRecv).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const act = async (id, action) => {
    try {
      await api(`/requests/${id}/${action}`, { method: 'PATCH' });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const rows = tab === 'received' ? recv : sent;

  return (
    <>
      <h1 style={{ marginTop: '20px' }}>Exchange Requests</h1>
      <div className="pills">
        <button
          className={'pill' + (tab === 'received' ? ' on' : '')}
          onClick={() => setTab('received')}
        >
          Received Requests {recv ? `(${recv.length})` : ''}
        </button>
        <button
          className={'pill' + (tab === 'sent' ? ' on' : '')}
          onClick={() => setTab('sent')}
        >
          Sent Requests {sent ? `(${sent.length})` : ''}
        </button>
      </div>

      <Err msg={error} />
      {!rows ? (
        <p className="muted" style={{ padding: '30px 0' }}>Loading requests...</p>
      ) : rows.length === 0 ? (
        <div className="state">
          <p>No {tab} requests at the moment.</p>
        </div>
      ) : (
        <ul className="req-list">
          {rows.map((r) => (
            <li key={r.id} className="req-item">
              <div>
                <strong>{r.listingTitle}</strong>
                <p className="muted">
                  {tab === 'received' ? `Buyer: ${r.buyerName}` : `Seller: ${r.sellerName}`} · Qty: {r.quantity} · Status: <span className={'status-' + r.status}>{r.status}</span>
                </p>
                {r.note && <p className="muted" style={{ fontStyle: 'italic', color: '#334155', marginTop: '4px' }}>"{r.note}"</p>}
              </div>
              <div className="req-acts">
                {tab === 'received' && r.status === 'PENDING' && (
                  <>
                    <button className="btn" onClick={() => act(r.id, 'accept')}>Accept</button>
                    <button className="btn ghost" onClick={() => act(r.id, 'decline')}>Decline</button>
                  </>
                )}
                {tab === 'received' && r.status === 'ACCEPTED' && (
                  <button className="btn ghost" onClick={() => act(r.id, 'complete')}>
                    {r.transactionType === 'SELL' ? 'Mark Completed' : 'Mark Returned'}
                  </button>
                )}
                {tab === 'sent' && ['PENDING', 'ACCEPTED'].includes(r.status) && (
                  <button className="btn ghost" onClick={() => act(r.id, 'cancel')}>Cancel Request</button>
                )}
                {['ACCEPTED', 'COMPLETED'].includes(r.status) && (
                  <Link className="btn" to={'/chat/' + r.id}>Open Chat</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ==========================================================================
   6. Chat (Private Messaging on Accepted Requests)
   ========================================================================== */
export function Chat() {
  const { id } = useParams();
  const { user } = useAuth();
  const [req, setReq] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const end = useRef(null);

  const load = useCallback(() => {
    api(`/requests/${id}/messages`).then(setMsgs).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    api('/requests/' + id).then(setReq).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [id, load]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api(`/requests/${id}/messages`, { method: 'POST', body: { body: text } });
      setText('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="chat">
      <Link to="/requests" className="link" style={{ paddingLeft: 0, marginBottom: '8px', display: 'inline-block' }}>
        ← Back to Requests
      </Link>
      <h2>{req ? `${req.listingTitle} · ${user.id === req.buyerId ? req.sellerName : req.buyerName}` : 'Conversation'}</h2>
      <p className="muted">Coordinate your meetup spot on campus. Cash or UPI payments are settled in person.</p>

      <div className="msgs">
        {msgs.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
            No messages yet. Say hello and arrange a time and campus location!
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={'bubble' + (m.senderId === user.id ? ' me' : '')}>
            {m.body}
          </div>
        ))}
        <div ref={end} />
      </div>

      <Err msg={error} />
      {req?.status === 'ACCEPTED' ? (
        <form className="send" onSubmit={send}>
          <input
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message to your classmate..."
          />
          <button className="btn">Send</button>
        </form>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>This exchange conversation is completed or closed.</p>
      )}
    </div>
  );
}

/* ==========================================================================
   7. Email Verification Screen (/verify-email?token=xyz)
   ========================================================================== */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { reloadUser } = useAuth();
  const [status, setStatus] = useState(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState('');

  useEffect(() => {
    if (!token) return;
    api('/auth/verify-email?token=' + token)
      .then((data) => {
        setStatus('success');
        setMessage(data?.message || 'Your university email has been verified!');
        reloadUser();
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Verification token is invalid or expired.');
      });
  }, [token, reloadUser]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendStatus('Sending...');
    try {
      await api('/auth/resend-verification', { method: 'POST', body: { email: resendEmail } });
      setResendStatus('Verification link sent! Check your university email inbox.');
    } catch (err) {
      setResendStatus(err.message);
    }
  };

  return (
    <div className="form narrow" style={{ textAlign: 'center', margin: '40px auto' }}>
      {status === 'verifying' && (
        <>
          <h2>Verifying Your University Email...</h2>
          <p className="muted">Please wait while we confirm your campus credentials.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ fontSize: '3rem', color: 'var(--brand-600)' }}>✓</div>
          <h2>Account Verified!</h2>
          <p className="ok">{message}</p>
          <p className="muted">You now have complete access to buy, sell, rent, and lend on Campus Exchange.</p>
          <Link to="/" className="btn" style={{ marginTop: '16px' }}>Start Exploring Marketplace</Link>
        </>
      )}

      {(status === 'error' || status === 'idle') && (
        <>
          <h2>{status === 'error' ? 'Verification Link Expired or Invalid' : 'Verify Student Email'}</h2>
          {status === 'error' && <p className="error">{message}</p>}
          <p className="muted">Enter your university email below to receive a new activation link.</p>
          <form onSubmit={handleResend} style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            <input
              type="email"
              required
              placeholder="e.g. rollnumber@university.edu"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
            />
            {resendStatus && <p className="ok">{resendStatus}</p>}
            <button className="btn">Send Verification Link</button>
          </form>
          <p style={{ marginTop: '16px' }}>
            <Link to="/login" className="link">Back to Sign In</Link>
          </p>
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   8. Forgot Password Screen (/forgot-password)
   ========================================================================== */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setSubmitting(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMsg('If an account exists for this university email, a password reset link has been dispatched.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Reset Password</h1>
      <p className="muted">Enter your university email address and we'll send you a password recovery link.</p>
      <label>
        University Email
        <input
          type="email"
          required
          placeholder="yourname@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <Err msg={error} />
      {msg && <p className="ok">{msg}</p>}
      <button className="btn" disabled={submitting}>
        {submitting ? 'Sending Link...' : 'Send Recovery Link'}
      </button>
      <p className="muted" style={{ textAlign: 'center' }}>
        Remembered your password? <Link to="/login">Sign in</Link>
      </p>
    </form>
  );
}

/* ==========================================================================
   9. Reset Password Screen (/reset-password?token=xyz)
   ========================================================================== */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="state form narrow">
        <h2>Invalid Password Reset Link</h2>
        <p className="muted">No recovery token was provided. Please request a new link.</p>
        <Link to="/forgot-password" className="btn">Request New Link</Link>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError("Passwords don't match");
    setSubmitting(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      setMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => nav('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Set New Password</h1>
      <label>
        New Password (8+ characters)
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        Confirm New Password
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <Err msg={error} />
      {msg && <p className="ok">{msg}</p>}
      <button className="btn" disabled={submitting}>
        {submitting ? 'Updating Password...' : 'Save New Password'}
      </button>
    </form>
  );
}

/* ==========================================================================
   10. Sign In Screen
   ========================================================================== */
export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(f.email, f.password);
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Sign In to Campus Exchange</h1>
      <p className="muted">Access campus marketplace listings, requests, and private chats.</p>
      <label>
        University Email
        <input
          type="email"
          required
          placeholder="yourname@university.edu"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
      </label>
      <div style={{ textAlign: 'right' }}>
        <Link to="/forgot-password" className="link" style={{ fontSize: '0.85rem' }}>Forgot password?</Link>
      </div>
      <Err msg={error} />
      <button className="btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      <p className="muted" style={{ textAlign: 'center' }}>
        New student? <Link to="/register">Create an account</Link>
      </p>
    </form>
  );
}

/* ==========================================================================
   11. Registration Screen
   ========================================================================== */
export function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({
    fullName: '',
    email: '',
    password: '',
    confirm: '',
    department: '',
    studyYear: '1st Year',
  });
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) {
      return setError("Passwords don't match");
    }
    setLoading(true);
    try {
      await register({
        fullName: f.fullName,
        email: f.email,
        password: f.password,
        department: f.department,
        studyYear: f.studyYear,
      });
      setRegisteredEmail(f.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (registeredEmail) {
    return (
      <div className="form narrow" style={{ textAlign: 'center', margin: '40px auto' }}>
        <div style={{ fontSize: '3rem', color: 'var(--brand-600)' }}>📬</div>
        <h2>Almost Done! Verify Your Email</h2>
        <p className="muted" style={{ margin: '14px 0' }}>
          We've sent an activation link to <strong>{registeredEmail}</strong>.
        </p>
        <p className="muted">
          Please open the verification link in your university inbox to verify your student status.
        </p>
        <div style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Link to="/" className="btn">Browse Marketplace</Link>
          <Link to="/verify-email" className="btn ghost">Verification Help</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Join Campus Exchange</h1>
      <p className="muted">University email is required to maintain a trusted campus community.</p>

      <label>
        Full Name
        <input required placeholder="e.g. Rahul Sharma" value={f.fullName} onChange={up('fullName')} />
      </label>

      <label>
        University Email Address
        <input
          type="email"
          required
          placeholder="e.g. rollnumber@university.edu"
          value={f.email}
          onChange={up('email')}
        />
      </label>

      <div className="grid2">
        <label>
          Department
          <input placeholder="e.g. Computer Science" value={f.department} onChange={up('department')} />
        </label>
        <label>
          Year of Study
          <select value={f.studyYear} onChange={up('studyYear')}>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
            <option value="Postgraduate">Postgraduate</option>
          </select>
        </label>
      </div>

      <label>
        Password (8+ characters)
        <input
          type="password"
          required
          minLength={8}
          placeholder="Min 8 characters"
          value={f.password}
          onChange={up('password')}
        />
      </label>

      <label>
        Confirm Password
        <input
          type="password"
          required
          placeholder="Re-enter password"
          value={f.confirm}
          onChange={up('confirm')}
        />
      </label>

      <Err msg={error} />
      <button className="btn" disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Student Account'}
      </button>

      <p className="muted" style={{ textAlign: 'center' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </form>
  );
}
