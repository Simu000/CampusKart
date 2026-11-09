// Centralized API Client — Campus Exchange
// Supports JSON envelopes, HTTP-only Cookie authentication, and Bearer token fallback.
const BASE = '/api/v1';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const isFormData = body instanceof FormData;

  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'include', // sends and receives secure HTTP-only cookies
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 204) return null;

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      localStorage.removeItem('token');
    }
    const errorMsg = json?.message || (res.status === 401 ? 'Please sign in' : 'Something went wrong');
    throw new Error(errorMsg);
  }

  // Automatically unwrap standard ApiResponse { success: true, message: "...", data: T }
  if (json && typeof json === 'object' && json.success === true && json.data !== undefined) {
    return json.data;
  }

  return json;
}

export const priceText = (l) => {
  if (l.transactionType === 'LEND') return 'Free';
  const basisMap = { PER_DAY: 'day', PER_WEEK: 'week', PER_MONTH: 'month' };
  const basis = l.priceBasis && basisMap[l.priceBasis] ? ` / ${basisMap[l.priceBasis]}` : '';
  return `₹${l.price}${basis}`;
};

export const conditionText = (c) => ({
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  FAIR: 'Fair',
}[c] || c);
