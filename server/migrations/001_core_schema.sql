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
  partner_id INTEGER NOT NULL UNIQUE REFERENCES partners(id) ON DELETE CASCADE,
  ffvl_license_required INTEGER NOT NULL DEFAULT 0,
  license_included INTEGER NOT NULL DEFAULT 0,
  medical_certificate_required INTEGER NOT NULL DEFAULT 0,
  parental_authorization_required INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partner_infos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL UNIQUE REFERENCES partners(id) ON DELETE CASCADE,
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
  spot_orientation TEXT
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
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  partner_price INTEGER,
  available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id, stage_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  customer_firstname TEXT NOT NULL,
  customer_lastname TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  product_type TEXT NOT NULL,
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  city TEXT,
  spot TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'en attente',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT,
  payment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
