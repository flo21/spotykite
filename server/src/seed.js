import { migrate, row, run } from './db.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const testEmailDomain = 'example.test';
const legacyEmailDomains = ['demo.spotykite.test', testEmailDomain];
const placeholderImage = 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80';

const schools = [
  {
    name: 'Test Armor Kite School',
    region: 'Bretagne',
    department: 'Finistere',
    city: 'Brest',
    address: 'Zone de test Spotykite, 29200 Brest',
    latitude: 48.3904,
    longitude: -4.4861,
    shortDescription: 'Ecole test bretonne pour valider les stages et les compteurs regionaux.',
    fullDescription: 'Test Armor Kite School est une fiche de test Spotykite utilisee pour verifier le parcours SpotyKite en Bretagne. Les informations sont realistes mais non commerciales.',
    schoolDescription: 'A savoir : cours confirmes selon meteo, materiel fourni, licence et certificat medical demandes avant la mise a l eau.'
  },
  {
    name: 'Test Quiberon Kite Center',
    region: 'Bretagne',
    department: 'Morbihan',
    city: 'Quiberon',
    address: 'Zone de test Spotykite, 56170 Quiberon',
    latitude: 47.484,
    longitude: -3.1196,
    shortDescription: 'Centre test en Bretagne sud pour les fiches Spotykite et le tunnel d achat.',
    fullDescription: 'Test Quiberon Kite Center sert de donnees de demonstration pour les filtres, la carte et les stages associes.',
    schoolDescription: 'A savoir : groupes limites, report meteo possible, licence et certificat medical requis.'
  },
  {
    name: 'Test Le Havre Kite School',
    region: 'Normandie',
    department: 'Seine-Maritime',
    city: 'Le Havre',
    address: 'Zone de test Spotykite, 76600 Le Havre',
    latitude: 49.4944,
    longitude: 0.1079,
    shortDescription: 'Ecole test normande pour verifier les compteurs et les offres de stage.',
    fullDescription: 'Test Le Havre Kite School propose un jeu de donnees coherent pour simuler des stages de kitesurf en Normandie.',
    schoolDescription: 'A savoir : briefing securite systematique, licence et certificat medical obligatoires.'
  },
  {
    name: 'Test Ouistreham Kite Academy',
    region: 'Normandie',
    department: 'Calvados',
    city: 'Ouistreham',
    address: 'Zone de test Spotykite, 14150 Ouistreham',
    latitude: 49.2757,
    longitude: -0.2592,
    shortDescription: 'Academie test normande pour les pages stages et les filtres regionaux.',
    fullDescription: 'Test Ouistreham Kite Academy est une ecole fictive de test non commerciale destinee aux validations produit.',
    schoolDescription: 'A savoir : stages en petits groupes, materiel inclus, licence et certificat medical demandes.'
  },
  {
    name: 'Test La Rochelle Kite School',
    region: 'Nouvelle-Aquitaine',
    department: 'Charente-Maritime',
    city: 'La Rochelle',
    address: 'Zone de test Spotykite, 17000 La Rochelle',
    latitude: 46.1603,
    longitude: -1.1511,
    shortDescription: 'Ecole test rochelaise pour valider les parcours publics SpotyKite.',
    fullDescription: 'Test La Rochelle Kite School alimente les tests de fiches Spotykite, offres et statistiques par region.',
    schoolDescription: 'A savoir : progression adaptee au niveau, report meteo, licence et certificat medical requis.'
  },
  {
    name: 'Test Arcachon Kite Center',
    region: 'Nouvelle-Aquitaine',
    department: 'Gironde',
    city: 'Arcachon',
    address: 'Zone de test Spotykite, 33120 Arcachon',
    latitude: 44.661,
    longitude: -1.172,
    shortDescription: 'Centre test en Nouvelle-Aquitaine pour verifier les offres achetables.',
    fullDescription: 'Test Arcachon Kite Center permet de tester les stages, la carte et les pages achat avec une localisation coherente.',
    schoolDescription: 'A savoir : encadrement diplome simule, materiel inclus, licence et certificat medical obligatoires.'
  },
  {
    name: 'Test Leucate Kite Academy',
    region: 'Occitanie',
    department: 'Aude',
    city: 'Leucate',
    address: 'Zone de test Spotykite, 11370 Leucate',
    latitude: 42.9106,
    longitude: 3.0297,
    shortDescription: 'Academie test occitane pour les stages et les statistiques backoffice.',
    fullDescription: 'Test Leucate Kite Academy est une entree de test dediee aux validations de filtres et compteurs.',
    schoolDescription: 'A savoir : conditions de vent controlees dans le parcours test, licence et certificat medical requis.'
  },
  {
    name: 'Test Hyeres Kite School',
    region: 'PACA',
    department: 'Var',
    city: 'Hyeres',
    address: 'Zone de test Spotykite, 83400 Hyeres',
    latitude: 43.1205,
    longitude: 6.1286,
    shortDescription: 'Ecole test PACA pour le parcours de reservation et les fiches stages.',
    fullDescription: 'Test Hyeres Kite School sert de fiche active de test Spotykite pour verifier les pages publiques et l achat.',
    schoolDescription: 'A savoir : materiel fourni, niveau debutant accepte, licence et certificat medical demandes.'
  },
  {
    name: 'Test Dunkerque Kite School',
    region: 'Hauts-de-France',
    department: 'Nord',
    city: 'Dunkerque',
    address: 'Zone de test Spotykite, 59140 Dunkerque',
    latitude: 51.0344,
    longitude: 2.3768,
    shortDescription: 'Ecole test des Hauts-de-France pour les compteurs du mega-menu.',
    fullDescription: 'Test Dunkerque Kite School permet de valider la presence d une ecole active dans les Hauts-de-France.',
    schoolDescription: 'A savoir : sessions confirmees selon securite, licence et certificat medical obligatoires.'
  },
  {
    name: 'Test La Baule Kite Center',
    region: 'Pays de la Loire',
    department: 'Loire-Atlantique',
    city: 'La Baule-Escoublac',
    address: 'Zone de test Spotykite, 44500 La Baule-Escoublac',
    latitude: 47.2868,
    longitude: -2.3908,
    shortDescription: 'Centre test en Pays de la Loire pour les filtres regionaux et l achat.',
    fullDescription: 'Test La Baule Kite Center est une fiche de test realiste non commerciale pour les validations SpotyKite.',
    schoolDescription: 'A savoir : stage confirme selon meteo, materiel compris, licence et certificat medical requis.'
  }
].map((school) => ({
  ...school,
  slug: slugify(`ecole test kitesurf ${school.city} ${school.name}`),
  email: `${slugify(school.name)}@${testEmailDomain}`,
  phone: '',
  website: ''
}));

