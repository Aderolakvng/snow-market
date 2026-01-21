import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import nodemailer from 'nodemailer';

const app = express();

// SMTP transporter (optional) — configure via env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
let emailTransport = null;
function initEmailTransport() {
  try {
    const host = process.env.SMTP_HOST && process.env.SMTP_HOST.trim();
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
    const user = process.env.SMTP_USER && process.env.SMTP_USER.trim();
    const pass = process.env.SMTP_PASS && process.env.SMTP_PASS.trim();
    if (!host || !port || !user || !pass) return;
    emailTransport = nodemailer.createTransport({ host, port, auth: { user, pass }, secure: Number(port) === 465 });
  } catch (e) {
    console.error('Email transport init failed', e);
  }
}
initEmailTransport();

function genTrackingNumbers(count) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random().toString(36).slice(2, 10).toUpperCase();
    arr.push(`SNW-${Date.now().toString().slice(-5)}-${r}`);
  }
  return arr;
}

async function sendOrderEmail(to, reference, amountInKobo, trackingNumbers) {
  if (!emailTransport) return false;
  try {
    const html = `
      <p>Thank you — your payment was successful.</p>
      <p><strong>Reference:</strong> ${reference}</p>
      <p><strong>Amount:</strong> ₦${(Number(amountInKobo)||0)/100}</p>
      <p><strong>Tracking numbers (please keep this for tracking):</strong></p>
      <ol>${(trackingNumbers||[]).map(t => `<li>${t}</li>`).join('')}</ol>
      <p>You can view and track your orders at <a href="/pages/orders.html">Your Orders</a>.</p>
    `;

    const info = await emailTransport.sendMail({ from: process.env.FROM_EMAIL || process.env.SMTP_USER, to, subject: `Order received — ${reference}`, html });
    try { await fs.appendFile('sent-emails.log', JSON.stringify({ time: new Date().toISOString(), to, reference, amountInKobo, trackingNumbers, info }) + '\n', 'utf8'); } catch(e){}
    return true;
  } catch (e) {
    console.error('Failed to send order email', e);
    return false;
  }
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`missing-env:${name}`);
  }
  return String(v).trim();
}

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'snow-paystack-backend' });
});

app.post('/verify-paystack', async (req, res) => {
  try {
    const PAYSTACK_SECRET_KEY = requireEnv('PAYSTACK_SECRET_KEY');

    const reference = req.body && req.body.reference ? String(req.body.reference).trim() : '';
    const expectedAmount = Number(req.body && req.body.expectedAmount);

    if (!reference) {
      return res.status(400).json({ ok: false, error: 'missing-reference' });
    }
    if (!(expectedAmount > 0)) {
      return res.status(400).json({ ok: false, error: 'invalid-expectedAmount' });
    }

    const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;

    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = json && json.message ? json.message : `paystack-http-${r.status}`;
      // Log and optionally notify about the failed verify at this stage
      try {
        const logEntry = { time: new Date().toISOString(), reference, error: msg, stage: 'paystack-http-error', original: json };
        await fs.appendFile('failed-verifications.log', JSON.stringify(logEntry) + '\n', 'utf8');
        if (process.env.NOTIFY_WEBHOOK_URL) {
          await fetch(process.env.NOTIFY_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntry) }).catch(()=>{});
        }
      } catch(e) { console.error('Failed to log notify paystack http error', e); }

      return res.status(502).json({ ok: false, error: 'paystack-verify-failed', message: msg });
    }

    const data = json && json.data ? json.data : null;
    const status = data ? String(data.status || '') : '';
    const currency = data ? String(data.currency || '') : '';
    const amount = data ? Number(data.amount || 0) : 0; // Paystack amount is already in kobo

    if (status !== 'success') {
      // Log payment not successful for manual follow up
      try {
        const logEntry = { time: new Date().toISOString(), reference, status, stage: 'payment-not-successful', original: data };
        await fs.appendFile('failed-verifications.log', JSON.stringify(logEntry) + '\n', 'utf8');
        if (process.env.NOTIFY_WEBHOOK_URL) {
          await fetch(process.env.NOTIFY_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntry) }).catch(()=>{});
        }
      } catch(e) { console.error('Failed to log notify payment not successful', e); }

      return res.status(412).json({ ok: false, error: 'payment-not-successful', status });
    }

    if (currency && currency !== 'NGN') {
      return res.status(412).json({ ok: false, error: 'unexpected-currency', currency });
    }

    if (amount !== Math.round(expectedAmount)) {
      return res.status(412).json({ ok: false, error: 'amount-mismatch', amount, expectedAmount: Math.round(expectedAmount) });
    }

    const customerEmail = data && data.customer && data.customer.email ? data.customer.email : (req.body && req.body.email ? String(req.body.email).trim() : null);

    // Generate tracking numbers and attempt to email them to the customer (if email/S MTP configured)
    const trackingNumbers = genTrackingNumbers(20);
    try {
      if (customerEmail) {
        sendOrderEmail(customerEmail, reference, amount, trackingNumbers).catch((e) => console.error('sendOrderEmail error', e));
      }
      const logEntry = { time: new Date().toISOString(), reference, amount, customerEmail, trackingNumbers, stage: 'verified-success' };
      await fs.appendFile('successful-verifications.log', JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (e) {
      console.error('post-verify tasks failed', e);
    }

    return res.json({
      ok: true,
      reference,
      amount,
      currency: currency || 'NGN',
      customerEmail,
      trackingNumbers
    });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg.startsWith('missing-env:')) {
      return res.status(500).json({ ok: false, error: msg });
    }
    return res.status(500).json({ ok: false, error: 'server-error', message: msg });
  }
});

// Endpoint to receive reports of failed verifications from clients for manual follow-up
app.post('/report-failed-verification', async (req, res) => {
  try {
    const reference = req.body && req.body.reference ? String(req.body.reference) : '';
    const expectedAmount = req.body && (req.body.expectedAmount !== undefined) ? Number(req.body.expectedAmount) : null;
    const error = req.body && req.body.error ? String(req.body.error) : '';
    const original = req.body && req.body.originalResponse ? req.body.originalResponse : null;

    if (!reference) {
      return res.status(400).json({ ok: false, error: 'missing-reference' });
    }

    const entry = { time: new Date().toISOString(), reference, expectedAmount, error, original };
    await fs.appendFile('failed-verifications.log', JSON.stringify(entry) + '\n', 'utf8');

    if (process.env.NOTIFY_WEBHOOK_URL) {
      try {
        await fetch(process.env.NOTIFY_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
      } catch (e) { console.error('notify webhook failed', e); }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('report failed verification error', e);
    return res.status(500).json({ ok: false, error: 'server-error', message: String(e && e.message ? e.message : e) });
  }
});

const port = Number(process.env.PORT || 4242);
app.listen(port, () => {
  console.log(`[paystack-backend] listening on :${port}`);
});
