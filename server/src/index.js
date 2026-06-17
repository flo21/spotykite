import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import Stripe from 'stripe';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { migrate, row, rows, run } from './db.js';
import { seed } from './seed.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFiles = [
  process.env.NODE_ENV === 'production' ? '.env.production' : null,
  '.env'
].filter(Boolean);

for (const envFile of envFiles) {
  config({ path: path.join(__dirname, '..', envFile), quiet: true });
}

const port = process.env.PORT || 4000;
const host = process.env.HOST || '127.0.0.1';
const uploadsDir = path.join(__dirname, '..', 'uploads');
const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '');
let stripeClient;
let resendClient;

function stripeSecretKeyStatus() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return 'MISSING';
  if (key === 'sk_test_xxx' || key === 'sk_live_xxx') return 'PLACEHOLDER';
  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) return 'INVALID';
  return 'OK';
}

function getStripeClient() {
  if (stripeSecretKeyStatus() !== 'OK') return null;
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

console.log('[env] STRIPE_SECRET_KEY', stripeSecretKeyStatus());
console.log('[env] STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET ? 'OK' : 'MISSING');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'OK' : 'MISSING');
console.log('MAIL_FROM:', process.env.MAIL_FROM);
console.log('SPOTYKITE_ADMIN_EMAIL:', process.env.SPOTYKITE_ADMIN_EMAIL);
console.log('[stripe] Dashboard webhook events requis: checkout.session.completed, payment_intent.succeeded');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://spotykite.com',
  'https://www.spotykite.com',
  ...(process.env.CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean)
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true
}));

app.post('/api/payments/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('WEBHOOK STRIPE RECU');
  const stripe = getStripeClient();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook config error', {
      stripeSecretKeyStatus: stripeSecretKeyStatus(),
      webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET)
    });
    return res.status(500).json({ error: 'Stripe webhook is not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature error', {
      message: error.message,
      stripeSignatureHeaderPresent: Boolean(req.headers['stripe-signature']),
      webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET)
    });
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  console.log('EVENT TYPE:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Webhook checkout.session.completed reçu');
    console.log('SESSION STRIPE:', session.id);
    console.log('CUSTOMER EMAIL:', session.customer_details?.email || session.customer_email);
    console.log('METADATA:', session.metadata);
    const paidOrder = markStripeCheckoutSessionPaid(session);
    if (paidOrder) {
      await sendStripePaymentEmails(paidOrder, session);
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('Webhook payment_intent.succeeded reçu');
    console.log('PAYMENT_INTENT:', paymentIntent.id);
    console.log('PAYMENT_INTENT_AMOUNT:', paymentIntent.amount_received ?? paymentIntent.amount);
    console.log('METADATA:', paymentIntent.metadata);
    console.log('PAYMENT INTENT METADATA:', paymentIntent.metadata);
    console.log('CUSTOMER EMAIL:', paymentIntent.metadata?.customerEmail);
    const paidOrder = markStripePaymentIntentPaid(paymentIntent);
    if (paidOrder) {
      await sendStripePaymentEmails(paidOrder, paymentIntent);
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '12mb' }));
app.use('/uploads', express.static(uploadsDir));

const offerSelect = `
  SELECT offers.*, schools.name AS schoolName, schools.slug AS schoolSlug, schools.region, schools.department, schools.city, schools.spot,
    schools.address AS schoolAddress, schools.website AS schoolWebsite, schools.phone AS schoolPhone, schools.email AS schoolEmail,
    schools.rating, schools.phone, schools.email,
    formula_prices.low_season_weekday_price, formula_prices.low_season_weekend_price,
    formula_prices.high_season_weekday_price, formula_prices.high_season_weekend_price,
    formula_prices.default_price
  FROM offers
  JOIN schools ON schools.id = offers.schoolId
  LEFT JOIN formula_prices ON formula_prices.formula_id = offers.id
`;

const schoolSelect = `
  SELECT schools.*,
    MIN(CASE WHEN offers.active = 1 THEN COALESCE(
      formula_prices.low_season_weekday_price,
      formula_prices.low_season_weekend_price,
      formula_prices.high_season_weekday_price,
      formula_prices.high_season_weekend_price,
      formula_prices.default_price,
      offers.spotykitePrice,
      offers.price,
      offers.publicPrice
    ) END) AS startingPrice,
    COUNT(CASE WHEN offers.active = 1 THEN 1 END) AS activeFormulas
  FROM schools
  LEFT JOIN offers ON offers.schoolId = schools.id
  LEFT JOIN formula_prices ON formula_prices.formula_id = offers.id
`;

seed();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'SpotyKite API' });
});

app.get('/api/content-blocks', (req, res) => {
  const { page, locale = 'fr' } = req.query;
  const filters = ['locale = :locale'];
  const params = { locale };
  if (page) {
    filters.push('page_key = :page');
    params.page = page;
  }
  res.json(rows(`SELECT * FROM content_blocks WHERE ${filters.join(' AND ')} ORDER BY page_key, section_key, field_key`, params).map(serializeContentBlock));
});

app.put('/api/content-blocks', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const saved = items.map((item) => {
    const payload = contentPayload(item);
    run(`
      INSERT INTO content_blocks (page_key, section_key, field_key, field_type, value, locale, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(page_key, section_key, field_key, locale) DO UPDATE SET
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `, payload);
    return row('SELECT * FROM content_blocks WHERE page_key = ? AND section_key = ? AND field_key = ? AND locale = ?', [payload[0], payload[1], payload[2], payload[5]]);
  });
  res.json(saved.map(serializeContentBlock));
});

app.post('/api/uploads', (req, res) => {
  const { filename = 'image.webp', dataUrl = '' } = req.body;
  const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Format image invalide' });
  const extension = match[1] === 'image/png' ? 'png' : match[1] === 'image/jpeg' ? 'jpg' : 'webp';
  const safeName = `${Date.now()}-${slugify(path.basename(filename, path.extname(filename))).slice(0, 48) || 'image'}.${extension}`;
  fs.writeFileSync(path.join(uploadsDir, safeName), Buffer.from(match[2], 'base64'));
  res.status(201).json({ url: `/uploads/${safeName}` });
});

app.get('/api/spots/stats', (_req, res) => {
  const regions = rows(`
    SELECT region, COUNT(*) AS count
    FROM schools
    WHERE COALESCE(status, 'active') = 'active'
      AND COALESCE(front_visibility, 'active') = 'active'
      AND region IS NOT NULL
      AND TRIM(region) != ''
    GROUP BY region
    ORDER BY region ASC
  `);

  const cities = rows(`
    SELECT city, region, COUNT(*) AS count
    FROM schools
    WHERE COALESCE(status, 'active') = 'active'
      AND COALESCE(front_visibility, 'active') = 'active'
      AND city IS NOT NULL
      AND TRIM(city) != ''
    GROUP BY city, region
    ORDER BY city ASC
  `);

  const stageTypes = rows(`
    SELECT
      CASE COALESCE(offers.category, offers.type)
        WHEN 'initiation' THEN 'Initiation kitesurf'
        WHEN 'stage-3-jours' THEN 'Stage 3 jours'
        WHEN 'stage-5-jours' THEN 'Stage 5 jours'
        WHEN 'cours-particulier' THEN 'Cours particulier'
        WHEN 'progression' THEN 'Progression'
        ELSE COALESCE(offers.category, offers.type)
      END AS type,
      COALESCE(offers.category, offers.type) AS slug,
      COUNT(DISTINCT offers.schoolId) AS count
    FROM offers
    JOIN schools ON schools.id = offers.schoolId
    WHERE offers.active = 1
      AND COALESCE(schools.status, 'active') = 'active'
      AND COALESCE(schools.front_visibility, 'active') = 'active'
    GROUP BY COALESCE(offers.category, offers.type)
    ORDER BY type ASC
  `);

  res.json({ regions, cities, stageTypes });
});

app.get('/api/partners', (_req, res) => {
  const partners = rows(`
    SELECT partners.*, partner_conditions.ffvl_license_required, partner_conditions.license_included,
      partner_conditions.medical_certificate_required, partner_conditions.parental_authorization_required,
      partner_infos.min_age, partner_infos.max_age, partner_infos.min_weight, partner_infos.max_weight,
      partner_infos.session_duration, partner_infos.max_participants, partner_infos.level,
      partner_infos.equipment_included, partner_infos.wetsuit_included, partner_infos.parking,
      partner_infos.showers, partner_infos.changing_rooms, partner_infos.private_lessons,
      partner_infos.group_lessons, partner_infos.wingfoil_available, partner_infos.rental_available,
      partner_infos.best_period, partner_infos.dominant_wind, partner_infos.spot_orientation
    FROM partners
    LEFT JOIN partner_conditions ON partner_conditions.partner_id = partners.id
    LEFT JOIN partner_infos ON partner_infos.partner_id = partners.id
    ORDER BY partners.created_at DESC
  `);
  res.json(partners.map(serializePartner));
});

app.get('/api/partners/:id', (req, res) => {
  const partner = row('SELECT * FROM partners WHERE id = ?', [req.params.id]);
  if (!partner) return res.status(404).json({ error: 'Partner not found' });
  res.json(serializePartner(partner));
});

app.post('/api/partners', (req, res) => {
  const payload = partnerPayload(req.body);
  const result = run(`
    INSERT INTO partners (name, slug, city, department, region, address, latitude, longitude, short_description, full_description, school_description, logo_url, main_image_url, website, phone, email, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, payload.partner);
  const partnerId = result.lastInsertRowid;
  run('INSERT INTO partner_conditions (partner_id, ffvl_license_required, license_included, medical_certificate_required, parental_authorization_required) VALUES (?, ?, ?, ?, ?)', [partnerId, ...payload.conditions]);
  run('INSERT INTO partner_infos (partner_id, min_age, max_age, min_weight, max_weight, session_duration, max_participants, level, equipment_included, wetsuit_included, parking, showers, changing_rooms, private_lessons, group_lessons, wingfoil_available, rental_available, best_period, dominant_wind, spot_orientation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [partnerId, ...payload.infos]);
  res.status(201).json(row('SELECT * FROM partners WHERE id = ?', [partnerId]));
});

app.put('/api/partners/:id', (req, res) => {
  const existing = row('SELECT * FROM partners WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Partner not found' });
  const payload = partnerPayload(req.body);
  run(`
    UPDATE partners SET name = ?, slug = ?, city = ?, department = ?, region = ?, address = ?, latitude = ?, longitude = ?,
      short_description = ?, full_description = ?, school_description = ?, logo_url = ?, main_image_url = ?,
      website = ?, phone = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...payload.partner, req.params.id]);
  run('INSERT INTO partner_conditions (partner_id, ffvl_license_required, license_included, medical_certificate_required, parental_authorization_required) VALUES (?, ?, ?, ?, ?) ON CONFLICT(partner_id) DO UPDATE SET ffvl_license_required = excluded.ffvl_license_required, license_included = excluded.license_included, medical_certificate_required = excluded.medical_certificate_required, parental_authorization_required = excluded.parental_authorization_required', [req.params.id, ...payload.conditions]);
  run('INSERT INTO partner_infos (partner_id, min_age, max_age, min_weight, max_weight, session_duration, max_participants, level, equipment_included, wetsuit_included, parking, showers, changing_rooms, private_lessons, group_lessons, wingfoil_available, rental_available, best_period, dominant_wind, spot_orientation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(partner_id) DO UPDATE SET min_age = excluded.min_age, max_age = excluded.max_age, min_weight = excluded.min_weight, max_weight = excluded.max_weight, session_duration = excluded.session_duration, max_participants = excluded.max_participants, level = excluded.level, equipment_included = excluded.equipment_included, wetsuit_included = excluded.wetsuit_included, parking = excluded.parking, showers = excluded.showers, changing_rooms = excluded.changing_rooms, private_lessons = excluded.private_lessons, group_lessons = excluded.group_lessons, wingfoil_available = excluded.wingfoil_available, rental_available = excluded.rental_available, best_period = excluded.best_period, dominant_wind = excluded.dominant_wind, spot_orientation = excluded.spot_orientation', [req.params.id, ...payload.infos]);
  res.json(row('SELECT * FROM partners WHERE id = ?', [req.params.id]));
});

app.delete('/api/partners/:id', (req, res) => {
  run('DELETE FROM partners WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.get('/api/orders', (_req, res) => {
  res.json(rows(`
    SELECT orders.*, stages.title AS stage_title, partners.name AS partner_name
    FROM orders
    LEFT JOIN stages ON stages.id = orders.stage_id
    LEFT JOIN partners ON partners.id = orders.partner_id
    ORDER BY orders.created_at DESC
  `).map(serializeOrder));
});

app.post('/api/orders', (req, res) => {
  const payload = orderPayload(req.body);
  const result = run(`
    INSERT INTO orders (order_number, customer_firstname, customer_lastname, customer_email, customer_phone, product_type, stage_id, partner_id, city, spot, amount, status, payment_status, payment_provider, payment_id, title, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, payload);
  res.status(201).json(serializeOrder(row('SELECT * FROM orders WHERE id = ?', [result.lastInsertRowid])));
});

app.put('/api/orders/:id', (req, res) => {
  const payload = orderPayload(req.body);
  run(`
    UPDATE orders SET order_number = ?, customer_firstname = ?, customer_lastname = ?, customer_email = ?, customer_phone = ?,
      product_type = ?, stage_id = ?, partner_id = ?, city = ?, spot = ?, amount = ?, status = ?,
      payment_status = ?, payment_provider = ?, payment_id = ?, title = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...payload, req.params.id]);
  res.json(serializeOrder(row('SELECT * FROM orders WHERE id = ?', [req.params.id])));
});

