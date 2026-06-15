import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeEuro, BedDouble, CreditCard, Gift, MapPin, Search, Sparkles, Trophy, Wind } from 'lucide-react';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/mapbox';
import heroKitesurf from '../assets/spotykite-hero-kitesurf.png';
import giftCardLagoonImage from '../assets/carte-cadeau-kitesurf-lagon.png';
import initiationImage from '../assets/initiation-kitesurf.png';
import stageThreeDaysImage from '../assets/stage-3-jours-kitesurf.png';
import stageFiveDaysImage from '../assets/stage-5-jours-kitesurf.png';
import privateLessonImage from '../assets/cours-particulier-kitesurf.png';
import improvementImage from '../assets/perfectionnement-kitesurf.png';
import { api } from '../api.js';

const departments = ['Tous les départements', 'Charente-Maritime', 'Finistère', 'Hérault', 'Bouches-du-Rhône'];
const franceView = { longitude: 2.2137, latitude: 46.2276, zoom: 5.2 };

const reassurance = [
  [BadgeEuro, 'Meilleur prix garanti'],
  [Trophy, 'Écoles sélectionnées'],
  [CreditCard, 'Paiement sécurisé'],
  [Gift, 'Carte cadeau valable 1 an'],
  [BedDouble, 'Hébergements recommandés']
];

const stageTypeCards = [
  {
    title: 'Initiation kitesurf',
    text: 'Découvrez les bases du kitesurf dans une école Spotykite.',
    price: 'À partir de 89 €',
    cta: 'Voir les écoles d’initiation',
    href: '/ecoles?type=initiation',
    icon: Sparkles,
    image: initiationImage
  },
  {
    title: 'Stage 3 jours',
    text: 'Une formule idéale pour progresser rapidement sur plusieurs séances.',
    price: 'À partir de 249 €',
    cta: 'Voir les stages 3 jours',
    href: '/ecoles?type=stage-3-jours',
    icon: Trophy,
    image: stageThreeDaysImage
  },
  {
    title: 'Stage 5 jours',
    text: 'Une immersion complète pour apprendre dans les meilleures conditions.',
    price: 'À partir de 399 €',
    cta: 'Voir les stages 5 jours',
    href: '/ecoles?type=stage-5-jours',
    icon: Wind,
    image: stageFiveDaysImage
  },
  {
    title: 'Cours particulier',
    text: 'Un accompagnement personnalisé avec un moniteur diplômé.',
    price: 'À partir de 89 €',
    cta: 'Voir les cours particuliers',
    href: '/ecoles?type=cours-particulier',
    icon: BadgeEuro,
    image: privateLessonImage
  },
  {
    title: 'Progression',
    text: 'Améliorez votre technique, votre autonomie et votre navigation.',
    price: 'À partir de 149 €',
    cta: 'Voir les écoles progression',
    href: '/ecoles?type=progression',
    icon: ArrowRight,
    image: improvementImage
  }
];

const faqItems = [
  ['Où faire un stage de kitesurf en France ?', 'Les régions les plus demandées sont la Bretagne, la Normandie, la Nouvelle-Aquitaine, l’Occitanie, les Hauts-de-France et la PACA. Spotykite vous aide à comparer les écoles par ville, spot et région.'],
  ['Combien coûte un stage de kitesurf ?', 'Le prix dépend de la durée et du format. Une formule courte peut commencer autour de 89 €, tandis qu’un stage de plusieurs jours coûte généralement davantage. Chaque fiche école affiche un prix à partir de.'],
  ['Peut-on offrir un stage de kitesurf ?', 'Oui. La carte cadeau Spotykite coûte 199 €, elle est valable 1 an et utilisable dans les écoles Spotykite.'],
  ['Comment choisir son école de kitesurf ?', 'Choisissez selon la localisation, le niveau accepté, les formules proposées, le prix et les informations pratiques du spot.'],
  ['L’hébergement est-il inclus ?', 'Non, Spotykite ne réserve pas l’hébergement en V1. Certaines fiches affichent simplement des hébergements recommandés et des codes promo éventuels.'],
  ['La carte cadeau est-elle valable partout en France ?', 'Oui, elle est utilisable dans les écoles Spotykite en France pendant 1 an.']
];

