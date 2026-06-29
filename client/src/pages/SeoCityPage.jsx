import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/mapbox';
import { ChevronDown, Gift, MapPin, School, Search, X } from 'lucide-react';
import { api } from '../api.js';
import SchoolCard from '../components/SchoolCard.jsx';
import { publicSchoolLocation, publicSchoolTitle } from '../utils/schoolDisplay.js';

const formulaTypes = [
  ['initiation', 'Initiation kitesurf'],
  ['stage-3-jours', 'Stage 3 jours'],
  ['stage-5-jours', 'Stage 5 jours'],
  ['cours-particulier', 'Cours particulier'],
  ['progression', 'Progression']
];
const priceOptions = [
  ['100', 'Jusqu’à 100 €'],
  ['200', 'Jusqu’à 200 €'],
  ['300', 'Jusqu’à 300 €'],
  ['500', 'Jusqu’à 500 €']
];

export default function SeoCityPage() {
  const params = useParams();
  const location = useLocation();
  const seoCityPath = params.seoCityPath || params.slug || location.pathname.replace(/^\/+/, '');
  const isSeoCityPath = String(seoCityPath).startsWith('stage-kitesurf-');
  const slug = normalizeSeoCitySlug(seoCityPath);
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    if (!isSeoCityPath) {
      setPage(null);
      setStatus('error');
      return () => {
        active = false;
      };
    }
    setStatus('loading');
    const request = preview ? api.seoCityPage(slug) : api.publicSeoCityPage(slug);
    request
      .then((data) => {
        if (!active) return;
        setPage(data);
        setStatus('ready');
        applySeoMeta(data);
      })
      .catch(() => {
        if (!active) return;
        setPage(null);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [slug, preview, isSeoCityPath]);

  const schools = page?.schools || [];
  const minPrice = page?.computedMinPrice || minPriceFromSchools(schools);
  const jsonLd = useMemo(() => page ? seoCityJsonLd(page, schools) : null, [page, schools]);

  if (status === 'loading') {
    return <main className="section"><p className="font-black text-muted">Chargement...</p></main>;
  }

  if (status === 'error' || !page) {
    return (
      <main className="section">
        <h1 className="text-5xl font-black text-navy">Page introuvable</h1>
        <Link className="btn-primary mt-5" to="/stages">Voir les stages disponibles</Link>
      </main>
    );
  }

  return (
    <main className="bg-bg">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      {page.preview && (
        <div className="bg-primary px-4 py-3 text-center text-sm font-black text-navy">
          Prévisualisation backoffice - cette page n’est pas nécessairement publiée.
        </div>
      )}

      <section className="bg-navy px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="eyebrow">Spotykite local</p>
            <h1 className="text-6xl font-black leading-none text-white sm:text-7xl">{page.h1 || `Stage de kitesurf à ${page.city}`}</h1>
            <p className="mt-5 max-w-3xl text-xl font-bold text-white/82">
              Trouvez une école de kitesurf à {page.city} ou à proximité et réservez votre stage facilement.
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
            <p className="text-sm font-black uppercase tracking-widest text-primary">Réserver rapidement</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link className="btn-primary justify-center" to={`/stages?q=${encodeURIComponent(page.city)}`}><Search size={18} /> Voir les stages</Link>
              <Link className="btn-secondary justify-center" to="/offrir"><Gift size={18} /> Offrir une carte cadeau</Link>
            </div>
          </div>
        </div>
      </section>

      <SeoSchoolsListingBlock page={page} schools={schools} />

      <section className="section">
        <div className="rounded-[2rem] border border-turquoise/25 bg-white p-6 shadow-sm sm:p-8">
          <p className="eyebrow">En résumé</p>
          <h2 className="text-5xl font-black text-navy">Stage de kitesurf à {page.city} : les informations clés</h2>
          <dl className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              ['Région', page.region],
              ['Département', page.department],
              ['Niveau conseillé', page.recommendedLevel],
              ['Meilleure période', page.idealPeriod],
              ['Fourchette de prix', page.priceRange || (minPrice ? `À partir de ${minPrice} €` : 'Selon les écoles disponibles')],
              ['Types de stages', 'Initiation, stage plusieurs jours, perfectionnement, cours particulier'],
              ['Temps moyen d’apprentissage', 'Variable selon le vent, la fréquence des séances et l’aisance dans l’eau'],
              ['Spots principaux', (page.nearbySpots || []).join(', ')],
              ['Vent dominant', page.destinationSummary?.includes('Tramontane') ? 'Tramontane, vent marin selon les conditions' : 'Selon les conditions locales']
            ].filter(([, value]) => value).map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-bg p-4">
                <dt className="text-xs font-black uppercase text-muted">{label}</dt>
                <dd className="mt-1 font-black text-navy">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <SeoTextSection title={`Pourquoi faire un stage de kitesurf à ${page.city} ?`} text={page.sections?.why} />
      <SeoTextSection title={`Les meilleurs spots de kitesurf autour de ${page.city}`} text={page.sections?.spots} />
      <SeoTextSection title="Quel stage choisir ?" text={page.sections?.choose} />
      <SeoTextSection title="À qui s’adresse un stage de kitesurf ?" text={page.sections?.audience} />
      <SeoTextSection title={`Où apprendre le kitesurf autour de ${page.city} ?`} text={page.sections?.around} schools={schools} />
      <SeoTextSection title="Quel niveau pour commencer ?" text={page.sections?.level} />
      <SeoTextSection title={`Combien coûte un stage de kitesurf à ${page.city} ?`} text={priceText(page.sections?.price, minPrice)} />
      <SeasonSection text={page.sections?.period} />
      <SeoTextSection title="Pourquoi réserver sur Spotykite ?" text={page.sections?.whySpotykite} />
      <SeoTextSection title="Comment se déroule un premier cours ?" text={page.sections?.firstLesson} />

      <section className="section">
        <div className="rounded-[2rem] bg-navy p-7 text-white sm:p-10">
          <p className="eyebrow">Carte cadeau</p>
          <h2 className="text-5xl font-black text-white">Offrir un stage de kitesurf à {page.city}</h2>
          <p className="mt-4 max-w-3xl text-lg font-bold text-white/80">{page.sections?.gift}</p>
          <Link className="btn-primary mt-6" to="/offrir"><Gift size={18} /> Offrir une carte cadeau</Link>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">FAQ locale</p>
        <h2 className="text-5xl font-black text-navy">Questions fréquentes sur le kitesurf à {page.city}</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {(page.faq || []).map((item) => (
            <details key={item.question} className="rounded-2xl border border-border bg-white p-5">
              <summary className="cursor-pointer text-lg font-black text-navy">{item.question}</summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

function SeasonSection({ text }) {
  const seasons = [
    ['Printemps', 'Temps plus doux, reprises progressives selon les conditions', 'Modérée hors vacances et week-ends', 'Débutant encadré à confirmé'],
    ['Été', 'Températures agréables, sessions à organiser selon vent et affluence', 'Plus élevée sur le littoral', 'Débutant tôt/journées encadrées, progression'],
    ['Automne', 'Conditions souvent intéressantes, eau encore relativement douce au début', 'Plus calme qu’en été', 'Progression et pratiquants réguliers'],
    ['Hiver', 'Météo plus fraîche, créneaux plus techniques', 'Faible', 'Confirmé ou très encadré selon écoles']
  ];
  return (
    <section className="section">
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-5xl font-black text-navy">Quand pratiquer le kitesurf à Leucate ?</h2>
        <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-muted">{text}</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-sky/60 text-xs uppercase text-muted">
              <tr>{['Saison', 'Météo', 'Fréquentation', 'Niveau conseillé'].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr>
            </thead>
            <tbody>
              {seasons.map((row) => (
                <tr key={row[0]} className="border-b border-border">
                  {row.map((cell) => <td key={cell} className="px-4 py-4 font-bold text-text">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SeoSchoolsListingBlock({ page, schools }) {
  const [filters, setFilters] = useState({ city: page.city, spot: '', type: '', maxPrice: '' });
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedMapSchool, setSelectedMapSchool] = useState(null);
  const exactSchools = schools.filter((school) => school.matchType === 'city');
  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      if (filters.spot && !normalize([school.spot, school.city, school.name].join(' ')).includes(normalize(filters.spot))) return false;
      if (filters.type && !schoolMatchesType(school, filters.type)) return false;
      if (filters.maxPrice && Number(school.startingPrice || 0) > Number(filters.maxPrice)) return false;
      return true;
    });
  }, [schools, filters.spot, filters.type, filters.maxPrice]);
  const title = exactSchools.length ? `Les écoles de kitesurf à ${page.city}` : `Les écoles de kitesurf les plus proches de ${page.city}`;
  const activeFilters = [
    ['city', page.city],
    ['spot', filters.spot],
    ['type', filters.type ? optionLabel(formulaTypes, filters.type) : ''],
    ['maxPrice', filters.maxPrice ? `Jusqu’à ${filters.maxPrice} €` : '']
  ].filter(([, value]) => value);

  function update(name, value) {
    if (name === 'city') return;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <section className="section">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Écoles disponibles</p>
            <h2 className="text-5xl font-black text-navy">{title}</h2>
            <p className="mt-3 max-w-3xl text-lg font-bold text-muted">{page.intro}</p>
          </div>
          <button type="button" className="btn-secondary justify-center lg:hidden" onClick={() => setMapOpen(true)} disabled={!filteredSchools.length}>
            <MapPin size={18} /> Voir sur la carte
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-border bg-white px-4 py-3 shadow-lift">
          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-xs font-black uppercase tracking-[0.16em] text-muted">Affiner :</span>
              <LockedPill value={page.city} />
              <InputPill label="Les spots" value={filters.spot} onChange={(value) => update('spot', value)} />
              <FilterPill label="Les formules" value={filters.type} options={formulaTypes} onChange={(value) => update('type', value)} />
              <FilterPill label="Prix" value={filters.maxPrice} options={priceOptions} onChange={(value) => update('maxPrice', value)} />
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm font-black text-muted">
              <span className="shrink-0">Trier par :</span>
              <span className="inline-flex h-10 items-center rounded-full border border-border bg-bg px-4 text-navy">Pertinence</span>
            </div>
            <button type="button" className="btn-primary h-10 shrink-0 justify-center px-5" onClick={() => setMapOpen(true)} disabled={!filteredSchools.length}>
              <MapPin size={18} /> Voir sur la carte
            </button>
          </div>

          <div className="grid gap-3 lg:hidden">
            <LockedPill value={page.city} />
            <InputPill label="Les spots" value={filters.spot} onChange={(value) => update('spot', value)} />
            <FilterPill label="Les formules" value={filters.type} options={formulaTypes} onChange={(value) => update('type', value)} />
            <FilterPill label="Prix" value={filters.maxPrice} options={priceOptions} onChange={(value) => update('maxPrice', value)} />
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="mr-1 shrink-0 text-xs font-black uppercase tracking-[0.16em] text-muted">Votre sélection :</span>
            {activeFilters.map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => key !== 'city' && update(key, '')}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-black ${key === 'city' ? 'border-primary/35 bg-primary/20 text-navy' : 'border-turquoise/35 bg-sky text-navy'}`}
              >
                {key !== 'city' && <X size={14} />} {value}
              </button>
            ))}
            <span className="ml-auto shrink-0 text-sm font-black text-ocean">{filteredSchools.length} résultat{filteredSchools.length > 1 ? 's' : ''} disponible{filteredSchools.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-black">{filteredSchools.length} école{filteredSchools.length > 1 ? 's' : ''} trouvée{filteredSchools.length > 1 ? 's' : ''}</h3>
          <Link className="btn-secondary justify-center" to="/offrir"><Gift size={18} /> Offrir une carte cadeau</Link>
        </div>

        {filteredSchools.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredSchools.map((school, index) => <SchoolCard key={school.id} school={school} index={index} />)}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <h3 className="text-2xl font-black text-navy">Aucune école disponible autour de {page.city}</h3>
            <p className="mt-2 text-muted">Aucun centre associé ou proche ne correspond aux filtres de cette page pour le moment.</p>
          </div>
        )}
      </div>
      {mapOpen && (
        <SchoolsMapModal
          schools={filteredSchools}
          selectedSchool={selectedMapSchool}
          onSelectSchool={setSelectedMapSchool}
          onClose={() => {
            setMapOpen(false);
            setSelectedMapSchool(null);
          }}
        />
      )}
    </section>
  );
}

function LockedPill({ value }) {
  return (
    <span className="inline-flex h-10 min-w-[138px] shrink-0 items-center rounded-full border border-primary/35 bg-primary/20 px-4 text-sm font-black text-navy">
      {value}
    </span>
  );
}

function FilterPill({ label, value, options, onChange }) {
  return (
    <label className="relative inline-flex h-10 min-w-[138px] shrink-0 items-center rounded-full border border-border bg-bg px-4 text-sm font-black text-navy transition hover:border-turquoise">
      <span className="pointer-events-none pr-7">{value ? optionLabel(options, value) : label}</span>
      <select className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionText = Array.isArray(option) ? option[1] : option;
          return <option key={optionValue} value={optionValue}>{optionText}</option>;
        })}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-4 text-ocean" />
    </label>
  );
}

function InputPill({ label, value, onChange }) {
  return (
    <label className="relative inline-flex h-10 min-w-[142px] shrink-0 items-center rounded-full border border-border bg-bg px-4 text-sm font-black text-navy transition focus-within:border-turquoise hover:border-turquoise">
      <input
        className="w-full bg-transparent pr-6 font-black outline-none placeholder:text-navy"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
      />
      <ChevronDown size={16} className="pointer-events-none absolute right-4 text-ocean" />
    </label>
  );
}

function SchoolsMapModal({ schools, selectedSchool, onSelectSchool, onClose }) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const validSchools = schools.filter(hasValidCoordinates);
  const initialSchool = validSchools[0];

  return (
    <div className="fixed inset-0 z-[1100] bg-navy/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Carte</p>
            <h2 className="text-2xl font-black text-navy">{schools.length} école{schools.length > 1 ? 's' : ''} filtrée{schools.length > 1 ? 's' : ''}</h2>
          </div>
          <button type="button" className="inline-grid h-11 w-11 place-items-center rounded-full border border-border bg-bg text-navy" onClick={onClose} aria-label="Fermer la carte">
            <X size={22} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {!token || !initialSchool ? (
            <div className="grid h-full place-items-center p-8 text-center">
              <p className="text-2xl font-black text-navy">{!token ? 'Carte temporairement indisponible' : 'Aucune école à afficher sur la carte'}</p>
            </div>
          ) : (
            <Map
              mapboxAccessToken={token}
              initialViewState={{
                longitude: Number(initialSchool.longitude),
                latitude: Number(initialSchool.latitude),
                zoom: validSchools.length > 1 ? 5.4 : 8
              }}
              mapStyle="mapbox://styles/mapbox/light-v11"
              style={{ width: '100%', height: '100%' }}
              onLoad={(event) => fitMapToSchools(event.target, validSchools)}
            >
              <NavigationControl position="top-right" showCompass={false} />
              {validSchools.map((school) => (
                <Marker key={school.id} longitude={Number(school.longitude)} latitude={Number(school.latitude)} anchor="bottom">
                  <button type="button" className="spotykite-map-marker" onClick={() => onSelectSchool(school)} aria-label={`Afficher ${publicSchoolTitle(school)}`}>
                    <MapPin size={22} className="fill-current" />
                  </button>
                </Marker>
              ))}
              {selectedSchool && hasValidCoordinates(selectedSchool) && (
                <Popup
                  longitude={Number(selectedSchool.longitude)}
                  latitude={Number(selectedSchool.latitude)}
                  anchor="top"
                  offset={[0, 18]}
                  closeOnClick={false}
                  onClose={() => onSelectSchool(null)}
                  className="spotykite-map-popup"
                >
                  <div className="min-w-[230px] text-text">
                    <h3 className="text-xl font-black leading-tight text-navy">{publicSchoolTitle(selectedSchool)}</h3>
                    <p className="mt-1 text-sm font-bold text-ocean">{publicSchoolLocation(selectedSchool)}</p>
                    <p className="mt-3 text-sm font-black text-primary">{selectedSchool.startingPrice ? `À partir de ${selectedSchool.startingPrice} €` : 'Prix sur demande'}</p>
                  </div>
                </Popup>
              )}
            </Map>
          )}
        </div>
      </div>
    </div>
  );
}

function SeoTextSection({ title, text, schools }) {
  return (
    <section className="section">
      <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-5xl font-black text-navy">{title}</h2>
        <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-muted">{text}</p>
        {schools?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {schools.slice(0, 6).map((school) => <span key={school.id} className="rounded-full bg-sky px-4 py-2 text-sm font-black text-ocean">{publicSchoolTitle(school)}</span>)}
          </div>
        )}
      </div>
    </section>
  );
}

function applySeoMeta(page) {
  document.title = page.metaTitle;
  setMeta('description', page.metaDescription);
  setMeta('og:title', page.metaTitle, 'property');
  setMeta('og:description', page.metaDescription, 'property');
  setMeta('og:type', 'website', 'property');
  setMeta('og:url', window.location.href, 'property');
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', page.metaTitle);
  setMeta('twitter:description', page.metaDescription);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', `${window.location.origin}/stage-kitesurf-${page.slug}`);
}

function setMeta(name, content, attr = 'name') {
  let meta = document.querySelector(`meta[${attr}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content || '');
}

function seoCityJsonLd(page, schools) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: page.h1,
      areaServed: [page.city, page.department, page.region].filter(Boolean).join(', '),
      url: `${window.location.origin}/stage-kitesurf-${page.slug}`,
      geo: page.latitude && page.longitude ? { '@type': 'GeoCoordinates', latitude: Number(page.latitude), longitude: Number(page.longitude) } : undefined,
      makesOffer: schools.map((school) => ({ '@type': 'Offer', name: publicSchoolTitle(school), url: `${window.location.origin}/ecole-kitesurf/${school.slug}` }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: window.location.origin },
        { '@type': 'ListItem', position: 2, name: 'Stages de kitesurf', item: `${window.location.origin}/stages` },
        { '@type': 'ListItem', position: 3, name: page.h1, item: `${window.location.origin}/stage-kitesurf-${page.slug}` }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (page.faq || []).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    }
  ];
}

function minPriceFromSchools(schools) {
  const prices = schools.map((school) => Number(school.startingPrice)).filter(Boolean);
  return prices.length ? Math.min(...prices) : null;
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function optionLabel(options, value) {
  const option = options.find((item) => String(Array.isArray(item) ? item[0] : item) === String(value));
  return Array.isArray(option) ? option[1] : option || value;
}

function schoolMatchesType(school, type) {
  const haystack = normalize([
    school.category,
    school.type,
    school.formulaTypes,
    school.presentationBadges,
    school.presentation_badges,
    school.description
  ].flat().join(' '));
  if (!haystack) return true;
  return haystack.includes(normalize(type)) || haystack.includes(normalize(optionLabel(formulaTypes, type)));
}

function hasValidCoordinates(school) {
  return Number.isFinite(Number(school?.latitude)) && Number.isFinite(Number(school?.longitude));
}

function fitMapToSchools(map, schools) {
  if (!map || !schools.length) return;
  if (schools.length === 1) {
    map.easeTo({
      center: [Number(schools[0].longitude), Number(schools[0].latitude)],
      zoom: 8,
      duration: 500
    });
    return;
  }

  const bounds = schools.reduce((acc, school) => {
    const lng = Number(school.longitude);
    const lat = Number(school.latitude);
    return [
      [Math.min(acc[0][0], lng), Math.min(acc[0][1], lat)],
      [Math.max(acc[1][0], lng), Math.max(acc[1][1], lat)]
    ];
  }, [[Number(schools[0].longitude), Number(schools[0].latitude)], [Number(schools[0].longitude), Number(schools[0].latitude)]]);

  map.fitBounds(bounds, { padding: 80, maxZoom: 8, duration: 500 });
}

function priceText(text, minPrice) {
  if (!minPrice) return text;
  return `${text}\n\nPrix minimum actuellement calculé depuis les offres disponibles : à partir de ${minPrice} €.`;
}

function normalizeSeoCitySlug(value) {
  return String(value || '')
    .replace(/^\/+/, '')
    .replace(/^stage-kitesurf-/, '')
    .split('?')[0]
    .replace(/\/$/, '');
}