app.delete('/api/orders/:id', (req, res) => {
  run('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.post('/api/payments/create-checkout-session', async (req, res) => {
  const stripeKeyStatus = stripeSecretKeyStatus();
  console.log('[payments] STRIPE_SECRET_KEY', stripeKeyStatus);
  const stripe = getStripeClient();
  if (!stripe) {
    const error = stripeKeyStatus === 'PLACEHOLDER'
      ? 'STRIPE_SECRET_KEY is still set to the placeholder sk_test_xxx'
      : 'STRIPE_SECRET_KEY is not configured';
    return res.status(500).json({ error });
  }

  try {
    const { orderId, amount, customerEmail, title, metadata = {}, order = {} } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!customerEmail) return res.status(400).json({ error: 'customerEmail is required' });

    const savedOrder = orderId ? row('SELECT * FROM orders WHERE id = ? OR order_number = ?', [orderId, orderId]) : createPendingStripeOrder({
      ...order,
      amount: Math.round(numericAmount),
      customerEmail,
      title,
      metadata
    });
    if (!savedOrder) return res.status(404).json({ error: 'Order not found' });
    if (savedOrder.payment_status === 'paid') return res.status(409).json({ error: 'Order already paid' });
    console.log('Commande créée', {
      orderId: savedOrder.id,
      orderNumber: savedOrder.order_number,
      customerEmail
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(numericAmount * 100),
            product_data: {
              name: title || savedOrder.title || savedOrder.product_type || `Commande ${savedOrder.order_number}`
            }
          }
        }
      ],
      success_url: `${frontendUrl}/paiement-reussi?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/paiement-annule`,
      metadata: {
        ...stringifyMetadata(metadata),
        customerEmail,
        orderId: String(savedOrder.id),
        orderNumber: savedOrder.order_number
      }
    });

    run(`
      UPDATE orders
      SET payment_provider = 'stripe',
        stripe_session_id = ?,
        payment_id = ?,
        metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [checkoutSession.id, checkoutSession.id, JSON.stringify({ ...metadata, stripeCheckoutUrl: checkoutSession.url }), savedOrder.id]);

    res.status(201).json({ checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id, orderId: savedOrder.id });
  } catch (error) {
    console.error('Stripe checkout session error', error);
    res.status(500).json({ error: 'Impossible de créer la session Stripe' });
  }
});

app.post('/api/payments/create-payment-intent', async (req, res) => {
  const stripeKeyStatus = stripeSecretKeyStatus();
  console.log('[payments] STRIPE_SECRET_KEY', stripeKeyStatus);
  const stripe = getStripeClient();
  if (!stripe) {
    const error = stripeKeyStatus === 'PLACEHOLDER'
      ? 'STRIPE_SECRET_KEY is still set to the placeholder sk_test_xxx'
      : 'STRIPE_SECRET_KEY is not configured';
    return res.status(500).json({ error });
  }

  try {
    const { amount, customerEmail, customerName = '', title, metadata = {}, order = {} } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!customerEmail) return res.status(400).json({ error: 'customerEmail is required' });

    const savedOrder = createPendingStripeOrder({
      ...order,
      amount: Math.round(numericAmount),
      customerEmail,
      customerName,
      title,
      metadata
    });

    const paymentMetadata = stringifyMetadata({
      ...metadata,
      customerEmail,
      customerName,
      orderId: String(savedOrder.id),
      orderNumber: savedOrder.order_number,
      offerName: metadata.offerName || title || savedOrder.title || '',
      schoolName: metadata.schoolName || ''
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(numericAmount * 100),
      currency: 'eur',
      receipt_email: customerEmail,
      description: title || savedOrder.title || `Commande ${savedOrder.order_number}`,
      automatic_payment_methods: { enabled: true },
      metadata: paymentMetadata
    });

    run(`
      UPDATE orders
      SET payment_provider = 'stripe',
        payment_id = ?,
        metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [paymentIntent.id, JSON.stringify({ ...metadata, ...paymentMetadata, stripePaymentIntent: paymentIntent.id }), savedOrder.id]);

    console.log('PaymentIntent créé', {
      orderId: savedOrder.id,
      orderNumber: savedOrder.order_number,
      paymentIntentId: paymentIntent.id,
      customerEmail
    });

    res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      orderId: savedOrder.id,
      orderNumber: savedOrder.order_number,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Stripe payment intent error', error);
    res.status(500).json({ error: 'Impossible de préparer le paiement Stripe' });
  }
});

app.get('/api/payments/payment-intent/:paymentIntentId', async (req, res) => {
  const stripe = getStripeClient();
  let order = row('SELECT * FROM orders WHERE payment_id = ?', [req.params.paymentIntentId]);
  if (!order) return res.status(404).json({ error: 'Paiement Stripe introuvable' });

  if (stripe && order.payment_status !== 'paid') {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);
      console.log('PaymentIntent récupéré depuis page retour', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        customerEmail: paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail
      });

      if (paymentIntent.status === 'succeeded') {
        const paidOrder = markStripePaymentIntentPaid(paymentIntent);
        if (paidOrder) {
          await sendStripePaymentEmails(paidOrder, paymentIntent);
          order = row('SELECT * FROM orders WHERE id = ?', [paidOrder.id]);
        }
      }
    } catch (error) {
      console.error('Erreur récupération PaymentIntent retour paiement', {
        paymentIntentId: req.params.paymentIntentId,
        error
      });
    }
  }

  res.json({
    paymentIntentId: req.params.paymentIntentId,
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    paid: order.payment_status === 'paid'
  });
});

app.get('/api/payments/checkout-session/:sessionId', async (req, res) => {
  const stripe = getStripeClient();
  let order = row('SELECT * FROM orders WHERE stripe_session_id = ? OR payment_id = ?', [req.params.sessionId, req.params.sessionId]);
  if (!order) return res.status(404).json({ error: 'Session Stripe introuvable' });

  if (stripe && order.payment_status !== 'paid') {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      console.log('Session Stripe récupérée depuis page retour', {
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || session.customer_email
      });

      if (session.payment_status === 'paid' || session.status === 'complete') {
        const paidOrder = markStripeCheckoutSessionPaid(session);
        if (paidOrder) {
          await sendStripePaymentEmails(paidOrder, session);
          order = row('SELECT * FROM orders WHERE id = ?', [paidOrder.id]);
        }
      }
    } catch (error) {
      console.error('Erreur récupération session Stripe retour paiement', {
        sessionId: req.params.sessionId,
        error
      });
    }
  }

  res.json({
    sessionId: req.params.sessionId,
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    paid: order.payment_status === 'paid'
  });
});