const stages = [
  {
    title: 'Stage decouverte 2 jours',
    slug: 'stage-decouverte-2-jours',
    description: 'Deux jours pour decouvrir le pilotage, les regles de securite et les premieres sensations de glisse.',
    durationDays: 2,
    duration: '2 jours',
    price: 199,
    type: 'stage',
    category: 'initiation',
    level: 'debutant'
  },
  {
    title: 'Stage progression 3 jours',
    slug: 'stage-progression-3-jours',
    description: 'Trois jours pour consolider le pilotage, travailler le waterstart et gagner en autonomie.',
    durationDays: 3,
    duration: '3 jours',
    price: 299,
    type: 'stage',
    category: 'stage-3-jours',
    level: 'intermediaire'
  },
  {
    title: 'Stage intensif 5 jours',
    slug: 'stage-intensif-5-jours',
    description: 'Cinq jours pour structurer une progression complete, de la securite aux premiers bords autonomes.',
    durationDays: 5,
    duration: '5 jours',
    price: 499,
    type: 'stage',
    category: 'stage-5-jours',
    level: 'debutant'
  },
  {
    title: 'Coaching individuel 1h',
    slug: 'coaching-individuel-1h',
    description: 'Une heure de coaching individuel pour travailler un objectif precis avec un moniteur.',
    durationDays: 0,
    duration: '1h',
    price: 89,
    type: 'coaching',
    category: 'cours-particulier',
    level: 'intermediaire'
  },
  {
    title: 'Progression autonomie',
    slug: 'perfectionnement-autonomie',
    description: 'Une formule ciblee pour ameliorer la technique, la remontee au vent et l autonomie.',
    durationDays: 1,
    duration: '1 jour',
    price: 149,
    type: 'stage',
    category: 'perfectionnement',
    level: 'intermediaire'
  }
];

