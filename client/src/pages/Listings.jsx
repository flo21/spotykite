import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/mapbox';
import { ChevronDown, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../api.js';
import SchoolCard from '../components/SchoolCard.jsx';
import Loading from '../components/Loading.jsx';
import { publicSchoolLocation, publicSchoolTitle } from '../utils/schoolDisplay.js';

const regions = ['Bretagne', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'PACA', 'Pays de la Loire', 'Hauts-de-France', 'Corse', 'Outre-mer'];
const formulaTypes = [
  ['initiation', 'Initiation kitesurf'],
  ['stage-3-jours', 'Stage 3 jours'],
  ['stage-5-jours', 'Stage 5 jours'],
  ['cours-particulier', 'Cours particulier'],
  ['progression', 'Progression']
];
const durationOptions = ['1 séance', '2 jours', '3 jours', '5 jours'];
const priceOptions = [
  ['100', 'Jusqu’à 100 €'],
  ['200', 'Jusqu’à 200 €'],
  ['300', 'Jusqu’à 300 €'],
  ['500', 'Jusqu’à 500 €']
];

export default function Listings({ seoType = null }) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedMapSchool, setSelectedMapSchool] = useState(null);
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    region: searchParams.get('region') ? fromSlug(searchParams.get('region')) : '',
    department: searchParams.get('department') ? fromSlug(searchParams.get('department')) : '',
    city: searchParams.get('city') ? fromSlug(searchParams.get('city')) : '',
    type: searchParams.get('type') || '',
    duration: searchParams.get('duration') || '',
    maxPrice: searchParams.get('maxPrice') || ''
  });

  const seoZone = useMemo(() => params.region || params.departement || params['ville-ou-spot'] || '', [params]);
  useEffect(() => {
    const next = { ...filters };
    if (seoType === 'region') next.region = displayZone(seoZone);
    if (seoType === 'departement') next.department = displayZone(seoZone);
    if (seoType === 'spot') next.city = displayZone(seoZone);
    setLoading(true);
    api.searchSchools(next)
      .then(setSchools)
      .finally(() => setLoading(false));
  }, [seoType, seoZone, filters.q, filters.region, filters.department, filters.city, filters.type, filters.duration, filters.maxPrice]);

  function update(name, value) {
    const next = { ...filters, [name]: value };
    setFilters(next);
    setSearchParams(Object.fromEntries(Object.entries(next).filter(([, item]) => item).map(([key, item]) => [
      key,
      ['q', 'type', 'duration', 'maxPrice'].includes(key) ? item : slugify(item)
    ])));
  }

  function submit(event) {
    event.preventDefault();
    update('q', filters.q);
  }

  function resetFilters() {
    setFilters({ q: '', region: '', department: '', city: '', type: '', duration: '', maxPrice: '' });
    setSearchParams({});
  }

  const activeFilters = [
    ['region', filters.region],
    ['department', filters.department],
    ['city', filters.city],
    ['type', filters.type ? typeLabel(filters.type) : ''],
    ['duration', filters.duration],
    ['maxPrice', filters.maxPrice ? `Jusqu’à ${filters.maxPrice} €` : '']
  ].filter(([, value]) => value);

  return (
    <main>
      <section className="section pt-8">
        <div className="mx-auto max-w-7xl">
          <aside className="mb-6 h-fit rounded-3xl border border-border bg-white p-5 shadow-lift lg:hidden">
            <div className="mb-4 flex items-center gap-2 text-xl font-black"><SlidersHorizontal /> Recherche</div>
            <form onSubmit={submit} className="grid gap-3">
              <label className="grid gap-1 text-sm font-bold">Région, département, ville ou spot
                <div className="relative">
                  <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                  <input className="field pl-11" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Ex : Leucate, Bretagne..." />
                </div>
              </label>
              <Filter label="Région" value={filters.region} options={regions} onChange={(value) => update('region', value)} />
              <Filter label="Type de formule" value={filters.type} options={formulaTypes} onChange={(value) => update('type', value)} rawValue />
              <input className="field" placeholder="Département" value={filters.department} onChange={(event) => update('department', event.target.value)} />
              <input className="field" placeholder="Ville ou spot" value={filters.city} onChange={(event) => update('city', event.target.value)} />
              <button className="btn-primary justify-center" type="submit">Rechercher</button>
              <button className="btn-secondary justify-center" type="button" onClick={resetFilters}>Réinitialiser</button>
            </form>
          </aside>

          <div className="mb-5 rounded-2xl border border-border bg-white px-4 py-3 shadow-lift">
            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-xs font-black uppercase tracking-[0.16em] text-muted">Affiner :</span>
                <FilterPill label="Les régions" value={filters.region} options={regions} onChange={(value) => update('region', value)} />
                <InputPill label="Les spots" value={filters.city} onChange={(value) => update('city', value)} />
                <FilterPill label="Les formules" value={filters.type} options={formulaTypes} onChange={(value) => update('type', value)} />
                <FilterPill label="Prix" value={filters.maxPrice} options={priceOptions} onChange={(value) => update('maxPrice', value)} />
              </form>
              <div className="flex shrink-0 items-center gap-2 text-sm font-black text-muted">
                <span className="shrink-0">
                  Trier par :
                </span>
                <span className="inline-flex h-10 items-center rounded-full border border-border bg-bg px-4 text-navy">Pertinence</span>
              </div>
              <button type="button" className="btn-primary h-10 shrink-0 justify-center px-5" onClick={() => setMapOpen(true)}>
                <MapPin size={18} /> Voir sur la carte
              </button>
            </div>

            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="mr-1 shrink-0 text-xs font-black uppercase tracking-[0.16em] text-muted">Votre sélection :</span>
              {activeFilters.length ? activeFilters.map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update(key, '')}
                  className="inline-flex items-center gap-2 rounded-full border border-turquoise/35 bg-sky px-3 py-1.5 text-sm font-black text-navy"
                >
                  <X size={14} /> {value}
                </button>
              )) : (
                <span className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm font-black text-muted">Toute la France</span>
              )}
              <span className="ml-auto shrink-0 text-sm font-black text-ocean">{schools.length} résultat{schools.length > 1 ? 's' : ''} disponible{schools.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black">{schools.length} école{schools.length > 1 ? 's' : ''} trouvée{schools.length > 1 ? 's' : ''}</h2>
              <button type="button" className="btn-secondary justify-center lg:hidden" onClick={() => setMapOpen(true)}>
                <MapPin size={18} /> Voir sur la carte
              </button>
            </div>
            {loading ? <Loading /> : (
              schools.length ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {schools.map((school, index) => <SchoolCard key={school.id} school={school} index={index} />)}
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <h3 className="text-2xl font-black text-navy">Aucune école trouvée</h3>
                  <p className="mt-2 text-muted">Essayez une autre région, un département voisin ou un spot plus large.</p>
                </div>
              )
            )}
          </div>
        </div>
      </section>
      {mapOpen && (
        <SchoolsMapModal
          schools={schools}
          selectedSchool={selectedMapSchool}
          onSelectSchool={setSelectedMapSchool}
          onClose={() => {
            setMapOpen(false);
            setSelectedMapSchool(null);
          }}
        />
      )}
    </main>
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
          const label = Array.isArray(option) ? option[1] : option;
          return <option key={optionValue} value={optionValue}>{label}</option>;
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

function Filter({ label, value, options, onChange, placeholder = 'Toute la France', className = '' }) {
  return (
    <label className={`grid gap-1 text-sm font-bold ${className}`}>
      {label}
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function optionLabel(options, value) {
  const option = options.find((item) => String(Array.isArray(item) ? item[0] : item) === String(value));
  return Array.isArray(option) ? option[1] : option || value;
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

function hasValidCoordinates(school) {
  return Number.isFinite(Number(school?.latitude)) && Number.isFinite(Number(school?.longitude));
}

function displayZone(value) {
  return fromSlug(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fromSlug(value = '') {
  return String(value).replace(/-/g, ' ');
}

function slugify(value) {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function typeLabel(value) {
  return formulaTypes.find(([type]) => type === value)?.[1].toLowerCase() || value;
}
