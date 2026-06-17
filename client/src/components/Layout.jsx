import { Link, NavLink, Outlet } from 'react-router-dom';
import { CalendarCheck, ChevronDown, MapPin, Menu, Phone, ShoppingBag, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { publicSchoolLocation, publicSchoolTitle } from '../utils/schoolDisplay.js';

const levelItems = [
  ['Débutant', 'debutant'],
  ['Intermédiaire', 'intermediaire'],
  ['Confirmé', 'confirme']
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [recentlyViewedSchools, setRecentlyViewedSchools] = useState([]);
  const [activeMega, setActiveMega] = useState(null);
  const [mobileMega, setMobileMega] = useState(null);
  const [spotStats, setSpotStats] = useState({ regions: [], cities: [], stageTypes: [] });
  const [statsStatus, setStatsStatus] = useState('loading');
  const phoneNumber = import.meta.env.VITE_SPOTYKITE_PHONE || '+33184808080';

  useEffect(() => {
    let active = true;
    const refresh = () => {
      setStatsStatus((current) => current === 'ready' ? current : 'loading');
      api.spotStats()
        .then((data) => {
          if (!active) return;
          setSpotStats({
            regions: Array.isArray(data.regions) ? data.regions : [],
            cities: Array.isArray(data.cities) ? data.cities : [],
            stageTypes: Array.isArray(data.stageTypes) ? data.stageTypes : []
          });
          setStatsStatus('ready');
        })
        .catch(() => {
          if (!active) return;
          setSpotStats({ regions: [], cities: [], stageTypes: [] });
          setStatsStatus('error');
        });
    };

    refresh();
    window.addEventListener('focus', refresh);

    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    refreshMobileActionState();

    function onStorage() {
      refreshMobileActionState();
    }

    function onFocus() {
      refreshMobileActionState();
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    window.addEventListener('spotykite-storage-update', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('spotykite-storage-update', onStorage);
    };
  }, []);

  const stats = useMemo(() => ({
    regions: spotStats.regions.filter((item) => Number(item.count) > 0),
    cities: spotStats.cities.filter((item) => Number(item.count) > 0),
    stageTypes: spotStats.stageTypes.filter((item) => Number(item.count) > 0),
    totalStages: spotStats.stageTypes.reduce((total, item) => total + Number(item.count || 0), 0)
  }), [spotStats]);

  function closeMobile() {
    setOpen(false);
    setMobileMega(null);
  }

  function refreshMobileActionState() {
    setCurrentBooking(readStorageItem('currentBooking', null));
    setRecentlyViewedSchools(readStorageItem('recentlyViewedSchools', []));
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky inset-x-0 top-0 z-[1000] border-b border-white/10 bg-[#12385C] text-white shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between px-5 py-2.5 sm:px-10 lg:px-16">
          <Link to="/" className="flex items-center text-2xl font-black leading-none tracking-[0] text-white no-underline" aria-label="SpotyKite">
            SpotyKite
          </Link>

          <nav className="hidden items-center gap-4 text-sm font-black lg:flex">
            <DesktopMegaTrigger label="Les spots" active={activeMega === 'spots'} onOpen={() => setActiveMega('spots')} onClose={() => setActiveMega(null)}>
              <SpotsMegaMenu stats={stats} status={statsStatus} />
            </DesktopMegaTrigger>
            <DesktopMegaTrigger label="Les stages" active={activeMega === 'stages'} onOpen={() => setActiveMega('stages')} onClose={() => setActiveMega(null)}>
              <StagesMegaMenu stats={stats} status={statsStatus} />
            </DesktopMegaTrigger>
            <NavLink to="/carte-cadeau" className={({ isActive }) => (isActive ? 'text-primary' : 'text-white/85 hover:text-primary')}>
              Carte cadeau
            </NavLink>
            <NavLink to="/jai-une-carte-cadeau" className={({ isActive }) => (isActive ? 'text-primary' : 'text-white/85 hover:text-primary')}>
              J’ai une carte cadeau
            </NavLink>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <NavLink to="/faq" className={({ isActive }) => `px-2 text-sm font-black ${isActive ? 'text-primary' : 'text-white/85 hover:text-primary'}`}>
              FAQ
            </NavLink>
            <a href="tel:+33184808080" className="inline-grid h-9 w-9 place-items-center rounded-full border border-white/35 bg-white/5 text-white transition hover:border-primary hover:text-primary" aria-label="Telephone">
              <Phone size={14} />
            </a>
            <Link to="/admin" className="inline-grid h-9 w-9 place-items-center rounded-full border border-white/35 bg-white/5 text-white transition hover:border-primary hover:text-primary" aria-label="Compte">
              <User size={14} />
            </Link>
            <Link to="/offrir-un-stage" className="inline-flex min-h-9 items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-black text-navy transition hover:bg-primaryHover">
              <CalendarCheck size={15} />
              Offrir un stage de kitesurf
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <a href={`tel:${phoneNumber}`} className="inline-grid h-11 w-11 place-items-center rounded-full border border-turquoise/55 bg-white/10 text-white shadow-sm transition hover:border-primary hover:text-primary" aria-label="Appeler Spotykite">
              <Phone size={19} />
            </a>
            <button
              className="inline-grid h-11 w-11 place-items-center rounded-full border border-turquoise/55 bg-white/10 text-white shadow-sm transition hover:border-primary hover:text-primary"
              onClick={() => {
                refreshMobileActionState();
                setCartOpen((current) => !current);
                setOpen(false);
                setMobileMega(null);
              }}
              aria-label="Commande en cours et écoles consultées"
              type="button"
            >
              <ShoppingBag size={19} />
            </button>
            <button
              className="inline-grid h-11 w-11 place-items-center rounded-full border border-turquoise/55 bg-white/10 text-white shadow-sm transition hover:border-primary hover:text-primary"
              onClick={() => {
                setOpen(!open);
                setCartOpen(false);
              }}
              aria-label="Menu"
              type="button"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        {cartOpen && (
          <MobileCartDrawer
            currentBooking={currentBooking}
            recentlyViewedSchools={recentlyViewedSchools}
            onClose={() => setCartOpen(false)}
          />
        )}

        {open && (
          <div className="mobile-menu border-t border-white/12 bg-[#12385C] px-4 py-3 text-white shadow-[0_14px_24px_rgba(0,0,0,0.16)] lg:hidden">
            <div className="grid gap-3">
              <MobileMega label="Les spots" id="spots" current={mobileMega} setCurrent={setMobileMega}>
                <SpotsMegaMenu mobile stats={stats} status={statsStatus} onNavigate={closeMobile} />
              </MobileMega>
              <MobileMega label="Les stages" id="stages" current={mobileMega} setCurrent={setMobileMega}>
                <StagesMegaMenu mobile stats={stats} status={statsStatus} onNavigate={closeMobile} />
              </MobileMega>
              <Link to="/carte-cadeau" onClick={closeMobile} className="mobile-nav-link">Offrir une carte cadeau</Link>
              <Link to="/utiliser-carte-cadeau" onClick={closeMobile} className="mobile-nav-link">J'ai une carte cadeau</Link>
              <Link to="/faq" onClick={closeMobile} className="mobile-nav-link">FAQ</Link>
              <Link to="/offrir-un-stage" onClick={closeMobile} className="btn-primary justify-center">Offrir un stage de kitesurf</Link>
              <div className="my-5 rounded-2xl border border-white/12 bg-white/[0.08] px-4 py-4 text-center text-white">
                <div className="flex justify-center gap-1 text-[19px] leading-none text-[#FFC107]" aria-label="5 étoiles">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
                <p className="mt-2 text-sm text-white">
                  <strong>4,8/5</strong> <span className="font-normal text-white/75">sur 1247 avis clients</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      <Outlet />

      <footer className="border-t border-border bg-white px-4 py-10 text-text">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-4">
          <div>
            <div className="text-2xl font-black">SpotyKite</div>
            <p className="mt-3 text-sm text-muted">La plateforme pour reserver ou offrir une experience kitesurf en France.</p>
          </div>
          <div><b>Experience</b><p className="mt-2 text-sm text-muted">Baptemes, stages, coaching et week-ends kite.</p></div>
          <div><b>Confiance</b><p className="mt-2 text-sm text-muted">Moniteurs diplomes, materiel fourni, report meteo.</p></div>
          <div>
            <b>Informations</b>
            <Link to="/blog" className="mt-2 block text-sm text-muted hover:text-ocean">Blog</Link>
            <Link to="/cgv" className="mt-2 block text-sm text-muted hover:text-ocean">CGV</Link>
            <Link to="/admin" className="mt-2 block text-sm text-muted hover:text-ocean">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MobileCartDrawer({ currentBooking, recentlyViewedSchools, onClose }) {
  return (
    <div className="border-t border-white/12 bg-white px-4 py-4 text-navy shadow-[0_14px_24px_rgba(0,0,0,0.16)] lg:hidden">
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-ocean">Mes actions</p>
          <button type="button" onClick={onClose} className="inline-grid h-10 w-10 place-items-center rounded-full border border-border bg-bg text-navy" aria-label="Fermer le panneau">
            <X size={18} />
          </button>
        </div>

        <section className="border-b border-border pb-4">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted">Commande en cours</h2>
          {currentBooking ? (
            <div className="mt-3 rounded-2xl border border-border bg-bg p-4">
              <p className="font-black text-navy">{currentBooking.schoolName || 'Stage Spotykite'}</p>
              <p className="mt-1 text-sm font-bold text-ocean">{currentBooking.formulaName || 'Formule sélectionnée'}</p>
              <p className="mt-1 text-sm font-black text-navy">{currentBooking.price ? `${currentBooking.price} €` : 'Prix sur demande'}</p>
              <Link to={currentBooking.reservationUrl || '/reservation'} onClick={onClose} className="btn-primary mt-3 w-full justify-center text-sm">
                Reprendre ma réservation
              </Link>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-border bg-bg p-4 text-sm font-bold text-muted">Aucune commande en cours</p>
          )}
        </section>

        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted">Récemment consultés</h2>
          {recentlyViewedSchools.length ? (
            <div className="mt-3 grid gap-3">
              {recentlyViewedSchools.map((school) => (
                <div key={school.id || school.slug} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-border bg-bg p-4">
                  <div className="min-w-0">
                    <p className="truncate font-black text-navy">{publicSchoolTitle(school)}</p>
                    <p className="truncate text-sm font-bold text-ocean">{publicSchoolLocation(school).replace(' · ', ' / ')}</p>
                    <p className="mt-1 text-sm font-black text-navy">{school.startingPrice ? `À partir de ${school.startingPrice} €` : 'Prix sur demande'}</p>
                  </div>
                  <Link to={`/ecole-kitesurf/${school.slug}`} onClick={onClose} className="rounded-full border border-turquoise/45 bg-white px-4 py-2 text-sm font-black text-ocean">
                    Voir
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-border bg-bg p-4 text-sm font-bold text-muted">Aucune école consultée récemment</p>
          )}
        </section>
      </div>
    </div>
  );
}

function readStorageItem(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function DesktopMegaTrigger({ label, active, onOpen, onClose, children }) {
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button className={`flex items-center gap-1 py-4 font-bold ${active ? 'text-primary' : 'text-white/85 hover:text-primary'}`}>
        {label} <ChevronDown size={16} />
      </button>
      {active && (
        <div className="absolute left-1/2 top-full w-[55vw] min-w-[720px] max-w-[860px] -translate-x-1/2 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

function MobileMega({ label, id, current, setCurrent, children }) {
  const active = current === id;
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.08]">
      <button className="flex w-full items-center justify-between p-4 font-bold text-white transition hover:text-primary" onClick={() => setCurrent(active ? null : id)}>
        {label} <ChevronDown size={18} className={active ? 'rotate-180 transition' : 'transition'} />
      </button>
      {active && <div className="border-t border-white/12 p-3">{children}</div>}
    </div>
  );
}

function SpotsMegaMenu({ mobile = false, stats, status, onNavigate }) {
  return (
    <div className={mobile ? 'grid gap-5' : 'rounded-3xl border border-border bg-white p-6 text-text shadow-lift'}>
      <div>
        <p className="mb-4 text-xs font-black uppercase tracking-widest text-ocean">LES SPOTS PAR RÉGION :</p>
        <StatsGrid status={status} empty="Aucune région active">
          {stats.regions.map(({ region, count }) => (
            <MegaLink key={region} to={`/spots?region=${slugifyRegion(region)}`} onNavigate={onNavigate}>
              {region} <Counter status={status}>{count}</Counter>
            </MegaLink>
          ))}
        </StatsGrid>
      </div>
      <div className="mt-6 grid gap-4 border-t border-border pt-5 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2 text-xs font-black uppercase tracking-widest text-ocean">
          LES SPOTS À PROXIMITÉ DE :
          <select className="field normal-case tracking-normal">
            <option>Choisissez une ville</option>
            {stats.cities.map(({ city, region }) => <option key={`${city}-${region}`}>{city}</option>)}
          </select>
        </label>
        <Link to="/spots" onClick={onNavigate} className="btn-primary justify-center">
          <MapPin size={18} /> Tous les spots
        </Link>
      </div>
    </div>
  );
}

function StagesMegaMenu({ mobile = false, stats, status, onNavigate }) {
  return (
    <div className={mobile ? 'grid gap-5' : 'rounded-3xl border border-border bg-white p-6 text-text shadow-lift'}>
      <div>
        <p className="mb-4 text-xs font-black uppercase tracking-widest text-ocean">LES TYPES DE STAGE :</p>
        <StatsGrid status={status} empty="Aucun stage disponible">
          {stats.stageTypes.map(({ type, slug, count }) => (
            <MegaLink key={slug} to={`/stages?type=${slug}`} onNavigate={onNavigate}>
              {type} <Counter status={status}>{count}</Counter>
            </MegaLink>
          ))}
          {stats.totalStages > 0 && (
            <Link to="/stages" onClick={onNavigate} className="rounded-2xl border border-primary bg-primary px-4 py-3 text-center font-black text-text transition hover:bg-primaryHover">
              Tous les stages <Counter status={status}>{stats.totalStages}</Counter>
            </Link>
          )}
        </StatsGrid>
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <p className="mb-4 text-xs font-black uppercase tracking-widest text-ocean">AFFINER PAR NIVEAU :</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {levelItems.map(([label, level]) => (
            <MegaLink key={level} to={`/stages?level=${level}`} onNavigate={onNavigate}>
              {label}
            </MegaLink>
          ))}
        </div>
      </div>
    </div>
  );
}

function MegaLink({ to, onNavigate, children }) {
  return (
    <Link to={to} onClick={onNavigate} className="rounded-2xl border border-border bg-sky/35 px-4 py-3 text-center font-black text-text transition hover:border-turquoise hover:text-ocean">
      {children}
    </Link>
  );
}

function StatsGrid({ status, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const hasItems = Array.isArray(items) ? items.length > 0 : Boolean(items);

  if (status === 'loading') {
    return <p className="rounded-2xl border border-border bg-sky/35 px-4 py-3 text-center font-black text-muted">Chargement...</p>;
  }

  if (!hasItems) {
    return <p className="rounded-2xl border border-border bg-sky/35 px-4 py-3 text-center font-black text-muted">{status === 'error' ? '—' : empty}</p>;
  }

  return <div className="grid gap-3 sm:grid-cols-2">{items}</div>;
}

function Counter({ status, children }) {
  return <span className="ml-2 text-ocean">{status === 'error' ? '—' : children}</span>;
}

function slugifyRegion(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