export function seed() {
  migrate();
  cleanupTestData();

  for (const school of schools) {
    upsertPartner(school);
    upsertSchool(school);
  }

  for (const stage of stages) {
    upsertStage(stage);
  }

  for (const school of schools) {
    const partnerId = row('SELECT id FROM partners WHERE slug = ?', [school.slug]).id;
    const schoolId = row('SELECT id FROM schools WHERE email = ?', [school.email]).id;

    for (const stage of stages) {
      const stageId = row('SELECT id FROM stages WHERE slug = ?', [stage.slug]).id;
      run(`INSERT INTO partner_stages (partner_id, stage_id, partner_price, available)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(partner_id, stage_id) DO UPDATE SET partner_price = excluded.partner_price, available = 1, updated_at = CURRENT_TIMESTAMP`, [partnerId, stageId, stage.price]);
      upsertOffer(schoolId, school, stage);
    }
  }

  if (row('SELECT COUNT(*) AS total FROM admin_users').total === 0) {
    const adminEmail = process.env.ADMIN_USER_EMAIL || process.env.SPOTYKITE_ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || process.env.SPOTYKITE_ADMIN_PASSWORD_HASH;
    if (adminEmail && adminPasswordHash) {
      run('INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)', [
        adminEmail,
        adminPasswordHash,
        'admin'
      ]);
    }
  }
}

function upsertPartner(school) {
  run(`
    INSERT INTO partners (name, slug, city, department, region, address, latitude, longitude, short_description, full_description, school_description, logo_url, main_image_url, website, phone, email, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      city = excluded.city,
      department = excluded.department,
      region = excluded.region,
      address = excluded.address,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      short_description = excluded.short_description,
      full_description = excluded.full_description,
      school_description = excluded.school_description,
      logo_url = excluded.logo_url,
      main_image_url = excluded.main_image_url,
      website = excluded.website,
      phone = excluded.phone,
      email = excluded.email,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
  `, [
    school.name,
    school.slug,
    school.city,
    school.department,
    school.region,
    school.address,
    school.latitude,
    school.longitude,
    school.shortDescription,
    school.fullDescription,
    school.schoolDescription,
    '',
    placeholderImage,
    school.website,
    school.phone,
    school.email
  ]);

  const partnerId = row('SELECT id FROM partners WHERE slug = ?', [school.slug]).id;
  run(`INSERT INTO partner_conditions (partner_id, ffvl_license_required, license_included, medical_certificate_required, parental_authorization_required)
    VALUES (?, 1, 0, 1, 1)
    ON CONFLICT(partner_id) DO UPDATE SET
      ffvl_license_required = 1,
      license_included = 0,
      medical_certificate_required = 1,
      parental_authorization_required = 1`, [partnerId]);
  run(`INSERT INTO partner_infos (partner_id, min_age, max_age, min_weight, max_weight, session_duration, max_participants, level, equipment_included, wetsuit_included, parking, showers, changing_rooms, private_lessons, group_lessons, wingfoil_available, rental_available, best_period, dominant_wind, spot_orientation)
    VALUES (?, 12, NULL, 35, 110, '2h30', 4, 'Debutant, Intermediaire, Confirme', 1, 1, 1, 0, 1, 1, 1, 0, 0, 'Avril a octobre', 'Selon conditions locales', 'Ville littorale')
    ON CONFLICT(partner_id) DO UPDATE SET
      min_age = 12,
      max_age = NULL,
      min_weight = 35,
      max_weight = 110,
      session_duration = '2h30',
      max_participants = 4,
      level = 'Debutant, Intermediaire, Confirme',
      equipment_included = 1,
      wetsuit_included = 1,
      parking = 1,
      showers = 0,
      changing_rooms = 1,
      private_lessons = 1,
      group_lessons = 1,
      wingfoil_available = 0,
      rental_available = 0,
      best_period = 'Avril a octobre',
      dominant_wind = 'Selon conditions locales',
      spot_orientation = 'Ville littorale'`, [partnerId]);
}

