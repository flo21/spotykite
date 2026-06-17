import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/mapbox';
import {
  Award,
  BedDouble,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Home,
  Info,
  MapPin,
  ShieldCheck,
  Shirt,
  Users,
  Waves,
  X
} from 'lucide-react';
import { api } from '../api.js';
import Loading from '../components/Loading.jsx';
import SchoolCard from '../components/SchoolCard.jsx';
import { publicSchoolLocation, publicSchoolTitle } from '../utils/schoolDisplay.js';

export default function SchoolDetail() {
  const { slug } = useParams();
  const [school, setSchool] = useState(null);
  const [status, setStatus] = useState('loading');
  const [selectedFormulaId, setSelectedFormulaId] = useState('');
  const [mobileActionOpen, setMobileActionOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    api.school(slug)
      .then((data) => {
        if (!active) return;
        setSchool(data);
        const firstActive = (data.formulas || []).find((formula) => formula.active);
        setSelectedFormulaId(firstActive?.id ? String(firstActive.id) : '');
        setStatus('ready');
        updateSeo(data);
      })
      .catch(() => {
        if (!active) return;
        setStatus('not-found');
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const selectedFormula = useMemo(() => {
    return school?.formulas?.find((formula) => String(formula.id) === selectedFormulaId);
  }, [school, selectedFormulaId]);
  const canBook = school?.frontVisibility === 'active' && school?.bookingEnabled;

  useEffect(() => {
    if (!school) return;
    rememberViewedSchool(school);
  }, [school]);

  useEffect(() => {
    if (!school || !selectedFormula || !canBook) return;
    rememberCurrentBooking(school, selectedFormula);
  }, [school, selectedFormula, canBook]);

  if (status === 'loading') return <Loading />;
  if (status === 'not-found' || !school) {
    return (
      <main className="section pt-12">
        <div className="card mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-4xl font-black text-navy">École introuvable</h1>
          <p className="mt-3 text-muted">Cette fiche école n’existe pas ou n’est plus disponible.</p>
          <Link to="/ecoles" className="btn-primary mt-6 justify-center">Voir les écoles</Link>
        </div>
      </main>
    );
  }

  function reserveFormula(formulaId) {
    setSelectedFormulaId(String(formulaId));
    if (!window.matchMedia('(max-width: 1023px)').matches) {
      document.getElementById('reservation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <main className="page-with-mobile-sticky-booking">
      <SchoolJsonLd school={school} />
      <SchoolHero school={school} selectedFormula={selectedFormula} />
      <SchoolAnchorNav />

      <section className="section">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="grid min-w-0 gap-8">
            <StageSection>
              <StageBrief />
              <BeforeBooking school={school} />
              <IncludedSection school={school} selectedFormula={selectedFormula} />
              <FormulaSection school={school} selectedFormulaId={selectedFormulaId} onReserve={reserveFormula} canBook={canBook} />
            </StageSection>
            <SchoolWelcome school={school} />
            <LocationSection school={school} />
            <AccommodationsSection accommodations={school.accommodations || []} />
            {canBook && <GiftCardConversion />}
            {canBook && <WhyBookSpotykite />}
            <NearbySchools schools={school.nearbySchools || []} />
            <SchoolFaq school={school} canBook={canBook} />
            <FinalCta school={school} selectedFormula={selectedFormula} canBook={canBook} />
          </div>

          <DesktopActionCard
            school={school}
            formulas={school.formulas || []}
            selectedFormula={selectedFormula}
            selectedFormulaId={selectedFormulaId}
            onSelectFormula={setSelectedFormulaId}
            canBook={canBook}
          />
        </div>
      </section>

      <MobileActionBar
        school={school}
        formulas={school.formulas || []}
        selectedFormula={selectedFormula}
        selectedFormulaId={selectedFormulaId}
        onSelectFormula={setSelectedFormulaId}
        canBook={canBook}
        open={mobileActionOpen}
        onOpen={() => setMobileActionOpen(true)}
        onClose={() => setMobileActionOpen(false)}
      />
    </main>
  );
}

function DesktopActionCard({ school, formulas, selectedFormula, selectedFormulaId, onSelectFormula, canBook }) {
  return (
    <aside id="reservation" className="hidden lg:block">
      <div className="sticky top-24 rounded-[2rem] border border-border bg-white p-6 shadow-lift">
        <ActionPanelContent
          school={school}
          formulas={formulas}
          selectedFormula={selectedFormula}
          selectedFormulaId={selectedFormulaId}
          onSelectFormula={onSelectFormula}
          canBook={canBook}
          compact
        />
      </div>
    </aside>
  );
}

function MobileActionBar({ school, formulas, selectedFormula, selectedFormulaId, onSelectFormula, canBook, open, onOpen, onClose }) {
  const label = canBook ? (selectedFormula ? `${selectedFormula.name} · ${selectedFormula.price} €` : `Réservez à ${school.city}`) : publicSchoolLocation(school);
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="fixed inset-x-0 bottom-0 z-[9998] border-t border-turquoise/45 bg-[#062B4A]/95 px-3 py-2 text-left text-white shadow-[0_-18px_44px_rgba(6,43,74,0.28)] backdrop-blur-[10px] sm:px-5 lg:hidden"
      >
        <div className="mx-auto flex min-h-12 max-w-7xl items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none sm:text-base">{label}</p>
          </div>
          <span className="ml-auto inline-flex h-10 w-[68px] shrink-0 items-center justify-center rounded-full bg-turquoise text-sm font-black uppercase text-navy shadow-[0_8px_20px_rgba(45,212,191,0.25)]">
            GO
          </span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 h-full w-full bg-navy/60" onClick={onClose} aria-label="Fermer le panneau" />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-[0_-24px_70px_rgba(6,43,74,0.32)]">
            <div className="mx-auto max-w-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow text-primary">{canBook ? 'Réservation' : 'Disponibilités'}</p>
                  <h2 className="text-2xl font-black text-navy">{canBook ? 'Réserver' : 'Recevoir les disponibilités'}</h2>
                </div>
                <button type="button" onClick={onClose} className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-bg text-navy" aria-label="Fermer">
                  <X size={20} />
                </button>
              </div>
              <ActionPanelContent
                school={school}
                formulas={formulas}
                selectedFormula={selectedFormula}
                selectedFormulaId={selectedFormulaId}
                onSelectFormula={onSelectFormula}
                canBook={canBook}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ActionPanelContent({ school, formulas, selectedFormula, selectedFormulaId, onSelectFormula, canBook, compact = false }) {
  if (!canBook) {
    return (
      <div>
        <h2 className={`${compact ? 'text-2xl' : 'text-3xl'} font-black text-navy`}>Préparez votre stage</h2>
        <p className="mt-3 text-sm font-bold leading-relaxed text-muted">
          Nous sélectionnons pour vous les meilleures disponibilités sur ce spot. Faites votre demande et notre équipe vous proposera la solution la plus adaptée.
        </p>
        <LeadRequestForm school={school} selectedFormula={selectedFormula} compact />
      </div>
    );
  }

  return (
    <div>
      <h2 className={`${compact ? 'text-2xl' : 'text-3xl'} font-black text-navy`}>Réserver</h2>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-2 text-sm font-black text-navy">
          Choisir une formule
          <select className="field" value={selectedFormulaId} onChange={(event) => onSelectFormula(event.target.value)}>
            {(formulas || []).map((formula) => (
              <option key={formula.id} value={formula.id}>
                {formula.name} · {formula.price ? `${formula.price} €` : 'Sur demande'}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-2xl border border-turquoise/25 bg-sky/40 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-ocean">Prix</p>
          <p className="mt-1 text-3xl font-black text-primary">{selectedFormula?.price ? `${selectedFormula.price} €` : 'Sur demande'}</p>
          {selectedFormula && <p className="mt-1 text-sm font-bold text-muted">{selectedFormula.duration} · {selectedFormula.level}</p>}
        </div>
      </div>
      <Link to={reservationUrl(school, selectedFormula)} className={`btn-primary mt-4 w-full justify-center ${!selectedFormula ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={!selectedFormula}>
        Réserver maintenant
      </Link>
      <Link to="/carte-cadeau" className="btn-secondary mt-3 w-full justify-center"><Gift size={18} /> Offrir un stage</Link>
      <p className="mt-3 flex items-center gap-2 text-sm font-black text-navy">
        <CheckCircle2 size={17} className="shrink-0 text-turquoise" />
        Paiement sécurisé Stripe
      </p>
    </div>
  );
}

function LeadRequestForm({ school, selectedFormula, compact = false }) {
  const [form, setForm] = useState({ firstName: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState('idle');
  const canSubmit = form.email || form.phone;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus('loading');
    try {
      await api.createLead({
        schoolId: school.id,
        formulaId: selectedFormula?.id || null,
        firstName: form.firstName,
        email: form.email,
        phone: form.phone,
        message: form.message,
        sourcePage: window.location.pathname
      });
      setStatus('sent');
      setForm({ firstName: '', email: '', phone: '', message: '' });
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">Votre demande a bien été envoyée. Nous vous recontactons rapidement.</p>;
  }

  return (
    <form onSubmit={submit} className={`mt-5 grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      <input className="field" placeholder="Prénom" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
      <input className="field" type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <input className="field" placeholder="Téléphone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      <textarea className={`field min-h-24 ${compact ? '' : 'sm:col-span-2'}`} placeholder="Message optionnel" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      <p className={`text-xs font-bold leading-relaxed text-muted ${compact ? '' : 'sm:col-span-2'}`}>
        En envoyant ce formulaire, vous acceptez d’être recontacté par Spotykite au sujet de votre demande.
      </p>
      {status === 'error' && <p className={`text-sm font-black text-red-600 ${compact ? '' : 'sm:col-span-2'}`}>Erreur lors de l’envoi. Réessayez dans quelques instants.</p>}
      <button className={`btn-primary justify-center disabled:opacity-60 ${compact ? 'w-full' : 'sm:col-span-2 sm:w-fit'}`} disabled={!canSubmit || status === 'loading'} type="submit">Recevoir les disponibilités</button>
    </form>
  );
}

function SchoolHero({ school, selectedFormula }) {
  const heroImage = school.photos?.[0] || school.imageUrl;
  const activity = heroFormulaTitle(selectedFormula);
  const title = (school.city || school.spot || 'Spotykite').toUpperCase();
  const breadcrumbs = ['Accueil', 'France', school.region, school.city].filter(Boolean);
  return (
    <section id="school-hero" className="relative min-h-[520px] overflow-hidden bg-navy text-white sm:min-h-[620px]">
      <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,43,73,0.20),rgba(6,43,73,0.62)_44%,rgba(6,43,73,0.94))]" />
      <div className="relative mx-auto flex min-h-[520px] max-w-7xl flex-col justify-end px-4 pb-10 pt-28 sm:min-h-[620px] sm:px-6 lg:pb-14">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="inline-flex rounded-full border border-white/35 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">
              {activity}
            </p>
            <h1 className="mt-4 max-w-5xl text-5xl font-black uppercase leading-[0.88] text-white sm:text-7xl lg:text-8xl">
              {title}
            </h1>
            <p className="mt-5 flex items-center gap-2 text-lg font-black text-white/90 sm:text-2xl">
              <MapPin size={22} className="text-turquoise" /> {publicSchoolLocation(school)}
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-black text-white/82 lg:max-w-md lg:justify-end" aria-label="Fil d’Ariane">
            {breadcrumbs.map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex items-center gap-2">
                {index === 0 ? <Link to="/" className="transition hover:text-primary">{item}</Link> : <span>{item}</span>}
                {index < breadcrumbs.length - 1 && <span className="text-primary">›</span>}
              </span>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

function SchoolAnchorNav() {
  const tabs = [
    ['#stage-kitesurf', 'Stage de kitesurf'],
    ['#spot', 'Le spot'],
    ['#carte', 'Voir sur la carte'],
    ['#proche', 'Proche de ce spot'],
    ['#faq', 'FAQ']
  ];
  const [active, setActive] = useState(tabs[0][0]);
  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-white/95 shadow-sm backdrop-blur" aria-label="Navigation fiche spot">
      <div className="mx-auto flex max-w-7xl gap-7 overflow-x-auto px-4 sm:px-6">
        {tabs.map(([href, label]) => (
          <a
            key={href}
            href={href}
            onClick={() => setActive(href)}
            className={`min-h-14 shrink-0 border-b-4 px-1 pt-5 text-sm font-black text-navy transition hover:text-ocean ${active === href ? 'border-primary text-ocean' : 'border-transparent'}`}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function StageSection({ children }) {
  return <section id="stage-kitesurf" className="scroll-mt-24 grid gap-8">{children}</section>;
}

function StageBrief() {
  const steps = [
    'Accueil à l’école',
    'Briefing sécurité',
    'Découverte du matériel',
    'Exercices au sol',
    'Mise à l’eau',
    'Premières sensations',
    'Navigation accompagnée',
    'Débriefing'
  ];

  return (
    <section className="card p-6 sm:p-8">
      <p className="eyebrow">Le stage en bref</p>
      <h2 className="text-4xl font-black text-navy">Votre stage de kitesurf en bref</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {steps.map((step, index) => (
          <div key={step} className="flex gap-4 rounded-2xl border border-border bg-bg p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-turquoise text-sm font-black text-navy">{index + 1}</span>
            <div>
              <p className="font-black text-navy">{step}</p>
              <p className="mt-1 text-sm text-muted">{briefStepText(index)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SchoolWelcome({ school }) {
  const practical = school.practical || {};
  const description = school.description || `À ${school.city}, Spotykite vous oriente vers un spot réputé pour ses conditions adaptées à l’apprentissage du kitesurf.`;
  const details = [
    ['Présentation', description],
    ['Philosophie pédagogique', 'Un apprentissage progressif, centré sur la sécurité, la compréhension du vent et les premières sensations sur l’eau.'],
    practical.bestPeriod && ['Période idéale', practical.bestPeriod],
    practical.level && ['Niveaux accueillis', practical.level],
    school.spot && ['Particularités du spot', `Sessions organisées autour du spot de ${school.spot}.`],
    practical.maxParticipants && ['Ambiance générale', `Groupes limités à ${practical.maxParticipants} participants pour garder un accompagnement lisible.`]
  ].filter(Boolean);

  return (
    <section id="spot" className="card scroll-mt-24 p-6 sm:p-8">
      <p className="eyebrow">Le spot</p>
      <h2 className="text-4xl font-black text-navy">Le spot de kitesurf à {school.city}</h2>
      <div className="mt-5 grid gap-3">
        {details.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}
      </div>
    </section>
  );
}

function FormulaSection({ school, selectedFormulaId, onReserve, canBook }) {
  const formulas = school.formulas || [];
  return (
    <section id="formules" className="grid gap-5">
      <div>
        <p className="eyebrow">Formules</p>
        <h2 className="text-4xl font-black text-navy">Choisissez votre formule</h2>
      </div>
      {formulas.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {formulas.map((formula) => (
            <article key={formula.id} className={`rounded-3xl border bg-white p-5 shadow-sm ${String(formula.id) === selectedFormulaId ? 'border-ocean' : 'border-border'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-sky px-3 py-1 text-xs font-black uppercase text-ocean">{categoryLabel(formula.category)}</span>
                  <h3 className="mt-3 text-3xl font-black leading-tight text-navy">{formula.name}</h3>
                </div>
                <p className="text-3xl font-black text-primary">{formula.price} €</p>
              </div>
              <p className="mt-2 text-sm font-bold text-ocean">{formula.duration} · {formula.level}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{formula.shortDescription}</p>
              <p className="mt-4 text-sm font-bold text-muted">
                Prix public : {formula.publicPrice} €{formula.spotykitePrice ? ` · Prix Spotykite : ${formula.spotykitePrice} €` : ''}
              </p>
              {canBook ? <button type="button" onClick={() => onReserve(formula.id)} className={`mt-5 w-full justify-center ${String(formula.id) === selectedFormulaId ? 'btn-secondary' : 'btn-primary'}`}>
                <span className="lg:hidden">Choisir cette formule</span>
                <span className="hidden lg:inline">{String(formula.id) === selectedFormulaId ? 'Formule sélectionnée' : 'Choisir cette formule'}</span>
              </button> : (
                <p className="mt-5 rounded-2xl border border-border bg-bg p-4 text-sm font-bold text-muted">Demandez vos disponibilités pour cette formule et notre équipe vous accompagne.</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Formules en préparation" text="Indiquez vos disponibilités et Spotykite vous orientera vers la formule la plus adaptée." />
      )}
    </section>
  );
}

function BeforeBooking({ school }) {
  const practical = school.practical || {};
  const items = [
    practical.level && [Users, 'Niveau requis', practical.level],
    practical.minAge && [Calendar, 'Âge minimum', `${practical.minAge} ans`],
    [Waves, 'Savoir nager', 'Requis pour toute activité nautique'],
    booleanInfo(practical.equipmentIncluded, ShieldCheck, 'Matériel fourni', 'Oui'),
    booleanInfo(practical.wetsuitIncluded, Shirt, 'Combinaison fournie', 'Oui'),
    practical.sessionDuration && [Clock, 'Durée moyenne', practical.sessionDuration],
    practical.maxParticipants && [Users, 'Nombre de participants', `${practical.maxParticipants} personnes maximum`],
    typeof practical.ffvlLicenseRequired === 'boolean' && [Info, 'Licence FFVL', practical.ffvlLicenseRequired ? (practical.licenseIncluded ? 'Requise, incluse' : 'Requise') : 'Non requise'],
    [Calendar, 'Conditions météo', 'Session validée selon le vent et la sécurité'],
    [CheckCircle2, 'Report météo', 'Report proposé si les conditions ne permettent pas la pratique'],
    booleanInfo(practical.parking, Car, 'Parking', 'Disponible'),
    booleanInfo(practical.changingRooms, Home, 'Vestiaires', 'Disponibles'),
    booleanInfo(practical.showers, Waves, 'Douches', 'Disponibles')
  ].filter(Boolean);

  return (
    <section className="card p-6 sm:p-8">
      <p className="eyebrow">Avant de réserver</p>
      <h2 className="text-4xl font-black text-navy">À savoir avant de réserver</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([Icon, title, text]) => (
          <Pill key={title} icon={<Icon />} title={title} text={text} />
        ))}
      </div>
    </section>
  );
}

function IncludedSection({ school, selectedFormula }) {
  const practical = school.practical || {};
  const formulaIncluded = splitIncluded(selectedFormula?.included);
  const defaults = [
    'Encadrement par moniteur diplômé',
    practical.equipmentIncluded && 'Matériel de kitesurf',
    practical.licenseIncluded && 'Assurance ou licence si applicable',
    'Briefing sécurité',
    'Assistance pendant les séances',
    school.spot && 'Accès au spot',
    'Débriefing pédagogique'
  ].filter(Boolean);
  const items = uniqueList([...formulaIncluded, ...defaults]);

  return (
    <section className="card p-6 sm:p-8">
      <p className="eyebrow">Ce qui est inclus</p>
      <h2 className="text-4xl font-black text-navy">Votre formule comprend</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-4">
            <CheckCircle2 className="mt-0.5 shrink-0 text-turquoise" size={20} />
            <p className="font-bold text-text">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LocationSection({ school }) {
  const hasCoords = hasValidCoordinates(school);
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const travelTimes = [
    school.travelTimeFromParis && ['Paris', school.travelTimeFromParis],
    school.travelTimeFromLyon && ['Lyon', school.travelTimeFromLyon],
    school.travelTimeFromMarseille && ['Marseille', school.travelTimeFromMarseille]
  ].filter(Boolean);
  return (
    <section id="carte" className="card scroll-mt-24 overflow-hidden p-0">
      <div className="p-6 sm:p-8">
        <p className="eyebrow">Localisation</p>
        <h2 className="text-4xl font-black text-navy">Où se situe l’école ?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <InfoRow label="Spot" value={school.spot || school.city} />
          {school.spot && <InfoRow label="Spot principal" value={school.spot} />}
          {school.practical?.parking && <InfoRow label="Parking" value="Disponible sur place ou à proximité" />}
        </div>
        {travelTimes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {travelTimes.map(([city, time]) => <span key={city} className="rounded-full bg-sky px-4 py-2 text-sm font-black text-ocean">Depuis {city} : {time}</span>)}
          </div>
        )}
      </div>
      {hasCoords && token ? (
        <div className="h-[320px] sm:h-[420px]">
          <Map
            mapboxAccessToken={token}
            initialViewState={{ longitude: Number(school.longitude), latitude: Number(school.latitude), zoom: 11 }}
            mapStyle="mapbox://styles/mapbox/light-v11"
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <Marker longitude={Number(school.longitude)} latitude={Number(school.latitude)} anchor="bottom">
              <span className="spotykite-map-marker"><MapPin size={22} className="fill-current" /></span>
            </Marker>
            <Popup longitude={Number(school.longitude)} latitude={Number(school.latitude)} anchor="top" closeButton={false}>
              <b>{publicSchoolTitle(school)}</b>
            </Popup>
          </Map>
        </div>
      ) : (
        <div className="grid min-h-[260px] place-items-center bg-sky/40 p-6 text-center">
          <div>
            <MapPin className="mx-auto text-ocean" size={38} />
            <p className="mt-3 text-xl font-black text-navy">Localisation bientôt disponible.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function AccommodationsSection({ accommodations }) {
  return (
    <section id="hebergements" className="card p-6 sm:p-8">
      <p className="eyebrow">Séjour</p>
      <h2 className="text-4xl font-black text-navy">Où dormir à proximité ?</h2>
      <p className="mt-3 text-sm font-bold text-muted">Les hébergements sont proposés à titre indicatif. La réservation se fait directement auprès de l’établissement.</p>
      {accommodations.length ? (
        <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible">
          {accommodations.map((item) => (
            <div key={item.id} className="min-w-[280px] snap-start rounded-2xl border border-border bg-bg p-4 md:min-w-0">
              <p className="flex items-center gap-2 font-black text-navy"><BedDouble size={18} className="text-ocean" /> {item.name}</p>
              <p className="mt-1 text-sm font-bold text-ocean">{item.type} · {item.distanceFromSpot}</p>
              <p className="mt-2 text-sm text-muted">{item.description}</p>
              {item.promoCode && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-black text-primary">Code promo : {item.promoCode}</p>}
              {item.websiteUrl && <a className="btn-secondary mt-4 justify-center text-sm" href={item.websiteUrl} target="_blank" rel="noreferrer">Voir l’hébergement</a>}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Aucun hébergement recommandé" text="Spotykite ne réserve pas l’hébergement en V1. Des recommandations pourront être ajoutées prochainement." />
      )}
    </section>
  );
}

function GiftCardConversion() {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-navy p-7 text-white sm:p-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
        <div>
          <p className="eyebrow">Carte cadeau Spotykite</p>
          <h2 className="text-5xl font-black leading-none text-white">Vous ne connaissez pas ses disponibilités ?</h2>
          <p className="mt-4 max-w-2xl text-lg font-bold text-white/82">Offrez une carte cadeau Spotykite, valable dans toutes les écoles Spotykite.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Valable 1 an', 'Utilisation partout en France', 'Réservation flexible'].map((item) => (
              <span key={item} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white">{item}</span>
            ))}
          </div>
        </div>
        <Link to="/carte-cadeau" className="btn-primary justify-center text-center"><Gift size={18} /> Offrir une carte cadeau</Link>
      </div>
    </section>
  );
}

function WhyBookSpotykite() {
  const benefits = [
    [Award, 'Meilleur prix garanti'],
    [ShieldCheck, 'Écoles sélectionnées'],
    [CreditCard, 'Paiement sécurisé'],
    [Gift, 'Carte cadeau valable 1 an'],
    [BedDouble, 'Hébergements recommandés']
  ];
  return (
    <section className="card p-6 sm:p-8">
      <p className="eyebrow">Pourquoi réserver avec Spotykite ?</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {benefits.map(([Icon, label]) => (
          <div key={label} className="rounded-2xl border border-border bg-bg p-4 text-center">
            <Icon className="mx-auto text-turquoise" size={28} />
            <p className="mt-3 font-black text-navy">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NearbySchools({ schools }) {
  return (
    <section id="proche" className="scroll-mt-24">
      <div className="mb-5">
        <p className="eyebrow">À proximité</p>
        <h2 className="text-4xl font-black text-navy">Autres spots proches</h2>
      </div>
      {schools.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((nearby) => <SchoolCard key={nearby.id} school={nearby} />)}
        </div>
      ) : (
        <Empty title="Aucun spot proche" text="Notre équipe peut vous orienter vers les meilleures options selon vos dates et votre niveau." />
      )}
    </section>
  );
}

function SchoolFaq({ school, canBook }) {
  const practical = school.practical || {};
  const items = [
    ['Puis-je débuter ?', `Oui, des formules adaptées aux débutants sont proposées selon les conditions du spot de ${school.city}.`],
    ['Que se passe-t-il en cas de mauvais temps ?', 'La session est confirmée selon le vent, la météo et la sécurité. Si les conditions ne sont pas adaptées, un report est proposé.'],
    ['Le matériel est-il fourni ?', practical.equipmentIncluded ? 'Oui, le matériel de kitesurf est fourni par l’école.' : 'Le détail du matériel fourni est précisé lors de la réservation.'],
    ['Faut-il savoir nager ?', 'Oui, il faut savoir nager pour pratiquer une activité nautique en sécurité.'],
    canBook && ['Puis-je offrir cette formule ?', 'Oui, la carte cadeau Spotykite est utilisable dans les écoles Spotykite pendant 1 an.'],
    canBook
      ? ['Comment réserver ?', 'Choisissez une formule, renseignez vos informations et envoyez votre demande de réservation via Spotykite.']
      : ['Comment recevoir les disponibilités ?', 'Indiquez vos coordonnées et vos préférences. Spotykite vous proposera la solution la plus adaptée pour ce spot.']
  ].filter(Boolean);
  return (
    <section id="faq" className="card scroll-mt-24 p-6 sm:p-8">
      <p className="eyebrow">FAQ</p>
      <h2 className="text-4xl font-black text-navy">Questions fréquentes</h2>
      <div className="mt-5 grid gap-3">
        {items.map(([question, answer]) => (
          <details key={question} className="rounded-2xl border border-border bg-bg p-5">
            <summary className="cursor-pointer text-lg font-black text-navy">{question}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ school, selectedFormula, canBook }) {
  return (
    <section className="rounded-[2rem] bg-navy p-7 text-white sm:p-10">
      <h2 className="text-5xl font-black leading-none text-white">{canBook ? `Prêt à découvrir le kitesurf à ${school.city} ?` : `Préparez votre stage à ${school.city}`}</h2>
      <p className="mt-4 max-w-2xl text-white/80">{canBook ? 'Choisissez votre formule et réservez votre session avec Spotykite.' : 'Indiquez vos disponibilités et notre équipe vous proposera la solution la plus adaptée sur ce spot.'}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {canBook ? <Link to={reservationUrl(school, selectedFormula)} className="btn-primary justify-center lg:hidden">Réserver un stage</Link> : <a href="#availability-request" className="btn-primary justify-center">Recevoir les disponibilités</a>}
        {canBook && <a href="#reservation" className="btn-primary hidden justify-center lg:inline-flex">Réserver un stage</a>}
        <Link to="/carte-cadeau" className="btn-secondary justify-center">Offrir un stage</Link>
      </div>
    </section>
  );
}

function Pill({ icon, title, text }) {
  return <div className="rounded-2xl border border-border bg-bg p-4"><div className="mb-2 text-ocean">{icon}</div><p className="font-black text-navy">{title}</p><p className="mt-1 text-sm text-muted">{text}</p></div>;
}

function InfoRow({ label, value }) {
  return <div className="rounded-2xl border border-border bg-bg p-4"><p className="text-xs font-black uppercase text-muted">{label}</p><p className="mt-1 font-bold text-text">{value}</p></div>;
}

function Empty({ title, text }) {
  return <div className="mt-5 rounded-2xl border border-border bg-bg p-5 text-center"><h3 className="font-black text-navy">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></div>;
}

function SchoolJsonLd({ school }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: publicSchoolTitle(school),
    address: school.address,
    telephone: school.phone,
    email: school.email,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    geo: hasValidCoordinates(school) ? {
      '@type': 'GeoCoordinates',
      latitude: Number(school.latitude),
      longitude: Number(school.longitude)
    } : undefined
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function updateSeo(school) {
  if (typeof document === 'undefined') return;
  document.title = `Stage de kitesurf à ${school.city} | Spotykite`;
  const description = `Découvrez les formules de kitesurf disponibles à ${school.city}. Spotykite vous accompagne pour réserver votre stage en ligne.`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', description);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', `${window.location.origin}/ecole-kitesurf/${school.slug}`);
  document.querySelector('meta[name="robots"]')?.remove();
}

function categoryLabel(value) {
  return {
    initiation: 'Initiation',
    'stage-3-jours': 'Stage 3 jours',
    'stage-5-jours': 'Stage 5 jours',
    'cours-particulier': 'Cours particulier',
    progression: 'Progression',
    perfectionnement: 'Progression'
  }[value] || value || 'Formule';
}

function heroFormulaTitle(formula) {
  if (!formula) return 'Stage de kitesurf';
  const labels = {
    initiation: 'Initiation kitesurf',
    'stage-3-jours': 'Stage 3 jours',
    'stage-5-jours': 'Stage 5 jours',
    'cours-particulier': 'Cours particulier',
    progression: 'Progression',
    perfectionnement: 'Progression'
  };
  return labels[formula.category] || formula.name || 'Stage de kitesurf';
}

function hasValidCoordinates(school) {
  const lat = Number(school.latitude);
  const lng = Number(school.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function reservationUrl(school, formula) {
  if (!school?.id || !formula?.id) return '/reservation';
  return `/reservation?schoolId=${encodeURIComponent(school.id)}&offerId=${encodeURIComponent(formula.id)}`;
}

function nearbySchoolsUrl(school) {
  const params = new URLSearchParams();
  if (school?.city) params.set('city', school.city);
  if (school?.department) params.set('department', school.department);
  return `/ecoles?${params.toString()}`;
}

function rememberViewedSchool(school) {
  if (typeof window === 'undefined') return;
  const item = {
    id: school.id,
    slug: school.slug,
    name: publicSchoolTitle(school),
    city: school.city,
    region: school.region,
    spot: school.spot,
    startingPrice: school.startingPrice
  };
  const current = readLocalArray('recentlyViewedSchools');
  const next = [item, ...current.filter((schoolItem) => String(schoolItem.id) !== String(item.id))].slice(0, 5);
  window.localStorage.setItem('recentlyViewedSchools', JSON.stringify(next));
  window.dispatchEvent(new Event('spotykite-storage-update'));
}

function rememberCurrentBooking(school, formula) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('currentBooking', JSON.stringify({
    schoolId: school.id,
    schoolName: publicSchoolTitle(school),
    formulaId: formula.id,
    formulaName: formula.name,
    price: formula.price,
    reservationUrl: reservationUrl(school, formula)
  }));
  window.dispatchEvent(new Event('spotykite-storage-update'));
}

function readLocalArray(key) {
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function briefStepText(index) {
  return [
    'Rencontre avec l’équipe et validation des conditions.',
    'Règles de sécurité, météo et organisation de la séance.',
    'Aile, barre, harnais et planche expliqués simplement.',
    'Premiers gestes pour comprendre la traction.',
    'Passage progressif dans l’eau avec l’encadrement.',
    'Gestion de l’aile et premières glisses selon le niveau.',
    'Conseils en temps réel pour progresser avec confiance.',
    'Retour pédagogique et prochaines étapes de progression.'
  ][index];
}

function booleanInfo(value, Icon, title, text) {
  return value === true ? [Icon, title, text] : null;
}

function splitIncluded(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}
