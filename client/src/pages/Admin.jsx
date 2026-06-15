import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  CreditCard,
  Edit3,
  Eye,
  Filter,
  Gift,
  Home,
  LayoutDashboard,
  LogOut,
  Plus,
  Save,
  School,
  Search,
  Settings,
  ShoppingBag,
  Trash2,
  Users,
  FileText,
  CalendarDays
} from 'lucide-react';
import { api } from '../api.js';

const ADMIN_CODE = 'spotykite-admin';

const initialOrders = [];
const initialPartners = [];
const initialGiftCards = [];

const blankPartner = {
  name: '',
  address: '',
  city: '',
  department: '',
  region: '',
  phone: '',
  email: '',
  website: '',
  contactName: '',
  sessionPrice: '',
  stagePrice: '',
  supervisedPrice: '',
  commission: '',
  services: '',
  notes: '',
  status: 'prospect',
  frontVisibility: 'active',
  bookingEnabled: true,
  schoolFormulas: {}
};

const defaultKitesurfBrief = "Après un briefing de sécurité, vous découvrez le pilotage de l'aile, les techniques de décollage, le contrôle de la puissance et les premières sensations de glisse. Encadré par un moniteur diplômé, vous progressez à votre rythme dans un environnement sécurisé. Une expérience accessible aux débutants comme aux sportifs souhaitant découvrir le kitesurf.";

const blankSchoolPartner = {
  name: '',
  city: '',
  department: '',
  region: '',
  spot: '',
  address: '',
  latitude: '',
  longitude: '',
  shortDescription: '',
  fullDescription: '',
  mainPhoto: '',
  galleryPhotos: '',
  logo: '',
  website: '',
  phone: '',
  email: '',
  kitesurfBrief: defaultKitesurfBrief,
  schoolTitle: 'Votre école de kitesurf',
  schoolDescription: '',
  licenceRequired: false,
  licenceIncluded: false,
  medicalCertificateRequired: false,
  parentalAuthorizationRequired: false,
  minAge: '',
  maxAge: '',
  minWeight: '',
  maxWeight: '',
  averageSessionDuration: '',
  maxParticipants: '',
  acceptedLevels: [],
  equipmentProvided: true,
  wetsuitProvided: true,
  changingRooms: false,
  parking: false,
  showers: false,
  privateLessons: true,
  groupLessons: true,
  wingfoilAvailable: false,
  rentalAvailable: false,
  metaTitle: '',
  metaDescription: '',
  slug: '',
  frontVisibility: 'active',
  bookingEnabled: true
};

const schoolStageDefinitions = [
  { type: 'initiation', label: 'Initiation kitesurf', price: '89', duration: '1 séance', level: 'débutant', shortDescription: 'Découverte du pilotage, sécurité et premières sensations.', displayOrder: 1 },
  { type: 'stage-3-jours', label: 'Stage 3 jours', price: '249', duration: '3 jours', level: 'débutant', shortDescription: 'Une progression structurée sur trois jours.', displayOrder: 2 },
  { type: 'stage-5-jours', label: 'Stage 5 jours', price: '399', duration: '5 jours', level: 'débutant', shortDescription: 'Une immersion complète pour gagner en autonomie.', displayOrder: 3 },
  { type: 'cours-particulier', label: 'Cours particulier', price: '89', duration: '1 séance', level: 'tous niveaux', shortDescription: 'Un accompagnement individualisé avec un moniteur.', displayOrder: 4 },
  { type: 'progression', label: 'Progression', price: '149', duration: '1 séance', level: 'intermédiaire', shortDescription: 'Perfectionnez votre technique et votre navigation.', displayOrder: 5 }
];

const blankSchoolStages = Object.fromEntries(schoolStageDefinitions.map((stage) => [stage.type, {
  enabled: false,
  name: stage.label,
  price: stage.price,
  defaultPrice: stage.price,
  lowSeasonWeekdayPrice: stage.price,
  lowSeasonWeekendPrice: stage.price,
  highSeasonWeekdayPrice: stage.price,
  highSeasonWeekendPrice: stage.price,
  duration: stage.duration,
  level: stage.level,
  shortDescription: stage.shortDescription,
  sessionPlaces: '',
  isActive: true,
  displayOrder: stage.displayOrder
}]));

blankSchoolPartner.schoolFormulas = blankSchoolStages;

function newSchoolPartnerForm() {
  return {
    ...blankSchoolPartner,
    acceptedLevels: [],
    schoolFormulas: mergeSchoolStages()
  };
}

const tabs = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['contents', 'Contenus du site', FileText],
  ['prospects', 'Prospects & commandes', Users],
  ['orders', 'Commandes', ShoppingBag],
  ['partners', 'Écoles', School],
  ['create-partner', 'Créer une école', Plus],
  ['formulas', 'Formules', CreditCard],
  ['accommodations', 'Hébergements', Home],
  ['calendar', 'Calendrier', CalendarDays],
  ['gifts', 'Cartes cadeaux', Gift],
  ['settings', 'Paramètres', Settings]
];

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('spotykite-admin') === 'true');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [orders, setOrders] = useState(initialOrders);
  const [prospects, setProspects] = useState([]);
  const [partners, setPartners] = useState(initialPartners);
  const [adminGiftCards, setAdminGiftCards] = useState(initialGiftCards);
  const [formulas, setFormulas] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [contentBlocks, setContentBlocks] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [specialOffers, setSpecialOffers] = useState([]);
  const [apiStatus, setApiStatus] = useState('fallback');
  const [notice, setNotice] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [partnerForm, setPartnerForm] = useState(blankPartner);
  const [schoolPartnerForm, setSchoolPartnerForm] = useState(newSchoolPartnerForm);
  const [createdSchoolPartner, setCreatedSchoolPartner] = useState(null);
  const [editingPartnerId, setEditingPartnerId] = useState(null);

  const stats = useMemo(() => {
    return {
      revenue: orders.filter((order) => order.status !== 'annulé').reduce((sum, order) => sum + order.amount, 0),
      totalOrders: orders.length,
      pendingOrders: orders.filter((order) => order.status === 'en attente').length,
      activePartners: partners.filter((partner) => partner.status === 'actif').length,
      activeFormulas: formulas.filter((formula) => formula.active || formula.status === 'active').length,
      commissions: orders.filter((order) => order.status !== 'annulé').reduce((sum, order) => sum + Math.round((order.amount || 0) * 0.15), 0),
      giftCardsSold: adminGiftCards.length
    };
  }, [orders, partners, adminGiftCards, formulas]);

  useEffect(() => {
    if (!unlocked) return;

    reloadAdminData()
      .then(() => setApiStatus('connected'))
      .catch((error) => {
        setApiStatus('fallback');
        showNotice('error', error.message || 'Impossible de charger les données depuis la base.');
      });
  }, [unlocked]);

  async function reloadAdminData() {
    const [nextOrders, nextProspects, nextSchools, nextFormulas, nextAccommodations, nextContentBlocks, nextAvailabilities, nextSeasons, nextSpecialOffers, nextGiftCards] = await Promise.all([
      api.orders(),
      api.prospects(),
      api.schools({ include: 'all' }),
      api.formulas(),
      api.accommodations(),
      api.contentBlocks(),
      api.availabilities(),
      api.seasons(),
      api.specialOffers(),
      api.giftCards()
    ]);
    setOrders(nextOrders.map(normalizeAdminOrder));
    setProspects(nextProspects);
    setPartners(nextSchools.map(normalizeAdminPartner));
    setFormulas(nextFormulas);
    setAccommodations(nextAccommodations);
    setContentBlocks(nextContentBlocks);
    setAvailabilities(nextAvailabilities);
    setSeasons(nextSeasons);
    setSpecialOffers(nextSpecialOffers);
    setAdminGiftCards(nextGiftCards.map(normalizeAdminGiftCard));
    setApiStatus('connected');
  }

  function showNotice(type, message) {
    setNotice({ type, message });
  }

  async function persist(action, successMessage) {
    try {
      await action();
      await reloadAdminData();
      showNotice('success', successMessage || 'Enregistré avec succès');
      return true;
    } catch (error) {
      showNotice('error', error.message || 'Erreur lors de l’enregistrement en base de données.');
      return false;
    }
  }

  function unlock(event) {
    event.preventDefault();
    if (code.trim() === ADMIN_CODE) {
      localStorage.setItem('spotykite-admin', 'true');
      setUnlocked(true);
    }
  }

  function logout() {
    localStorage.removeItem('spotykite-admin');
    setUnlocked(false);
    setCode('');
  }

  async function savePartner(event) {
    event.preventDefault();
    const payload = {
      name: partnerForm.name,
      slug: partnerForm.slug,
      description: partnerForm.notes || partnerForm.services || '',
      region: partnerForm.region,
      department: partnerForm.department,
      city: partnerForm.city,
      spot: partnerForm.city,
      address: partnerForm.address,
      website: partnerForm.website,
      phone: partnerForm.phone,
      email: partnerForm.email,
      status: normalizePartnerStatus(partnerForm.status) === 'actif' ? 'active' : 'inactive',
      frontVisibility: partnerForm.frontVisibility,
      bookingEnabled: partnerForm.bookingEnabled,
      schoolFormulas: enabledSchoolFormulas(partnerForm.schoolFormulas)
    };
    if (editingPartnerId) {
      const saved = await persist(() => api.updateSchool(editingPartnerId, payload), 'École enregistrée avec succès');
      if (!saved) return;
    } else {
      const saved = await persist(() => api.createSchool(payload), 'École créée avec succès');
      if (!saved) return;
    }
    setPartnerForm(blankPartner);
    setEditingPartnerId(null);
  }

  async function saveSchoolPartner(event) {
    event.preventDefault();
    const payload = {
      name: schoolPartnerForm.name,
      slug: schoolPartnerForm.slug,
      description: schoolPartnerForm.fullDescription || schoolPartnerForm.shortDescription,
      region: schoolPartnerForm.region,
      department: schoolPartnerForm.department,
      city: schoolPartnerForm.city,
      spot: schoolPartnerForm.spot || schoolPartnerForm.city,
      address: schoolPartnerForm.address,
      latitude: schoolPartnerForm.latitude,
      longitude: schoolPartnerForm.longitude,
      website: schoolPartnerForm.website,
      phone: schoolPartnerForm.phone,
      email: schoolPartnerForm.email,
      imageUrl: schoolPartnerForm.mainPhoto,
      photos: schoolPartnerForm.galleryPhotos,
      pedagogy: schoolPartnerForm.schoolDescription,
      spotDetails: schoolPartnerForm.kitesurfBrief,
      weatherPolicy: schoolPartnerForm.dominantWind || '',
      weatherPostponePolicy: '',
      openingPeriod: schoolPartnerForm.bestPeriod || '',
      additionalInfo: schoolPartnerForm.fullDescription,
      schoolFormulas: enabledSchoolFormulas(schoolPartnerForm.schoolFormulas),
      frontVisibility: schoolPartnerForm.frontVisibility,
      bookingEnabled: schoolPartnerForm.bookingEnabled,
      status: 'active'
    };
    const saved = await persist(
      () => editingPartnerId ? api.updateSchool(editingPartnerId, payload) : api.createSchool(payload),
      editingPartnerId ? 'École enregistrée avec succès' : 'École créée avec succès'
    );
    if (!saved) return;
    if (editingPartnerId) {
      setSchoolPartnerForm(newSchoolPartnerForm());
      setEditingPartnerId(null);
      setTab('partners');
      return;
    }
    setCreatedSchoolPartner(normalizeAdminPartner(payload));
    setSchoolPartnerForm(newSchoolPartnerForm());
  }

  function editPartner(partner) {
    setSchoolPartnerForm(schoolToSchoolForm(partner, formulas.filter((formula) => String(formula.schoolId) === String(partner.id))));
    setEditingPartnerId(partner.id);
    setCreatedSchoolPartner(null);
    setTab('create-partner');
  }

  async function deletePartner(id) {
    const deleted = await persist(() => api.deleteSchool(id), 'École supprimée avec succès');
    if (!deleted) return;
    if (editingPartnerId === id) {
      setPartnerForm(blankPartner);
      setSchoolPartnerForm(newSchoolPartnerForm());
      setEditingPartnerId(null);
    }
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-bg px-4 py-24">
        <form onSubmit={unlock} className="mx-auto max-w-md rounded-3xl border border-border bg-white p-6 shadow-lift">
          <p className="eyebrow">Backoffice</p>
          <h1 className="text-4xl font-black text-text">Accès admin SpotyKite</h1>
          <p className="mt-3 text-sm text-muted">Protection temporaire avant branchement du système d'authentification.</p>
          <input className="field mt-6" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code admin" type="password" />
          <button className="btn-primary mt-4 w-full justify-center">Entrer</button>
          <p className="mt-4 text-xs font-bold text-muted">Code temporaire : spotykite-admin</p>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f8] text-text">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-border bg-navy px-4 py-6 text-white">
          <div className="px-3 text-2xl font-black">SpotyKite</div>
          <p className="px-3 text-xs font-bold uppercase tracking-widest text-white/55">Backoffice</p>
          <nav className="mt-8 grid gap-2">
            {tabs.map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setSelectedOrder(null);
                }}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${tab === id ? 'bg-primary text-navy' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
          <button onClick={logout} className="mt-8 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-white/70 hover:bg-white/10">
            <LogOut size={18} /> Déconnexion
          </button>
        </aside>

        <section className="min-w-0 p-4 sm:p-6 lg:p-8">
          <AdminHeader tab={tab} apiStatus={apiStatus} />
          {notice && <AdminNotice notice={notice} onClose={() => setNotice(null)} />}
          {tab === 'dashboard' && <Dashboard stats={stats} orders={orders} partners={partners} />}
          {tab === 'contents' && <ContentsPage blocks={contentBlocks} onSaved={reloadAdminData} onNotice={showNotice} />}
          {tab === 'prospects' && <ProspectsPage prospects={prospects} onReload={reloadAdminData} onNotice={showNotice} />}
          {tab === 'orders' && (
            selectedOrder
              ? <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} />
              : <OrdersPage orders={orders} onSelect={setSelectedOrder} />
          )}
          {tab === 'partners' && (
            <PartnersPage
              orders={orders}
              partners={partners}
              formulas={formulas}
              form={partnerForm}
              setForm={setPartnerForm}
              editingId={editingPartnerId}
              onSubmit={savePartner}
              onEdit={editPartner}
              onDelete={deletePartner}
              onCancel={() => {
                setPartnerForm(blankPartner);
                setEditingPartnerId(null);
              }}
            />
          )}
          {tab === 'create-partner' && (
            <CreatePartnerPage
              form={schoolPartnerForm}
              setForm={setSchoolPartnerForm}
              onSubmit={saveSchoolPartner}
              createdPartner={createdSchoolPartner}
              partners={partners}
              editingId={editingPartnerId}
              onCancel={() => {
                setSchoolPartnerForm(newSchoolPartnerForm());
                setEditingPartnerId(null);
                setCreatedSchoolPartner(null);
                setTab('partners');
              }}
            />
          )}
          {tab === 'gifts' && <GiftCardsPage cards={adminGiftCards} />}
          {tab === 'formulas' && <FormulasPage formulas={formulas} schools={partners} onCreated={reloadAdminData} onNotice={showNotice} />}
          {tab === 'accommodations' && <AccommodationsPage accommodations={accommodations} schools={partners} onCreated={reloadAdminData} onNotice={showNotice} />}
          {tab === 'calendar' && (
            <CalendarPage
              availabilities={availabilities}
              schools={partners}
              formulas={formulas}
              seasons={seasons}
              specialOffers={specialOffers}
              onCreated={reloadAdminData}
              onSeasonCreated={reloadAdminData}
              onSpecialOfferCreated={reloadAdminData}
              onNotice={showNotice}
            />
          )}
          {tab === 'settings' && <SettingsPage />}
        </section>
      </div>
    </main>
  );
}