function upsertSchool(school) {
  const existing = row('SELECT id FROM schools WHERE email = ?', [school.email]);
  const values = [
    school.name,
    school.slug,
    school.shortDescription,
    school.region,
    school.department,
    school.city,
    school.city,
    school.address,
    school.latitude,
    school.longitude,
    4.8,
    school.phone,
    school.email,
    school.website,
    placeholderImage,
    placeholderImage
  ];

  if (existing) {
    run("UPDATE schools SET name = ?, slug = ?, description = ?, region = ?, department = ?, city = ?, spot = ?, address = ?, latitude = ?, longitude = ?, rating = ?, phone = ?, email = ?, website = ?, imageUrl = ?, photos = ?, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [...values, existing.id]);
    return;
  }

  run("INSERT INTO schools (name, slug, description, region, department, city, spot, address, latitude, longitude, rating, phone, email, website, imageUrl, photos, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", values);
}

function upsertStage(stage) {
  run(`INSERT INTO stages (title, slug, description, duration_days, price, type, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      duration_days = excluded.duration_days,
      price = excluded.price,
      type = excluded.type,
      is_active = 1`, [stage.title, stage.slug, stage.description, stage.durationDays, stage.price, stage.type]);
}

function upsertOffer(schoolId, school, stage) {
  const title = stage.title
    .replace('Stage decouverte', 'Initiation')
    .replace('Stage progression', 'Progression')
    .replace('Stage intensif', 'Stage')
    .replace('Coaching individuel 1h', 'Cours particulier');
  const existing = row('SELECT id FROM offers WHERE schoolId = ? AND title = ?', [schoolId, title]);
  const values = [
    schoolId,
    title,
    stage.type,
    stage.category,
    stage.level,
    stage.duration,
    stage.price,
    stage.price,
    stage.price,
    0.15,
    `${stage.description} Donnees de test non commerciales pour ${school.region}.`,
    stage.description,
    'Materiel complet, briefing securite, encadrement, licence et certificat medical a fournir.',
    placeholderImage,
    1
  ];

  if (existing) {
    run('UPDATE offers SET schoolId = ?, title = ?, type = ?, category = ?, level = ?, duration = ?, price = ?, publicPrice = ?, spotykitePrice = ?, commissionRate = ?, description = ?, shortDescription = ?, included = ?, imageUrl = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...values, existing.id]);
    upsertAccommodation(schoolId, school);
    return;
  }

  run('INSERT INTO offers (schoolId, title, type, category, level, duration, price, publicPrice, spotykitePrice, commissionRate, description, shortDescription, included, imageUrl, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', values);
  upsertAccommodation(schoolId, school);
}

function upsertAccommodation(schoolId, school) {
  const name = `Hébergement recommandé ${school.city}`;
  const existing = row('SELECT id FROM accommodations WHERE schoolId = ? AND name = ?', [schoolId, name]);
  const values = [
    schoolId,
    name,
    'hotel',
    school.address,
    'Moins de 10 km du spot',
    'https://www.spotykite.com',
    `KITE-${slugify(school.city).slice(0, 8).toUpperCase()}`,
    'Recommandation indicative proche du spot. Réservation à effectuer directement auprès de l’hébergement.',
    'active'
  ];
  if (existing) {
    run('UPDATE accommodations SET schoolId = ?, name = ?, type = ?, address = ?, distanceFromSpot = ?, websiteUrl = ?, promoCode = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [...values, existing.id]);
    return;
  }
  run('INSERT INTO accommodations (schoolId, name, type, address, distanceFromSpot, websiteUrl, promoCode, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', values);
}

function cleanupTestData() {
  for (const domain of legacyEmailDomains) {
    run(`DELETE FROM offers WHERE schoolId IN (SELECT id FROM schools WHERE email LIKE ?)`, [`%@${domain}`]);
    run('DELETE FROM schools WHERE email LIKE ?', [`%@${domain}`]);
    run('DELETE FROM partners WHERE email LIKE ?', [`%@${domain}`]);
    run('DELETE FROM gift_cards WHERE buyerEmail LIKE ? OR buyer_email LIKE ? OR recipientEmail LIKE ? OR beneficiary_email LIKE ?', [`%@${domain}`, `%@${domain}`, `%@${domain}`, `%@${domain}`]);
  }

  run("DELETE FROM orders WHERE order_number LIKE 'SK-DEMO-%' OR payment_id LIKE 'pay_demo_%'");
  run("DELETE FROM bookings WHERE customerEmail IN ('camille@example.com')");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  console.log('Database seeded.');
}
