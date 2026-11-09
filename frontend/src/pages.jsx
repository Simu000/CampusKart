import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, conditionText, priceText } from './api';
import { useAuth } from './auth.jsx';

const Err = ({ msg }) => (msg ? <p className="error" role="alert">{msg}</p> : null);
const Tag = ({ t }) => <span className={'tag tag-' + t}>{t}</span>;

function Card({ l }) {
  const thumb = l.imageUrl || (l.images && l.images.length > 0 ? l.images[0] : null);
  return (
    <Link to={`/listing/${l.id}`} className="card">
      <div className="thumb">{thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>No photo</span>}</div>
      <div className="card-body">
        <div className="row"><strong className="price">{priceText(l)}</strong><Tag t={l.transactionType} /></div>
        <h3>{l.title}</h3>
        <p className="muted">{l.categoryName} · {conditionText(l.itemCondition)}</p>
        <p className="muted">{l.sellerName}{l.status !== 'AVAILABLE' && ' · Unavailable'}</p>
      </div>
    </Link>
  );
}

/* ---------- Browse ---------- */
export function Browse() {
  const [f, setF] = useState({ q: '', type: '', category: 0, sort: 'newest', page: 0 });
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const set = (patch) => setF((p) => ({ ...p, page: 0, ...patch }));

  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  const load = useCallback(() => {
    setData(null); setError('');
    const qs = new URLSearchParams({ q: f.q, type: f.type, category: f.category, sort: f.sort, page: f.page, size: 12 });
    api('/listings?' + qs).then(setData).catch((e) => setError(e.message));
  }, [f]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <>
      <section className="hero">
        <h1>Find what you need. Sell what you don't.</h1>
        <p>Buy, sell, rent and borrow within your campus.</p>
        <input className="search" placeholder="Search Arduino, calculator, textbook..." value={f.q} onChange={(e) => set({ q: e.target.value })} />
      </section>
      <div className="filters">
        <div className="pills">
          {[['', 'All'], ['SELL', 'Sell'], ['RENT', 'Rent'], ['LEND', 'Lend']].map(([v, label]) => (
            <button key={v} className={'pill' + (f.type === v ? ' on' : '')} onClick={() => set({ type: v })}>{label}</button>
          ))}
        </div>
        <select value={f.category} onChange={(e) => set({ category: Number(e.target.value) })}>
          <option value={0}>All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">Newest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
        </select>
      </div>
      {error ? <div className="state"><p className="error">{error}</p><button className="btn" onClick={load}>Retry</button></div>
        : !data ? <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card skeleton" />)}</div>
        : data.items.length === 0 ? <div className="state"><p>No listings match yet.</p><Link to="/sell" className="btn">Create the first listing</Link></div>
        : <>
            <div className="grid">{data.items.map((l) => <Card key={l.id} l={l} />)}</div>
            <div className="pager">
              <button className="btn ghost" disabled={f.page === 0} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</button>
              <span className="muted">Page {data.page + 1} of {Math.max(data.totalPages, 1)}</span>
              <button className="btn ghost" disabled={f.page + 1 >= data.totalPages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</button>
            </div>
          </>}
    </>
  );
}

/* ---------- Listing detail + request form ---------- */
export function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [l, setL] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const presets = ['Hi, I\'m interested in this item. Is it available?', 'Can we discuss the price?', 'I\'m interested in renting this item.'];

  useEffect(() => { api('/listings/' + id).then(setL).catch((e) => setError(e.message)); }, [id]);
  if (error) return <p className="error">{error}</p>;
  if (!l) return <p className="muted">Loading...</p>;
  const mine = user && user.id === l.sellerId;

  const send = async (e) => {
    e.preventDefault(); setError(''); setMsg('');
    if (!user) return nav('/login');
    try {
      await api('/requests', { method: 'POST', body: { listingId: l.id, quantity: Number(qty), note } });
      setMsg('Request sent. You will see the seller\'s response under Requests.');
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    if (!confirm('Remove this listing?')) return;
    try { await api('/listings/' + l.id, { method: 'DELETE' }); nav('/my-listings'); } catch (err) { setError(err.message); }
  };

  const thumb = l.imageUrl || (l.images && l.images.length > 0 ? l.images[0] : null);

  return (
    <div className="detail">
      <div className="gallery">
        <div className="main-photo">
          {thumb ? <img src={thumb} alt={l.title} /> : <div className="no-photo">No photo provided</div>}
        </div>
      </div>
      <div className="info">
        <div className="row"><Tag t={l.transactionType} /><span className="muted">{l.categoryName}</span></div>
        <h1>{l.title}</h1>
        <p className="price-lg">{priceText(l)}</p>
        <p className="muted">Condition: <strong>{conditionText(l.itemCondition)}</strong> · Available: <strong>{l.qtyAvailable}</strong> of {l.qtyTotal}</p>
        <p className="desc">{l.description}</p>
        <div className="seller-box">
          <p className="muted">Posted by</p>
          <p className="seller-name">{l.sellerName}</p>
        </div>

        {mine ? (
          <div className="mine-actions">
            <p className="muted">This is your listing.</p>
            <button className="btn danger" onClick={remove}>Remove listing</button>
          </div>
        ) : l.status !== 'AVAILABLE' || l.qtyAvailable <= 0 ? (
          <p className="muted">This item is currently unavailable.</p>
        ) : (
          <form className="req-form" onSubmit={send}>
            <h3>Request this item</h3>
            <label>Quantity
              <input type="number" min="1" max={l.qtyAvailable} value={qty} onChange={(e) => setQty(e.target.value)} required />
            </label>
            <label>Introductory note (optional)
              <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say hi or suggest a meetup spot on campus" />
            </label>
            <div className="presets">
              {presets.map((p) => <button type="button" key={p} className="chip" onClick={() => setNote(p)}>{p}</button>)}
            </div>
            <Err msg={error} />
            {msg && <p className="ok">{msg}</p>}
            <button className="btn" disabled={!l.qtyAvailable}>Send request</button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- Create listing ---------- */
export function Sell() {
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [f, setF] = useState({
    title: '', categoryId: '', description: '', itemCondition: 'GOOD', transactionType: 'SELL',
    quantity: 1, price: '', priceBasis: 'PER_DAY', imageUrl: ''
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

  const submit = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true);
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
      <h1>List an item</h1>
      <label>Product name<input required placeholder="e.g. Arduino Uno R3, Scientific calculator" value={f.title} onChange={up('title')} /></label>
      <label>Category
        <select value={f.categoryId} onChange={up('categoryId')}>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Description<textarea required rows={4} placeholder="Describe the item condition, accessories included, and pickup preferences on campus." value={f.description} onChange={up('description')} /></label>

      <div className="grid2">
        <label>Condition
          <select value={f.itemCondition} onChange={up('itemCondition')}>
            <option value="NEW">New</option><option value="LIKE_NEW">Like new</option>
            <option value="GOOD">Good</option><option value="FAIR">Fair</option>
          </select>
        </label>
        <label>Quantity<input type="number" min="1" required value={f.quantity} onChange={up('quantity')} /></label>
      </div>

      <label>Transaction type</label>
      <div className="pills">
        {[['SELL', 'Sell permanently'], ['RENT', 'Rent out'], ['LEND', 'Lend for free']].map(([v, l]) => (
          <button type="button" key={v} className={'pill' + (f.transactionType === v ? ' on' : '')} onClick={() => setF({ ...f, transactionType: v })}>{l}</button>
        ))}
      </div>

      {f.transactionType !== 'LEND' && (
        <div className="grid2">
          <label>Price (₹)<input type="number" min="1" step="1" required value={f.price} onChange={up('price')} placeholder="350" /></label>
          {f.transactionType === 'RENT' && (
            <label>Rental basis
              <select value={f.priceBasis} onChange={up('priceBasis')}>
                <option value="PER_DAY">per day</option><option value="PER_WEEK">per week</option><option value="PER_MONTH">per month</option>
              </select>
            </label>
          )}
        </div>
      )}

      <label>Photo URL (or uploads)<input type="url" placeholder="https://..." value={f.imageUrl} onChange={up('imageUrl')} /></label>

      <Err msg={error} />
      <button className="btn" disabled={submitting}>{submitting ? 'Publishing...' : 'Publish listing'}</button>
    </form>
  );
}

/* ---------- My listings ---------- */
export function MyListings() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/listings/mine').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm('Remove this listing?')) return;
    try { await api('/listings/' + id, { method: 'DELETE' }); load(); } catch (err) { alert(err.message); }
  };

  if (error) return <p className="error">{error}</p>;
  if (!items) return <p className="muted">Loading...</p>;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>My listings</h1>
        <Link to="/sell" className="btn">Add listing</Link>
      </div>
      {items.length === 0 ? <div className="state"><p>You haven't listed anything yet.</p></div> : (
        <div className="grid">
          {items.map((l) => (
            <div key={l.id} className="card">
              <div className="thumb">{l.imageUrl ? <img src={l.imageUrl} alt="" /> : <span>No photo</span>}</div>
              <div className="card-body">
                <div className="row"><strong className="price">{priceText(l)}</strong><Tag t={l.transactionType} /></div>
                <h3>{l.title}</h3>
                <p className="muted">Available: {l.qtyAvailable} · Reserved: {l.qtyReserved}</p>
                <div className="row" style={{ marginTop: 'auto', gap: '.5rem' }}>
                  <Link to={'/listing/' + l.id} className="btn ghost">View</Link>
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

/* ---------- Requests (sent & received) ---------- */
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
    try { await api(`/requests/${id}/${action}`, { method: 'PATCH' }); load(); } catch (err) { alert(err.message); }
  };

  const rows = tab === 'received' ? recv : sent;

  return (
    <>
      <h1>Requests</h1>
      <div className="pills">
        <button className={'pill' + (tab === 'received' ? ' on' : '')} onClick={() => setTab('received')}>Received {recv ? `(${recv.length})` : ''}</button>
        <button className={'pill' + (tab === 'sent' ? ' on' : '')} onClick={() => setTab('sent')}>Sent {sent ? `(${sent.length})` : ''}</button>
      </div>
      <Err msg={error} />
      {!rows ? <p className="muted">Loading...</p> : rows.length === 0 ? <div className="state"><p>No {tab} requests yet.</p></div> : (
        <ul className="req-list">{rows.map((r) => (
          <li key={r.id} className="req-item">
            <div>
              <strong>{r.listingTitle}</strong>
              <p className="muted">
                {tab === 'received' ? `From: ${r.buyerName}` : `Seller: ${r.sellerName}`} · Qty: {r.quantity} · Status: <span className={'status-' + r.status}>{r.status}</span>
              </p>
              {r.note && <p className="note">"{r.note}"</p>}
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
                  {r.transactionType === 'SELL' ? 'Mark sold' : 'Mark returned'}
                </button>
              )}
              {tab === 'sent' && ['PENDING', 'ACCEPTED'].includes(r.status) && (
                <button className="btn ghost" onClick={() => act(r.id, 'cancel')}>Cancel</button>
              )}
              {['ACCEPTED', 'COMPLETED'].includes(r.status) && (
                <Link className="btn" to={'/chat/' + r.id}>Open chat</Link>
              )}
            </div>
          </li>
        ))}</ul>
      )}
    </>
  );
}

/* ---------- Chat (polls every 4s) ---------- */
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

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs.length]);

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
      <Link to="/requests" className="muted">← Back to Requests</Link>
      <h2>{req ? `${req.listingTitle} · ${user.id === req.buyerId ? req.sellerName : req.buyerName}` : 'Chat'}</h2>
      <div className="msgs">
        {msgs.length === 0 && <p className="muted">No messages yet. Agree on price, pickup location, and return arrangements here.</p>}
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
          <input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Write a message..." />
          <button className="btn">Send</button>
        </form>
      ) : (
        <p className="muted">This conversation is closed.</p>
      )}
    </div>
  );
}

/* ---------- Login / Register ---------- */
export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(f.email, f.password);
      nav('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Sign in</h1>
      <label>University email
        <input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </label>
      <label>Password
        <input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </label>
      <Err msg={error} />
      <button className="btn">Sign in</button>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
    </form>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) {
      return setError("Passwords don't match");
    }
    try {
      await register({ fullName: f.fullName, email: f.email, password: f.password });
      nav('/');
    } catch (err) {
      setError(err.message);
    }
  };

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="form narrow" onSubmit={submit}>
      <h1>Join Campus Exchange</h1>
      <label>Full name
        <input required value={f.fullName} onChange={up('fullName')} />
      </label>
      <label>University email
        <input type="email" required value={f.email} onChange={up('email')} />
      </label>
      <label>Password (8+ characters)
        <input type="password" required minLength={8} value={f.password} onChange={up('password')} />
      </label>
      <label>Confirm password
        <input type="password" required value={f.confirm} onChange={up('confirm')} />
      </label>
      <Err msg={error} />
      <button className="btn">Create account</button>
      <p className="muted">Already have an account? <Link to="/login">Sign in</Link></p>
    </form>
  );
}
