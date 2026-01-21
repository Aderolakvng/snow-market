const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

function getPaystackSecret() {
  // Prefer runtime env var (recommended for local emulation / CI)
  if (process.env.PAYSTACK_SECRET_KEY) return process.env.PAYSTACK_SECRET_KEY;

  // Fallback to Firebase Functions config: firebase functions:config:set paystack.secret="sk_..."
  try {
    const cfg = functions.config();
    if (cfg && cfg.paystack && cfg.paystack.secret) return cfg.paystack.secret;
  } catch (e) {
    // ignore
  }

  return null;
}

exports.verifyPaystackPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }

  const reference = (data && data.reference) ? String(data.reference).trim() : '';
  const expectedAmount = Number(data && data.expectedAmount);

  if (!reference) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing reference');
  }

  if (!(expectedAmount > 0)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid expectedAmount');
  }

  const secret = getPaystackSecret();
  if (!secret) {
    throw new functions.https.HttpsError('failed-precondition', 'Paystack secret is not configured on the server');
  }

  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;

  let json;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      }
    });

    json = await res.json();

    if (!res.ok) {
      throw new Error(json && json.message ? json.message : `paystack-http-${res.status}`);
    }
  } catch (e) {
    throw new functions.https.HttpsError('unavailable', `Paystack verify failed: ${e.message || e}`);
  }

  const txn = (json && json.data) ? json.data : null;
  const status = txn ? String(txn.status || '') : '';
  const currency = txn ? String(txn.currency || '') : '';
  const amount = txn ? Number(txn.amount || 0) : 0; // Paystack amount is already in kobo

  if (status !== 'success') {
    throw new functions.https.HttpsError('failed-precondition', `Payment not successful (status=${status || 'unknown'})`);
  }

  if (currency && currency !== 'NGN') {
    throw new functions.https.HttpsError('failed-precondition', `Unexpected currency: ${currency}`);
  }

  if (amount !== Math.round(expectedAmount)) {
    throw new functions.https.HttpsError('failed-precondition', 'Amount mismatch');
  }

  return {
    ok: true,
    reference,
    amount,
    currency: currency || 'NGN',
    paidAt: txn && txn.paid_at ? txn.paid_at : null,
    customerEmail: txn && txn.customer ? txn.customer.email : null
  };
});