function AdminHeader({ tab, apiStatus }) {
  const labels = {
    dashboard: 'Dashboard admin',
    contents: 'Contenus du site',
    prospects: 'Prospects & commandes',
    orders: 'Commandes',
    partners: 'Écoles',
    'create-partner': 'Créer une école',
    formulas: 'Formules',
    accommodations: 'Hébergements recommandés',
    calendar: 'Calendrier et disponibilités',
    gifts: 'Cartes cadeaux SpotyKite',
    settings: 'Paramètres'
  };

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-ocean">Administration</p>
        <h1 className="text-4xl font-black text-navy">{labels[tab]}</h1>
      </div>
      <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-muted shadow-sm">
        {apiStatus === 'connected' ? 'Connecté à la base de données.' : 'API indisponible, données locales temporaires.'}
      </div>
    </header>
  );
}

function Dashboard({ stats, orders, partners }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={<BarChart3 />} label="Chiffre d'affaires" value={formatCurrency(stats.revenue)} />
        <Metric icon={<CreditCard />} label="Commissions" value={formatCurrency(stats.commissions)} />
        <Metric icon={<ShoppingBag />} label="Commandes" value={stats.totalOrders} />
        <Metric icon={<School />} label="Écoles actives" value={stats.activePartners} />
        <Metric icon={<CreditCard />} label="Formules actives" value={stats.activeFormulas} />
        <Metric icon={<Gift />} label="Cartes vendues" value={stats.giftCardsSold} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Panel title="Dernières commandes">
          <OrdersTable rows={orders.slice(0, 5)} compact />
        </Panel>
        <Panel title="Écoles à suivre">
          <div className="grid gap-3">
            {partners.map((partner) => (
              <div key={partner.id} className="rounded-2xl border border-border bg-bg p-4">
                <p className="font-black">{partner.name}</p>
                <p className="text-sm text-muted">{partner.city} · {partner.commission} commission</p>
                <StatusBadge value={partner.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AdminNotice({ notice, onClose }) {
  return (
    <div className={`mb-5 flex items-start justify-between gap-4 rounded-2xl border p-4 text-sm font-black ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
      <p>{notice.message}</p>
      <button type="button" onClick={onClose} className="rounded-xl bg-white/70 px-3 py-1 text-xs">Fermer</button>
    </div>
  );
}

const defaultContentBlocks = [
  ['home', 'hero', 'title', 'text', 'Vivez le kitesurf partout en France'],
  ['home', 'hero', 'subtitle', 'textarea', 'Recherchez une école Spotykite, choisissez une formule ou offrez une carte cadeau valable sur tout le réseau Spotykite.'],
  ['home', 'gift', 'title', 'text', 'Offrir un stage de kitesurf'],
  ['home', 'gift', 'subtitle', 'textarea', 'Le cadeau idéal pour découvrir le kitesurf partout en France.'],
  ['home', 'why', 'title', 'text', 'Pourquoi réserver votre stage de kitesurf avec Spotykite ?'],
  ['home', 'faq', '1.question', 'text', 'Où faire un stage de kitesurf en France ?'],
  ['gift-card', 'hero', 'title', 'text', 'Carte Cadeau SpotyKite'],
  ['gift-card', 'hero', 'subtitle', 'textarea', 'Offrez la liberté de choisir son stage de kitesurf plus tard.'],
  ['gift-card', 'product', 'price', 'text', '199'],
  ['footer', 'main', 'description', 'textarea', 'La plateforme pour réserver ou offrir une expérience kitesurf en France.']
].map(([pageKey, sectionKey, fieldKey, fieldType, value]) => ({ pageKey, sectionKey, fieldKey, fieldType, value, locale: 'fr' }));

function ContentsPage({ blocks, onSaved, onNotice }) {
  const [items, setItems] = useState(() => mergeDefaultContentBlocks(blocks));
  const grouped = useMemo(() => {
    return items.reduce((acc, item) => {
      const key = item.pageKey || item.page_key;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  useEffect(() => {
    setItems(mergeDefaultContentBlocks(blocks));
  }, [blocks]);

  function update(index, key, value) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  async function upload(index, file) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const result = await api.uploadImage({ filename: file.name, dataUrl });
    update(index, 'value', result.url);
  }

  async function save() {
    try {
      await api.saveContentBlocks(items);
      await onSaved();
      onNotice('success', 'Contenus enregistrés avec succès');
    } catch (error) {
      onNotice('error', error.message || 'Erreur lors de l’enregistrement des contenus.');
    }
  }

  return (
    <div className="grid gap-6">
      {Object.entries(grouped).map(([pageKey, pageItems]) => (
        <Panel key={pageKey} title={`Page : ${pageKey}`}>
          <div className="grid gap-4">
            {pageItems.map((item) => {
              const index = items.indexOf(item);
              const fieldType = item.fieldType || item.field_type || 'text';
              return (
                <div key={`${item.pageKey}-${item.sectionKey}-${item.fieldKey}`} className="rounded-2xl border border-border bg-bg p-4">
                  <div className="mb-3 grid gap-2 md:grid-cols-4">
                    <input className="field" value={item.pageKey || ''} onChange={(event) => update(index, 'pageKey', event.target.value)} placeholder="page_key" />
                    <input className="field" value={item.sectionKey || ''} onChange={(event) => update(index, 'sectionKey', event.target.value)} placeholder="section_key" />
                    <input className="field" value={item.fieldKey || ''} onChange={(event) => update(index, 'fieldKey', event.target.value)} placeholder="field_key" />
                    <select className="field" value={fieldType} onChange={(event) => update(index, 'fieldType', event.target.value)}>
                      {['text', 'textarea', 'richtext', 'image', 'url', 'boolean'].map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </div>
                  {fieldType === 'textarea' || fieldType === 'richtext' ? (
                    <textarea className="field min-h-28" value={item.value || ''} onChange={(event) => update(index, 'value', event.target.value)} />
                  ) : fieldType === 'image' ? (
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input className="field" value={item.value || ''} onChange={(event) => update(index, 'value', event.target.value)} placeholder="/uploads/image.webp" />
                      <input className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(index, event.target.files?.[0])} />
                      {item.value && <img src={item.value} alt="" className="h-32 w-full rounded-2xl object-cover md:col-span-2" />}
                    </div>
                  ) : fieldType === 'boolean' ? (
                    <AdminCheckbox label="Actif" checked={item.value === 'true' || item.value === true} onChange={(event) => update(index, 'value', event.target.checked ? 'true' : 'false')} />
                  ) : (
                    <input className="field" value={item.value || ''} onChange={(event) => update(index, 'value', event.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
      <div className="sticky bottom-4 z-10 rounded-3xl border border-border bg-white p-4 shadow-lift">
        <button className="btn-primary w-full justify-center" type="button" onClick={save}>
          <Save size={18} /> Enregistrer les contenus
        </button>
      </div>
    </div>
  );
}

function ProspectsPage({ prospects, onReload, onNotice }) {
  async function update(item, patch) {
    try {
      await api.updateProspect(item.kind, item.dbId || item.id, patch);
      await onReload();
      onNotice('success', 'Prospect mis à jour avec succès');
    } catch (error) {
      onNotice('error', error.message || 'Erreur lors de la mise à jour du prospect.');
    }
  }

  async function copyResume(url) {
    const absolute = url?.startsWith('http') ? url : `${window.location.origin}${url || ''}`;
    await navigator.clipboard.writeText(absolute);
    onNotice('success', 'Lien de reprise copié');
  }

  return (
    <Panel title="Prospects & commandes initiées">
      <SimpleTable headers={['Date', 'Prénom', 'Email', 'Téléphone', 'Type', 'École', 'Formule', 'Étape', 'Statut', 'Source', 'Lien', 'Actions']}>
        {prospects.map((item) => (
          <tr key={`${item.kind}-${item.dbId || item.id}`} className="border-b border-border bg-white">
            <td className="px-4 py-4">{formatDate(item.updatedAt || item.createdAt)}</td>
            <td className="px-4 py-4 font-black">{item.firstName || '-'}</td>
            <td className="px-4 py-4">{item.email || '-'}</td>
            <td className="px-4 py-4">{item.phone || '-'}</td>
            <td className="px-4 py-4">{prospectTypeLabel(item.type)}</td>
            <td className="px-4 py-4">{item.schoolName || '-'}</td>
            <td className="px-4 py-4">{item.formulaName || '-'}</td>
            <td className="px-4 py-4">{item.lastStep || '-'}</td>
            <td className="px-4 py-4"><StatusBadge value={item.status} /></td>
            <td className="px-4 py-4">{item.sourcePage || '-'}</td>
            <td className="px-4 py-4">
              {item.resumeUrl ? <button type="button" className="rounded-xl border border-border px-3 py-2 text-xs font-black text-ocean" onClick={() => copyResume(item.resumeUrl)}>Copier</button> : '-'}
            </td>
            <td className="px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-border px-3 py-2 text-xs font-black text-ocean" onClick={() => update(item, { status: item.kind === 'lead' ? 'contacted' : 'à relancer' })}>Relancer</button>
                <button type="button" className="rounded-xl border border-border px-3 py-2 text-xs font-black text-ocean" onClick={() => update(item, { status: item.kind === 'lead' ? 'converted' : 'completed' })}>Converti</button>
              </div>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </Panel>
  );
}

function OrdersPage({ orders, onSelect }) {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateRange: '',
    dateFrom: '',
    dateTo: '',
    partner: '',
    city: '',
    offerType: '',
    minAmount: '',
    maxAmount: ''
  });
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filteredOrders = useMemo(() => {
    const now = new Date('2026-06-03');
    return orders.filter((order) => {
      const query = normalize(filters.search);
      const haystack = normalize([order.customerName, order.customerEmail, order.id, order.partner, order.city, order.spot].join(' '));
      const boughtAt = new Date(order.boughtAt);
      const normalizedStatus = order.status === 'payé' ? 'payée' : order.status;
      const minAmount = filters.minAmount ? Number(filters.minAmount) : null;
      const maxAmount = filters.maxAmount ? Number(filters.maxAmount) : null;

      if (query && !haystack.includes(query)) return false;
      if (filters.status && normalizedStatus !== filters.status) return false;
      if (filters.partner && order.partner !== filters.partner) return false;
      if (filters.city && `${order.city} / ${order.spot}` !== filters.city) return false;
      if (filters.offerType && order.offerType !== filters.offerType) return false;
      if (minAmount !== null && order.amount < minAmount) return false;
      if (maxAmount !== null && order.amount > maxAmount) return false;
      if (!matchesDateRange(boughtAt, filters.dateRange, filters.dateFrom, filters.dateTo, now)) return false;
      return true;
    });
  }, [orders, filters]);

  const paginatedOrders = paginate(filteredOrders, page, pageSize);
  const partners = unique(orders.map((order) => order.partner));
  const cities = unique(orders.map((order) => `${order.city} / ${order.spot}`));

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters({ search: '', status: '', dateRange: '', dateFrom: '', dateTo: '', partner: '', city: '', offerType: '', minAmount: '', maxAmount: '' });
    setPage(1);
  }

  return (
    <Panel title="Toutes les commandes">
      <FilterBar
        title="Filtres commandes"
        count={filteredOrders.length}
        total={orders.length}
        onReset={resetFilters}
      >
        <div className="grid gap-3 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <SearchField value={filters.search} onChange={(value) => updateFilter('search', value)} placeholder="Nom, email, commande, école, ville..." />
          <SelectFilter value={filters.status} onChange={(value) => updateFilter('status', value)} options={['payée', 'en attente', 'annulée', 'remboursée']} placeholder="Statut" />
          <SelectFilter value={filters.dateRange} onChange={(value) => updateFilter('dateRange', value)} options={['aujourd’hui', '7 derniers jours', '30 derniers jours', 'période personnalisée']} placeholder="Date" />
          <SelectFilter value={filters.partner} onChange={(value) => updateFilter('partner', value)} options={partners} placeholder="École" />
          <SelectFilter value={filters.offerType} onChange={(value) => updateFilter('offerType', value)} options={['stage', 'séance', 'carte cadeau']} placeholder="Type d’offre" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <SelectFilter value={filters.city} onChange={(value) => updateFilter('city', value)} options={cities} placeholder="Ville / spot" />
          <input className="field" type="number" placeholder="Montant min." value={filters.minAmount} onChange={(event) => updateFilter('minAmount', event.target.value)} />
          <input className="field" type="number" placeholder="Montant max." value={filters.maxAmount} onChange={(event) => updateFilter('maxAmount', event.target.value)} />
          <input className="field" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} disabled={filters.dateRange !== 'période personnalisée'} />
          <input className="field" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} disabled={filters.dateRange !== 'période personnalisée'} />
        </div>
      </FilterBar>
      <OrdersTable rows={paginatedOrders} onSelect={onSelect} />
      <Pagination page={page} pageSize={pageSize} total={filteredOrders.length} onPageChange={setPage} />
    </Panel>
  );
}

function OrdersTable({ rows, onSelect, compact = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="bg-sky/60 text-xs uppercase text-muted">
          <tr>
            {['ID', 'Client', 'Email', 'Téléphone', 'Produit', 'Ville / spot', 'École', 'Montant', 'Statut', 'Achat', 'Date souhaitée', ''].map((label) => (
              <th key={label} className="px-4 py-3 font-black">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id} className="border-b border-border bg-white">
              <td className="px-4 py-4 font-black">{order.id}</td>
              <td className="px-4 py-4">{order.customerName}</td>
              <td className="px-4 py-4">{order.customerEmail}</td>
              <td className="px-4 py-4">{order.customerPhone}</td>
              <td className="px-4 py-4">{order.product}</td>
              <td className="px-4 py-4">{order.city} / {order.spot}</td>
              <td className="px-4 py-4">{order.partner}</td>
              <td className="px-4 py-4 font-black">{formatCurrency(order.amount)}</td>
              <td className="px-4 py-4"><StatusBadge value={order.status} /></td>
              <td className="px-4 py-4">{formatDate(order.boughtAt)}</td>
              <td className="px-4 py-4">{order.desiredDate ? formatDate(order.desiredDate) : '-'}</td>
              <td className="px-4 py-4">
                {!compact && (
                  <button onClick={() => onSelect(order)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 font-black text-ocean hover:border-ocean">
                    <Eye size={16} /> Voir détail
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderDetail({ order, onBack }) {
  return (
    <div className="grid gap-6">
      <button onClick={onBack} className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 font-black text-ocean">
        <ChevronLeft size={18} /> Retour aux commandes
      </button>
      <Panel title={`Commande ${order.id}`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Detail label="Client" value={order.customerName} />
          <Detail label="Email" value={order.customerEmail} />
          <Detail label="Téléphone" value={order.customerPhone} />
          <Detail label="Produit acheté" value={order.product} />
          <Detail label="Ville / spot" value={`${order.city} / ${order.spot}`} />
          <Detail label="École associée" value={order.partner} />
          <Detail label="Montant payé" value={formatCurrency(order.amount)} />
          <Detail label="Statut" value={order.status} />
          <Detail label="Date d'achat" value={formatDate(order.boughtAt)} />
          <Detail label="Date souhaitée" value={order.desiredDate ? formatDate(order.desiredDate) : '-'} />
          <Detail label="Paiement" value={order.paymentMethod} />
          <Detail label="Notes" value={order.notes} />
        </div>
      </Panel>
    </div>
  );
}

function PartnersPage({ orders, partners, onEdit, onDelete }) {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    city: '',
    region: '',
    department: '',
    activity: '',
    hasOrders: ''
  });
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filteredPartners = useMemo(() => {
    return partners.filter((partner) => {
      const query = normalize(filters.search);
      const haystack = normalize([partner.name, partner.email, partner.phone, partner.city, partner.region].join(' '));
      const normalizedStatus = normalizePartnerStatus(partner.status);
      const hasOrders = orders.some((order) => order.partner === partner.name);

      if (query && !haystack.includes(query)) return false;
      if (filters.status && normalizedStatus !== filters.status) return false;
      if (filters.city && partner.city !== filters.city) return false;
      if (filters.region && partner.region !== filters.region) return false;
      if (filters.department && partner.department !== filters.department) return false;
      if (filters.activity && !normalize(partner.activities || partner.services).includes(normalize(filters.activity))) return false;
      if (filters.hasOrders === 'avec commandes' && !hasOrders) return false;
      if (filters.hasOrders === 'sans commandes' && hasOrders) return false;
      return true;
    });
  }, [partners, filters]);

  const paginatedPartners = paginate(filteredPartners, page, pageSize);
  const cities = unique(partners.map((partner) => partner.city));
  const regions = unique(partners.map((partner) => partner.region));
  const departments = unique(partners.map((partner) => partner.department));

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters({ search: '', status: '', city: '', region: '', department: '', activity: '', hasOrders: '' });
    setPage(1);
  }

  return (
    <div className="grid gap-6">
      <Panel title="Écoles Spotykite">
        <FilterBar
          title="Filtres écoles"
          count={filteredPartners.length}
          total={partners.length}
          onReset={resetFilters}
        >
          <div className="grid gap-3 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
            <SearchField value={filters.search} onChange={(value) => updateFilter('search', value)} placeholder="Nom, email, téléphone, ville, région..." />
            <SelectFilter value={filters.status} onChange={(value) => updateFilter('status', value)} options={['actif', 'inactif', 'en attente']} placeholder="Statut" />
            <SelectFilter value={filters.city} onChange={(value) => updateFilter('city', value)} options={cities} placeholder="Ville" />
            <SelectFilter value={filters.region} onChange={(value) => updateFilter('region', value)} options={regions} placeholder="Région" />
            <SelectFilter value={filters.department} onChange={(value) => updateFilter('department', value)} options={departments} placeholder="Département" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <SelectFilter value={filters.activity} onChange={(value) => updateFilter('activity', value)} options={['kitesurf', 'wingfoil', 'paddle']} placeholder="Type d’activité" />
            <SelectFilter value={filters.hasOrders} onChange={(value) => updateFilter('hasOrders', value)} options={['avec commandes', 'sans commandes']} placeholder="Commandes" />
          </div>
        </FilterBar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-sky/60 text-xs uppercase text-muted">
              <tr>
                {['École', 'Ville', 'Département', 'Région', 'Téléphone', 'Email', 'Site web', 'Visibilité', 'Réservation', 'Statut', 'Actions'].map((label) => (
                  <th key={label} className="px-4 py-3 font-black">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedPartners.map((partner) => (
                <tr key={partner.id} className="border-b border-border bg-white">
                  <td className="px-4 py-4 font-black">{partner.name}</td>
                  <td className="px-4 py-4">{partner.city}</td>
                  <td className="px-4 py-4">{partner.department}</td>
                  <td className="px-4 py-4">{partner.region}</td>
                  <td className="px-4 py-4">{partner.phone}</td>
                  <td className="px-4 py-4">{partner.email}</td>
                  <td className="px-4 py-4">{partner.website}</td>
                  <td className="px-4 py-4 font-black">{visibilityLabel(partner.frontVisibility)}</td>
                  <td className="px-4 py-4">{partner.bookingEnabled ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-4"><StatusBadge value={partner.status} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(partner)} className="icon-btn" aria-label="Modifier"><Edit3 size={16} /></button>
                      <button onClick={() => onDelete(partner.id)} className="icon-btn text-red-500" aria-label="Supprimer"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredPartners.length} onPageChange={setPage} />
      </Panel>
    </div>
  );
}

function CreatePartnerPage({ form, setForm, onSubmit, createdPartner, partners, editingId, onCancel }) {
  const nearbySchools = useMemo(() => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!lat || !lng) return [];

    return partners
      .filter((partner) => partner.latitude && partner.longitude)
      .map((partner) => ({
        ...partner,
        distance: distanceKm(lat, lng, Number(partner.latitude), Number(partner.longitude))
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
  }, [form.latitude, form.longitude, partners]);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggle(name) {
    setForm((current) => ({ ...current, [name]: !current[name] }));
  }

  function toggleLevel(level) {
    setForm((current) => ({
      ...current,
      acceptedLevels: current.acceptedLevels.includes(level)
        ? current.acceptedLevels.filter((item) => item !== level)
        : [...current.acceptedLevels, level]
    }));
  }

  function autoSlug() {
    const nextSlug = slugify(`ecole kitesurf ${form.city} ${form.name}`);
    update('slug', nextSlug);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {createdPartner && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
          École créée : {createdPartner.name}. La fiche école, le point carte et les référencements région/département sont prêts à être alimentés.
        </div>
      )}
      {editingId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/30 bg-white p-4 shadow-lift">
          <div>
            <p className="eyebrow text-primary">Édition école</p>
            <h2 className="text-2xl font-black text-navy">{form.name || 'École'}</h2>
          </div>
          <button type="button" onClick={onCancel} className="btn-secondary justify-center">Annuler</button>
        </div>
      )}

      <Panel title="Informations générales">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminInput required label="Nom de l'école *" value={form.name} onChange={(value) => update('name', value)} />
          <AdminInput required label="Ville *" value={form.city} onChange={(value) => update('city', value)} />
          <AdminInput required label="Département *" value={form.department} onChange={(value) => update('department', value)} />
          <AdminInput required label="Région *" value={form.region} onChange={(value) => update('region', value)} />
          <AdminInput label="Spot principal" value={form.spot} onChange={(value) => update('spot', value)} />
          <AdminInput required label="Adresse complète *" value={form.address} onChange={(value) => update('address', value)} className="xl:col-span-2" />
          <AdminInput required label="Latitude *" type="number" value={form.latitude} onChange={(value) => update('latitude', value)} />
          <AdminInput required label="Longitude *" type="number" value={form.longitude} onChange={(value) => update('longitude', value)} />
          <AdminInput label="Site internet" value={form.website} onChange={(value) => update('website', value)} />
          <AdminInput label="Téléphone" value={form.phone} onChange={(value) => update('phone', value)} />
          <AdminInput label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} />
        </div>
        <div className="mt-3 grid gap-3">
          <AdminTextarea label="Description courte (150 caractères)" maxLength={150} value={form.shortDescription} onChange={(value) => update('shortDescription', value)} />
          <AdminTextarea label="Description complète" value={form.fullDescription} onChange={(value) => update('fullDescription', value)} />
        </div>
      </Panel>

      <Panel title="Publication">
        <PublicationFields form={form} update={update} />
        {(!form.latitude || !form.longitude) && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Coordonnées GPS manquantes : l'école sera enregistrée, mais elle n'apparaîtra pas sur la carte tant que latitude et longitude ne seront pas renseignées.
          </div>
        )}
      </Panel>

      <Panel title="Médias">
        <div className="grid gap-3 md:grid-cols-3">
          <AdminInput label="Photo principale" value={form.mainPhoto} onChange={(value) => update('mainPhoto', value)} placeholder="URL image" />
          <AdminInput label="Galerie photos" value={form.galleryPhotos} onChange={(value) => update('galleryPhotos', value)} placeholder="URLs séparées par des virgules" />
          <AdminInput label="Logo école" value={form.logo} onChange={(value) => update('logo', value)} placeholder="URL logo" />
        </div>
      </Panel>

      <Panel title="Stages proposés par l’école">
        <SchoolStagesEditor
          value={form.schoolFormulas}
          onChange={(schoolFormulas) => setForm((current) => ({ ...current, schoolFormulas }))}
        />
      </Panel>

      <Panel title='Section "Le kitesurf en bref"'>
        <AdminTextarea label="Texte personnalisable" value={form.kitesurfBrief} onChange={(value) => update('kitesurfBrief', value)} rows={6} />
      </Panel>

      <Panel title={'Section "L’école précise"'}>
        <div className="grid gap-3">
          <AdminInput label="Titre" value={form.schoolTitle} onChange={(value) => update('schoolTitle', value)} />
          <AdminTextarea label="Votre école de kitesurf" value={form.schoolDescription} onChange={(value) => update('schoolDescription', value)} placeholder="Présentez l'équipe, le spot, l'ambiance et les spécificités du centre." rows={6} />
        </div>
      </Panel>

      <Panel title="Conditions">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminCheckbox label="Licence FFVL obligatoire" checked={form.licenceRequired} onChange={() => toggle('licenceRequired')} />
          <AdminCheckbox label="Licence incluse dans le prix" checked={form.licenceIncluded} onChange={() => toggle('licenceIncluded')} />
          <AdminCheckbox label="Certificat médical obligatoire" checked={form.medicalCertificateRequired} onChange={() => toggle('medicalCertificateRequired')} />
          <AdminCheckbox label="Autorisation parentale obligatoire pour mineurs" checked={form.parentalAuthorizationRequired} onChange={() => toggle('parentalAuthorizationRequired')} />
        </div>
      </Panel>

      <Panel title="À savoir">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminInput label="Âge minimum" type="number" value={form.minAge} onChange={(value) => update('minAge', value)} />
          <AdminInput label="Âge maximum" type="number" value={form.maxAge} onChange={(value) => update('maxAge', value)} />
          <AdminInput label="Poids minimum" type="number" value={form.minWeight} onChange={(value) => update('minWeight', value)} />
          <AdminInput label="Poids maximum" type="number" value={form.maxWeight} onChange={(value) => update('maxWeight', value)} />
          <AdminInput label="Durée moyenne d'une séance" value={form.averageSessionDuration} onChange={(value) => update('averageSessionDuration', value)} />
          <AdminInput label="Nombre maximum de participants" type="number" value={form.maxParticipants} onChange={(value) => update('maxParticipants', value)} />
        </div>
        <div className="mt-5">
          <p className="mb-2 text-sm font-black text-navy">Niveau accepté</p>
          <div className="grid gap-3 md:grid-cols-3">
            {['Débutant', 'Intermédiaire', 'Confirmé'].map((level) => (
              <AdminCheckbox key={level} label={level} checked={form.acceptedLevels.includes(level)} onChange={() => toggleLevel(level)} />
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['equipmentProvided', 'Matériel fourni'],
            ['wetsuitProvided', 'Combinaison fournie'],
            ['changingRooms', 'Vestiaires'],
            ['parking', 'Parking'],
            ['showers', 'Douches'],
            ['privateLessons', 'Cours particuliers disponibles'],
            ['groupLessons', 'Cours collectifs disponibles'],
            ['wingfoilAvailable', 'Wingfoil disponible'],
            ['rentalAvailable', 'Location matériel disponible']
          ].map(([key, label]) => (
            <AdminCheckbox key={key} label={label} checked={form[key]} onChange={() => toggle(key)} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Map">
          <div className="grid min-h-[280px] place-items-center rounded-3xl border border-border bg-gradient-to-br from-sky via-white to-sand p-6 text-center">
            <div>
              <MapPinPreview />
              <p className="mt-3 text-2xl font-black text-navy">{form.name || 'Marqueur école'}</p>
              <p className="mt-1 text-sm font-bold text-muted">{form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : 'Carte Google Maps basée sur latitude + longitude'}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Écoles à proximité">
          {nearbySchools.length ? (
            <div className="grid gap-3">
              {nearbySchools.map((school) => (
                <div key={school.id} className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3">
                  <div className="h-14 w-14 rounded-2xl bg-sky" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{school.name}</p>
                    <p className="text-sm text-muted">{school.city} · {school.distance.toFixed(1)} km</p>
                  </div>
                  <button className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-ocean" type="button">Voir l'école</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Les 6 écoles les plus proches apparaîtront automatiquement dès que latitude et longitude seront renseignées.</p>
          )}
        </Panel>
      </div>

      <Panel title="SEO">
        <div className="grid gap-3 md:grid-cols-2">
          <AdminInput label="Meta title" value={form.metaTitle} onChange={(value) => update('metaTitle', value)} />
          <AdminInput label="Slug URL" value={form.slug} onChange={(value) => update('slug', value)} placeholder="/ecole-kitesurf-la-rochelle-atlantic-kite-school" />
          <AdminTextarea label="Meta description" value={form.metaDescription} onChange={(value) => update('metaDescription', value)} className="md:col-span-2" />
        </div>
        <button type="button" onClick={autoSlug} className="btn-secondary mt-4 justify-center">Générer le slug</button>
      </Panel>

      <Panel title="Résultat généré">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Detail label="Fiche école" value={form.name ? (editingId ? 'Sera mise à jour à la sauvegarde' : 'Sera créée à la sauvegarde') : 'En attente'} />
          <Detail label="Point carte" value={form.latitude && form.longitude ? 'Coordonnées prêtes' : 'Coordonnées requises'} />
          <Detail label="Résultats de recherche" value={form.region && form.department ? 'Indexable région / département' : 'Région et département requis'} />
          <Detail label="URL publique" value={form.slug ? `/${form.slug.replace(/^\//, '')}` : 'Slug à renseigner'} />
        </div>
      </Panel>

      <div className="sticky bottom-4 z-10 rounded-3xl border border-border bg-white p-4 shadow-lift">
        <button className="btn-primary w-full justify-center" type="submit">
          <Save size={18} /> {editingId ? 'Enregistrer les modifications' : 'Créer l’école'}
        </button>
      </div>
    </form>
  );
}

function PartnerForm({ form, setForm, editingId, onSubmit, onCancel }) {
  const fields = [
    ['name', "Nom de l'école"],
    ['address', 'Adresse'],
    ['city', 'Ville'],
    ['department', 'Département'],
    ['region', 'Région'],
    ['phone', 'Téléphone'],
    ['email', 'Email'],
    ['website', 'Site internet'],
    ['contactName', 'Nom du contact'],
    ['sessionPrice', 'Tarif séance kitesurf'],
    ['stagePrice', 'Tarif stage'],
    ['supervisedPrice', 'Tarif navigation supervisée'],
    ['commission', 'Commission négociée']
  ];

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {fields.map(([key, label]) => (
        <input key={key} className="field" placeholder={label} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      ))}
      <textarea className="field min-h-24" placeholder="Prestations proposées" value={form.services} onChange={(event) => setForm({ ...form, services: event.target.value })} />
      <textarea className="field min-h-24" placeholder="Notes internes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      <div className="rounded-2xl border border-border bg-white p-4">
        <h3 className="mb-3 text-lg font-black text-navy">Publication</h3>
        <PublicationFields form={form} update={(key, value) => setForm({ ...form, [key]: value })} compact />
      </div>
      <div className="rounded-2xl border border-border bg-white p-4">
        <h3 className="mb-3 text-lg font-black text-navy">Stages proposés par l’école</h3>
        <SchoolStagesEditor
          value={form.schoolFormulas}
          onChange={(schoolFormulas) => setForm({ ...form, schoolFormulas })}
        />
      </div>
      <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
        <option value="prospect">prospect</option>
        <option value="partenaire">référencée</option>
        <option value="actif">actif</option>
        <option value="suspendu">suspendu</option>
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        <button className="btn-primary justify-center" type="submit"><Save size={18} /> {editingId ? 'Enregistrer' : 'Ajouter'}</button>
        {editingId && <button className="btn-secondary justify-center" type="button" onClick={onCancel}>Annuler</button>}
      </div>
    </form>
  );
}

function PublicationFields({ form, update, compact = false }) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-1 text-sm font-black text-navy">
        Visibilité sur le site
        <select className="field" value={form.frontVisibility || 'active'} onChange={(event) => update('frontVisibility', event.target.value)}>
          <option value="hidden">Masquée</option>
          <option value="seo_only">Fiche SEO uniquement</option>
          <option value="active">Active sur le site</option>
        </select>
      </label>
      <AdminCheckbox label="Réservation activée" checked={Boolean(form.bookingEnabled)} onChange={(event) => update('bookingEnabled', event.target.checked)} />
      <div className={`rounded-2xl border border-border bg-bg p-4 text-sm font-bold text-muted ${compact ? '' : 'md:max-w-3xl'}`}>
        <p><b>Masquée :</b> l’école reste enregistrée mais n’apparaît pas sur le site.</p>
        <p className="mt-2"><b>Fiche SEO uniquement :</b> la fiche peut être utilisée pour le référencement, mais la réservation est désactivée.</p>
        <p className="mt-2"><b>Active :</b> l’école apparaît sur le site, dans la carte, les filtres et les listings.</p>
        <p className="mt-2"><b>Réservation activée :</b> affiche les blocs de réservation et permet d’acheter une formule.</p>
      </div>
    </div>
  );
}

function SchoolStagesEditor({ value = {}, onChange }) {
  const stages = mergeSchoolStages(value);

  function updateStage(type, patch) {
    onChange({
      ...stages,
      [type]: {
        ...stages[type],
        ...patch
      }
    });
  }

  return (
    <div className="grid gap-3">
      {schoolStageDefinitions.map((stage) => {
        const item = stages[stage.type];
        return (
          <div key={stage.type} className="rounded-2xl border border-border bg-bg p-4">
            <AdminCheckbox
              label={stage.label}
              checked={Boolean(item.enabled)}
              onChange={(event) => updateStage(stage.type, { enabled: event.target.checked, isActive: event.target.checked ? item.isActive : false })}
            />
            {item.enabled && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <AdminInput label="Prix" type="number" value={item.price} onChange={(price) => updateStage(stage.type, { price })} />
                <AdminInput label="Prix par défaut" type="number" value={item.defaultPrice} onChange={(defaultPrice) => updateStage(stage.type, { defaultPrice, price: defaultPrice })} />
                <AdminInput label="Semaine basse saison" type="number" value={item.lowSeasonWeekdayPrice} onChange={(lowSeasonWeekdayPrice) => updateStage(stage.type, { lowSeasonWeekdayPrice })} />
                <AdminInput label="Week-end basse saison" type="number" value={item.lowSeasonWeekendPrice} onChange={(lowSeasonWeekendPrice) => updateStage(stage.type, { lowSeasonWeekendPrice })} />
                <AdminInput label="Semaine haute saison" type="number" value={item.highSeasonWeekdayPrice} onChange={(highSeasonWeekdayPrice) => updateStage(stage.type, { highSeasonWeekdayPrice })} />
                <AdminInput label="Week-end haute saison" type="number" value={item.highSeasonWeekendPrice} onChange={(highSeasonWeekendPrice) => updateStage(stage.type, { highSeasonWeekendPrice })} />
                <AdminInput label="Durée" value={item.duration} onChange={(duration) => updateStage(stage.type, { duration })} />
                <label className="grid gap-1 text-sm font-black text-navy">
                  Niveau
                  <select className="field" value={item.level} onChange={(event) => updateStage(stage.type, { level: event.target.value })}>
                    {['débutant', 'intermédiaire', 'confirmé', 'tous niveaux'].map((level) => <option key={level}>{level}</option>)}
                  </select>
                </label>
                <AdminInput label="Places par session" type="number" value={item.sessionPlaces || ''} onChange={(sessionPlaces) => updateStage(stage.type, { sessionPlaces })} />
                <AdminTextarea label="Description courte" value={item.shortDescription} onChange={(shortDescription) => updateStage(stage.type, { shortDescription })} className="md:col-span-2" />
                <AdminCheckbox label="Stage actif et visible sur la fiche" checked={Boolean(item.isActive)} onChange={(event) => updateStage(stage.type, { isActive: event.target.checked })} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormulasPage({ formulas, schools, onCreated, onNotice }) {
  const [form, setForm] = useState({ schoolId: '', name: '', duration: '', level: 'débutant', publicPrice: '', spotykitePrice: '', commissionRate: '0.15', shortDescription: '', active: true });

  async function submit(event) {
    event.preventDefault();
    try {
      await api.createFormula({
        ...form,
        title: form.name,
        publicPrice: Number(form.publicPrice),
        spotykitePrice: Number(form.spotykitePrice || form.publicPrice),
        price: Number(form.spotykitePrice || form.publicPrice),
        active: form.active
      });
      await onCreated();
      onNotice('success', 'Formule enregistrée avec succès');
      setForm({ schoolId: '', name: '', duration: '', level: 'débutant', publicPrice: '', spotykitePrice: '', commissionRate: '0.15', shortDescription: '', active: true });
    } catch (error) {
      onNotice('error', error.message || 'Erreur lors de l’enregistrement de la formule.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Panel title="Créer une formule">
        <form onSubmit={submit} className="grid gap-3">
          <SchoolSelect schools={schools} value={form.schoolId} onChange={(value) => setForm({ ...form, schoolId: value })} />
          <input className="field" required placeholder="Nom de la formule" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input className="field" required placeholder="Durée" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} />
          <select className="field" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
            {['débutant', 'intermédiaire', 'confirmé', 'tous niveaux'].map((level) => <option key={level}>{level}</option>)}
          </select>
          <input className="field" required type="number" placeholder="Prix public" value={form.publicPrice} onChange={(event) => setForm({ ...form, publicPrice: event.target.value })} />
          <input className="field" type="number" placeholder="Prix SpotyKite" value={form.spotykitePrice} onChange={(event) => setForm({ ...form, spotykitePrice: event.target.value })} />
          <input className="field" type="number" step="0.01" placeholder="Commission" value={form.commissionRate} onChange={(event) => setForm({ ...form, commissionRate: event.target.value })} />
          <textarea className="field min-h-24" placeholder="Description courte" value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} />
          <AdminCheckbox label="Formule active" checked={form.active} onChange={() => setForm({ ...form, active: !form.active })} />
          <button className="btn-primary justify-center" type="submit">Créer la formule</button>
        </form>
      </Panel>
      <Panel title="Formules existantes">
        <SimpleTable headers={['École', 'Formule', 'Durée', 'Niveau', 'Prix', 'Statut']}>
          {formulas.map((formula) => (
            <tr key={formula.id} className="border-b border-border bg-white">
              <td className="px-4 py-4">{formula.schoolName}</td>
              <td className="px-4 py-4 font-black">{formula.name || formula.title}</td>
              <td className="px-4 py-4">{formula.duration}</td>
              <td className="px-4 py-4">{formula.level}</td>
              <td className="px-4 py-4 font-black">{formatCurrency(formula.price)}</td>
              <td className="px-4 py-4"><StatusBadge value={formula.active ? 'actif' : 'suspendu'} /></td>
            </tr>
          ))}
        </SimpleTable>
      </Panel>
    </div>
  );
}

function AccommodationsPage({ accommodations, schools, onCreated, onNotice }) {
  const [form, setForm] = useState({ schoolId: '', name: '', type: 'hôtel', address: '', distanceFromSpot: '', websiteUrl: '', promoCode: '', description: '', status: 'active' });

  async function submit(event) {
    event.preventDefault();
    try {
      await api.createAccommodation(form);
      await onCreated();
      onNotice('success', 'Hébergement enregistré avec succès');
      setForm({ schoolId: '', name: '', type: 'hôtel', address: '', distanceFromSpot: '', websiteUrl: '', promoCode: '', description: '', status: 'active' });
    } catch (error) {
      onNotice('error', error.message || 'Erreur lors de l’enregistrement de l’hébergement.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Panel title="Ajouter un hébergement recommandé">
        <form onSubmit={submit} className="grid gap-3">
          <SchoolSelect schools={schools} value={form.schoolId} onChange={(value) => setForm({ ...form, schoolId: value })} />
          <input className="field" required placeholder="Nom" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input className="field" placeholder="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} />
          <input className="field" placeholder="Adresse" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          <input className="field" placeholder="Distance du spot" value={form.distanceFromSpot} onChange={(event) => setForm({ ...form, distanceFromSpot: event.target.value })} />
          <input className="field" placeholder="Lien externe" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} />
          <input className="field" placeholder="Code promo optionnel" value={form.promoCode} onChange={(event) => setForm({ ...form, promoCode: event.target.value })} />
          <textarea className="field min-h-24" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <button className="btn-primary justify-center" type="submit">Ajouter</button>
        </form>
      </Panel>
      <Panel title="Hébergements existants">
        <SimpleTable headers={['École', 'Nom', 'Type', 'Distance', 'Code promo', 'Statut']}>
          {accommodations.map((item) => (
            <tr key={item.id} className="border-b border-border bg-white">
              <td className="px-4 py-4">{schools.find((school) => Number(school.id) === Number(item.schoolId))?.name || item.schoolId}</td>
              <td className="px-4 py-4 font-black">{item.name}</td>
              <td className="px-4 py-4">{item.type}</td>
              <td className="px-4 py-4">{item.distanceFromSpot}</td>
              <td className="px-4 py-4">{item.promoCode || '-'}</td>
              <td className="px-4 py-4"><StatusBadge value={item.status === 'active' ? 'actif' : 'suspendu'} /></td>
            </tr>
          ))}
        </SimpleTable>
      </Panel>
    </div>
  );
}

function CalendarPage({ availabilities, schools, formulas, seasons, specialOffers, onCreated, onSeasonCreated, onSpecialOfferCreated, onNotice }) {
  const [form, setForm] = useState({ schoolId: '', formulaId: '', date: '', totalPlaces: '4', bookedPlaces: '0', manualPrice: '', status: 'available', internalNote: '' });
  const [seasonForm, setSeasonForm] = useState({ schoolId: '', name: 'Basse saison', type: 'low', startDate: '', endDate: '', active: true });
  const [offerForm, setOfferForm] = useState({ schoolId: '', formulaId: '', name: '', description: '', startDate: '', endDate: '', dayType: 'all', discountType: 'percent', value: '', maxPlaces: '', active: true });
  const filteredFormulas = formulas.filter((formula) => !form.schoolId || String(formula.schoolId) === String(form.schoolId));
  const monthRows = useMemo(() => {
    return [...availabilities].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 60);
  }, [availabilities]);

  async function submit(event) {
    event.preventDefault();
    try {
      await api.createAvailability(form);
      await onCreated();
      onNotice('success', 'Disponibilité enregistrée avec succès');
      setForm((current) => ({ ...current, date: '', bookedPlaces: '0', manualPrice: '', internalNote: '' }));
    } catch (error) {
      onNotice('error', error.message || 'Erreur lors de l’enregistrement de la disponibilité.');
    }
  }

  async function submitSeason(event) {
    event.preventDefault();
    try {
      await api.createSeason(seasonForm);
      await onSeasonCreated();
      onNotice('success', 'Saison enregistrée avec succès');
      setSeasonForm((current) => ({ ...current, startDate: '', endDate: '' }));
    } catch (error) {
      onNotice('error', error.message || 'Erreur lors de l’enregistrement de la saison.');
    }
  }

  async function submitSpecialOffer(event) {
    event.preventDefault();
    try {
      await api.createSpecialOffer(offerForm);
      await onSpecialOfferCreated();
      onNotice('success', 'Offre spéciale enregistrée avec succès');
      setOfferForm((current) => ({ ...current, name: '', description: '', value: '', maxPlaces: '' }));
    } catch (error) {
      onNotice('error', error.message || 'Erreur lors de l’enregistrement de l’offre spéciale.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Panel title="Ajouter une disponibilité">
        <form onSubmit={submit} className="grid gap-3">
          <SchoolSelect schools={schools} value={form.schoolId} onChange={(value) => setForm({ ...form, schoolId: value, formulaId: '' })} />
          <select className="field" required value={form.formulaId} onChange={(event) => setForm({ ...form, formulaId: event.target.value })}>
            <option value="">Choisir une formule</option>
            {filteredFormulas.map((formula) => <option key={formula.id} value={formula.id}>{formula.name || formula.title}</option>)}
          </select>
          <input className="field" required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          <input className="field" required type="number" min="0" placeholder="Places totales" value={form.totalPlaces} onChange={(event) => setForm({ ...form, totalPlaces: event.target.value })} />
          <input className="field" type="number" min="0" placeholder="Places réservées" value={form.bookedPlaces} onChange={(event) => setForm({ ...form, bookedPlaces: event.target.value })} />
          <input className="field" type="number" min="0" placeholder="Prix manuel optionnel" value={form.manualPrice} onChange={(event) => setForm({ ...form, manualPrice: event.target.value })} />
          <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {['available', 'full', 'closed', 'cancelled'].map((status) => <option key={status}>{status}</option>)}
          </select>
          <textarea className="field min-h-24" placeholder="Note interne" value={form.internalNote} onChange={(event) => setForm({ ...form, internalNote: event.target.value })} />
          <button className="btn-primary justify-center" type="submit">Enregistrer la date</button>
        </form>
      </Panel>
      <Panel title="Vue disponibilités">
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {['available', 'full', 'closed', 'cancelled'].map((status) => (
            <div key={status} className={`rounded-2xl border p-3 text-center text-sm font-black ${availabilityClass(status)}`}>{status}</div>
          ))}
        </div>
        <SimpleTable headers={['Date', 'École', 'Formule', 'Prix', 'Places', 'Statut', 'Note']}>
          {monthRows.map((item) => (
            <tr key={item.id} className="border-b border-border bg-white">
              <td className="px-4 py-4 font-black">{formatDate(item.date)}</td>
              <td className="px-4 py-4">{item.schoolName}</td>
              <td className="px-4 py-4">{item.formulaName}</td>
              <td className="px-4 py-4 font-black">{item.appliedPrice ? `${item.appliedPrice} €` : '-'}</td>
              <td className="px-4 py-4">{item.bookedPlaces}/{item.totalPlaces} · {item.availablePlaces} dispo</td>
              <td className="px-4 py-4"><span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${availabilityClass(item.status)}`}>{item.status}</span></td>
              <td className="px-4 py-4">{item.internalNote || '-'}</td>
            </tr>
          ))}
        </SimpleTable>
      </Panel>
      <Panel title="Saisons">
        <form onSubmit={submitSeason} className="grid gap-3">
          <SchoolSelect schools={schools} value={seasonForm.schoolId} onChange={(value) => setSeasonForm({ ...seasonForm, schoolId: value })} />
          <input className="field" required placeholder="Nom" value={seasonForm.name} onChange={(event) => setSeasonForm({ ...seasonForm, name: event.target.value })} />
          <select className="field" value={seasonForm.type} onChange={(event) => setSeasonForm({ ...seasonForm, type: event.target.value })}>
            <option value="low">basse saison</option>
            <option value="high">haute saison</option>
            <option value="custom">personnalisée</option>
          </select>
          <input className="field" required type="date" value={seasonForm.startDate} onChange={(event) => setSeasonForm({ ...seasonForm, startDate: event.target.value })} />
          <input className="field" required type="date" value={seasonForm.endDate} onChange={(event) => setSeasonForm({ ...seasonForm, endDate: event.target.value })} />
          <AdminCheckbox label="Saison active" checked={seasonForm.active} onChange={() => setSeasonForm({ ...seasonForm, active: !seasonForm.active })} />
          <button className="btn-primary justify-center" type="submit">Créer la saison</button>
        </form>
        <div className="mt-4 grid gap-2">
          {seasons.slice(0, 8).map((season) => (
            <div key={season.id} className="rounded-2xl border border-border bg-bg p-3 text-sm font-bold">
              {season.name} · {season.startDate} → {season.endDate} · {season.active ? 'active' : 'inactive'}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Offres spéciales">
        <form onSubmit={submitSpecialOffer} className="grid gap-3">
          <SchoolSelect schools={schools} value={offerForm.schoolId} onChange={(value) => setOfferForm({ ...offerForm, schoolId: value, formulaId: '' })} />
          <select className="field" value={offerForm.formulaId} onChange={(event) => setOfferForm({ ...offerForm, formulaId: event.target.value })}>
            <option value="">Toutes les formules</option>
            {formulas.filter((formula) => !offerForm.schoolId || String(formula.schoolId) === String(offerForm.schoolId)).map((formula) => <option key={formula.id} value={formula.id}>{formula.name || formula.title}</option>)}
          </select>
          <input className="field" required placeholder="Nom de l’offre" value={offerForm.name} onChange={(event) => setOfferForm({ ...offerForm, name: event.target.value })} />
          <textarea className="field min-h-20" placeholder="Description courte" value={offerForm.description} onChange={(event) => setOfferForm({ ...offerForm, description: event.target.value })} />
          <input className="field" required type="date" value={offerForm.startDate} onChange={(event) => setOfferForm({ ...offerForm, startDate: event.target.value })} />
          <input className="field" required type="date" value={offerForm.endDate} onChange={(event) => setOfferForm({ ...offerForm, endDate: event.target.value })} />
          <select className="field" value={offerForm.dayType} onChange={(event) => setOfferForm({ ...offerForm, dayType: event.target.value })}>
            <option value="all">tous les jours</option>
            <option value="weekday">semaine</option>
            <option value="weekend">week-end</option>
          </select>
          <select className="field" value={offerForm.discountType} onChange={(event) => setOfferForm({ ...offerForm, discountType: event.target.value })}>
            <option value="fixed_price">prix fixe</option>
            <option value="amount">réduction en €</option>
            <option value="percent">réduction en %</option>
          </select>
          <input className="field" required type="number" min="0" placeholder="Valeur" value={offerForm.value} onChange={(event) => setOfferForm({ ...offerForm, value: event.target.value })} />
          <input className="field" type="number" min="0" placeholder="Places limitées optionnel" value={offerForm.maxPlaces} onChange={(event) => setOfferForm({ ...offerForm, maxPlaces: event.target.value })} />
          <AdminCheckbox label="Offre active" checked={offerForm.active} onChange={() => setOfferForm({ ...offerForm, active: !offerForm.active })} />
          <button className="btn-primary justify-center" type="submit">Créer l’offre spéciale</button>
        </form>
        <div className="mt-4 grid gap-2">
          {specialOffers.slice(0, 8).map((offer) => (
            <div key={offer.id} className="rounded-2xl border border-border bg-bg p-3 text-sm font-bold">
              {offer.name} · {offer.discountType} {offer.value} · {offer.active ? 'active' : 'inactive'}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SchoolSelect({ schools, value, onChange }) {
  return (
    <select className="field" required value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choisir une école</option>
      {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
    </select>
  );
}

function SimpleTable({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-sky/60 text-xs uppercase text-muted">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-black">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function GiftCardsPage({ cards }) {
  return (
    <Panel title="Cartes cadeaux SpotyKite">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-sky/60 text-xs uppercase text-muted">
            <tr>
              {['Code', 'Acheteur', 'Email acheteur', 'Bénéficiaire', 'Montant', "Date d'achat", "Date d'expiration", 'Statut', 'Commande liée'].map((label) => (
                <th key={label} className="px-4 py-3 font-black">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.code} className="border-b border-border bg-white">
                <td className="px-4 py-4 font-black text-ocean">{card.code}</td>
                <td className="px-4 py-4">{card.buyer}</td>
                <td className="px-4 py-4">{card.buyerEmail}</td>
                <td className="px-4 py-4">{card.recipient}</td>
                <td className="px-4 py-4 font-black">{formatCurrency(card.amount)}</td>
                <td className="px-4 py-4">{formatDate(card.boughtAt)}</td>
                <td className="px-4 py-4">{formatDate(card.expiresAt)}</td>
                <td className="px-4 py-4"><StatusBadge value={card.status} /></td>
                <td className="px-4 py-4">{card.linkedOrder || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SettingsPage() {
  return (
    <Panel title="Paramètres">
      <div className="grid gap-4 md:grid-cols-2">
        <Detail label="Accès temporaire" value="Code localStorage : spotykite-admin" />
        <Detail label="Connexion future" value="Prévu pour auth API / base de données" />
        <Detail label="Commission par défaut" value="12% à 15%" />
        <Detail label="Notifications" value="Email admin à brancher" />
      </div>
    </Panel>
  );
}

function AdminInput({ label, value, onChange, type = 'text', required = false, placeholder = '', className = '' }) {
  return (
    <label className={`grid gap-1 text-sm font-black text-navy ${className}`}>
      {label}
      <input className="field" required={required} type={type} placeholder={placeholder || label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminTextarea({ label, value, onChange, rows = 4, maxLength, placeholder = '', className = '' }) {
  return (
    <label className={`grid gap-1 text-sm font-black text-navy ${className}`}>
      {label}
      <textarea className="field min-h-28" rows={rows} maxLength={maxLength} placeholder={placeholder || label} value={value} onChange={(event) => onChange(event.target.value)} />
      {maxLength && <span className="text-right text-xs font-bold text-muted">{String(value).length}/{maxLength}</span>}
    </label>
  );
}

function AdminCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-4 text-sm font-bold text-text">
      <input className="h-5 w-5 accent-ocean" type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function MapPinPreview() {
  return (
    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ocean text-2xl font-black text-white shadow-lift">
      •
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-2xl bg-sky text-ocean">{icon}</div>
      <p className="text-sm font-black uppercase text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-navy">{value}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-2xl font-black text-navy">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-4">
      <p className="text-xs font-black uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-bold text-text">{value}</p>
    </div>
  );
}

function StatusBadge({ value }) {
  const style = {
    payé: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    confirmé: 'bg-sky text-ocean border-turquoise/30',
    'en attente': 'bg-amber-50 text-amber-700 border-amber-200',
    annulé: 'bg-red-50 text-red-700 border-red-200',
    prospect: 'bg-slate-50 text-slate-700 border-slate-200',
    partenaire: 'bg-blue-50 text-blue-700 border-blue-200',
    actif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    suspendu: 'bg-red-50 text-red-700 border-red-200',
    'non utilisée': 'bg-amber-50 text-amber-700 border-amber-200',
    utilisée: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    expirée: 'bg-red-50 text-red-700 border-red-200'
  }[value] || 'bg-slate-50 text-slate-700 border-slate-200';

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${style}`}>{value}</span>;
}

function FilterBar({ title, count, total, onReset, children }) {
  return (
    <div className="mb-5 rounded-3xl border border-border bg-bg p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-black text-navy">
          <Filter size={18} className="text-ocean" /> {title}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-muted">{count} résultat{count > 1 ? 's' : ''} / {total}</span>
          <button onClick={onReset} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-black text-ocean hover:border-ocean">
            Réinitialiser les filtres
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function SearchField({ value, onChange, placeholder }) {
  return (
    <label className="relative block">
      <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input className="field pl-11" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectFilter({ value, onChange, options, placeholder }) {
  return (
    <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="font-bold text-muted">Affichage {start}-{end} sur {total}</p>
      <div className="flex items-center gap-2">
        <button className="rounded-xl border border-border bg-white px-3 py-2 font-black disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Précédent
        </button>
        <span className="rounded-xl bg-sky px-3 py-2 font-black text-ocean">{page} / {totalPages}</span>
        <button className="rounded-xl border border-border bg-white px-3 py-2 font-black disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Suivant
        </button>
      </div>
    </div>
  );
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mergeDefaultContentBlocks(blocks = []) {
  const normalized = blocks.map(normalizeContentBlock);
  const existingKeys = new Set(normalized.map((item) => `${item.pageKey}.${item.sectionKey}.${item.fieldKey}.${item.locale || 'fr'}`));
  return [
    ...normalized,
    ...defaultContentBlocks.filter((item) => !existingKeys.has(`${item.pageKey}.${item.sectionKey}.${item.fieldKey}.${item.locale || 'fr'}`))
  ];
}

function normalizeContentBlock(item) {
  return {
    id: item.id,
    pageKey: item.pageKey || item.page_key || '',
    sectionKey: item.sectionKey || item.section_key || '',
    fieldKey: item.fieldKey || item.field_key || '',
    fieldType: item.fieldType || item.field_type || 'text',
    value: item.value || '',
    locale: item.locale || 'fr'
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function availabilityClass(status) {
  return {
    available: 'border-turquoise/40 bg-sky text-ocean',
    full: 'border-slate-200 bg-slate-100 text-slate-600',
    closed: 'border-red-200 bg-red-50 text-red-700',
    cancelled: 'border-amber-200 bg-amber-50 text-amber-700'
  }[status] || 'border-border bg-bg text-muted';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
}

function paginate(rows, page, pageSize) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

function matchesDateRange(date, range, from, to, now) {
  if (!range) return true;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;

  if (range === 'aujourd’hui') {
    return date >= startOfToday && date < new Date(startOfToday.getTime() + dayMs);
  }
  if (range === '7 derniers jours') {
    return date >= new Date(startOfToday.getTime() - 6 * dayMs);
  }
  if (range === '30 derniers jours') {
    return date >= new Date(startOfToday.getTime() - 29 * dayMs);
  }
  if (range === 'période personnalisée') {
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(`${to}T23:59:59`)) return false;
  }
  return true;
}

function normalizePartnerStatus(status) {
  if (status === 'actif') return 'actif';
  if (status === 'suspendu') return 'inactif';
  return 'en attente';
}

function normalizeAdminOrder(order) {
  return {
    id: order.id || order.order_number,
    customerName: order.customerName || `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim(),
    customerEmail: order.customerEmail || order.customer_email,
    customerPhone: order.customerPhone || order.customer_phone || '',
    product: order.product || order.stage_title || order.product_type,
    offerType: order.offerType || order.product_type,
    city: order.city || '',
    spot: order.spot || '',
    partner: order.partner || order.partner_name || '',
    amount: order.amount || 0,
    status: order.status || 'en attente',
    boughtAt: order.boughtAt || order.created_at,
    desiredDate: order.desiredDate || '',
    paymentMethod: order.paymentMethod || order.payment_provider || order.payment_status || '',
    notes: order.notes || ''
  };
}

function normalizeAdminPartner(partner) {
  return {
    ...partner,
    id: partner.id,
    name: partner.name || '',
    address: partner.address || '',
    city: partner.city || '',
    department: partner.department || '',
    region: partner.region || '',
    phone: partner.phone || '',
    email: partner.email || '',
    website: partner.website || '',
    contactName: partner.contactName || '',
    sessionPrice: partner.sessionPrice || '',
    stagePrice: partner.stagePrice || '',
    supervisedPrice: partner.supervisedPrice || '',
    commission: partner.commission || '',
    services: partner.services || partner.school_description || '',
    activities: partner.activities || '',
    notes: partner.notes || partner.full_description || '',
    status: partner.status === 'active' ? 'actif' : (partner.status || (partner.is_active ? 'actif' : 'suspendu'))
    ,
    frontVisibility: partner.frontVisibility || partner.front_visibility || 'active',
    bookingEnabled: partner.bookingEnabled ?? partner.booking_enabled ?? true
  };
}

function schoolToSchoolForm(school, formulas = []) {
  const photos = Array.isArray(school.photos) ? school.photos.join(', ') : (school.photos || school.galleryPhotos || '');
  const practical = school.practical || {};
  return {
    ...newSchoolPartnerForm(),
    name: school.name || '',
    city: school.city || '',
    department: school.department || '',
    region: school.region || '',
    spot: school.spot || '',
    address: school.address || '',
    latitude: school.latitude ?? '',
    longitude: school.longitude ?? '',
    shortDescription: school.shortDescription || school.short_description || '',
    fullDescription: school.description || school.fullDescription || school.full_description || school.additionalInfo || '',
    mainPhoto: school.imageUrl || school.mainPhoto || school.main_image_url || '',
    galleryPhotos: photos,
    logo: school.logo || school.logo_url || '',
    website: school.website || '',
    phone: school.phone || '',
    email: school.email || '',
    kitesurfBrief: school.spotDetails || school.spot_details || defaultKitesurfBrief,
    schoolTitle: school.schoolTitle || 'Votre école de kitesurf',
    schoolDescription: school.pedagogy || school.schoolDescription || school.school_description || '',
    licenceRequired: Boolean(practical.ffvlLicenseRequired ?? school.licenceRequired),
    licenceIncluded: Boolean(practical.licenseIncluded ?? school.licenceIncluded),
    medicalCertificateRequired: Boolean(practical.medicalCertificateRequired ?? school.medicalCertificateRequired),
    parentalAuthorizationRequired: Boolean(practical.parentalAuthorizationRequired ?? school.parentalAuthorizationRequired),
    minAge: practical.minAge ?? school.minAge ?? '',
    maxAge: practical.maxAge ?? school.maxAge ?? '',
    minWeight: practical.minWeight ?? school.minWeight ?? '',
    maxWeight: practical.maxWeight ?? school.maxWeight ?? '',
    averageSessionDuration: practical.sessionDuration ?? school.averageSessionDuration ?? '',
    maxParticipants: practical.maxParticipants ?? school.maxParticipants ?? '',
    acceptedLevels: practical.level ? String(practical.level).split(',').map((item) => item.trim()).filter(Boolean) : [],
    equipmentProvided: Boolean(practical.equipmentIncluded ?? school.equipmentProvided ?? true),
    wetsuitProvided: Boolean(practical.wetsuitIncluded ?? school.wetsuitProvided ?? true),
    changingRooms: Boolean(practical.changingRooms ?? school.changingRooms),
    parking: Boolean(practical.parking ?? school.parking),
    showers: Boolean(practical.showers ?? school.showers),
    privateLessons: Boolean(practical.privateLessons ?? school.privateLessons ?? true),
    groupLessons: Boolean(practical.groupLessons ?? school.groupLessons ?? true),
    wingfoilAvailable: Boolean(practical.wingfoilAvailable ?? school.wingfoilAvailable),
    rentalAvailable: Boolean(practical.rentalAvailable ?? school.rentalAvailable),
    metaTitle: school.metaTitle || '',
    metaDescription: school.metaDescription || '',
    slug: school.slug || '',
    frontVisibility: school.frontVisibility || school.front_visibility || 'active',
    bookingEnabled: school.bookingEnabled ?? school.booking_enabled ?? true,
    schoolFormulas: formulasToSchoolFormulas(formulas)
  };
}

function visibilityLabel(value) {
  return {
    hidden: 'Masquée',
    seo_only: 'SEO uniquement',
    active: 'Active'
  }[value] || 'Active';
}

function prospectTypeLabel(value) {
  return {
    booking: 'réservation',
    gift_card: 'carte cadeau',
    lead_request: 'demande école'
  }[value] || value || '-';
}

function mergeSchoolStages(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(schoolStageDefinitions.map((stage) => {
    const item = source[stage.type] || {};
    return [stage.type, {
      enabled: Boolean(item.enabled),
      name: item.name || stage.label,
      price: item.price ?? stage.price,
      defaultPrice: item.defaultPrice ?? item.price ?? stage.price,
      lowSeasonWeekdayPrice: item.lowSeasonWeekdayPrice ?? item.price ?? stage.price,
      lowSeasonWeekendPrice: item.lowSeasonWeekendPrice ?? item.price ?? stage.price,
      highSeasonWeekdayPrice: item.highSeasonWeekdayPrice ?? item.price ?? stage.price,
      highSeasonWeekendPrice: item.highSeasonWeekendPrice ?? item.price ?? stage.price,
      duration: item.duration || stage.duration,
      level: item.level || stage.level,
      shortDescription: item.shortDescription || stage.shortDescription,
      sessionPlaces: item.sessionPlaces || '',
      isActive: item.isActive ?? true,
      displayOrder: item.displayOrder ?? stage.displayOrder
    }];
  }));
}

function formulasToSchoolFormulas(formulas = []) {
  const stages = mergeSchoolStages();
  formulas.forEach((formula) => {
    const type = normalizeFormulaType(formula.category || formula.type);
    if (!stages[type]) return;
    stages[type] = {
      ...stages[type],
      enabled: true,
      name: formula.name || formula.title || stages[type].name,
      price: String(formula.price || formula.spotykitePrice || formula.publicPrice || stages[type].price),
      defaultPrice: String(formula.priceRules?.defaultPrice || formula.price || stages[type].price),
      lowSeasonWeekdayPrice: String(formula.priceRules?.lowSeasonWeekdayPrice || formula.price || stages[type].price),
      lowSeasonWeekendPrice: String(formula.priceRules?.lowSeasonWeekendPrice || formula.price || stages[type].price),
      highSeasonWeekdayPrice: String(formula.priceRules?.highSeasonWeekdayPrice || formula.price || stages[type].price),
      highSeasonWeekendPrice: String(formula.priceRules?.highSeasonWeekendPrice || formula.price || stages[type].price),
      duration: formula.duration || stages[type].duration,
      level: formula.level || stages[type].level,
      shortDescription: formula.shortDescription || formula.description || stages[type].shortDescription,
      isActive: Boolean(formula.active ?? formula.isActive ?? true),
      displayOrder: formula.displayOrder ?? formula.display_order ?? stages[type].displayOrder
    };
  });
  return stages;
}

function enabledSchoolFormulas(value = {}) {
  return Object.entries(mergeSchoolStages(value))
    .filter(([, item]) => item.enabled)
    .map(([formulaType, item]) => ({
      formulaType,
      name: item.name,
      price: item.price,
      defaultPrice: item.defaultPrice,
      lowSeasonWeekdayPrice: item.lowSeasonWeekdayPrice,
      lowSeasonWeekendPrice: item.lowSeasonWeekendPrice,
      highSeasonWeekdayPrice: item.highSeasonWeekdayPrice,
      highSeasonWeekendPrice: item.highSeasonWeekendPrice,
      duration: item.duration,
      level: item.level,
      shortDescription: item.shortDescription,
      sessionPlaces: item.sessionPlaces,
      isActive: item.isActive,
      displayOrder: item.displayOrder
    }));
}

function normalizeFormulaType(value = '') {
  return value === 'perfectionnement' ? 'progression' : value;
}

function normalizeAdminGiftCard(card) {
  const normalizedStatus = {
    active: 'non utilisée',
    redeemed: 'utilisée',
    expired: 'expirée',
    cancelled: 'annulée'
  }[card.status] || card.status;

  return {
    code: card.code,
    buyer: card.buyer || card.buyerName || `${card.buyer_firstname || ''} ${card.buyer_lastname || ''}`.trim(),
    buyerEmail: card.buyerEmail || card.buyer_email,
    recipient: card.recipient || card.recipientName || card.beneficiary_name,
    amount: card.amount || 0,
    boughtAt: card.boughtAt || card.createdAt || card.created_at,
    expiresAt: card.expiresAt || card.expires_at,
    status: normalizedStatus,
    linkedOrder: card.linkedOrder || card.bookingId || ''
  };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
}