export default function Home() {
  const [department, setDepartment] = useState(departments[0]);
  const [regionStats, setRegionStats] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [searchLocation, setSearchLocation] = useState('');
  const [regionStatsStatus, setRegionStatsStatus] = useState('loading');
  const [contentBlocks, setContentBlocks] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    api.spotStats()
      .then((data) => {
        if (!active) return;
        setRegionStats((data.regions || []).filter((item) => Number(item.count) > 0));
        setRegionStatsStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setRegionStats([]);
        setRegionStatsStatus('error');
      });

    api.mapSchools()
      .then((data) => {
        if (!active) return;
        const nextSchools = (data || []).filter((school) => school.latitude && school.longitude);
        setSchools(nextSchools);
        setSelectedSchool(nextSchools[0] || null);
      })
      .catch(() => {
        if (!active) return;
        setSchools([]);
      });

    api.contentBlocks({ page: 'home' })
      .then((data) => {
        if (!active) return;
        setContentBlocks(contentMap(data));
      })
      .catch(() => {
        if (!active) return;
        setContentBlocks({});
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleSchools = (() => {
    if (!selectedRegion) return schools;
    return schools.filter((school) => school.region === selectedRegion);
  })();

  function reserveCenterStage() {
    const params = new URLSearchParams();
    if (searchLocation.trim()) params.set('q', searchLocation.trim());
    if (department !== 'Tous les départements') params.set('department', slugify(department));
    navigate(`/stages?${params.toString()}`);
  }

  return (
    <main>
      <Hero
        department={department}
        setDepartment={setDepartment}
        searchLocation={searchLocation}
        setSearchLocation={setSearchLocation}
        onSearch={reserveCenterStage}
        content={contentBlocks}
      />

      <GiftCardSection content={contentBlocks} />

      <StageTypesSection />

      <SchoolsMapSection
        regionStats={regionStats}
        regionStatsStatus={regionStatsStatus}
        selectedRegion={selectedRegion}
        selectedSchool={selectedSchool}
        schools={visibleSchools}
        allSchools={schools}
        onRegionSelect={(region) => {
          setSelectedRegion(region);
          const first = schools.find((school) => school.region === region);
          setSelectedSchool(first || null);
        }}
        onSchoolSelect={setSelectedSchool}
        onResetRegion={() => {
          setSelectedRegion('');
          setSelectedSchool(schools[0] || null);
        }}
      />

      <ReassuranceSection />

      <WhySpotykiteSection content={contentBlocks} />

      <SeoFaqSection />
    </main>
  );
}

function Hero({ department, setDepartment, searchLocation, setSearchLocation, onSearch, content = {} }) {
  return (
    <section className="relative min-h-[640px] overflow-hidden bg-navy text-white xl:h-screen xl:min-h-[680px]">
      <img
        src={heroKitesurf}
        alt="Kitesurfeur en action sur une mer turquoise"
        className="absolute inset-0 h-full w-full object-cover object-[68%_50%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,36,61,0.88)_0%,rgba(6,36,61,0.64)_39%,rgba(6,36,61,0.14)_67%,rgba(6,36,61,0.20)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-navy/45 to-transparent" />

      <div className="relative mx-auto flex min-h-[640px] max-w-[1540px] flex-col justify-end px-5 pb-5 pt-10 sm:px-10 lg:px-16 lg:pb-[80px] lg:pt-14 xl:min-h-[680px]">
        <div className="mx-auto mb-[30px] max-w-[1180px] text-center">
          <h1 className="font-['Bebas_Neue','Anton','Oswald',sans-serif] text-4xl font-semibold uppercase leading-none tracking-[0.02em] text-white sm:text-5xl lg:whitespace-nowrap lg:text-[3.6rem] xl:text-[4rem]">
            {contentValue(content, 'hero', 'title', 'Vivez le kitesurf partout en France')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-bold text-white/86 sm:text-lg">
            {contentValue(content, 'hero', 'subtitle', 'Recherchez une école Spotykite, choisissez une formule ou offrez une carte cadeau valable sur tout le réseau Spotykite.')}
          </p>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <div className="rounded-[1.2rem] border border-white/55 bg-white/95 p-4 text-text shadow-lift backdrop-blur">
            <h2 className="text-xl font-black leading-tight text-navy sm:text-2xl">Trouver un stage de kitesurf</h2>
            <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-1 rounded-xl border border-border bg-white px-3 py-2 text-[10px] font-black text-muted shadow-sm">
                Région, département, ville ou spot
                <span className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-navy">
                  <Search size={16} />
                  <input className="bg-transparent font-bold outline-none" value={searchLocation} onChange={(event) => setSearchLocation(event.target.value)} placeholder="Leucate, Bretagne..." />
                </span>
              </label>
              <label className="grid gap-1 rounded-xl border border-border bg-white px-3 py-2 text-[10px] font-black text-muted shadow-sm">
                Département optionnel
                <span className="grid grid-cols-[1fr_auto] items-center text-xs text-navy">
                  <select className="w-full appearance-none bg-transparent font-bold outline-none" value={department} onChange={(event) => setDepartment(event.target.value)}>
                    {departments.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <ArrowRight size={18} className="rotate-90" />
                </span>
              </label>
              <button onClick={onSearch} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-black text-navy transition hover:bg-primaryHover">
                Go <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/55 bg-white/95 p-4 text-text shadow-lift backdrop-blur">
            <h2 className="text-xl font-black leading-tight text-navy sm:text-2xl">Offrir une carte cadeau</h2>
            <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-1 rounded-xl border border-border bg-white px-3 py-2 text-[10px] font-black text-muted shadow-sm">
                Carte cadeau Spotykite
                <span className="text-xs font-bold text-navy">199 € · valable 1 an · utilisable partout en France</span>
              </div>
              <Link to="/carte-cadeau" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-black text-navy transition hover:bg-primaryHover">
                Go <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GiftCardSection({ content = {} }) {
  const image = contentValue(content, 'gift', 'image', giftCardLagoonImage);

  return (
    <section className="section">
      <div className="grid overflow-hidden rounded-[2rem] border border-border bg-navy text-white shadow-lift lg:grid-cols-[0.95fr_1.05fr]">
        <div className="grid content-center gap-5 p-6 sm:p-8 lg:p-10">
          <p className="eyebrow text-primary">CARTE CADEAU SPOTYKITE</p>
          <div className="gift-price-inline">
            <span className="stage-type-price-badge">199 € · Valable 1 an</span>
          </div>
          <h2 className="text-5xl font-black leading-none text-white sm:text-6xl">{contentValue(content, 'gift', 'title', 'Offrir un stage de kitesurf')}</h2>
          <p className="text-xl font-black text-white">{contentValue(content, 'gift', 'subtitle', 'Le cadeau idéal pour découvrir le kitesurf partout en France.')}</p>
          <p className="max-w-xl text-white/78">{contentValue(content, 'gift', 'text', 'Offrez une carte cadeau valable 1 an dans les écoles Spotykite.')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/carte-cadeau" className="btn-primary justify-center">
              <Gift size={18} /> Offrir une carte cadeau
            </Link>
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white/82">Carte cadeau numérique envoyée par e-mail.</span>
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden">
          <img src={image} alt="Kitesurfeur naviguant dans un lagon turquoise vu du ciel" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/30 via-transparent to-navy/20" />
        </div>
      </div>
    </section>
  );
}

function StageTypesSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalSlides = stageTypeCards.length;

  function previous() {
    setCurrentIndex((current) => (current - 1 + totalSlides) % totalSlides);
  }

  function next() {
    setCurrentIndex((current) => (current + 1) % totalSlides);
  }

  return (
    <section className="overflow-hidden bg-white px-4 pb-16 sm:px-6 lg:pb-24">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 text-center">
          <div>
            <p className="eyebrow">Types de stages</p>
            <h2 className="text-5xl font-black uppercase leading-none text-navy sm:text-6xl">CHOISISSEZ VOTRE STAGE DE KITESURF</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg font-bold text-muted">
              Initiation, progression ou cours particulier : trouvez l’école adaptée à votre niveau.
            </p>
          </div>
        </div>

        <div className="stage-carousel">
          <button type="button" onClick={previous} className="stage-carousel-arrow stage-carousel-arrow-desktop stage-carousel-arrow-left" aria-label="Stage précédent">
            <ArrowRight size={24} className="rotate-180" />
          </button>
          <button type="button" onClick={next} className="stage-carousel-arrow stage-carousel-arrow-desktop stage-carousel-arrow-right" aria-label="Stage suivant">
            <ArrowRight size={24} />
          </button>

          <div className="stage-carousel-viewport">
            <div className="stage-carousel-track" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
              {stageTypeCards.map((card) => (
                <div className="stage-carousel-slide" key={card.href}>
                  <Link to={card.href} className="stage-offer-card group border border-white/10 bg-[#062B49] text-white shadow-lift no-underline transition hover:bg-[#07375e]">
                    <div className="stage-type-card-content grid h-full content-between gap-8">
                      <div>
                        <span className="stage-type-price-badge">{card.price}</span>
                        <h3 className="stage-card-title mt-8 text-4xl font-black leading-none text-white sm:text-5xl lg:mt-10 lg:text-7xl">{card.title}</h3>
                        <p className="stage-card-description mt-6 max-w-lg text-base font-bold leading-relaxed text-white/78 sm:text-lg lg:mt-8 lg:text-xl">{card.text}</p>
                      </div>
                      <span className="stage-type-cta">
                        {card.cta} <ArrowRight size={17} />
                      </span>
                    </div>
                    <div className="stage-type-card-image">
                      <img src={card.image} alt={`${card.title} dans une école de kitesurf Spotykite`} className="transition duration-500 group-hover:scale-105" />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="stage-carousel-mobile-nav" aria-label="Navigation mobile des types de stages">
            <button type="button" onClick={previous} className="stage-carousel-mobile-arrow" aria-label="Stage précédent">
              <ArrowRight size={22} className="rotate-180" />
            </button>
            <div className="flex justify-center gap-2">
              {stageTypeCards.map((card, index) => (
                <button
                  key={card.href}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2.5 rounded-full transition ${currentIndex === index ? 'w-9 bg-ocean' : 'w-2.5 bg-ocean/25'}`}
                  aria-label={`Afficher ${card.title}`}
                />
              ))}
            </div>
            <button type="button" onClick={next} className="stage-carousel-mobile-arrow" aria-label="Stage suivant">
              <ArrowRight size={22} />
            </button>
          </div>

          <div className="stage-carousel-desktop-dots">
            {stageTypeCards.map((card, index) => (
              <button
                key={card.href}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-2.5 rounded-full transition ${currentIndex === index ? 'w-9 bg-ocean' : 'w-2.5 bg-ocean/25'}`}
                aria-label={`Afficher ${card.title}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SchoolsMapSection({ regionStats, regionStatsStatus, selectedRegion, selectedSchool, schools, allSchools, onRegionSelect, onSchoolSelect, onResetRegion }) {
  const regions = regionStats.length ? regionStats : fallbackRegionStats(allSchools);

  return (
    <section className="overflow-hidden border-y border-border bg-white">
      <div className="grid min-h-[650px] lg:h-[720px] lg:grid-cols-2">
        <div className="flex items-center bg-gradient-to-br from-navy via-[#0c3c60] to-ocean px-5 py-12 text-white sm:px-10 lg:px-16">
          <div className="w-full">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">ÉCOLES SPOTYKITE</p>
            <h2 className="mt-4 max-w-xl text-5xl font-black uppercase leading-none text-white sm:text-6xl xl:text-7xl">
              LE MEILLEUR CHOIX D’ÉCOLES DE KITESURF
            </h2>
            <p className="mt-5 max-w-lg text-base font-bold leading-relaxed text-white/78">
              Filtrez par région et trouvez rapidement une école sélectionnée par Spotykite près de votre spot préféré.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {regionStatsStatus === 'loading' && <p className="col-span-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white/75">Chargement des régions...</p>}
              {regionStatsStatus === 'error' && !regions.length && <p className="col-span-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white/75">Régions indisponibles</p>}
              {regions.map(({ region, count }) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => onRegionSelect(region)}
                  className={`flex min-h-14 items-center justify-between rounded-full border px-4 py-2 text-left text-sm font-black transition sm:text-base ${selectedRegion === region ? 'border-primary bg-primary text-navy' : 'border-white/22 bg-white/10 text-white hover:border-primary hover:bg-white/16'}`}
                >
                  <span className="truncate">{region}</span>
                  <span className={`ml-2 grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm ${selectedRegion === region ? 'bg-navy text-primary' : 'bg-turquoise text-navy'}`}>{count}</span>
                </button>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onResetRegion} className="btn-primary justify-center">Toutes les écoles</button>
              {selectedRegion && (
                <button type="button" onClick={onResetRegion} className="inline-flex min-h-12 items-center rounded-2xl border border-white/35 bg-white/10 px-5 py-3 font-black text-white transition hover:border-primary hover:text-primary">
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        <MapboxSchoolsMap schools={schools} selectedRegion={selectedRegion} selectedSchool={selectedSchool} onSchoolSelect={onSchoolSelect} />
      </div>
    </section>
  );
}

function MapboxSchoolsMap({ schools, selectedRegion, selectedSchool, onSchoolSelect }) {
  const mapRef = useRef(null);
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const validSchools = useMemo(() => schools.filter(hasValidCoordinates), [schools]);
  const mobileZoom = typeof window !== 'undefined' && window.innerWidth < 768 ? 4.6 : franceView.zoom;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;

    if (!selectedRegion || validSchools.length === 0) {
      map.flyTo({ center: [franceView.longitude, franceView.latitude], zoom: mobileZoom, duration: 700 });
      return;
    }

    if (validSchools.length === 1) {
      map.flyTo({
        center: [Number(validSchools[0].longitude), Number(validSchools[0].latitude)],
        zoom: 8,
        duration: 700
      });
      return;
    }

    const bounds = validSchools.reduce((acc, school) => {
      const lng = Number(school.longitude);
      const lat = Number(school.latitude);
      return [
        [Math.min(acc[0][0], lng), Math.min(acc[0][1], lat)],
        [Math.max(acc[1][0], lng), Math.max(acc[1][1], lat)]
      ];
    }, [[Number(validSchools[0].longitude), Number(validSchools[0].latitude)], [Number(validSchools[0].longitude), Number(validSchools[0].latitude)]]);

    map.fitBounds(bounds, { padding: 70, maxZoom: 8.5, duration: 700 });
  }, [validSchools, selectedRegion, token, mobileZoom]);

  if (!token) {
    return (
      <div className="spotykite-map-fallback">
        <div>
          <p className="text-3xl font-black text-navy">Carte temporairement indisponible</p>
          <p className="mt-2 max-w-md text-sm font-bold text-muted">Ajoutez `VITE_MAPBOX_TOKEN` pour afficher la carte interactive des écoles Spotykite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spotykite-mapbox">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{ ...franceView, zoom: mobileZoom }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        cooperativeGestures
      >
        <NavigationControl position="top-right" showCompass={false} />
        {validSchools.map((school) => (
          <Marker key={school.id} longitude={Number(school.longitude)} latitude={Number(school.latitude)} anchor="bottom">
            <button
              type="button"
              className="spotykite-map-marker"
              onClick={(event) => {
                event.preventDefault();
                onSchoolSelect(school);
              }}
              aria-label={`Afficher ${school.name}`}
            >
              <MapPin size={22} className="fill-current" />
            </button>
          </Marker>
        ))}

        {selectedSchool && hasValidCoordinates(selectedSchool) && (
          <Popup
            longitude={Number(selectedSchool.longitude)}
            latitude={Number(selectedSchool.latitude)}
            anchor="top"
            closeButton
            closeOnClick={false}
            onClose={() => onSchoolSelect(null)}
            className="spotykite-map-popup"
          >
            <div className="min-w-[220px] text-text">
              <h3 className="text-xl font-black leading-tight text-navy">{selectedSchool.name}</h3>
              <p className="mt-1 text-sm font-bold text-ocean">{selectedSchool.city} · {selectedSchool.region}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-sky/60 p-2">
                  <p className="text-[10px] font-black uppercase text-muted">À partir de</p>
                  <p className="font-black text-ocean">{selectedSchool.startingPrice ? `${selectedSchool.startingPrice} €` : 'Sur demande'}</p>
                </div>
                <div className="rounded-xl bg-sky/60 p-2">
                  <p className="text-[10px] font-black uppercase text-muted">Formules</p>
                  <p className="font-black text-ocean">{selectedSchool.activeFormulas || 0}</p>
                </div>
              </div>
              <Link to={`/ecole-kitesurf/${selectedSchool.slug}`} className="mt-3 inline-flex w-full justify-center rounded-xl bg-primary px-4 py-2 text-sm font-black text-navy transition hover:bg-primaryHover">
                Voir l'école
              </Link>
            </div>
          </Popup>
        )}
      </Map>
      {!validSchools.length && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
          <div className="rounded-3xl border border-border bg-white/90 p-6 shadow-lift">
            <p className="text-2xl font-black text-navy">Aucune école trouvée</p>
            <p className="mt-2 text-sm text-muted">Sélectionnez une autre région ou affichez toutes les écoles.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ReassuranceSection() {
  return (
    <section className="benefits-section w-full border-y border-border bg-white px-4 pt-8 sm:px-6 lg:pt-10">
      <div className="benefits-grid mx-auto max-w-7xl">
        {reassurance.map(([Icon, label]) => (
          <div key={label} className="benefit-item">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky text-ocean">
              <Icon size={26} />
            </div>
            <p className="mt-3 max-w-36 text-sm font-black leading-tight text-navy">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhySpotykiteSection({ content = {} }) {
  return (
    <section className="why-spotykite px-4 sm:px-6">
      <div className="mx-auto max-w-4xl text-center">
        <p className="eyebrow">Pourquoi Spotykite</p>
        <h2 className="text-5xl font-black leading-none text-navy sm:text-6xl">{contentValue(content, 'why', 'title', 'Pourquoi réserver votre stage de kitesurf avec Spotykite ?')}</h2>
        <p className="text-lg leading-relaxed text-muted">
          {contentValue(content, 'why', 'text', 'Spotykite référence des écoles de kitesurf sélectionnées partout en France pour vous aider à trouver facilement une formule adaptée à votre niveau, votre destination et votre budget.')}
        </p>
        <div className="why-spotykite-actions flex flex-wrap justify-center gap-3">
          <Link to="/stages" className="btn-primary justify-center">Voir les écoles</Link>
          <Link to="/faq" className="btn-secondary justify-center">Consulter la FAQ</Link>
        </div>
      </div>
    </section>
  );
}

function SeoFaqSection() {
  return (
    <section className="border-t border-border bg-white">
      <div className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>Stage de kitesurf en France</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {faqItems.map(([question, answer]) => (
            <details key={question} className="rounded-2xl border border-border bg-bg p-5">
              <summary className="cursor-pointer text-lg font-black text-navy">{question}</summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function fallbackRegionStats(schools) {
  const counts = schools.reduce((acc, school) => {
    acc[school.region] = (acc[school.region] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([region, count]) => ({ region, count })).sort((a, b) => a.region.localeCompare(b.region, 'fr'));
}

function hasValidCoordinates(school) {
  const lat = Number(school.latitude);
  const lng = Number(school.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function contentMap(blocks = []) {
  return blocks.reduce((acc, block) => {
    const section = block.sectionKey || block.section_key;
    const field = block.fieldKey || block.field_key;
    if (section && field) acc[`${section}.${field}`] = block.value;
    return acc;
  }, {});
}

function contentValue(content, section, field, fallback) {
  const value = content[`${section}.${field}`];
  return value === undefined || value === null || value === '' ? fallback : value;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
