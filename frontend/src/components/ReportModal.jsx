import { useState } from 'react';
import { reportApi } from '../services/adminApi';

const REPORT_REASONS = [
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'FAKE_OR_MISLEADING', label: 'Fake or misleading listing' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment or abusive behavior' },
  { value: 'PROHIBITED_ITEM', label: 'Prohibited or unsafe item' },
  { value: 'SUSPECTED_SCAM', label: 'Suspected scam' },
  { value: 'OTHER', label: 'Other violation' },
];

export default function ReportModal({ listingId, reportedUserId, targetTitle, onClose, onSuccess }) {
  const [reason, setReason] = useState('INAPPROPRIATE_CONTENT');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await reportApi.createReport({
        listingId: listingId ? Number(listingId) : null,
        reportedUserId: reportedUserId ? Number(reportedUserId) : null,
        reason,
        description: description.trim() || undefined,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Report {targetTitle ? `"${targetTitle}"` : 'Issue'}</h3>
          <button className="link" onClick={onClose} style={{ fontSize: '1.2rem', padding: 0 }}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginBottom: 16 }}>
          Reports are reviewed confidentially by campus administrators. False reports are strictly prohibited.
        </p>

        <form onSubmit={submit}>
          <label style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
            <span>Reason for report</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
            <span>Additional details (optional)</span>
            <textarea
              rows={3}
              placeholder="Explain why this content or behavior violates campus guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {error && <p className="error" style={{ marginBottom: 14 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn danger" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
