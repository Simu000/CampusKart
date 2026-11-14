import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function EditListing() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const fileInputRef = useRef(null);

  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [f, setF] = useState({
    title: '',
    categoryId: '',
    description: '',
    itemCondition: 'GOOD',
    transactionType: 'SELL',
    quantity: 1,
    price: '',
    priceBasis: 'PER_DAY',
  });

  const [existingImages, setExistingImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    Promise.all([
      api('/categories'),
      api(`/listings/${id}`),
    ])
      .then(([categories, listing]) => {
        setCats(categories || []);
        if (Number(listing.sellerId) !== user?.id) {
          setError('You do not have permission to edit this listing');
          setLoading(false);
          return;
        }
        setF({
          title: listing.title || '',
          categoryId: listing.categoryId ? String(listing.categoryId) : '',
          description: listing.description || '',
          itemCondition: listing.itemCondition || 'GOOD',
          transactionType: listing.transactionType || 'SELL',
          quantity: listing.qtyTotal || 1,
          price: listing.price !== undefined ? String(listing.price) : '',
          priceBasis: listing.priceBasis || 'PER_DAY',
        });
        setExistingImages(listing.images || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load listing');
        setLoading(false);
      });
  }, [id, user]);

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const payload = {
        title: f.title.trim(),
        categoryId: parseInt(f.categoryId, 10),
        description: f.description.trim(),
        itemCondition: f.itemCondition,
        transactionType: f.transactionType,
        quantity: parseInt(f.quantity, 10),
        price: f.transactionType === 'LEND' ? 0 : parseFloat(f.price),
        priceBasis: f.transactionType === 'RENT' ? f.priceBasis : 'NONE',
      };

      await api(`/listings/${id}`, {
        method: 'PUT',
        body: payload,
      });

      setSuccess('Listing updated successfully!');
      setTimeout(() => nav(`/listing/${id}`), 1200);
    } catch (err) {
      setError(err.message || 'Failed to update listing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError('');

    const fd = new FormData();
    fd.append('file', file);

    try {
      const updatedListing = await api(`/listings/${id}/images`, {
        method: 'POST',
        body: fd,
      });
      setExistingImages(updatedListing.images || []);
      setSuccess('Image uploaded!');
    } catch (err) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="state">
        <p>Loading listing details...</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} style={{ maxWidth: '640px', margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Edit Listing</h1>
        <Link to={`/listing/${id}`} className="link">Cancel</Link>
      </div>
      <p className="muted">Update product information or photos.</p>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="ok">{success}</p>}

      <label>
        Product Title *
        <input required value={f.title} onChange={up('title')} placeholder="e.g. Arduino Uno R3" />
      </label>

      <div className="grid2">
        <label>
          Category *
          <select required value={f.categoryId} onChange={up('categoryId')}>
            <option value="">Select category...</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label>
          Condition *
          <select value={f.itemCondition} onChange={up('itemCondition')}>
            <option value="NEW">New (Unopened / Unused)</option>
            <option value="LIKE_NEW">Like New</option>
            <option value="GOOD">Good condition</option>
            <option value="FAIR">Fair / Functional</option>
          </select>
        </label>
      </div>

      <label>
        Description *
        <textarea
          rows={4}
          required
          value={f.description}
          onChange={up('description')}
          placeholder="Describe condition, reason for selling/renting, what components are included..."
        />
      </label>

      <div>
        <label style={{ marginBottom: '8px' }}>Exchange Type *</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            ['SELL', 'Sell Permanently'],
            ['RENT', 'Rent Out'],
            ['LEND', 'Lend (Free)'],
          ].map(([val, label]) => (
            <button
              type="button"
              key={val}
              className={'pill' + (f.transactionType === val ? ' on' : '')}
              onClick={() => setF({ ...f, transactionType: val })}
              style={{ flex: 1, padding: '10px 8px' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <label>
          Total Quantity Available *
          <input
            type="number"
            min={1}
            required
            value={f.quantity}
            onChange={up('quantity')}
          />
        </label>

        {f.transactionType !== 'LEND' ? (
          <label>
            Price (₹ INR) *
            <input
              type="number"
              step="0.01"
              min="0.5"
              required
              placeholder="e.g. 350"
              value={f.price}
              onChange={up('price')}
            />
          </label>
        ) : (
          <label>
            Price
            <input disabled value="Free" style={{ opacity: 0.7 }} />
          </label>
        )}
      </div>

      {f.transactionType === 'RENT' && (
        <label>
          Rental Basis *
          <select value={f.priceBasis} onChange={up('priceBasis')}>
            <option value="PER_DAY">Per day</option>
            <option value="PER_WEEK">Per week</option>
            <option value="PER_MONTH">Per month</option>
          </select>
        </label>
      )}

      {/* Photos Section */}
      <div>
        <label style={{ marginBottom: '8px' }}>Product Photos</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {existingImages.map((imgUrl, i) => (
            <div key={i} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={imgUrl} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
        {existingImages.length < 5 && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? 'Uploading...' : '+ Add Another Photo'}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Saving Changes...' : 'Save Changes'}
        </button>
        <Link to={`/listing/${id}`} className="btn ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
