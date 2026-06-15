import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../api.js';
import SchoolCard from '../components/SchoolCard.jsx';
import Loading from '../components/Loading.jsx';

const regions = ['Bretagne', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'PACA', 'Pays de la Loire', 'Hauts-de-France', 'Corse', 'Outre-mer'];
const formulaTypes = [
  ['initiation', 'Initiation kitesurf'],
  ['stage-3-jours', 'Stage 3 jours'],
  ['stage-5-jours', 'Stage 5 jours'],
  ['cours-particulier', 'Cours particulier'],
  ['progression', 'Progression']
];

export default function Listings({ seoType = null }) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    region: searchParams.get('region') ? fromSlug(searchParams.get('region')) : '',
    department: searchParams.get('department') ? fromSlug(searchParams.get('department')) : '',
    city: searchParams.get('city') ? fromSlug(searchParams.get('city')) : '',
    type: searchParams.get('type') || ''
  });

  const seoZone = useMemo(() => params.region || params.departement || params['ville-ou-spot'] || '', [params]);
  const title = seoZone
    ? `Stage de kitesurf ${displayZone(seoZone)}`
    : filters.type
      ? `Écoles proposant ${typeLabel(filters.type)}`
      : 'Trouvez une école de kitesurf en France';

  useEffect(() => {
    const next = { ...filters };
    if (seoType === 'region') next.region = displayZone(seoZone);
    if (seoType === 'departement') next.department = displayZone(seoZone);
    if (seoType === 'spot') next.city = displayZone(seoZone);
    setLoading(true);
    api.searchSchools(next)
      .then(setSchools)
      .finally(() => setLoading(false));
  }, [seoType, seoZone, filters.q, filters.region, filters.department, filters.city, filters.type]);

  function update(name, value) {
    const next = { ...filters, [name]: value };
    setFilters(next);
    setSearchParams(Object.fromEntries(Object.entries(next).filter(([, item]) => item).map(([key, item]) => [key, key === 'q' ? item : slugify(item)])));
  }

  function submit(event) {
    event.preventDefault();
    update('q', filters.q);
  }

  return (
    <main>
      <section className="border-b border-border bg-gradient-to-br from-sky via-white to-sand px-4 py-12 text-text sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow text-primary">Écoles Spotykite</p>
          <h1 className="max-w-4xl text-4xl font-black sm:text-6xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-muted">
            Réservez une formule dans une école référencée par Spotykite. Les résultats affichent les écoles disponibles, avec le prix à partir de la formule la moins chère.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="h-fit rounded-3xl border border-border bg-white p-5 shadow-lift">
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
              <button className="btn-secondary justify-center" type="button" onClick={() => {
                setFilters({ q: '', region: '', department: '', city: '', type: '' });
                setSearchParams({});
              }}>Réinitialiser</button>
            </form>
          </aside>

          <div>
            <div className="mb-5">
              <h2 className="text-2xl font-black">{schools.length} école{schools.length > 1 ? 's' : ''} trouvée{schools.length > 1 ? 's' : ''}</h2>
              <p className="text-sm text-muted">Chaque fiche école présente ses formules, son spot et ses hébergements recommandés.</p>
            </div>
            {loading ? <Loading /> : (
              schools.length ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {schools.map((school) => <SchoolCard key={school.id} school={school} />)}
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
    </main>
  );
}

function Filter({ label, value, options, onChange, rawValue = false }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Toute la France</option>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
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
