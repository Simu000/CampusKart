import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, conditionText, priceText } from './api';
import { useAuth } from './auth.jsx';
import ReportModal from './components/ReportModal.jsx';
import { blockApi } from './services/adminApi.js';

const Err = ({ msg }) => (msg ? <p className="error" role="alert">{msg}</p> : null);
const Tag = ({ t }) => <span className={'tag tag-' + t}>{t}</span>;

function Card({ l }) {
  const thumb = l.imageUrl || (l.images && l.images.length > 0 ? l.images[0] : null);
  return (
    <div className="card">
      <Link to={`/listing/${l.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="thumb">
          {thumb ? <img src={thumb} alt={l.title} loading="lazy" /> : <span>No photo</span>}
        </div>
      </Link>
      <div className="card-body">
        <div className="row">
          <strong className="price">{priceText(l)}</strong>
          <Tag t={l.transactionType} />
        </div>
        <Link to={`/listing/${l.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>{l.title}</h3>
        </Link>
        <p className="muted">{l.categoryName} · <span className="badge-cond">{conditionText(l.itemCondition)}</span></p>
        <div className="row" style={{ marginTop: 'auto', paddingTop: '8px' }}>
          <Link to={`/profile/${l.sellerId}`} className="link" style={{ padding: 0, fontSize: '0.85rem' }}>
            By {l.sellerName}
          </Link>
          {l.status !== 'AVAILABLE' && <span className="muted" style={{ fontSize: '0.8rem' }}>(Unavailable)</span>}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   1. Browse Marketplace Catalog (with enhanced price & condition filters)
   ========================================================================== */
export function Browse() {
  const [f, setF] = useState({
    q: '',
    type: '',
    category: 0,
    condition: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    page: 0,
  });
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
      condition: f.condition,
      sort: f.sort,
      page: f.page,
      size: 12,
    });
    if (f.minPrice) qs.set('minPrice', f.minPrice);
    if (f.maxPrice) qs.set('maxPrice', f.maxPrice);

    api('/listings?' + qs).then(setData).catch((e) => setError(e.message));
  }, [f]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const clearFilters = () => {
    setF({ q: '', type: '', category: 0, condition: '', minPrice: '', maxPrice: '', sort: 'newest', page: 0 });
  };

  const hasActiveFilters = f.q || f.type || f.category !== 0 || f.condition || f.minPrice || f.maxPrice;

  return (
    <>
      <section className="hero">
        <h1>Find what you need. Sell what you don't.</h1>
        <p>Buy, sell, rent, and borrow essentials securely within your campus.</p>
        <div className="search-bar-wrap">
          <span className="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
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
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select value={f.condition} onChange={(e) => set({ condition: e.target.value })}>
          <option value="">All Conditions</option>
          <option value="NEW">New (Unopened)</option>
          <option value="LIKE_NEW">Like New</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
        </select>

        <div className="price-inputs">
          <input
            type="number"
            placeholder="Min ₹"
            value={f.minPrice}
            onChange={(e) => set({ minPrice: e.target.value })}
          />
          <span className="muted">-</span>
          <input
            type="number"
            placeholder="Max ₹"
            value={f.maxPrice}
            onChange={(e) => set({ maxPrice: e.target.value })}
          />
        </div>

        <select value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">Newest First</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>

        {hasActiveFilters && (
          <button className="link" onClick={clearFilters} style={{ fontSize: '0.85rem' }}>
            Reset Filters
          </button>
        )}
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
          <h3>No items match your filters.</h3>
          <p>Try clearing your search query or price bounds.</p>
          <button className="btn ghost" onClick={clearFilters} style={{ marginTop: '10px' }}>Clear All Filters</button>
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
   2. Listing Details Screen (with interactive multi-photo gallery)
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
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showReport, setShowReport] = useState(false);

  const presets = [
    "Hi, I'm interested in this item. Is it available?",
    "Can we discuss meeting on campus?",
    "I'd like to inspect this in person.",
  ];

  useEffect(() => {
    api('/listings/' + id)
      .then((data) => {
        setL(data);
        setActivePhotoIdx(0);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="state"><p className="error">{error}</p></div>;
  if (!l) return <p className="muted" style={{ padding: '40px 0' }}>Loading item details...</p>;

  const mine = user && user.id === l.sellerId;
  const isUnverified = user && !user.verified;

  const galleryImages = l.images && l.images.length > 0
    ? l.images
    : (l.imageUrl ? [l.imageUrl] : []);

  const currentPhoto = galleryImages[activePhotoIdx] || l.imageUrl;

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

  return (
    <div className="detail">
      <div className="gallery">
        <div className="main-photo">
          {currentPhoto ? (
            <img src={currentPhoto} alt={l.title} />
          ) : (
            <div className="no-photo">No Photo Available</div>
          )}
        </div>

        {galleryImages.length > 1 && (
          <div className="gallery-thumbs">
            {galleryImages.map((imgUrl, idx) => (
              <div
                key={idx}
                className={'gallery-thumb' + (idx === activePhotoIdx ? ' active' : '')}
                onClick={() => setActivePhotoIdx(idx)}
              >
                <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} />
              </div>
            ))}
          </div>
        )}
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
          <Link to={`/profile/${l.sellerId}`} className="seller-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>{l.sellerName}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--brand-600)' }}>View Profile →</span>
          </Link>
        </div>

        {mine ? (
          <div className="mine-actions" style={{ background: '#f1f5f9', padding: '16px', borderRadius: '10px' }}>
            <p className="muted" style={{ marginBottom: '10px' }}>This is your listing.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to={`/edit-listing/${l.id}`} className="btn">Edit Listing</Link>
              <button className="btn danger ghost" onClick={remove}>Remove Listing</button>
            </div>
          </div>
        ) : l.status !== 'AVAILABLE' || l.qtyAvailable <= 0 ? (
          <div className="box">
            <p className="muted">This item is currently reserved or unavailable.</p>
          </div>
        ) : (
          <form className="req-form" onSubmit={send}>
            <h3>Request This Item</h3>
            {isUnverified && (
              <p className="error" style={{ background: 'var(--danger-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--danger)' }}>
                You must verify your university email before you can request items. Check your inbox for the verification link.
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

        {!mine && user && (
          <div style={{ marginTop: '18px', textAlign: 'center' }}>
            <button
              className="link"
              style={{ fontSize: '0.82rem', color: 'var(--ink-400)' }}
              onClick={() => setShowReport(true)}
            >
              Report this listing
            </button>
          </div>
        )}

        {showReport && (
          <ReportModal
            listingId={l.id}
            targetTitle={l.title}
            onClose={() => setShowReport(false)}
            onSuccess={() => alert('Report submitted. Thank you for helping keep campus exchange safe.')}
          />
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   3. Create Product Listing (with Multi-File Uploader & Previews)
   ========================================================================== */
export function Sell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const fileInputRef = useRef(null);
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

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then((c) => {
      setCats(c);
      if (c[0]) setF((prev) => ({ ...prev, categoryId: c[0].id }));
    });
  }, []);

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 5) {
      alert('You can upload a maximum of 5 images per listing.');
      return;
    }
    const updated = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(updated);
    setFilePreviews(updated.map((file) => URL.createObjectURL(file)));
  };

  const removeFile = (idx) => {
    const updated = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(updated);
    setFilePreviews(updated.map((file) => URL.createObjectURL(file)));
  };

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

      // 1. Create the listing
      const created = await api('/listings', { method: 'POST', body: payload });

      // 2. Upload any selected photo files
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          await api(`/listings/${created.id}/images`, { method: 'POST', body: formData });
        }
      }

      nav('/listing/' + created.id);
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

      <div>
        <label>Upload Photos (Up to 5 images)</label>
        <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
          <p style={{ fontWeight: 600, color: 'var(--ink-700)' }}>Click to upload photo files</p>
          <p className="muted" style={{ fontSize: '0.8rem' }}>Supports JPG, PNG, WEBP up to 5MB each</p>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {filePreviews.length > 0 && (
          <div className="upload-previews">
            {filePreviews.map((src, i) => (
              <div key={i} className="upload-preview">
                <img src={src} alt={`Preview ${i + 1}`} />
                <button type="button" className="remove-btn" onClick={() => removeFile(i)}>✕</button>
                {i === 0 && <span className="primary-tag">Primary</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <label>
        Or paste an Image URL (Optional)
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
   4. Public Student Seller Profile (/profile/:id)
   ========================================================================== */
export function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [blockMsg, setBlockMsg] = useState('');

  useEffect(() => {
    api(`/users/${id}/public-profile`)
      .then(setProfile)
      .catch((e) => setError(e.message));

    if (user && user.id !== Number(id)) {
      blockApi.getBlocked().then((list) => {
        setIsBlocked(list.some((u) => u.id === Number(id)));
      }).catch(() => {});
    }
  }, [id, user]);

  const handleBlockToggle = async () => {
    try {
      if (isBlocked) {
        await blockApi.unblock(id);
        setIsBlocked(false);
        setBlockMsg('Student unblocked');
      } else {
        await blockApi.block(id);
        setIsBlocked(true);
        setBlockMsg('Student blocked. They can no longer contact you.');
      }
      setTimeout(() => setBlockMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className="state"><p className="error">{error}</p></div>;
  if (!profile) return <p className="muted" style={{ padding: '40px 0' }}>Loading student profile...</p>;

  const initials = profile.fullName
    ? profile.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const joinedYear = profile.joinedAt
    ? new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <>
      <div className="profile-card">
        <div className="avatar-circle">
          {profile.profileImageUrl ? (
            <img src={profile.profileImageUrl} alt={profile.fullName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="profile-info">
          <h1>{profile.fullName}</h1>
          <div className="profile-meta">
          {profile.verified && <span style={{ fontSize: '0.82rem', color: 'var(--brand-600)', fontWeight: 600 }}>Verified Campus Member</span>}
            {profile.department && <span>Department: <strong>{profile.department}</strong></span>}
            {profile.studyYear && <span>{profile.studyYear}</span>}
            <span>Member since: {joinedYear}</span>
          </div>
          {user && user.id !== Number(id) && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
              <button
                className="btn ghost"
                style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                onClick={handleBlockToggle}
              >
                {isBlocked ? 'Unblock Student' : 'Block Student'}
              </button>
              <button
                className="btn ghost danger"
                style={{ padding: '4px 12px', fontSize: '0.82rem' }}
                onClick={() => setShowReport(true)}
              >
                Report Student
              </button>
              {blockMsg && <span className="ok" style={{ fontSize: '0.82rem' }}>{blockMsg}</span>}
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <ReportModal
          reportedUserId={id}
          targetTitle={profile.fullName}
          onClose={() => setShowReport(false)}
          onSuccess={() => alert('Report submitted. Thank you for helping keep campus exchange safe.')}
        />
      )}

      <h2>Active Items ({profile.activeListingsCount})</h2>
      {profile.activeListings.length === 0 ? (
        <div className="state">
          <p>This student currently has no active marketplace listings.</p>
        </div>
      ) : (
        <div className="grid">
          {profile.activeListings.map((l) => (
            <Card key={l.id} l={l} />
          ))}
        </div>
      )}
    </>
  );
}

/* ==========================================================================
   5. My Listings Screen
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
   6. Requests Screen
   ========================================================================== */
export function Requests() {
  const [tab, setTab] = useState('received');
  const [sent, setSent] = useState(null);
  const [recv, setRecv] = useState(null);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null); // { requestId, action, label }

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

  const handleConfirmCompletion = (requestId, transactionType) => {
    const label = transactionType === 'SELL' ? 'hand over the item to the buyer' : 'return/receive the item from your classmate';
    setConfirmModal({ requestId, action: 'confirm-completion', label });
  };

  const rows = tab === 'received' ? recv : sent;

  return (
    <>
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="modal confirm-modal-box" onClick={e => e.stopPropagation()}>
            <h3>Confirm Exchange Completion</h3>
            <p>
              Please only confirm if you have already physically <strong>{confirmModal.label}</strong>.
            </p>
            <div className="confirm-modal-warning">
              Once marked complete, this chat will be permanently closed and you will no longer be able to send messages.
            </div>
            <div className="confirm-modal-actions">
              <button className="btn ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className="btn"
                onClick={() => {
                  act(confirmModal.requestId, confirmModal.action);
                  setConfirmModal(null);
                }}
              >
                Yes, exchange is complete
              </button>
            </div>
          </div>
        </div>
      )}

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
                {r.status === 'ACCEPTED' && (
                  <>
                    {r.peerHasConfirmed && (
                      <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>
                        ✓ Classmate confirmed
                      </span>
                    )}
                    {r.canConfirm && (
                      <button className="btn" onClick={() => handleConfirmCompletion(r.id, r.transactionType)}>
                        {r.transactionType === 'SELL' ? 'Confirm Exchange' : 'Confirm Return'}
                      </button>
                    )}
                    {r.awaitingPeerConfirmation && (
                      <span style={{ color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '99px', fontSize: '0.82rem', fontWeight: 600 }}>
                        ✓ You confirmed · Awaiting peer
                      </span>
                    )}
                  </>
                )}
                {tab === 'sent' && r.status === 'PENDING' && (
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
   7. Chat (Private Messaging on Accepted Requests)
   ========================================================================== */
export function Chat() {
  const { id } = useParams();
  const { user } = useAuth();
  const [req, setReq] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
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

  const peerId = req ? (user.id === req.buyerId ? req.sellerId : req.buyerId) : null;
  const peerName = req ? (user.id === req.buyerId ? req.sellerName : req.buyerName) : 'Classmate';

  return (
    <div className="chat">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <Link to="/requests" className="link" style={{ paddingLeft: 0 }}>
          ← Back to Requests
        </Link>
        {peerId && (
          <button
            className="link"
            style={{ fontSize: '0.82rem', color: 'var(--danger)' }}
            onClick={() => setShowReport(true)}
          >
            Report Student
          </button>
        )}
      </div>
      <h2>{req ? `${req.listingTitle} · ${peerName}` : 'Conversation'}</h2>
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

      {showReport && peerId && (
        <ReportModal
          reportedUserId={peerId}
          targetTitle={peerName}
          onClose={() => setShowReport(false)}
          onSuccess={() => alert('Report submitted. Our moderation team will investigate.')}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   8. Email Verification Screen (/verify-email?token=xyz)
   ========================================================================== */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { reloadUser, startSession } = useAuth();
  const [status, setStatus] = useState(token ? 'verifying' : 'idle');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState('');
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!token || verifyingRef.current) return;
    verifyingRef.current = true;

    api('/auth/verify-email?token=' + encodeURIComponent(token))
      .then((data) => {
        if (data?.token) {
          localStorage.setItem('token', data.token);
        }
        if (startSession) {
          startSession(data);
        }
        setStatus('success');
        setMessage(data?.message || 'Your university email has been verified!');
        reloadUser();
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Verification token is invalid or expired.');
      });
  }, [token, reloadUser, startSession]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendStatus('Sending verification email...');
    try {
      await api('/auth/resend-verification', { method: 'POST', body: { email: resendEmail } });
      setResendStatus('Verification email sent! Please check your university email inbox.');
    } catch (err) {
      setResendStatus(err.message || 'Failed to send verification email.');
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
          <div style={{ width: 56, height: 56, background: 'var(--brand-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', border: '2px solid var(--brand-600)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
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
          <p className="muted">Enter your university email below to receive a verification email link.</p>
          <form onSubmit={handleResend} style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            <input
              type="email"
              required
              placeholder="e.g. rollnumber@chitkara.edu.in"
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
   9. Forgot Password Screen (/forgot-password)
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
      setMsg('If an account exists for this university email, a password reset link has been dispatched to your email inbox.');
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
          placeholder="yourname@chitkara.edu.in"
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
   10. Reset Password Screen (/reset-password?token=xyz)
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
   11. Sign In Screen
   ========================================================================== */
export function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/browse" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(f.email, f.password);
      nav('/browse');
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
          placeholder="yourname@chitkara.edu.in"
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
      {error && error.toLowerCase().includes('not verified') && (
        <div style={{ margin: '10px 0', textAlign: 'center' }}>
          <button
            type="button"
            className="link"
            style={{ fontSize: '0.85rem' }}
            onClick={async () => {
              if (!f.email) return;
              try {
                await api('/auth/resend-verification', { method: 'POST', body: { email: f.email } });
                alert('Verification email resent! Please check your Chitkara email inbox.');
              } catch (e) {
                alert(e.message);
              }
            }}
          >
            Resend verification email to {f.email}
          </button>
        </div>
      )}
      <button className="btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      <p className="muted" style={{ textAlign: 'center' }}>
        New student? <Link to="/register">Create an account</Link>
      </p>
    </form>
  );
}

/* ==========================================================================
   12. Registration Screen
   ========================================================================== */
export function Register() {
  const { user, register } = useAuth();
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
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  if (user) {
    return <Navigate to="/browse" replace />;
  }

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

  const handleResend = async () => {
    setResending(true);
    setResendMsg('');
    try {
      await api('/auth/resend-verification', { method: 'POST', body: { email: registeredEmail } });
      setResendMsg('Verification email resent! Please check your Chitkara email inbox.');
    } catch (err) {
      setResendMsg(err.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (registeredEmail) {
    return (
      <div className="form narrow" style={{ textAlign: 'center', margin: '40px auto' }}>
        <div style={{ width: 48, height: 48, background: 'var(--brand-50)', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', border: '2px solid var(--brand-600)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h2>Verify Your University Email</h2>
        <p style={{ margin: '14px 0', fontSize: '1.05rem', color: '#1e293b' }}>
          We have sent a verification link to <strong>{registeredEmail}</strong>.
        </p>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', margin: '20px 0', textAlign: 'left' }}>
          <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
            To activate your student account:
          </p>
          <ol style={{ paddingLeft: '20px', margin: 0, color: '#475569', fontSize: '0.92rem', lineHeight: 1.6 }}>
            <li>Open your Chitkara university email inbox (check Spam/Junk folder if not in Inbox).</li>
            <li>Click the <strong>Verify Email</strong> button inside the email.</li>
            <li>Once verified, sign in to access the campus marketplace.</li>
          </ol>
        </div>

        <p className="error" style={{ fontSize: '0.85rem', background: 'var(--danger-bg)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--danger)' }}>
          You cannot proceed or sign in before verifying your university email.
        </p>

        {resendMsg && <p className="ok" style={{ marginTop: '14px' }}>{resendMsg}</p>}

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to="/login" className="btn">Go to Sign In</Link>
          <button
            type="button"
            className="btn ghost"
            disabled={resending}
            onClick={handleResend}
          >
            {resending ? 'Resending...' : 'Resend Email'}
          </button>
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
          placeholder="e.g. rollnumber@chitkara.edu.in"
          value={f.email}
          onChange={up('email')}
        />
        <small className="muted" style={{ display: 'block', marginTop: '4px', fontSize: '0.78rem' }}>
          Allowed campus domain: @chitkara.edu.in (or subdomains)
        </small>
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
