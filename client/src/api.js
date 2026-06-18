const API_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur reseau' }));
    throw new Error(error.error || 'Erreur SpotyKite');
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  spotStats: () => request('/spots/stats'),
  contentBlocks: (params = {}) => request(`/content-blocks?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  saveContentBlocks: (payload) => request('/content-blocks', { method: 'PUT', body: JSON.stringify(payload) }),
  uploadImage: (payload) => request('/uploads', { method: 'POST', body: JSON.stringify(payload) }),
  filters: () => request('/filters'),
  mapSchools: (params = {}) => request(`/schools/map?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  partners: () => request('/partners'),
  createPartner: (payload) => request('/partners', { method: 'POST', body: JSON.stringify(payload) }),
  updatePartner: (id, payload) => request(`/partners/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePartner: (id) => request(`/partners/${id}`, { method: 'DELETE' }),
  orders: () => request('/orders'),
  order: (id) => request(`/orders/${encodeURIComponent(id)}`),
  prospects: () => request('/prospects'),
  updateProspect: (kind, id, payload) => request(`/prospects/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createInitiatedOrder: (payload) => request('/initiated-orders', { method: 'POST', body: JSON.stringify(payload) }),
  updateInitiatedOrder: (id, payload) => request(`/initiated-orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  resumeOrder: (token) => request(`/initiated-orders/resume/${token}`),
  createLead: (payload) => request('/leads', { method: 'POST', body: JSON.stringify(payload) }),
  createOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  updateOrder: (id, payload) => request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  sendOrderEmail: (id, payload) => request(`/orders/${encodeURIComponent(id)}/emails`, { method: 'POST', body: JSON.stringify(payload) }),
  addOrderHistory: (id, payload) => request(`/orders/${encodeURIComponent(id)}/history`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: 'DELETE' }),
  createCheckoutSession: (payload) => request('/payments/create-checkout-session', { method: 'POST', body: JSON.stringify(payload) }),
  createPaymentIntent: (payload) => request('/payments/create-payment-intent', { method: 'POST', body: JSON.stringify(payload) }),
  confirmGiftCardPayment: (payload) => request('/payments/confirm-gift-card-payment', { method: 'POST', body: JSON.stringify(payload) }),
  checkoutSession: (sessionId) => request(`/payments/checkout-session/${sessionId}`),
  paymentIntent: (paymentIntentId) => request(`/payments/payment-intent/${paymentIntentId}`),
  consumeVoucher: (token) => request(`/vouchers/consume/${token}`, { method: 'POST' }),
  consumePartnerOrder: (schoolId, payload) => request(`/partners/${schoolId}/orders/consume`, { method: 'POST', body: JSON.stringify(payload) }),
  schools: (params = {}) => request(`/schools?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  searchSchools: (params = {}) => request(`/schools?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  school: (slug) => request(`/schools/${slug}`),
  createSchool: (payload) => request('/schools', { method: 'POST', body: JSON.stringify(payload) }),
  updateSchool: (id, payload) => request(`/schools/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSchool: (id) => request(`/schools/${id}`, { method: 'DELETE' }),
  formulas: (params = {}) => request(`/formulas?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  createFormula: (payload) => request('/formulas', { method: 'POST', body: JSON.stringify(payload) }),
  accommodations: (params = {}) => request(`/accommodations?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  createAccommodation: (payload) => request('/accommodations', { method: 'POST', body: JSON.stringify(payload) }),
  updateAccommodation: (id, payload) => request(`/accommodations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAccommodation: (id) => request(`/accommodations/${id}`, { method: 'DELETE' }),
  availabilities: (params = {}) => request(`/availabilities?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  createAvailability: (payload) => request('/availabilities', { method: 'POST', body: JSON.stringify(payload) }),
  updateAvailability: (id, payload) => request(`/availabilities/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAvailability: (id) => request(`/availabilities/${id}`, { method: 'DELETE' }),
  seasons: (params = {}) => request(`/seasons?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  createSeason: (payload) => request('/seasons', { method: 'POST', body: JSON.stringify(payload) }),
  updateSeason: (id, payload) => request(`/seasons/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  specialOffers: (params = {}) => request(`/special-offers?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  createSpecialOffer: (payload) => request('/special-offers', { method: 'POST', body: JSON.stringify(payload) }),
  updateSpecialOffer: (id, payload) => request(`/special-offers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  offers: (params = {}) => request(`/offers?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
  offer: (id) => request(`/offers/${id}`),
  createOffer: (payload) => request('/offers', { method: 'POST', body: JSON.stringify(payload) }),
  updateOffer: (id, payload) => request(`/offers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteOffer: (id) => request(`/offers/${id}`, { method: 'DELETE' }),
  bookings: () => request('/bookings'),
  createBooking: (payload) => request('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  giftCards: () => request('/gift-cards'),
  createGiftCard: (payload) => request('/gift-cards', { method: 'POST', body: JSON.stringify(payload) }),
  updateGiftCard: (id, payload) => request(`/gift-cards/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteGiftCard: (id) => request(`/gift-cards/${id}`, { method: 'DELETE' }),
  validateGiftCard: (payload) => request('/gift-cards/validate', { method: 'POST', body: JSON.stringify(payload) }),
  redeemGiftCard: (payload) => request('/gift-cards/redeem', { method: 'POST', body: JSON.stringify(payload) })
};
