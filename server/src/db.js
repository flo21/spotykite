import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'spotykite.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      region TEXT NOT NULL,
      city TEXT NOT NULL,
      spot TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 4.8,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      imageUrl TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schoolId INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      level TEXT NOT NULL,
      duration TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT NOT NULL,
      included TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (schoolId) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offerId INTEGER NOT NULL,
      giftCardId INTEGER,
      customerName TEXT NOT NULL,
      customerEmail TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      date TEXT NOT NULL,
      region TEXT,
      schoolId INTEGER,
      level TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      totalPrice INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (offerId) REFERENCES offers(id) ON DELETE CASCADE,
      FOREIGN KEY (schoolId) REFERENCES schools(id) ON DELETE SET NULL,
      FOREIGN KEY (giftCardId) REFERENCES gift_cards(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS gift_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offerId INTEGER,
      buyerName TEXT NOT NULL,
      buyerEmail TEXT NOT NULL,
      recipientName TEXT NOT NULL,
      recipientEmail TEXT NOT NULL,
      message TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      code TEXT NOT NULL UNIQUE,
      expiresAt TEXT,
      redeemedAt TEXT,
      bookingId INTEGER,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (offerId) REFERENCES offers(id) ON DELETE SET NULL,
      FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      city TEXT NOT NULL,
      department TEXT NOT NULL,
      region TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      short_description TEXT,
      full_description TEXT,
      school_description TEXT,
      logo_url TEXT,
      main_image_url TEXT,
      website TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS partner_conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL UNIQUE,
      ffvl_license_required INTEGER NOT NULL DEFAULT 0,
      license_included INTEGER NOT NULL DEFAULT 0,
      medical_certificate_required INTEGER NOT NULL DEFAULT 0,
      parental_authorization_required INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS partner_infos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL UNIQUE,
      min_age INTEGER,
      max_age INTEGER,
      min_weight INTEGER,
      max_weight INTEGER,
      session_duration TEXT,
      max_participants INTEGER,
      level TEXT,
      equipment_included INTEGER NOT NULL DEFAULT 1,
      wetsuit_included INTEGER NOT NULL DEFAULT 1,
      parking INTEGER NOT NULL DEFAULT 0,
      showers INTEGER NOT NULL DEFAULT 0,
      changing_rooms INTEGER NOT NULL DEFAULT 0,
      private_lessons INTEGER NOT NULL DEFAULT 1,
      group_lessons INTEGER NOT NULL DEFAULT 1,
      wingfoil_available INTEGER NOT NULL DEFAULT 0,
      rental_available INTEGER NOT NULL DEFAULT 0,
      best_period TEXT,
      dominant_wind TEXT,
      spot_orientation TEXT,
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      duration_days INTEGER,
      price INTEGER NOT NULL,
      type TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS partner_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      stage_id INTEGER NOT NULL,
      partner_price INTEGER,
      available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(partner_id, stage_id),
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_firstname TEXT NOT NULL,
      customer_lastname TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      product_type TEXT NOT NULL,
      stage_id INTEGER,
      partner_id INTEGER,
      city TEXT,
      spot TEXT,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'en attente',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_provider TEXT,
      payment_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL,
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL,
      section_key TEXT NOT NULL,
      field_key TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text',
      value TEXT,
      locale TEXT NOT NULL DEFAULT 'fr',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(page_key, section_key, field_key, locale)
    );

    CREATE TABLE IF NOT EXISTS formula_availabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      formula_id INTEGER,
      date TEXT NOT NULL,
      total_places INTEGER NOT NULL DEFAULT 0,
      booked_places INTEGER NOT NULL DEFAULT 0,
      manual_price INTEGER,
      status TEXT NOT NULL DEFAULT 'available',
      internal_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(school_id, formula_id, date),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (formula_id) REFERENCES offers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS formula_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formula_id INTEGER NOT NULL UNIQUE,
      low_season_weekday_price INTEGER,
      low_season_weekend_price INTEGER,
      high_season_weekday_price INTEGER,
      high_season_weekend_price INTEGER,
      default_price INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (formula_id) REFERENCES offers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS school_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'low',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS special_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      formula_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      day_type TEXT NOT NULL DEFAULT 'all',
      custom_days TEXT,
      discount_type TEXT NOT NULL DEFAULT 'fixed_price',
      value INTEGER NOT NULL DEFAULT 0,
      max_places INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (formula_id) REFERENCES offers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS initiated_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'booking',
      status TEXT NOT NULL DEFAULT 'initiated',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      school_id INTEGER,
      formula_id INTEGER,
      desired_date TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      amount INTEGER,
      source_page TEXT,
      resume_token TEXT NOT NULL UNIQUE,
      resume_url TEXT NOT NULL,
      last_step TEXT,
      message TEXT,
      internal_note TEXT,
      email_sent_at TEXT,
      sms_prepared INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
      FOREIGN KEY (formula_id) REFERENCES offers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      formula_id INTEGER,
      first_name TEXT,
      email TEXT,
      phone TEXT,
      message TEXT,
      source_page TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      order_id INTEGER,
      internal_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
      FOREIGN KEY (formula_id) REFERENCES offers(id) ON DELETE SET NULL,
      FOREIGN KEY (order_id) REFERENCES initiated_orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      initiated_order_id INTEGER,
      event_type TEXT NOT NULL,
      author TEXT,
      content TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (initiated_order_id) REFERENCES initiated_orders(id) ON DELETE CASCADE
    );
  `);

  addColumnIfMissing('bookings', 'giftCardId', 'INTEGER');
  addColumnIfMissing('bookings', 'region', 'TEXT');
  addColumnIfMissing('bookings', 'schoolId', 'INTEGER');
  addColumnIfMissing('bookings', 'level', 'TEXT');
  addColumnIfMissing('bookings', 'dateFlexible', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('bookings', 'paymentStatus', "TEXT NOT NULL DEFAULT 'pending'");
  addColumnIfMissing('bookings', 'orderStatus', "TEXT NOT NULL DEFAULT 'en attente'");
  addColumnIfMissing('bookings', 'giftCardCode', 'TEXT');
  addColumnIfMissing('orders', 'title', 'TEXT');
  addColumnIfMissing('orders', 'stripe_session_id', 'TEXT');
  addColumnIfMissing('orders', 'paid_at', 'TEXT');
  addColumnIfMissing('orders', 'metadata', 'TEXT');
  addColumnIfMissing('orders', 'customer_email_sent_at', 'TEXT');
  addColumnIfMissing('orders', 'admin_email_sent_at', 'TEXT');
  addColumnIfMissing('orders', 'consumed_at', 'TEXT');
  addColumnIfMissing('orders', 'consumed_by', 'TEXT');
  addColumnIfMissing('orders', 'consumption_method', 'TEXT');
  addColumnIfMissing('orders', 'voucher_token', 'TEXT');
  addColumnIfMissing('orders', 'partner_payout_status', "TEXT NOT NULL DEFAULT 'not_payable'");
  addColumnIfMissing('orders', 'reservation_key', 'TEXT');
  addColumnIfMissing('orders', 'payment_link', 'TEXT');
  addColumnIfMissing('initiated_orders', 'payment_link', 'TEXT');
  addColumnIfMissing('schools', 'slug', 'TEXT');
  addColumnIfMissing('schools', 'department', 'TEXT');
  addColumnIfMissing('schools', 'address', 'TEXT');
  addColumnIfMissing('schools', 'latitude', 'REAL');
  addColumnIfMissing('schools', 'longitude', 'REAL');
  addColumnIfMissing('schools', 'website', 'TEXT');
  addColumnIfMissing('schools', 'photos', 'TEXT');
  addColumnIfMissing('schools', 'status', "TEXT NOT NULL DEFAULT 'active'");
  addColumnIfMissing('schools', 'front_visibility', "TEXT NOT NULL DEFAULT 'active'");
  addColumnIfMissing('schools', 'booking_enabled', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('schools', 'pedagogy', 'TEXT');
  addColumnIfMissing('schools', 'spot_details', 'TEXT');
  addColumnIfMissing('schools', 'weather_policy', 'TEXT');
  addColumnIfMissing('schools', 'weather_postpone_policy', 'TEXT');
  addColumnIfMissing('schools', 'opening_period', 'TEXT');
  addColumnIfMissing('schools', 'additional_info', 'TEXT');
  addColumnIfMissing('schools', 'presentation_badges', 'TEXT');
  addColumnIfMissing('schools', 'created_at', 'TEXT');
  addColumnIfMissing('schools', 'updated_at', 'TEXT');
  addColumnIfMissing('offers', 'publicPrice', 'INTEGER');
  addColumnIfMissing('offers', 'spotykitePrice', 'INTEGER');
  addColumnIfMissing('offers', 'commissionRate', 'REAL NOT NULL DEFAULT 0.15');
  addColumnIfMissing('offers', 'shortDescription', 'TEXT');
  addColumnIfMissing('offers', 'slug', 'TEXT');
  addColumnIfMissing('offers', 'display_order', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('formula_availabilities', 'manual_price', 'INTEGER');
  addColumnIfMissing('offers', 'category', 'TEXT');
  addColumnIfMissing('offers', 'created_at', 'TEXT');
  addColumnIfMissing('offers', 'updated_at', 'TEXT');
  addColumnIfMissing('gift_cards', 'remaining_amount', 'INTEGER');
  addColumnIfMissing('gift_cards', 'initial_amount', 'INTEGER');
  addColumnIfMissing('gift_cards', 'expiresAt', 'TEXT');
  addColumnIfMissing('gift_cards', 'redeemedAt', 'TEXT');
  addColumnIfMissing('gift_cards', 'bookingId', 'INTEGER');
  addColumnIfMissing('gift_cards', 'buyer_firstname', 'TEXT');
  addColumnIfMissing('gift_cards', 'buyer_lastname', 'TEXT');
  addColumnIfMissing('gift_cards', 'buyer_email', 'TEXT');
  addColumnIfMissing('gift_cards', 'beneficiary_name', 'TEXT');
  addColumnIfMissing('gift_cards', 'beneficiary_email', 'TEXT');
  addColumnIfMissing('gift_cards', 'stage_id', 'INTEGER');
  addColumnIfMissing('gift_cards', 'expires_at', 'TEXT');
  addColumnIfMissing('gift_cards', 'used_at', 'TEXT');
  addColumnIfMissing('gift_cards', 'created_at', 'TEXT');
  addColumnIfMissing('gift_cards', 'updated_at', 'TEXT');
  db.exec(`
    UPDATE schools SET slug = lower(replace(name, ' ', '-')) WHERE slug IS NULL OR TRIM(slug) = '';
    UPDATE schools SET department = '' WHERE department IS NULL;
    UPDATE schools SET address = '' WHERE address IS NULL;
    UPDATE schools SET website = '' WHERE website IS NULL;
    UPDATE schools SET photos = imageUrl WHERE photos IS NULL OR TRIM(photos) = '';
    UPDATE schools SET status = 'active' WHERE status IS NULL OR TRIM(status) = '';
    UPDATE schools SET front_visibility = 'active' WHERE front_visibility IS NULL OR TRIM(front_visibility) = '';
    UPDATE schools SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
    UPDATE schools SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
    UPDATE offers SET publicPrice = price WHERE publicPrice IS NULL;
    UPDATE offers SET spotykitePrice = price WHERE spotykitePrice IS NULL;
    UPDATE offers SET shortDescription = description WHERE shortDescription IS NULL OR TRIM(shortDescription) = '';
    UPDATE offers SET category = 'initiation' WHERE (category IS NULL OR TRIM(category) = '') AND (LOWER(title) LIKE '%initiation%' OR LOWER(title) LIKE '%decouverte%' OR duration = '2 jours');
    UPDATE offers SET category = 'stage-3-jours' WHERE (category IS NULL OR TRIM(category) = '') AND duration = '3 jours';
    UPDATE offers SET category = 'stage-5-jours' WHERE (category IS NULL OR TRIM(category) = '') AND duration = '5 jours';
    UPDATE offers SET category = 'cours-particulier' WHERE (category IS NULL OR TRIM(category) = '') AND (LOWER(title) LIKE '%cours particulier%' OR LOWER(title) LIKE '%coaching%' OR type = 'coaching');
    UPDATE offers SET category = 'perfectionnement' WHERE (category IS NULL OR TRIM(category) = '') AND LOWER(title) LIKE '%perfectionnement%';
    UPDATE offers SET category = type WHERE category IS NULL OR TRIM(category) = '';
    UPDATE offers SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
    UPDATE offers SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
    UPDATE gift_cards SET remaining_amount = amount WHERE remaining_amount IS NULL;
    DELETE FROM partner_stages
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM partner_stages
      GROUP BY partner_id, stage_id
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_stages_partner_stage
      ON partner_stages(partner_id, stage_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_voucher_token
      ON orders(voucher_token)
      WHERE voucher_token IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pending_reservation_key
      ON orders(reservation_key)
      WHERE reservation_key IS NOT NULL AND payment_status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_events_initiated_order_id ON order_events(initiated_order_id);

    CREATE TABLE IF NOT EXISTS accommodations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schoolId INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      address TEXT,
      distanceFromSpot TEXT,
      websiteUrl TEXT,
      promoCode TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schoolId) REFERENCES schools(id) ON DELETE CASCADE
    );
  `);
  db.exec("UPDATE gift_cards SET status = 'active' WHERE status = 'created';");
}

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function rows(statement, params = {}) {
  const prepared = db.prepare(statement);
  return Array.isArray(params) ? prepared.all(...params) : prepared.all(params);
}

export function row(statement, params = {}) {
  const prepared = db.prepare(statement);
  return Array.isArray(params) ? prepared.get(...params) : prepared.get(params);
}

export function run(statement, params = {}) {
  const prepared = db.prepare(statement);
  return Array.isArray(params) ? prepared.run(...params) : prepared.run(params);
}