app.get('/api/prospects', (_req, res) => {
  const initiated = rows(`
    SELECT initiated_orders.*, schools.name AS schoolName, offers.title AS formulaName
    FROM initiated_orders
    LEFT JOIN schools ON schools.id = initiated_orders.school_id
    LEFT JOIN offers ON offers.id = initiated_orders.formula_id
    ORDER BY initiated_orders.updated_at DESC
  `).map(serializeInitiatedOrder);
  const leads = rows(`
    SELECT leads.*, schools.name AS schoolName, offers.title AS formulaName, initiated_orders.resume_url AS resumeUrl
    FROM leads
    LEFT JOIN schools ON schools.id = leads.school_id
    LEFT JOIN offers ON offers.id = leads.formula_id
    LEFT JOIN initiated_orders ON initiated_orders.id = leads.order_id
    ORDER BY leads.updated_at DESC
  `).map(serializeLead);
  res.json([...initiated, ...leads].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
});

app.post('/api/initiated-orders', (req, res) => {
  try {
    const saved = upsertInitiatedOrder(req.body);
    res.status(201).json(saved);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Erreur capture prospect' });
  }
});

app.put('/api/initiated-orders/:id', (req, res) => {
  const existing = row('SELECT * FROM initiated_orders WHERE id = ? OR resume_token = ?', [req.params.id, req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Commande initiée introuvable' });
  try {
    const saved = upsertInitiatedOrder({ ...req.body, resumeToken: existing.resume_token });
    res.json(saved);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Erreur capture prospect' });
  }
});

app.get('/api/initiated-orders/resume/:token', (req, res) => {
  const item = row(`
    SELECT initiated_orders.*, schools.name AS schoolName, schools.slug AS schoolSlug, offers.title AS formulaName
    FROM initiated_orders
    LEFT JOIN schools ON schools.id = initiated_orders.school_id
    LEFT JOIN offers ON offers.id = initiated_orders.formula_id
    WHERE initiated_orders.resume_token = ?
  `, [req.params.token]);
  if (!item) return res.status(404).json({ error: 'Lien de reprise introuvable' });
  if (item.expires_at && new Date(item.expires_at) < new Date()) return res.status(410).json({ error: 'Lien de reprise expiré' });
  res.json(serializeInitiatedOrder(item));
});

app.patch('/api/prospects/:kind/:id', (req, res) => {
  const table = req.params.kind === 'lead' ? 'leads' : 'initiated_orders';
  const status = req.body.status;
  const note = req.body.internalNote ?? req.body.internal_note ?? '';
  run(`UPDATE ${table} SET status = COALESCE(?, status), internal_note = COALESCE(?, internal_note), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status || null, note || null, req.params.id]);
  res.json({ ok: true });
});

app.post('/api/leads', (req, res) => {
  if (!req.body.email && !req.body.phone) return res.status(400).json({ error: 'Email ou téléphone requis' });
  try {
    const initiated = upsertInitiatedOrder({
      ...req.body,
      type: 'lead_request',
      status: 'initiated',
      paymentStatus: 'unpaid',
      lastStep: 'lead'
    });
    const payload = leadPayload(req.body, initiated.dbId);
    const result = run(`
      INSERT INTO leads (school_id, formula_id, first_name, email, phone, message, source_page, status, order_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, payload);
    res.status(201).json({
      lead: serializeLead(row('SELECT leads.* FROM leads WHERE id = ?', [result.lastInsertRowid])),
      order: initiated
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Erreur création lead' });
  }
});

app.get('/api/schools', (req, res) => {
  const { q, region, department, city, spot, zone, type, include } = req.query;
  const filters = include === 'all'
    ? []
    : ["COALESCE(schools.status, 'active') = 'active'", "COALESCE(schools.front_visibility, 'active') = 'active'"];
  const params = {};
  const locationQuery = q || zone || '';

  if (locationQuery) {
    filters.push(`(
      LOWER(schools.region) LIKE LOWER(:location)
      OR LOWER(schools.department) LIKE LOWER(:location)
      OR LOWER(schools.city) LIKE LOWER(:location)
      OR LOWER(schools.spot) LIKE LOWER(:location)
      OR LOWER(schools.name) LIKE LOWER(:location)
    )`);
    params.location = `%${normalizeSlugQuery(locationQuery)}%`;
  }
  if (type) {
    const categoryFilter = schoolCategoryFilter(type);
    filters.push(`EXISTS (
      SELECT 1
      FROM offers formula_filter
      WHERE formula_filter.schoolId = schools.id
        AND formula_filter.active = 1
        AND ${categoryFilter.sql}
    )`);
    Object.assign(params, categoryFilter.params);
  }

  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const schools = rows(`${schoolSelect}${where} GROUP BY schools.id ORDER BY schools.region, schools.city, schools.name`, params)
    .map(serializeSchool)
    .filter((school) => schoolMatchesLocationFilters(school, { region, department, city, spot }));
  res.json(schools);
});

app.get('/api/schools/map', (req, res) => {
  const { region, department, type } = req.query;
  const filters = [
    "COALESCE(schools.status, 'active') = 'active'",
    "COALESCE(schools.front_visibility, 'active') = 'active'",
    'schools.latitude IS NOT NULL',
    'schools.longitude IS NOT NULL'
  ];
  const params = {};
  if (type) {
    const categoryFilter = schoolCategoryFilter(type);
    filters.push(`EXISTS (
      SELECT 1 FROM offers formula_filter
      WHERE formula_filter.schoolId = schools.id
        AND formula_filter.active = 1
        AND ${categoryFilter.sql}
    )`);
    Object.assign(params, categoryFilter.params);
  }
  const schools = rows(`
    ${schoolSelect}
    WHERE ${filters.join(' AND ')}
    GROUP BY schools.id
    ORDER BY schools.region, schools.city, schools.name
  `, params)
    .map(serializeSchool)
    .filter((school) => schoolMatchesLocationFilters(school, { region, department }));
  res.json(schools.map((school) => ({
    id: school.id,
    name: school.name,
    slug: school.slug,
    city: school.city,
    region: school.region,
    department: school.department,
    latitude: school.latitude,
    longitude: school.longitude,
    starting_price: school.startingPrice,
    startingPrice: school.startingPrice,
    activeFormulas: school.activeFormulas,
    formulas_count: school.activeFormulas,
    formulasCount: school.activeFormulas
  })));
});

app.get('/api/filters', (_req, res) => {
  const schools = rows(`
    SELECT DISTINCT region, department, city, spot
    FROM schools
    WHERE COALESCE(status, 'active') = 'active' AND COALESCE(front_visibility, 'active') = 'active'
    ORDER BY region, department, city, spot
  `);
  const formulas = rows(`
    SELECT DISTINCT category, level
    FROM offers
    JOIN schools ON schools.id = offers.schoolId
    WHERE offers.active = 1 AND COALESCE(schools.status, 'active') = 'active' AND COALESCE(schools.front_visibility, 'active') = 'active'
  `);
  const prices = row(`
    SELECT MIN(COALESCE(spotykitePrice, price, publicPrice)) AS minPrice,
      MAX(COALESCE(spotykitePrice, price, publicPrice)) AS maxPrice
    FROM offers
    JOIN schools ON schools.id = offers.schoolId
    WHERE offers.active = 1 AND COALESCE(schools.status, 'active') = 'active' AND COALESCE(schools.front_visibility, 'active') = 'active'
  `);
  res.json({
    regions: uniqueSorted(schools.map((item) => item.region)),
    departments: uniqueSorted(schools.map((item) => item.department)),
    cities: uniqueSorted(schools.map((item) => item.city)),
    spots: uniqueSorted(schools.map((item) => item.spot)),
    formulaTypes: uniqueSorted(formulas.map((item) => item.category)),
    levels: uniqueSorted(formulas.map((item) => item.level)),
    price: {
      min: Number(prices?.minPrice || 0),
      max: Number(prices?.maxPrice || 0)
    }
  });
});

app.get('/api/schools/:slug', (req, res) => {
  const school = row(`${schoolSelect} WHERE schools.slug = :slug OR schools.id = :id GROUP BY schools.id`, {
    slug: req.params.slug,
    id: Number(req.params.slug) || 0
  });
  if (!school || school.front_visibility === 'hidden' || (school.status && school.status !== 'active')) return res.status(404).json({ error: 'School not found' });
  const partner = row(`
    SELECT partners.*, partner_conditions.ffvl_license_required, partner_conditions.license_included,
      partner_conditions.medical_certificate_required, partner_conditions.parental_authorization_required,
      partner_infos.min_age, partner_infos.max_age, partner_infos.min_weight, partner_infos.max_weight,
      partner_infos.session_duration, partner_infos.max_participants, partner_infos.level,
      partner_infos.equipment_included, partner_infos.wetsuit_included, partner_infos.parking,
      partner_infos.showers, partner_infos.changing_rooms, partner_infos.private_lessons,
      partner_infos.group_lessons, partner_infos.best_period
    FROM partners
    LEFT JOIN partner_conditions ON partner_conditions.partner_id = partners.id
    LEFT JOIN partner_infos ON partner_infos.partner_id = partners.id
    WHERE partners.slug = ? OR LOWER(partners.email) = LOWER(?)
  `, [school.slug || '', school.email || '']);
  const formulas = rows(`${offerSelect} WHERE offers.schoolId = ? AND offers.active = 1 ORDER BY COALESCE(offers.spotykitePrice, offers.price, offers.publicPrice) ASC`, [school.id]).map(serializeFormula);
  const accommodations = rows('SELECT * FROM accommodations WHERE schoolId = ? AND status = ? ORDER BY distanceFromSpot, name', [school.id, 'active']).map(serializeAccommodation);
  const availabilities = rows(`
    SELECT formula_availabilities.*, offers.title AS formulaName
    FROM formula_availabilities
    LEFT JOIN offers ON offers.id = formula_availabilities.formula_id
    WHERE formula_availabilities.school_id = ?
    ORDER BY formula_availabilities.date ASC
  `, [school.id]).map(serializeAvailability);
  const nearbySchools = rows(`
    ${schoolSelect}
    WHERE schools.id != :schoolId
      AND COALESCE(schools.status, 'active') = 'active'
      AND COALESCE(schools.front_visibility, 'active') = 'active'
      AND (
        LOWER(schools.city) = LOWER(:city)
        OR LOWER(COALESCE(schools.department, '')) = LOWER(:department)
        OR LOWER(schools.region) = LOWER(:region)
      )
    GROUP BY schools.id
    ORDER BY
      CASE
        WHEN LOWER(schools.city) = LOWER(:city) THEN 1
        WHEN LOWER(COALESCE(schools.department, '')) = LOWER(:department) THEN 2
        ELSE 3
      END,
      schools.city,
      schools.name
    LIMIT 6
  `, {
    schoolId: school.id,
    city: school.city || '',
    department: school.department || '',
    region: school.region || ''
  }).map(serializeSchool);
  res.json({
    ...serializeSchool(school),
    practical: serializeSchoolPractical(partner),
    formulas,
    accommodations,
    availabilities,
    nearbySchools
  });
});

app.post('/api/schools', (req, res) => {
  const payload = schoolPayload(req.body);
  const result = run('INSERT INTO schools (name, slug, description, region, department, city, spot, address, latitude, longitude, rating, phone, email, website, imageUrl, photos, status, front_visibility, booking_enabled, pedagogy, spot_details, weather_policy, weather_postpone_policy, opening_period, additional_info, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', payload);
  syncSchoolFormulas(result.lastInsertRowid, req.body);
  res.status(201).json(serializeSchool(row(`${schoolSelect} WHERE schools.id = ? GROUP BY schools.id`, [result.lastInsertRowid])));
});

app.put('/api/schools/:id', (req, res) => {
  const payload = schoolPayload(req.body);
  run('UPDATE schools SET name = ?, slug = ?, description = ?, region = ?, department = ?, city = ?, spot = ?, address = ?, latitude = ?, longitude = ?, rating = ?, phone = ?, email = ?, website = ?, imageUrl = ?, photos = ?, status = ?, front_visibility = ?, booking_enabled = ?, pedagogy = ?, spot_details = ?, weather_policy = ?, weather_postpone_policy = ?, opening_period = ?, additional_info = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...payload, req.params.id]);
  syncSchoolFormulas(req.params.id, req.body);
  res.json(serializeSchool(row(`${schoolSelect} WHERE schools.id = ? GROUP BY schools.id`, [req.params.id])));
});

app.delete('/api/schools/:id', (req, res) => {
  run('DELETE FROM schools WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.get('/api/offers', (req, res) => {
  const filters = [];
  const params = {};
  const { region, type, level, duration, maxPrice } = req.query;
  if (region && region !== 'Toute la France') {
    filters.push('schools.region = :region');
    params.region = region;
  }
  if (type) {
    const typeFilter = stageTypeFilter(type);
    filters.push(typeFilter.sql);
    Object.assign(params, typeFilter.params);
  }
  if (level) {
    filters.push('offers.level = :level');
    params.level = level;
  }
  if (duration) {
    filters.push('offers.duration = :duration');
    params.duration = duration;
  }
  if (maxPrice) {
    filters.push('offers.price <= :maxPrice');
    params.maxPrice = Number(maxPrice);
  }
  const where = filters.length ? ` WHERE offers.active = 1 AND ${filters.join(' AND ')}` : ' WHERE offers.active = 1';
  res.json(rows(`${offerSelect}${where} ORDER BY COALESCE(offers.spotykitePrice, offers.price, offers.publicPrice) ASC`, params).map(serializeFormula));
});

function stageTypeFilter(type) {
  if (['initiation', 'stage-3-jours', 'stage-5-jours', 'cours-particulier', 'progression', 'perfectionnement'].includes(type)) {
    return {
      sql: type === 'perfectionnement' ? "(offers.category = 'progression' OR offers.category = 'perfectionnement')" : 'offers.category = :category',
      params: type === 'perfectionnement' ? {} : { category: type }
    };
  }
  const filters = {
    'bapteme-kite': {
      sql: "(LOWER(offers.title) LIKE :title OR LOWER(offers.title) LIKE '%baptême%')",
      params: { title: '%bapteme%' }
    },
    'stage-decouverte-2-jours': {
      sql: "(LOWER(offers.title) LIKE :title OR offers.duration = '2 jours')",
      params: { title: '%decouverte%' }
    },
    'stage-progression-3-jours': {
      sql: "(LOWER(offers.title) LIKE :title OR offers.duration = '3 jours')",
      params: { title: '%progression%' }
    },
    'week-end-kite': {
      sql: "(offers.type = 'sejour' OR LOWER(offers.title) LIKE :title)",
      params: { title: '%week-end%' }
    },
    'coaching-prive': {
      sql: "(LOWER(offers.title) LIKE :title OR offers.type = 'coaching')",
      params: { title: '%coaching%' }
    },
    stage: {
      sql: "offers.type IN ('cours', 'stage', 'sejour')",
      params: {}
    }
  };

  return filters[type] || {
    sql: 'offers.type = :type',
    params: { type }
  };
}

function schoolCategoryFilter(type) {
  if (type === 'perfectionnement') {
    return {
      sql: "formula_filter.category IN ('progression', 'perfectionnement')",
      params: {}
    };
  }
  return {
    sql: 'formula_filter.category = :formulaType',
    params: { formulaType: type }
  };
}

app.get('/api/offers/:id', (req, res) => {
  const offer = row(`${offerSelect} WHERE offers.id = ?`, [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  res.json(serializeFormula(offer));
});

app.post('/api/offers', (req, res) => {
  const payload = formulaPayload(req.body);
  const result = run('INSERT INTO offers (schoolId, title, type, category, level, duration, price, publicPrice, spotykitePrice, commissionRate, description, shortDescription, included, imageUrl, slug, display_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', payload);
  res.status(201).json(serializeFormula(row(`${offerSelect} WHERE offers.id = ?`, [result.lastInsertRowid])));
});

app.put('/api/offers/:id', (req, res) => {
  const payload = formulaPayload(req.body);
  run('UPDATE offers SET schoolId = ?, title = ?, type = ?, category = ?, level = ?, duration = ?, price = ?, publicPrice = ?, spotykitePrice = ?, commissionRate = ?, description = ?, shortDescription = ?, included = ?, imageUrl = ?, slug = ?, display_order = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...payload, req.params.id]);
  res.json(serializeFormula(row(`${offerSelect} WHERE offers.id = ?`, [req.params.id])));
});

app.delete('/api/offers/:id', (req, res) => {
  run('DELETE FROM offers WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.get('/api/availabilities', (req, res) => {
  const { schoolId, formulaId, from, to } = req.query;
  const filters = [];
  const params = {};
  if (schoolId) {
    filters.push('formula_availabilities.school_id = :schoolId');
    params.schoolId = Number(schoolId);
  }
  if (formulaId) {
    filters.push('formula_availabilities.formula_id = :formulaId');
    params.formulaId = Number(formulaId);
  }
  if (from) {
    filters.push('formula_availabilities.date >= :from');
    params.from = from;
  }
  if (to) {
    filters.push('formula_availabilities.date <= :to');
    params.to = to;
  }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  res.json(rows(`
    SELECT formula_availabilities.*, schools.name AS schoolName, offers.title AS formulaName
    FROM formula_availabilities
    JOIN schools ON schools.id = formula_availabilities.school_id
    LEFT JOIN offers ON offers.id = formula_availabilities.formula_id
    ${where}
    ORDER BY formula_availabilities.date ASC, schools.name ASC
  `, params).map(serializeAvailability));
});

app.post('/api/availabilities', (req, res) => {
  const payload = availabilityPayload(req.body);
  const result = run(`
    INSERT INTO formula_availabilities (school_id, formula_id, date, total_places, booked_places, manual_price, status, internal_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(school_id, formula_id, date) DO UPDATE SET
      total_places = excluded.total_places,
      booked_places = excluded.booked_places,
      manual_price = excluded.manual_price,
      status = excluded.status,
      internal_note = excluded.internal_note,
      updated_at = CURRENT_TIMESTAMP
  `, payload);
  const item = row(`
    SELECT formula_availabilities.*, schools.name AS schoolName, offers.title AS formulaName
    FROM formula_availabilities
    JOIN schools ON schools.id = formula_availabilities.school_id
    LEFT JOIN offers ON offers.id = formula_availabilities.formula_id
    WHERE formula_availabilities.id = ?
       OR (formula_availabilities.school_id = ? AND COALESCE(formula_availabilities.formula_id, 0) = COALESCE(?, 0) AND formula_availabilities.date = ?)
    ORDER BY formula_availabilities.id DESC
    LIMIT 1
  `, [result.lastInsertRowid, payload[0], payload[1], payload[2]]);
  res.status(201).json(serializeAvailability(item));
});

app.put('/api/availabilities/:id', (req, res) => {
  const payload = availabilityPayload(req.body);
  run(`
    UPDATE formula_availabilities SET school_id = ?, formula_id = ?, date = ?, total_places = ?,
      booked_places = ?, manual_price = ?, status = ?, internal_note = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...payload, req.params.id]);
  const item = row(`
    SELECT formula_availabilities.*, schools.name AS schoolName, offers.title AS formulaName
    FROM formula_availabilities
    JOIN schools ON schools.id = formula_availabilities.school_id
    LEFT JOIN offers ON offers.id = formula_availabilities.formula_id
    WHERE formula_availabilities.id = ?
  `, [req.params.id]);
  res.json(serializeAvailability(item));
});

app.delete('/api/availabilities/:id', (req, res) => {
  run('DELETE FROM formula_availabilities WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.get('/api/seasons', (req, res) => {
  const schoolId = Number(req.query.schoolId || 0);
  const where = schoolId ? ' WHERE school_id = :schoolId' : '';
  res.json(rows(`SELECT * FROM school_seasons${where} ORDER BY start_date ASC`, schoolId ? { schoolId } : {}).map(serializeSeason));
});

app.post('/api/seasons', (req, res) => {
  const payload = seasonPayload(req.body);
  const result = run('INSERT INTO school_seasons (school_id, name, start_date, end_date, type, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', payload);
  res.status(201).json(serializeSeason(row('SELECT * FROM school_seasons WHERE id = ?', [result.lastInsertRowid])));
});

app.put('/api/seasons/:id', (req, res) => {
  const payload = seasonPayload(req.body);
  run('UPDATE school_seasons SET school_id = ?, name = ?, start_date = ?, end_date = ?, type = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...payload, req.params.id]);
  res.json(serializeSeason(row('SELECT * FROM school_seasons WHERE id = ?', [req.params.id])));
});

app.get('/api/special-offers', (req, res) => {
  const schoolId = Number(req.query.schoolId || 0);
  const where = schoolId ? ' WHERE special_offers.school_id = :schoolId' : '';
  res.json(rows(`
    SELECT special_offers.*, offers.title AS formulaName
    FROM special_offers
    LEFT JOIN offers ON offers.id = special_offers.formula_id
    ${where}
    ORDER BY special_offers.start_date ASC
  `, schoolId ? { schoolId } : {}).map(serializeSpecialOffer));
});

app.post('/api/special-offers', (req, res) => {
  const payload = specialOfferPayload(req.body);
  const result = run('INSERT INTO special_offers (school_id, formula_id, name, description, start_date, end_date, day_type, custom_days, discount_type, value, max_places, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', payload);
  res.status(201).json(serializeSpecialOffer(row('SELECT * FROM special_offers WHERE id = ?', [result.lastInsertRowid])));
});

app.put('/api/special-offers/:id', (req, res) => {
  const payload = specialOfferPayload(req.body);
  run('UPDATE special_offers SET school_id = ?, formula_id = ?, name = ?, description = ?, start_date = ?, end_date = ?, day_type = ?, custom_days = ?, discount_type = ?, value = ?, max_places = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...payload, req.params.id]);
  res.json(serializeSpecialOffer(row('SELECT * FROM special_offers WHERE id = ?', [req.params.id])));
});

app.get('/api/bookings', (_req, res) => {
  res.json(rows(`SELECT bookings.*, offers.title AS offerTitle, schools.name AS schoolName, schools.city, schools.spot
    FROM bookings
    JOIN offers ON offers.id = bookings.offerId
    LEFT JOIN schools ON schools.id = COALESCE(bookings.schoolId, offers.schoolId)
    ORDER BY bookings.createdAt DESC`));
});

app.post('/api/bookings', (req, res) => {
  const { offerId, formulaId, giftCardId = null, giftCardCode = null, customerName, customerFirstname, customerLastname, customerEmail, customerPhone, date, desiredDate, dateFlexible = false, region = null, schoolId = null, level = null } = req.body;
  const selectedOfferId = offerId || formulaId;
  const offer = row('SELECT * FROM offers WHERE id = ?', [selectedOfferId]);
  if (!offer) return res.status(400).json({ error: 'Invalid offerId' });
  const school = row('SELECT * FROM schools WHERE id = ?', [schoolId || offer.schoolId]);
  if (!school || school.front_visibility !== 'active' || !Number(school.booking_enabled ?? 1)) {
    return res.status(403).json({ error: 'Cette école n’est pas réservable en ligne' });
  }
  const calculated = (!dateFlexible && (desiredDate || date)) ? calculateFormulaPrice(offer.id, desiredDate || date) : null;
  const amount = Number(calculated?.price || offer.spotykitePrice || offer.price || offer.publicPrice || 0);
  const appliedGiftCard = giftCardCode ? row('SELECT * FROM gift_cards WHERE UPPER(code) = UPPER(?)', [giftCardCode]) : null;
  const discount = appliedGiftCard && appliedGiftCard.status === 'active' ? Math.min(Number(appliedGiftCard.remaining_amount || appliedGiftCard.amount || 0), amount) : 0;
  const totalPrice = amount - discount;
  const name = customerName || `${customerFirstname || ''} ${customerLastname || ''}`.trim();
  const result = run('INSERT INTO bookings (offerId, giftCardId, customerName, customerEmail, customerPhone, date, region, schoolId, level, status, totalPrice, dateFlexible, paymentStatus, orderStatus, giftCardCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [selectedOfferId, appliedGiftCard?.id || giftCardId, name, customerEmail, customerPhone, desiredDate || date || 'date à définir', region || school?.region || null, school?.id || schoolId, level || offer.level, totalPrice === 0 ? 'confirmed' : 'pending', totalPrice, toBoolInt(dateFlexible), totalPrice === 0 ? 'paid' : 'pending', 'en attente', giftCardCode]);
  markInitiatedPaid(req.body.resumeToken, totalPrice);
  if (!dateFlexible && (desiredDate || date) && school?.id) {
    incrementAvailabilityBooking(school.id, selectedOfferId, desiredDate || date);
  }
  if (appliedGiftCard && discount > 0) {
    const remaining = Number(appliedGiftCard.remaining_amount || appliedGiftCard.amount || 0) - discount;
    run('UPDATE gift_cards SET remaining_amount = ?, status = ?, redeemedAt = CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE redeemedAt END, bookingId = ? WHERE id = ?', [remaining, remaining === 0 ? 'redeemed' : 'active', remaining, result.lastInsertRowid, appliedGiftCard.id]);
  }
  res.status(201).json(row('SELECT * FROM bookings WHERE id = ?', [result.lastInsertRowid]));
});

app.get('/api/formulas', (req, res) => {
  const schoolId = req.query.schoolId;
  const where = schoolId ? ' WHERE offers.schoolId = :schoolId' : '';
  res.json(rows(`${offerSelect}${where} ORDER BY offers.active DESC, COALESCE(offers.spotykitePrice, offers.price, offers.publicPrice) ASC`, schoolId ? { schoolId } : {}).map(serializeFormula));
});

app.post('/api/formulas', (req, res) => {
  const payload = formulaPayload(req.body);
  const result = run('INSERT INTO offers (schoolId, title, type, category, level, duration, price, publicPrice, spotykitePrice, commissionRate, description, shortDescription, included, imageUrl, slug, display_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', payload);
  res.status(201).json(serializeFormula(row(`${offerSelect} WHERE offers.id = ?`, [result.lastInsertRowid])));
});

app.get('/api/accommodations', (req, res) => {
  const schoolId = req.query.schoolId;
  const where = schoolId ? ' WHERE schoolId = :schoolId' : '';
  res.json(rows(`SELECT * FROM accommodations${where} ORDER BY status DESC, name`, schoolId ? { schoolId } : {}).map(serializeAccommodation));
});

app.post('/api/accommodations', (req, res) => {
  const payload = accommodationPayload(req.body);
  const result = run('INSERT INTO accommodations (schoolId, name, type, address, distanceFromSpot, websiteUrl, promoCode, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', payload);
  res.status(201).json(serializeAccommodation(row('SELECT * FROM accommodations WHERE id = ?', [result.lastInsertRowid])));
});

app.put('/api/accommodations/:id', (req, res) => {
  const payload = accommodationPayload(req.body);
  run('UPDATE accommodations SET schoolId = ?, name = ?, type = ?, address = ?, distanceFromSpot = ?, websiteUrl = ?, promoCode = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...payload, req.params.id]);
  res.json(serializeAccommodation(row('SELECT * FROM accommodations WHERE id = ?', [req.params.id])));
});

app.delete('/api/accommodations/:id', (req, res) => {
  run('DELETE FROM accommodations WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.get('/api/gift-cards', (_req, res) => {
  res.json(rows(`SELECT gift_cards.*, offers.title AS offerTitle FROM gift_cards LEFT JOIN offers ON offers.id = gift_cards.offerId ORDER BY COALESCE(gift_cards.created_at, gift_cards.createdAt) DESC`).map(serializeGiftCard));
});

app.post('/api/gift-cards', (req, res) => {
  const { offerId = null, stage_id = null, buyerName, buyerEmail, recipientName, recipientEmail, message } = req.body;
  const buyer = splitName(req.body.buyerName || `${req.body.buyer_firstname || ''} ${req.body.buyer_lastname || ''}`);
  const beneficiaryName = req.body.recipientName || req.body.beneficiary_name || '';
  const buyer_email = req.body.buyer_email || buyerEmail;
  const beneficiary_email = req.body.beneficiary_email || recipientEmail;
  const buyerPhone = req.body.buyerPhone || req.body.customerPhone || req.body.customer_phone || '';
  const amount = Number(req.body.amount || 199);
  const paymentStatus = req.body.payment_status || req.body.paymentStatus || 'pending';
  const paymentProvider = req.body.payment_provider || req.body.paymentProvider || 'stripe';
  const paymentId = req.body.payment_id || req.body.paymentId || '';
  const code = `SKC-${Math.random().toString(36).slice(2, 7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const orderResult = run(`
    INSERT INTO orders (order_number, customer_firstname, customer_lastname, customer_email, customer_phone, product_type, stage_id, partner_id, city, spot, amount, status, payment_status, payment_provider, payment_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.body.order_number || req.body.orderNumber || `SK-GC-${Date.now().toString().slice(-6)}`,
    buyer.firstname,
    buyer.lastname,
    buyer_email,
    buyerPhone,
    'gift_card',
    null,
    null,
    '',
    '',
    amount,
    paymentStatus === 'paid' ? 'payé' : 'en attente',
    paymentStatus,
    paymentProvider,
    paymentId
  ]);
  const result = run(`INSERT INTO gift_cards (offerId, buyerName, buyerEmail, recipientName, recipientEmail, message, amount, initial_amount, remaining_amount, status, code, expiresAt, buyer_firstname, buyer_lastname, buyer_email, beneficiary_name, beneficiary_email, stage_id, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [offerId, `${buyer.firstname} ${buyer.lastname}`.trim(), buyer_email, beneficiaryName, beneficiary_email, message || '', amount, amount, amount, 'active', code, expiresAt.toISOString().slice(0, 10), buyer.firstname, buyer.lastname, buyer_email, beneficiaryName, beneficiary_email, stage_id, expiresAt.toISOString().slice(0, 10)]);
  const card = row('SELECT gift_cards.*, offers.title AS offerTitle FROM gift_cards LEFT JOIN offers ON offers.id = gift_cards.offerId WHERE gift_cards.id = ?', [result.lastInsertRowid]);
  const order = row('SELECT * FROM orders WHERE id = ?', [orderResult.lastInsertRowid]);
  markInitiatedPaid(req.body.resumeToken, amount);
  res.status(201).json({
    ...serializeGiftCard(card),
    order: serializeOrder(order),
    pdfUrl: `/api/gift-cards/${card.code}/pdf`,
    emails: {
      buyerConfirmation: buyer_email,
      giftCardRecipient: beneficiary_email || buyer_email
    }
  });
});

app.put('/api/gift-cards/:id', (req, res) => {
  const existing = row('SELECT * FROM gift_cards WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Gift card not found' });
  const buyer = splitName(req.body.buyerName || `${req.body.buyer_firstname || existing.buyer_firstname || ''} ${req.body.buyer_lastname || existing.buyer_lastname || ''}`);
  const buyerEmail = req.body.buyer_email || req.body.buyerEmail || existing.buyer_email || existing.buyerEmail;
  const beneficiaryName = req.body.beneficiary_name || req.body.recipientName || existing.beneficiary_name || existing.recipientName;
  const beneficiaryEmail = req.body.beneficiary_email || req.body.recipientEmail || existing.beneficiary_email || existing.recipientEmail;
  run(`UPDATE gift_cards SET buyerName = ?, buyerEmail = ?, recipientName = ?, recipientEmail = ?, message = ?, amount = ?, status = ?, buyer_firstname = ?, buyer_lastname = ?, buyer_email = ?, beneficiary_name = ?, beneficiary_email = ?, stage_id = ?, expires_at = ?, used_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [`${buyer.firstname} ${buyer.lastname}`.trim(), buyerEmail, beneficiaryName, beneficiaryEmail, req.body.message || existing.message || '', Number(req.body.amount || existing.amount), req.body.status || existing.status, buyer.firstname, buyer.lastname, buyerEmail, beneficiaryName, beneficiaryEmail, req.body.stage_id || existing.stage_id || null, req.body.expires_at || existing.expires_at || existing.expiresAt, req.body.used_at || existing.used_at || existing.redeemedAt || null, req.params.id]);
  res.json(serializeGiftCard(row('SELECT * FROM gift_cards WHERE id = ?', [req.params.id])));
});

app.delete('/api/gift-cards/:id', (req, res) => {
  run('DELETE FROM gift_cards WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.post('/api/gift-cards/validate', (req, res) => {
  const { code, recipientEmail } = req.body;
  const card = row(`SELECT gift_cards.*, offers.title AS offerTitle FROM gift_cards LEFT JOIN offers ON offers.id = gift_cards.offerId WHERE UPPER(gift_cards.code) = UPPER(?) AND LOWER(gift_cards.recipientEmail) = LOWER(?)`, [code || '', recipientEmail || '']);
  if (!card) return res.status(404).json({ error: 'Carte Cadeau SpotyKite introuvable' });
  if (card.status === 'redeemed') return res.status(409).json({ error: 'Carte Cadeau SpotyKite deja utilisee' });
  if (card.status === 'cancelled') return res.status(409).json({ error: 'Carte Cadeau SpotyKite annulee' });
  if (card.expiresAt && new Date(card.expiresAt) < new Date(new Date().toISOString().slice(0, 10))) {
    run("UPDATE gift_cards SET status = 'expired' WHERE id = ?", [card.id]);
    return res.status(410).json({ error: 'Carte Cadeau SpotyKite expiree' });
  }
  if (card.status === 'expired') return res.status(410).json({ error: 'Carte Cadeau SpotyKite expiree' });
  res.json(card);
});

app.post('/api/gift-cards/redeem', (req, res) => {
  const { code, recipientEmail, region, schoolId, date, customerName, customerPhone = '', level = 'debutant' } = req.body;
  const card = row(`SELECT * FROM gift_cards WHERE UPPER(code) = UPPER(?) AND LOWER(recipientEmail) = LOWER(?)`, [code || '', recipientEmail || '']);
  if (!card) return res.status(404).json({ error: 'Carte Cadeau SpotyKite introuvable' });
  if (card.status === 'redeemed') return res.status(409).json({ error: 'Carte Cadeau SpotyKite deja utilisee' });
  if (card.expiresAt && new Date(card.expiresAt) < new Date(new Date().toISOString().slice(0, 10))) {
    run("UPDATE gift_cards SET status = 'expired' WHERE id = ?", [card.id]);
    return res.status(410).json({ error: 'Carte Cadeau SpotyKite expiree' });
  }
  if (!card.offerId) return res.status(400).json({ error: 'Aucune experience associee a cette Carte Cadeau SpotyKite' });
  const bookingResult = run('INSERT INTO bookings (offerId, giftCardId, customerName, customerEmail, customerPhone, date, region, schoolId, level, status, totalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [card.offerId, card.id, customerName || card.recipientName, recipientEmail, customerPhone, date, region, schoolId ? Number(schoolId) : null, level, 'confirmed', 0]);
  const bookingId = bookingResult.lastInsertRowid;
  run("UPDATE gift_cards SET status = 'redeemed', redeemedAt = CURRENT_TIMESTAMP, bookingId = ? WHERE id = ?", [bookingId, card.id]);
  res.status(201).json({
    booking: row('SELECT * FROM bookings WHERE id = ?', [bookingId]),
    giftCard: row('SELECT * FROM gift_cards WHERE id = ?', [card.id])
  });
});

app.get('/api/gift-cards/:code/pdf', (req, res) => {
  const card = row(`SELECT gift_cards.*, offers.title AS offerTitle FROM gift_cards LEFT JOIN offers ON offers.id = gift_cards.offerId WHERE UPPER(gift_cards.code) = UPPER(?)`, [req.params.code]);
  if (!card) return res.status(404).send('Carte Cadeau SpotyKite introuvable');
  res.type('application/pdf');
  res.send(`PDF Carte Cadeau SpotyKite\nCode: ${card.code}\nBeneficiaire: ${card.recipientName}\nExperience: ${card.offerTitle || 'Carte Cadeau SpotyKite'}\nMontant: ${card.amount} EUR\nExpiration: ${card.expiresAt}`);
});

app.listen(port, host, () => {
  console.log(`SpotyKite API running on http://${host}:${port}`);
});

function partnerPayload(body) {
  return {
    partner: [
      body.name,
      body.slug || slugify(`ecole kitesurf ${body.city || ''} ${body.name || ''}`),
      body.city,
      body.department,
      body.region,
      body.address,
      nullableNumber(body.latitude),
      nullableNumber(body.longitude),
      body.short_description || body.shortDescription || '',
      body.full_description || body.fullDescription || '',
      body.school_description || body.schoolDescription || '',
      body.logo_url || body.logo || '',
      body.main_image_url || body.mainPhoto || body.imageUrl || '',
      body.website || '',
      body.phone || '',
      body.email || '',
      toBoolInt(body.is_active ?? body.isActive ?? body.status !== 'suspendu')
    ],
    conditions: [
      toBoolInt(body.ffvl_license_required ?? body.licenceRequired),
      toBoolInt(body.license_included ?? body.licenceIncluded),
      toBoolInt(body.medical_certificate_required ?? body.medicalCertificateRequired),
      toBoolInt(body.parental_authorization_required ?? body.parentalAuthorizationRequired)
    ],
    infos: [
      nullableNumber(body.min_age ?? body.minAge),
      nullableNumber(body.max_age ?? body.maxAge),
      nullableNumber(body.min_weight ?? body.minWeight),
      nullableNumber(body.max_weight ?? body.maxWeight),
      body.session_duration || body.averageSessionDuration || '',
      nullableNumber(body.max_participants ?? body.maxParticipants),
      Array.isArray(body.acceptedLevels) ? body.acceptedLevels.join(', ') : (body.level || ''),
      toBoolInt(body.equipment_included ?? body.equipmentProvided),
      toBoolInt(body.wetsuit_included ?? body.wetsuitProvided),
      toBoolInt(body.parking),
      toBoolInt(body.showers),
      toBoolInt(body.changing_rooms ?? body.changingRooms),
      toBoolInt(body.private_lessons ?? body.privateLessons),
      toBoolInt(body.group_lessons ?? body.groupLessons),
      toBoolInt(body.wingfoil_available ?? body.wingfoilAvailable),
      toBoolInt(body.rental_available ?? body.rentalAvailable),
      body.best_period || '',
      body.dominant_wind || '',
      body.spot_orientation || ''
    ]
  };
}

function schoolPayload(body) {
  const name = body.name || '';
  const description = body.description || body.fullDescription || body.shortDescription || '';
  const imageUrl = body.imageUrl || body.mainPhoto || body.main_image_url || 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80';
  const photos = Array.isArray(body.photos) ? body.photos.join(',') : (body.photos || body.galleryPhotos || imageUrl);
  return [
    name,
    body.slug || slugify(`ecole kitesurf ${body.city || ''} ${name}`),
    description,
    body.region || '',
    body.department || '',
    body.city || '',
    body.spot || body.city || '',
    body.address || '',
    nullableNumber(body.latitude),
    nullableNumber(body.longitude),
    Number(body.rating || 4.8),
    body.phone || '',
    body.email || '',
    body.website || '',
    imageUrl,
    photos,
    normalizeStatus(body.status ?? body.is_active ?? body.active),
    normalizeFrontVisibility(body.front_visibility ?? body.frontVisibility),
    toBoolInt(body.booking_enabled ?? body.bookingEnabled ?? true),
    body.pedagogy || body.teachingPhilosophy || '',
    body.spot_details || body.spotDetails || '',
    body.weather_policy || body.weatherPolicy || body.weatherConditions || '',
    body.weather_postpone_policy || body.weatherPostponePolicy || '',
    body.opening_period || body.openingPeriod || '',
    body.additional_info || body.additionalInfo || ''
  ];
}

function formulaPayload(body) {
  const publicPrice = Number(body.public_price ?? body.publicPrice ?? body.price ?? 0);
  const spotykitePrice = body.spotykite_price ?? body.spotykitePrice ?? body.price ?? publicPrice;
  const title = body.name || body.title || '';
  return [
    Number(body.school_id ?? body.schoolId),
    title,
    body.type || 'stage',
    body.category || body.formulaCategory || inferFormulaCategory(body),
    body.level || 'débutant',
    body.duration || '',
    Number(spotykitePrice),
    publicPrice,
    Number(spotykitePrice),
    Number(body.commission_rate ?? body.commissionRate ?? 0.15),
    body.description || body.short_description || body.shortDescription || '',
    body.short_description || body.shortDescription || body.description || '',
    body.included || 'Matériel, briefing sécurité et encadrement par l’école.',
    body.imageUrl || body.image_url || 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
    body.slug || slugify(title),
    Number(body.display_order ?? body.displayOrder ?? body.order ?? 0),
    toBoolInt(body.status ? body.status === 'active' || body.status === 'actif' : (body.active ?? true))
  ];
}

function syncSchoolFormulas(schoolId, body) {
  if (!Object.prototype.hasOwnProperty.call(body, 'schoolFormulas') && !Object.prototype.hasOwnProperty.call(body, 'formulas')) return;
  const configured = normalizeSchoolFormulas(body.schoolFormulas || body.formulas);
  const configuredTypes = configured.map((formula) => formula.formulaType);
  schoolFormulaDefinitions.forEach((definition) => {
    if (!configuredTypes.includes(definition.type)) {
      run('UPDATE offers SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE schoolId = ? AND category = ?', [schoolId, definition.type]);
    }
  });
  configured.forEach((formula) => {
    const existing = row('SELECT id FROM offers WHERE schoolId = ? AND category = ?', [schoolId, formula.formulaType]);
    const payload = formulaPayload({
      schoolId,
      name: formula.name,
      title: formula.name,
      type: 'stage',
      category: formula.formulaType,
      level: formula.level,
      duration: formula.duration,
      price: formula.price,
      publicPrice: formula.price,
      spotykitePrice: formula.price,
      shortDescription: formula.shortDescription,
      description: formula.shortDescription,
      slug: `${schoolId}-${formula.formulaType}`,
      displayOrder: formula.displayOrder,
      active: formula.isActive
    });
    if (existing) {
      run('UPDATE offers SET schoolId = ?, title = ?, type = ?, category = ?, level = ?, duration = ?, price = ?, publicPrice = ?, spotykitePrice = ?, commissionRate = ?, description = ?, shortDescription = ?, included = ?, imageUrl = ?, slug = ?, display_order = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...payload, existing.id]);
      upsertFormulaPrices(existing.id, formula);
    } else {
      const created = run('INSERT INTO offers (schoolId, title, type, category, level, duration, price, publicPrice, spotykitePrice, commissionRate, description, shortDescription, included, imageUrl, slug, display_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', payload);
      upsertFormulaPrices(created.lastInsertRowid, formula);
    }
  });
}

function upsertFormulaPrices(formulaId, formula) {
  const defaultPrice = Number(formula.defaultPrice || formula.price || 0);
  run(`
    INSERT INTO formula_prices (formula_id, low_season_weekday_price, low_season_weekend_price, high_season_weekday_price, high_season_weekend_price, default_price, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(formula_id) DO UPDATE SET
      low_season_weekday_price = excluded.low_season_weekday_price,
      low_season_weekend_price = excluded.low_season_weekend_price,
      high_season_weekday_price = excluded.high_season_weekday_price,
      high_season_weekend_price = excluded.high_season_weekend_price,
      default_price = excluded.default_price,
      updated_at = CURRENT_TIMESTAMP
  `, [
    formulaId,
    nullableNumber(formula.lowSeasonWeekdayPrice),
    nullableNumber(formula.lowSeasonWeekendPrice),
    nullableNumber(formula.highSeasonWeekdayPrice),
    nullableNumber(formula.highSeasonWeekendPrice),
    defaultPrice
  ]);
}

function normalizeSchoolFormulas(input) {
  const items = Array.isArray(input)
    ? input
    : Object.entries(input || {}).map(([formulaType, value]) => ({ formulaType, ...value }));
  return items
    .filter((item) => item?.enabled || item?.isActive || item?.active)
    .map((item) => {
      const definition = schoolFormulaDefinitions.find((definition) => definition.type === (item.formulaType || item.type || item.category)) || schoolFormulaDefinitions[0];
      return {
        formulaType: definition.type,
        name: item.name || definition.name,
        price: Number(item.price || definition.price),
        duration: item.duration || definition.duration,
        level: item.level || definition.level,
        shortDescription: item.shortDescription || item.short_description || definition.shortDescription,
        lowSeasonWeekdayPrice: item.lowSeasonWeekdayPrice ?? item.low_season_weekday_price ?? item.price ?? definition.price,
        lowSeasonWeekendPrice: item.lowSeasonWeekendPrice ?? item.low_season_weekend_price ?? item.price ?? definition.price,
        highSeasonWeekdayPrice: item.highSeasonWeekdayPrice ?? item.high_season_weekday_price ?? item.price ?? definition.price,
        highSeasonWeekendPrice: item.highSeasonWeekendPrice ?? item.high_season_weekend_price ?? item.price ?? definition.price,
        defaultPrice: item.defaultPrice ?? item.default_price ?? item.price ?? definition.price,
        isActive: item.status ? item.status === 'active' : item.isActive ?? item.active ?? true,
        displayOrder: Number(item.displayOrder ?? definition.displayOrder)
      };
    });
}

const schoolFormulaDefinitions = [
  { type: 'initiation', name: 'Initiation kitesurf', price: 89, duration: '1 séance', level: 'débutant', shortDescription: 'Découverte du pilotage, sécurité et premières sensations.', displayOrder: 1 },
  { type: 'stage-3-jours', name: 'Stage 3 jours', price: 249, duration: '3 jours', level: 'débutant', shortDescription: 'Une progression structurée sur trois jours.', displayOrder: 2 },
  { type: 'stage-5-jours', name: 'Stage 5 jours', price: 399, duration: '5 jours', level: 'débutant', shortDescription: 'Une immersion complète pour gagner en autonomie.', displayOrder: 3 },
  { type: 'cours-particulier', name: 'Cours particulier', price: 89, duration: '1 séance', level: 'tous niveaux', shortDescription: 'Un accompagnement individualisé avec un moniteur.', displayOrder: 4 },
  { type: 'progression', name: 'Progression', price: 149, duration: '1 séance', level: 'intermédiaire', shortDescription: 'Perfectionnez votre technique et votre navigation.', displayOrder: 5 }
];

function contentPayload(body) {
  return [
    body.page_key || body.pageKey || '',
    body.section_key || body.sectionKey || '',
    body.field_key || body.fieldKey || '',
    body.field_type || body.fieldType || 'text',
    body.value ?? '',
    body.locale || 'fr'
  ];
}

function availabilityPayload(body) {
  const totalPlaces = Number(body.total_places ?? body.totalPlaces ?? 0);
  const bookedPlaces = Number(body.booked_places ?? body.bookedPlaces ?? 0);
  return [
    Number(body.school_id ?? body.schoolId),
    body.formula_id || body.formulaId ? Number(body.formula_id ?? body.formulaId) : null,
    body.date || '',
    totalPlaces,
    bookedPlaces,
    nullableNumber(body.manual_price ?? body.manualPrice),
    body.status || (bookedPlaces >= totalPlaces && totalPlaces > 0 ? 'full' : 'available'),
    body.internal_note || body.internalNote || ''
  ];
}

function seasonPayload(body) {
  return [
    Number(body.school_id ?? body.schoolId),
    body.name || (body.type === 'high' ? 'Haute saison' : 'Basse saison'),
    body.start_date || body.startDate || '',
    body.end_date || body.endDate || '',
    body.type || 'low',
    toBoolInt(body.active ?? true)
  ];
}

function specialOfferPayload(body) {
  return [
    Number(body.school_id ?? body.schoolId),
    body.formula_id || body.formulaId ? Number(body.formula_id ?? body.formulaId) : null,
    body.name || '',
    body.description || '',
    body.start_date || body.startDate || '',
    body.end_date || body.endDate || '',
    body.day_type || body.dayType || 'all',
    Array.isArray(body.customDays) ? body.customDays.join(',') : (body.custom_days || body.customDays || ''),
    body.discount_type || body.discountType || 'fixed_price',
    Number(body.value || 0),
    nullableNumber(body.max_places ?? body.maxPlaces),
    toBoolInt(body.active ?? true)
  ];
}

function accommodationPayload(body) {
  return [
    Number(body.school_id ?? body.schoolId),
    body.name || '',
    body.type || 'hébergement',
    body.address || '',
    body.distance_from_spot || body.distanceFromSpot || '',
    body.website_url || body.websiteUrl || '',
    body.promo_code || body.promoCode || '',
    body.description || '',
    normalizeStatus(body.status ?? body.active)
  ];
}

function incrementAvailabilityBooking(schoolId, formulaId, date) {
  const availability = row(`
    SELECT * FROM formula_availabilities
    WHERE school_id = ? AND formula_id = ? AND date = ?
  `, [schoolId, formulaId, date]);
  if (!availability) return;
  const total = Number(availability.total_places || 0);
  const booked = Number(availability.booked_places || 0) + 1;
  run(`
    UPDATE formula_availabilities
    SET booked_places = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [booked, total > 0 && booked >= total ? 'full' : availability.status, availability.id]);
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && String(value).trim() !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
}

function matchesSlugValue(value, query) {
  if (!query) return true;
  const normalizedValue = slugify(value || '');
  const normalizedQuery = slugify(normalizeSlugQuery(query));
  return normalizedValue === normalizedQuery;
}

function schoolMatchesLocationFilters(school, filters = {}) {
  if (!matchesSlugValue(school.region, filters.region)) return false;
  if (!matchesSlugValue(school.department, filters.department)) return false;
  if (filters.city && !matchesSlugValue(school.city, filters.city) && !matchesSlugValue(school.spot, filters.city)) return false;
  if (!matchesSlugValue(school.spot, filters.spot)) return false;
  return true;
}

function hasValidCoordinates(item) {
  const lat = Number(item.latitude);
  const lng = Number(item.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function inferFormulaCategory(body) {
  const text = `${body.name || body.title || ''} ${body.duration || ''} ${body.type || ''}`.toLowerCase();
  if (text.includes('cours particulier') || text.includes('coaching')) return 'cours-particulier';
  if (text.includes('5 jours')) return 'stage-5-jours';
  if (text.includes('3 jours')) return 'stage-3-jours';
  if (text.includes('perfectionnement') || text.includes('progression')) return 'progression';
  if (text.includes('initiation') || text.includes('decouverte') || text.includes('découverte') || text.includes('2 jours')) return 'initiation';
  return body.type || 'stage';
}

function orderPayload(body) {
  const name = splitName(body.customerName || `${body.customer_firstname || ''} ${body.customer_lastname || ''}`);
  return [
    body.order_number || body.orderNumber || `SK-${Date.now().toString().slice(-6)}`,
    body.customer_firstname || name.firstname,
    body.customer_lastname || name.lastname,
    body.customer_email || body.customerEmail,
    body.customer_phone || body.customerPhone || '',
    body.product_type || body.offerType || body.productType || 'stage',
    body.stage_id || body.stageId || null,
    body.partner_id || body.partnerId || null,
    body.city || '',
    body.spot || '',
    Number(body.amount || 0),
    body.status || 'en attente',
    body.payment_status || body.paymentStatus || 'pending',
    body.payment_provider || body.paymentProvider || '',
    body.payment_id || body.paymentId || '',
    body.title || body.product || '',
    body.metadata ? JSON.stringify(body.metadata) : null
  ];
}

function createPendingStripeOrder(body) {
  const payload = orderPayload({
    ...body,
    status: 'pending',
    paymentStatus: 'pending',
    paymentProvider: 'stripe'
  });
  const result = run(`
    INSERT INTO orders (order_number, customer_firstname, customer_lastname, customer_email, customer_phone, product_type, stage_id, partner_id, city, spot, amount, status, payment_status, payment_provider, payment_id, title, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, payload);
  return row('SELECT * FROM orders WHERE id = ?', [result.lastInsertRowid]);
}

function stringifyMetadata(metadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

function parseMetadata(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function findStripeOrderFromMetadata(metadata, fallbackColumn, fallbackValue) {
  if (metadata.orderId) {
    const order = row('SELECT * FROM orders WHERE id = ? OR order_number = ?', [metadata.orderId, metadata.orderId]);
    if (order) return order;
  }
  if (metadata.orderNumber) {
    const order = row('SELECT * FROM orders WHERE order_number = ?', [metadata.orderNumber]);
    if (order) return order;
  }
  if (fallbackColumn === 'stripe_session_id') {
    return row('SELECT * FROM orders WHERE stripe_session_id = ? OR payment_id = ?', [fallbackValue, fallbackValue]);
  }
  return row('SELECT * FROM orders WHERE payment_id = ?', [fallbackValue]);
}

function markStripeCheckoutSessionPaid(session) {
  const metadata = session.metadata || {};
  const order = findStripeOrderFromMetadata(metadata, 'stripe_session_id', session.id);

  if (!order) {
    console.warn('Stripe webhook order not found for session', session.id);
    return null;
  }

  const orderMetadata = {
    ...parseMetadata(order.metadata),
    ...metadata,
    stripeCheckoutUrl: parseMetadata(order.metadata).stripeCheckoutUrl,
    stripePaymentIntent: session.payment_intent || ''
  };

  run(`
    UPDATE orders
    SET status = 'payé',
      payment_status = 'paid',
      payment_provider = 'stripe',
      payment_id = ?,
      stripe_session_id = ?,
      metadata = ?,
      paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [session.payment_intent || session.id, session.id, JSON.stringify(orderMetadata), order.id]);

  if (orderMetadata.resumeToken) {
    markInitiatedPaid(orderMetadata.resumeToken, order.amount);
  }

  console.log('Stripe checkout order paid', {
    sessionId: session.id,
    orderId: order.id,
    orderNumber: order.order_number
  });
  console.log('Commande payée', {
    orderId: order.id,
    orderNumber: order.order_number,
    customerEmail: order.customer_email
  });

  return row('SELECT * FROM orders WHERE id = ?', [order.id]);
}

function markStripePaymentIntentPaid(paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  const order = findStripeOrderFromMetadata(metadata, 'payment_id', paymentIntent.id);

  if (!order) {
    console.warn('Stripe webhook order not found for payment intent', paymentIntent.id);
    return null;
  }

  const orderMetadata = {
    ...parseMetadata(order.metadata),
    ...metadata,
    stripePaymentIntent: paymentIntent.id
  };

  run(`
    UPDATE orders
    SET status = 'payé',
      payment_status = 'paid',
      payment_provider = 'stripe',
      payment_id = ?,
      metadata = ?,
      paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [paymentIntent.id, JSON.stringify(orderMetadata), order.id]);

  if (orderMetadata.resumeToken) {
    markInitiatedPaid(orderMetadata.resumeToken, order.amount);
  }

  console.log('Stripe payment intent order paid', {
    paymentIntentId: paymentIntent.id,
    orderId: order.id,
    orderNumber: order.order_number
  });
  console.log('Commande payée', {
    orderId: order.id,
    orderNumber: order.order_number,
    customerEmail: order.customer_email
  });

  return row('SELECT * FROM orders WHERE id = ?', [order.id]);
}

function getResendClient() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_xxxxxxxxx') {
    throw new Error('Configuration Resend manquante: RESEND_API_KEY');
  }
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function mailFrom() {
  return process.env.MAIL_FROM || 'Spotykite <onboarding@resend.dev>';
}

async function sendStripePaymentEmails(order, session) {
  const emailData = buildStripePaymentEmailData(order, session);
  console.log('Tentative envoi Resend', {
    orderId: order.id,
    sessionId: session.id,
    customerEmail: emailData.customerEmail,
    adminEmail: process.env.SPOTYKITE_ADMIN_EMAIL
  });
  const emailResults = await Promise.allSettled([
    sendCustomerPaymentEmail(order, emailData),
    sendAdminPaymentEmail(order, emailData)
  ]);
  console.log('RESULTATS ENVOI EMAILS STRIPE:', emailResults);
}

async function sendCustomerPaymentEmail(order, emailData) {
  if (order.customer_email_sent_at) {
    console.log('Email client déjà envoyé', { orderId: order.id, sentAt: order.customer_email_sent_at });
    return;
  }
  if (!emailData.customerEmail) {
    console.warn('Email client non envoyé: email client manquant', { orderId: order.id, sessionId: emailData.sessionId });
    return;
  }

  console.log('Client email:', emailData.customerEmail);
  console.log('ENVOI EMAIL CLIENT...');

  try {
    console.log('AVANT ENVOI EMAIL CLIENT');
    const reservationPdf = await createReservationPdf(emailData);
    const resultClient = await getResendClient().emails.send({
      from: mailFrom(),
      to: emailData.customerEmail,
      subject: 'Confirmation de votre demande Spotykite',
      html: paymentCustomerHtml(emailData),
      attachments: [
        {
          filename: `Reservation-${emailData.orderNumber}.pdf`,
          content: reservationPdf.toString('base64')
        }
      ]
    });
    console.log('EMAIL CLIENT RESULT:', resultClient);
    console.log('RESEND CLIENT RESULT:', resultClient);
    if (resultClient?.error) {
      throw resultClient.error;
    }
    run('UPDATE orders SET customer_email_sent_at = CURRENT_TIMESTAMP WHERE id = ?', [order.id]);
    console.log('Email client envoyé', { orderId: order.id, to: emailData.customerEmail });
  } catch (error) {
    console.error('Erreur email Resend', {
      type: 'client',
      orderId: order.id,
      to: emailData.customerEmail,
      error
    });
  }
}

async function sendAdminPaymentEmail(order, emailData) {
  if (order.admin_email_sent_at) {
    console.log('Email admin déjà envoyé', { orderId: order.id, sentAt: order.admin_email_sent_at });
    return;
  }
  const adminEmail = process.env.SPOTYKITE_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('Email Spotykite non envoyé: SPOTYKITE_ADMIN_EMAIL manquant', { orderId: order.id, sessionId: emailData.sessionId });
    return;
  }

  try {
    console.log('ENVOI EMAIL ADMIN...');
    console.log('AVANT ENVOI EMAIL ADMIN');
    const resultAdmin = await getResendClient().emails.send({
      from: mailFrom(),
      to: adminEmail,
      subject: 'Nouvelle réservation payée sur Spotykite',
      html: paymentAdminHtml(emailData)
    });
    console.log('EMAIL ADMIN RESULT:', resultAdmin);
    console.log('RESEND ADMIN RESULT:', resultAdmin);
    if (resultAdmin?.error) {
      throw resultAdmin.error;
    }
    run('UPDATE orders SET admin_email_sent_at = CURRENT_TIMESTAMP WHERE id = ?', [order.id]);
    console.log('Email admin envoyé', { orderId: order.id, to: adminEmail });
  } catch (error) {
    console.error('Erreur email Resend', {
      type: 'admin',
      orderId: order.id,
      to: adminEmail,
      error
    });
  }
}

function buildStripePaymentEmailData(order, stripePayment) {
  const metadata = { ...parseMetadata(order.metadata), ...(stripePayment.metadata || {}) };
  const formulaId = metadata.formulaId || metadata.formula_id;
  const schoolId = metadata.schoolId || metadata.school_id;
  const formula = formulaId ? row(`${offerSelect} WHERE offers.id = ?`, [formulaId]) : null;
  const school = !formula && schoolId ? row('SELECT * FROM schools WHERE id = ?', [schoolId]) : null;
  const customerName = stripePayment.customer_details?.name || metadata.customerName || `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim();
  const stripeAmount = stripePayment.amount_total ?? stripePayment.amount_received ?? stripePayment.amount;
  const amount = Number(stripeAmount ? stripeAmount / 100 : order.amount || 0);
  const city = order.city || formula?.city || school?.city || metadata.city || '';
  const spot = order.spot || formula?.spot || school?.spot || metadata.spot || '';
  const schoolName = formula?.schoolName || school?.name || metadata.schoolName || metadata.school_name || '';
  const schoolPhone = formula?.schoolPhone || formula?.phone || school?.phone || metadata.schoolPhone || metadata.school_phone || '';
  const schoolEmail = formula?.schoolEmail || formula?.email || school?.email || metadata.schoolEmail || metadata.school_email || '';
  const schoolAddress = formula?.schoolAddress || school?.address || metadata.schoolAddress || metadata.school_address || '';
  const schoolWebsite = formula?.schoolWebsite || school?.website || metadata.schoolWebsite || metadata.school_website || '';
  const desiredDate = metadata.desiredDate || metadata.desired_date || metadata.selectedDate || metadata.selected_date || '';
  const hasReservedDate = Boolean(desiredDate && !String(desiredDate).toLowerCase().includes('définir') && !String(desiredDate).toLowerCase().includes('definir'));
  const offerName = metadata.offerName || metadata.offer_name || '';

  return {
    orderNumber: metadata.orderNumber || metadata.order_number || order.order_number,
    customerName,
    customerEmail: stripePayment.customer_details?.email || stripePayment.customer_email || stripePayment.receipt_email || metadata.customerEmail || metadata.customer_email || order.customer_email,
    customerPhone: order.customer_phone || '',
    productName: formula?.title || formula?.name || offerName || order.title || order.product_type || 'Réservation Spotykite',
    formulaName: formula?.title || formula?.name || offerName || order.title || 'Stage Spotykite',
    amountLabel: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount),
    schoolName,
    schoolPhone,
    schoolEmail,
    schoolAddress,
    schoolWebsite,
    city,
    spot,
    locationLabel: [city, spot].filter(Boolean).join(' - '),
    reservedDate: hasReservedDate ? formatEmailDate(desiredDate) : '',
    reservedTime: metadata.desiredTime || metadata.startTime || metadata.time || 'À confirmer avec l’école',
    dateToDefine: !hasReservedDate,
    sessionId: stripePayment.id,
    paymentIntent: stripePayment.payment_intent || stripePayment.id || order.payment_id || '',
    metadata
  };
}

function paymentCustomerHtml(data) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#12385C;max-width:680px">
      <h1 style="font-size:24px;margin:0 0 12px">Votre réservation Spotykite est confirmée</h1>
      <p>Bonjour${data.customerName ? ` ${escapeHtml(data.customerName)}` : ''},</p>
      <p>Votre paiement est confirmé. Vous trouverez ci-dessous les informations utiles pour votre stage.</p>

      <h2 style="font-size:18px;margin-top:24px">Récapitulatif de commande</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
        ${emailRows([
          ['Commande', data.orderNumber],
          ['Formule réservée', data.formulaName],
          ['Montant payé', data.amountLabel],
          ['École', data.schoolName || '-'],
          ['Lieu', data.locationLabel || '-']
        ])}
      </table>

      <h2 style="font-size:18px;margin-top:24px">Coordonnées de l’école</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
        ${emailRows([
          ['Nom de l’école', data.schoolName || '-'],
          ['Téléphone', data.schoolPhone || '-'],
          ['Email', data.schoolEmail || '-'],
          ['Adresse', data.schoolAddress || '-'],
          ['Site web', data.schoolWebsite || '-']
        ])}
      </table>

      <h2 style="font-size:18px;margin-top:24px">Date de votre stage</h2>
      ${data.dateToDefine ? `
        <p><strong>Votre stage est bien réservé.</strong></p>
        <p>Merci de contacter directement l’école afin de convenir d’une date de pratique.</p>
        <p>Les coordonnées de l’école figurent ci-dessus.</p>
      ` : `
        <p><strong>Date :</strong> ${escapeHtml(data.reservedDate)}</p>
        <p><strong>Heure :</strong> ${escapeHtml(data.reservedTime)}</p>
        <p>Merci de vous présenter 15 minutes avant le début de votre séance.</p>
      `}

      <p style="margin-top:24px">Votre bon de réservation Spotykite est joint à cet email.</p>
      <p>À bientôt,<br>Spotykite</p>
    </div>
  `;
}

async function createReservationPdf(data) {
  const qrCode = await QRCode.toBuffer(data.orderNumber, { width: 180, margin: 1 });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const blue = '#12385C';
    const turquoise = '#2DD4BF';
    const muted = '#5B7083';

    doc.rect(0, 0, doc.page.width, 96).fill(blue);
    doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('Spotykite', 48, 32);
    doc.fillColor(turquoise).fontSize(10).font('Helvetica-Bold').text('BON DE RÉSERVATION SPOTYKITE', 48, 64);

    doc.fillColor(blue).fontSize(18).font('Helvetica-Bold').text('BON DE RÉSERVATION SPOTYKITE', 48, 126);
    doc.fillColor(muted).fontSize(11).font('Helvetica').text(`Commande : ${data.orderNumber}`, 48, 154);

    doc.image(qrCode, 410, 122, { width: 110 });
    doc.fillColor(muted).fontSize(9).text('QR Code réservation', 405, 236, { width: 120, align: 'center' });

    let y = 210;
    y = pdfSection(doc, 'Participant', [data.customerName || '-', data.customerEmail || '', data.customerPhone || ''].filter(Boolean), y);
    y = pdfSection(doc, 'École', [data.schoolName || '-', data.schoolAddress || '', data.schoolWebsite || ''].filter(Boolean), y);
    y = pdfSection(doc, 'Lieu', [[data.city, data.spot].filter(Boolean).join(' - ') || '-'], y);
    y = pdfSection(doc, 'Formule', [data.formulaName || '-'], y);
    y = pdfSection(doc, 'Date', [data.dateToDefine ? 'Date à définir avec l’école' : `${data.reservedDate}${data.reservedTime ? ` - ${data.reservedTime}` : ''}`], y);
    y = pdfSection(doc, 'Téléphone', [data.schoolPhone || '-'], y);
    y = pdfSection(doc, 'Email', [data.schoolEmail || '-'], y);

    doc.moveTo(48, y + 18).lineTo(547, y + 18).strokeColor('#D8E6EF').stroke();
    doc.fillColor(muted).fontSize(9).font('Helvetica').text('Présentez ce bon à l’école ou communiquez le numéro de commande pour retrouver rapidement votre réservation.', 48, y + 34, { width: 499 });

    doc.end();
  });
}

function pdfSection(doc, title, lines, y) {
  doc.fillColor('#12385C').fontSize(12).font('Helvetica-Bold').text(`${title} :`, 48, y);
  doc.fillColor('#1F2A37').fontSize(11).font('Helvetica');
  lines.forEach((line, index) => {
    doc.text(String(line), 160, y + (index * 16), { width: 250 });
  });
  return y + Math.max(44, lines.length * 16 + 22);
}

function emailRows(rows) {
  return rows.map(([label, value]) => `
    <tr>
      <td style="border:1px solid #dbe7ef;font-weight:bold;width:180px">${escapeHtml(label)}</td>
      <td style="border:1px solid #dbe7ef">${escapeHtml(value)}</td>
    </tr>
  `).join('');
}

function paymentAdminHtml(data) {
  const rows = [
    ['Client', data.customerName || '-'],
    ['Email', data.customerEmail || '-'],
    ['Téléphone', data.customerPhone || '-'],
    ['Produit', data.productName],
    ['Montant payé', data.amountLabel],
    ['Lieu', data.locationLabel || '-'],
    ['Commande', data.orderNumber],
    ['Session Stripe', data.sessionId],
    ['Payment intent', data.paymentIntent || '-']
  ];

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#12385C">
      <h1 style="font-size:22px">Nouvelle réservation payée</h1>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="border:1px solid #dbe7ef;font-weight:bold">${escapeHtml(label)}</td>
            <td style="border:1px solid #dbe7ef">${escapeHtml(value)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
}

function formatEmailDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function serializePartner(partner) {
  return {
    ...partner,
    isActive: Boolean(partner.is_active),
    name: partner.name,
    city: partner.city,
    department: partner.department,
    region: partner.region,
    address: partner.address,
    phone: partner.phone,
    email: partner.email,
    website: partner.website,
    status: partner.is_active ? 'actif' : 'suspendu'
  };
}

function serializeSchool(school) {
  const activeFormulas = Number(school.activeFormulas || 0);
  const startingPrice = school.startingPrice ? Number(school.startingPrice) : null;
  return {
    ...school,
    schoolId: school.id,
    slug: school.slug || slugify(`ecole kitesurf ${school.city || ''} ${school.name || ''}`),
    photos: String(school.photos || school.imageUrl || '').split(',').map((item) => item.trim()).filter(Boolean),
    status: school.status || 'active',
    isActive: (school.status || 'active') === 'active',
    frontVisibility: school.front_visibility || 'active',
    front_visibility: school.front_visibility || 'active',
    bookingEnabled: Boolean(school.booking_enabled ?? 1),
    booking_enabled: Boolean(school.booking_enabled ?? 1),
    startingPrice,
    starting_price: startingPrice,
    activeFormulas,
    formulas_count: activeFormulas,
    visibleOnMap: hasValidCoordinates(school),
    pedagogy: school.pedagogy || '',
    spotDetails: school.spot_details || '',
    weatherPolicy: school.weather_policy || '',
    weatherPostponePolicy: school.weather_postpone_policy || '',
    openingPeriod: school.opening_period || '',
    additionalInfo: school.additional_info || ''
  };
}

function serializeSchoolPractical(partner) {
  if (!partner) return {};
  return {
    minAge: partner.min_age,
    maxAge: partner.max_age,
    minWeight: partner.min_weight,
    maxWeight: partner.max_weight,
    sessionDuration: partner.session_duration,
    maxParticipants: partner.max_participants,
    level: partner.level,
    equipmentIncluded: Boolean(partner.equipment_included),
    wetsuitIncluded: Boolean(partner.wetsuit_included),
    ffvlLicenseRequired: Boolean(partner.ffvl_license_required),
    licenseIncluded: Boolean(partner.license_included),
    medicalCertificateRequired: Boolean(partner.medical_certificate_required),
    parentalAuthorizationRequired: Boolean(partner.parental_authorization_required),
    parking: Boolean(partner.parking),
    showers: Boolean(partner.showers),
    changingRooms: Boolean(partner.changing_rooms),
    privateLessons: Boolean(partner.private_lessons),
    groupLessons: Boolean(partner.group_lessons),
    bestPeriod: partner.best_period,
    address: partner.address,
    phone: partner.phone,
    email: partner.email,
    website: partner.website
  };
}

function serializeFormula(offer) {
  const priceRules = {
    lowSeasonWeekdayPrice: nullableNumber(offer.low_season_weekday_price),
    lowSeasonWeekendPrice: nullableNumber(offer.low_season_weekend_price),
    highSeasonWeekdayPrice: nullableNumber(offer.high_season_weekday_price),
    highSeasonWeekendPrice: nullableNumber(offer.high_season_weekend_price),
    defaultPrice: nullableNumber(offer.default_price ?? offer.spotykitePrice ?? offer.price ?? offer.publicPrice)
  };
  return {
    ...offer,
    formulaId: offer.id,
    school_id: offer.schoolId,
    schoolId: offer.schoolId,
    name: offer.title,
    title: offer.title,
    public_price: Number(offer.publicPrice || offer.price || 0),
    publicPrice: Number(offer.publicPrice || offer.price || 0),
    spotykite_price: Number(offer.spotykitePrice || offer.price || offer.publicPrice || 0),
    spotykitePrice: Number(offer.spotykitePrice || offer.price || offer.publicPrice || 0),
    price: Number(priceRules.defaultPrice || offer.spotykitePrice || offer.price || offer.publicPrice || 0),
    priceRules,
    commission_rate: Number(offer.commissionRate || 0),
    commissionRate: Number(offer.commissionRate || 0),
    category: offer.category || offer.type,
    formulaCategory: offer.category || offer.type,
    slug: offer.slug || slugify(`${offer.title || offer.name || ''}-${offer.id || ''}`),
    displayOrder: Number(offer.display_order || 0),
    display_order: Number(offer.display_order || 0),
    short_description: offer.shortDescription || offer.description,
    shortDescription: offer.shortDescription || offer.description,
    status: offer.active ? 'active' : 'inactive',
    active: Boolean(offer.active)
  };
}

function serializeContentBlock(item) {
  return {
    ...item,
    pageKey: item.page_key,
    sectionKey: item.section_key,
    fieldKey: item.field_key,
    fieldType: item.field_type
  };
}

function serializeAvailability(item) {
  const total = Number(item.total_places || 0);
  const booked = Number(item.booked_places || 0);
  const pricing = item.formula_id && item.date ? calculateFormulaPrice(item.formula_id, item.date, item) : null;
  return {
    ...item,
    schoolId: item.school_id,
    school_id: item.school_id,
    formulaId: item.formula_id,
    formula_id: item.formula_id,
    formulaName: item.formulaName || item.formula_name || '',
    totalPlaces: total,
    total_places: total,
    bookedPlaces: booked,
    booked_places: booked,
    manualPrice: nullableNumber(item.manual_price),
    manual_price: nullableNumber(item.manual_price),
    appliedPrice: pricing?.price ?? nullableNumber(item.manual_price),
    applied_price: pricing?.price ?? nullableNumber(item.manual_price),
    normalPrice: pricing?.normalPrice ?? null,
    normal_price: pricing?.normalPrice ?? null,
    priceSource: pricing?.source || '',
    price_source: pricing?.source || '',
    specialOfferName: pricing?.specialOfferName || '',
    special_offer_name: pricing?.specialOfferName || '',
    availablePlaces: Math.max(total - booked, 0),
    available_places: Math.max(total - booked, 0),
    internalNote: item.internal_note || '',
    internal_note: item.internal_note || ''
  };
}

function serializeSeason(item) {
  return {
    ...item,
    schoolId: item.school_id,
    school_id: item.school_id,
    startDate: item.start_date,
    start_date: item.start_date,
    endDate: item.end_date,
    end_date: item.end_date,
    active: Boolean(item.active)
  };
}

function serializeSpecialOffer(item) {
  return {
    ...item,
    schoolId: item.school_id,
    school_id: item.school_id,
    formulaId: item.formula_id,
    formula_id: item.formula_id,
    startDate: item.start_date,
    start_date: item.start_date,
    endDate: item.end_date,
    end_date: item.end_date,
    dayType: item.day_type,
    day_type: item.day_type,
    customDays: String(item.custom_days || '').split(',').filter(Boolean),
    custom_days: item.custom_days || '',
    discountType: item.discount_type,
    discount_type: item.discount_type,
    maxPlaces: item.max_places,
    max_places: item.max_places,
    active: Boolean(item.active)
  };
}

function serializeAccommodation(item) {
  return {
    ...item,
    school_id: item.schoolId,
    distance_from_spot: item.distanceFromSpot,
    website_url: item.websiteUrl,
    promo_code: item.promoCode
  };
}

function serializeOrder(order) {
  return {
    ...order,
    id: order.order_number || order.id,
    dbId: order.id,
    customerName: `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim(),
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    product: order.stage_title || order.product_type,
    offerType: order.product_type,
    partner: order.partner_name || '',
    amount: order.amount,
    boughtAt: order.created_at,
    desiredDate: '',
    paymentMethod: order.payment_provider || order.payment_status
  };
}

function serializeGiftCard(card) {
  return {
    ...card,
    buyerName: card.buyerName || `${card.buyer_firstname || ''} ${card.buyer_lastname || ''}`.trim(),
    buyerEmail: card.buyerEmail || card.buyer_email,
    recipientName: card.recipientName || card.beneficiary_name,
    recipientEmail: card.recipientEmail || card.beneficiary_email,
    expiresAt: card.expiresAt || card.expires_at,
    redeemedAt: card.redeemedAt || card.used_at,
    createdAt: card.createdAt || card.created_at,
    initial_amount: card.initial_amount ?? card.amount,
    remainingAmount: card.remaining_amount ?? card.amount,
    remaining_amount: card.remaining_amount ?? card.amount
  };
}

function initiatedOrderPayload(body, existing = null) {
  const token = body.resumeToken || body.resume_token || existing?.resume_token || crypto.randomBytes(24).toString('hex');
  const expires = existing?.expires_at || futureDate(30);
  const type = body.type || existing?.type || 'booking';
  const resumeUrl = `/reservation/reprendre/${token}`;
  return {
    token,
    values: [
      type,
      body.status || existing?.status || 'initiated',
      body.payment_status || body.paymentStatus || existing?.payment_status || 'unpaid',
      nullableNumber(body.school_id ?? body.schoolId ?? existing?.school_id),
      nullableNumber(body.formula_id ?? body.formulaId ?? existing?.formula_id),
      body.desired_date || body.desiredDate || existing?.desired_date || '',
      body.first_name || body.firstName || body.customerFirstname || body.buyerFirstname || existing?.first_name || '',
      body.last_name || body.lastName || body.customerLastname || body.buyerLastname || existing?.last_name || '',
      body.email || body.customerEmail || body.buyerEmail || existing?.email || '',
      body.phone || body.customerPhone || body.buyerPhone || existing?.phone || '',
      nullableNumber(body.amount ?? existing?.amount),
      body.source_page || body.sourcePage || existing?.source_page || '',
      token,
      resumeUrl,
      body.last_step || body.lastStep || existing?.last_step || 'contact',
      body.message || existing?.message || '',
      expires
    ]
  };
}

function upsertInitiatedOrder(body) {
  if (!body.email && !body.phone && !body.customerEmail && !body.customerPhone && !body.buyerEmail && !body.buyerPhone) {
    throw Object.assign(new Error('Email ou téléphone requis'), { status: 400 });
  }
  const token = body.resumeToken || body.resume_token || '';
  const existing = token ? row('SELECT * FROM initiated_orders WHERE resume_token = ?', [token]) : null;
  const payload = initiatedOrderPayload(body, existing);
  if (existing) {
    run(`
      UPDATE initiated_orders SET type = ?, status = ?, payment_status = ?, school_id = ?, formula_id = ?,
        desired_date = ?, first_name = ?, last_name = ?, email = ?, phone = ?, amount = ?, source_page = ?,
        resume_token = ?, resume_url = ?, last_step = ?, message = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE resume_token = ?
    `, [...payload.values, payload.token]);
  } else {
    run(`
      INSERT INTO initiated_orders (type, status, payment_status, school_id, formula_id, desired_date, first_name, last_name, email, phone, amount, source_page, resume_token, resume_url, last_step, message, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, payload.values);
  }
  const item = row(`
    SELECT initiated_orders.*, schools.name AS schoolName, offers.title AS formulaName
    FROM initiated_orders
    LEFT JOIN schools ON schools.id = initiated_orders.school_id
    LEFT JOIN offers ON offers.id = initiated_orders.formula_id
    WHERE initiated_orders.resume_token = ?
  `, [payload.token]);
  return serializeInitiatedOrder(item);
}

function leadPayload(body, orderId) {
  return [
    nullableNumber(body.school_id ?? body.schoolId),
    nullableNumber(body.formula_id ?? body.formulaId),
    body.first_name || body.firstName || '',
    body.email || '',
    body.phone || '',
    body.message || '',
    body.source_page || body.sourcePage || '',
    body.status || 'new',
    orderId
  ];
}

function serializeInitiatedOrder(item) {
  return {
    ...item,
    kind: 'order',
    dbId: item.id,
    type: item.type,
    status: item.status,
    paymentStatus: item.payment_status,
    schoolId: item.school_id,
    formulaId: item.formula_id,
    schoolName: item.schoolName || item.school_name || '',
    formulaName: item.formulaName || item.formula_name || '',
    desiredDate: item.desired_date,
    firstName: item.first_name,
    lastName: item.last_name,
    email: item.email,
    phone: item.phone,
    sourcePage: item.source_page,
    resumeToken: item.resume_token,
    resumeUrl: item.resume_url,
    lastStep: item.last_step,
    internalNote: item.internal_note || '',
    updatedAt: item.updated_at,
    createdAt: item.created_at
  };
}

function serializeLead(item) {
  return {
    ...item,
    kind: 'lead',
    dbId: item.id,
    schoolId: item.school_id,
    formulaId: item.formula_id,
    schoolName: item.schoolName || item.school_name || '',
    formulaName: item.formulaName || item.formula_name || '',
    firstName: item.first_name,
    email: item.email,
    phone: item.phone,
    sourcePage: item.source_page,
    resumeUrl: item.resumeUrl || item.resume_url || '',
    internalNote: item.internal_note || '',
    updatedAt: item.updated_at,
    createdAt: item.created_at,
    type: 'lead_request',
    lastStep: 'lead'
  };
}

function markInitiatedPaid(token, amount) {
  if (!token) return;
  run(`
    UPDATE initiated_orders
    SET status = 'paid', payment_status = 'paid', amount = COALESCE(?, amount), last_step = 'payment', updated_at = CURRENT_TIMESTAMP
    WHERE resume_token = ?
  `, [nullableNumber(amount), token]);
}

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function calculateFormulaPrice(formulaId, date, availability = null) {
  const manualPrice = nullableNumber(availability?.manual_price ?? availability?.manualPrice);
  const offer = row(`
    SELECT offers.*, formula_prices.*
    FROM offers
    LEFT JOIN formula_prices ON formula_prices.formula_id = offers.id
    WHERE offers.id = ?
  `, [formulaId]);
  if (!offer) return null;
  const defaultPrice = Number(offer.default_price || offer.spotykitePrice || offer.price || offer.publicPrice || 0);
  const basePrice = seasonalPrice(offer, date, defaultPrice);
  if (manualPrice !== null) {
    return { price: manualPrice, normalPrice: basePrice, source: 'manual' };
  }
  const special = activeSpecialOffer(offer.schoolId, formulaId, date);
  if (special) {
    return {
      price: applyDiscount(basePrice, special),
      normalPrice: basePrice,
      source: 'special_offer',
      specialOfferName: special.name
    };
  }
  return { price: basePrice, normalPrice: basePrice, source: 'season' };
}

function seasonalPrice(offer, date, fallback) {
  const season = row(`
    SELECT * FROM school_seasons
    WHERE school_id = ? AND active = 1 AND date(?) BETWEEN date(start_date) AND date(end_date)
    ORDER BY CASE type WHEN 'high' THEN 1 WHEN 'low' THEN 2 ELSE 3 END
    LIMIT 1
  `, [offer.schoolId, date]);
  const weekend = isWeekend(date);
  if (season?.type === 'high') {
    return Number((weekend ? offer.high_season_weekend_price : offer.high_season_weekday_price) || fallback);
  }
  if (season?.type === 'low') {
    return Number((weekend ? offer.low_season_weekend_price : offer.low_season_weekday_price) || fallback);
  }
  return Number(fallback);
}

function activeSpecialOffer(schoolId, formulaId, date) {
  return rows(`
    SELECT * FROM special_offers
    WHERE school_id = ?
      AND active = 1
      AND (formula_id IS NULL OR formula_id = ?)
      AND date(?) BETWEEN date(start_date) AND date(end_date)
    ORDER BY formula_id DESC, id DESC
  `, [schoolId, formulaId, date]).find((offer) => offerMatchesDay(offer, date));
}

function offerMatchesDay(offer, date) {
  if (offer.day_type === 'all') return true;
  if (offer.day_type === 'weekday') return !isWeekend(date);
  if (offer.day_type === 'weekend') return isWeekend(date);
  const day = String(new Date(date).getDay());
  return String(offer.custom_days || '').split(',').map((item) => item.trim()).includes(day);
}

function applyDiscount(basePrice, offer) {
  const value = Number(offer.value || 0);
  if (offer.discount_type === 'fixed_price') return value;
  if (offer.discount_type === 'amount') return Math.max(Number(basePrice) - value, 0);
  if (offer.discount_type === 'percent') return Math.max(Math.round(Number(basePrice) * (1 - value / 100)), 0);
  return Number(basePrice);
}

function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

function splitName(value = '') {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return { firstname: parts[0] || '', lastname: parts.slice(1).join(' ') || '' };
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  return Number(value);
}

function toBoolInt(value) {
  return value ? 1 : 0;
}

function normalizeStatus(value) {
  if (value === false || value === 0 || value === 'inactive' || value === 'inactif' || value === 'suspendu') return 'inactive';
  return 'active';
}

function normalizeFrontVisibility(value) {
  if (['hidden', 'seo_only', 'active'].includes(value)) return value;
  return 'active';
}

function normalizeSlugQuery(value) {
  return String(value || '').replace(/-/g, ' ').trim();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
