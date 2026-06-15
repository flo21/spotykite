import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, Gift, ShieldCheck, Star } from 'lucide-react';
import { stagePrograms } from '../data/stagePrograms.js';

const regions = ['Bretagne', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'PACA', 'Pays de la Loire', 'Hauts-de-France', 'Corse'];
const departments = {
  Bretagne: ['Finistère', 'Morbihan'],
  Normandie: ['Calvados', 'Manche'],
  'Nouvelle-Aquitaine': ['Charente-Maritime', 'Gironde', 'Landes'],
  Occitanie: ['Hérault', 'Aude', 'Pyrénées-Orientales'],
  PACA: ['Bouches-du-Rhône', 'Var'],
  'Pays de la Loire': ['Vendée', 'Loire-Atlantique'],
  'Hauts-de-France': ['Somme', 'Pas-de-Calais'],
  Corse: ['Corse-du-Sud', 'Haute-Corse']
};
const centersByDepartment = {};

export default function StageProgram() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const program = stagePrograms.find((item) => item.slug === slug);
  const [formula, setFormula] = useState('france');
  const [region, setRegion] = useState('');
  const [department, setDepartment] = useState('');
  const [center, setCenter] = useState('');
  const [dateMode, setDateMode] = useState('sans-date');
  const [date, setDate] = useState('');
  const [isGift, setIsGift] = useState(false);
  const [message, setMessage] = useState('');

  const availableDepartments = region ? departments[region] || [] : [];
  const availableCenters = department ? centersByDepartment[department] || [] : [];
  const needsCenter = formula === 'centre';
  const needsDate = dateMode === 'date-fixe';
  const canContinue = program && formula && (!needsCenter || (region && department && center)) && (!needsDate || date);

  if (!program) {
    return (
      <main className="section pt-12">
        <div className="card p-8 text-center">
          <h1 className="text-4xl font-black text-navy">Stage introuvable</h1>
          <Link to="/" className="btn-primary mt-6 justify-center">Retour à l’accueil</Link>
        </div>
      </main>
    );
  }

  function continueCheckout() {
    if (!canContinue) return;
    const params = new URLSearchParams({
      stage: program.slug,
      formula,
      dateMode,
      gift: isGift ? 'oui' : 'non',
      price: String(program.price)
    });
    if (region) params.set('region', region);
    if (department) params.set('department', department);
    if (center) params.set('center', center);
    if (date) params.set('date', date);
    if (message) params.set('message', message);
    navigate(`/stages?${params.toString()}`);
  }

  return (
    <main className="page-with-mobile-sticky-booking bg-bg">
      <section className="relative overflow-hidden bg-navy px-4 pb-14 pt-12 text-white sm:px-6 lg:pb-20 lg:pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(0,191,216,0.32),transparent_28rem),linear-gradient(135deg,#0B2540_0%,#06243D_52%,#007C89_100%)]" />
        <div className="relative mx-auto max-w-7xl">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black backdrop-blur">{program.badge}</span>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-none sm:text-7xl">{program.title}</h1>
          <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-white/84 sm:text-xl">{program.short}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {['Moniteurs diplômés', 'Matériel inclus', 'Report météo', 'Valable en cadeau'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/12 px-4 py-2 font-bold backdrop-blur">
                <Check size={16} className="text-primary" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="grid gap-6">
            <InfoBlock title="Ce que vous allez apprendre" items={program.learn} />
            <InfoBlock title="Déroulé du stage" items={program.schedule} />
            <InfoBlock title="Bénéfices" items={program.benefits} />

            <section className="card p-6">
              <h2 className="text-3xl font-black text-navy">Prérequis</h2>
              <p className="mt-3 text-muted">{program.prerequisites}</p>
            </section>

            <section className="card p-6">
              <h2 className="text-3xl font-black text-navy">Avis & réassurances</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {['4,8/5 avis clients', 'Écoles vérifiées', 'Paiement sécurisé'].map((item) => (
                  <div key={item} className="rounded-2xl border border-border bg-sky/35 p-4 font-bold">
                    <Star size={18} className="mb-2 fill-primary text-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-6">
              <h2 className="mb-5 text-3xl font-black text-navy">Configurer votre stage</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Choice active={formula === 'france'} title="Toute France" text="Le bénéficiaire choisit plus tard son école, son spot et sa date." onClick={() => setFormula('france')} />
                <Choice active={formula === 'centre'} title="École précise" text="Sélectionnez une école Spotykite dès maintenant." onClick={() => setFormula('centre')} />
              </div>

              {needsCenter && (
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Select label="Région" value={region} options={regions} onChange={(value) => { setRegion(value); setDepartment(''); setCenter(''); }} />
                  <Select label="Département" value={department} options={availableDepartments} onChange={(value) => { setDepartment(value); setCenter(''); }} disabled={!region} />
                  <Select label="Centre" value={center} options={availableCenters} onChange={setCenter} disabled={!department} />
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Choice active={dateMode === 'sans-date'} title="Sans date fixe" text="La date sera choisie plus tard selon les disponibilités." icon={<CalendarDays />} onClick={() => setDateMode('sans-date')} />
                <Choice active={dateMode === 'date-fixe'} title="Date fixe" text="Choisissez une date souhaitée pour préparer la réservation." icon={<CalendarDays />} onClick={() => setDateMode('date-fixe')} />
              </div>
              {needsDate && (
                <label className="mt-4 grid max-w-sm gap-2 text-sm font-black text-navy">
                  Date souhaitée
                  <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
              )}

              <label className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-bg p-4 font-bold">
                <input className="h-5 w-5 accent-ocean" type="checkbox" checked={isGift} onChange={(event) => setIsGift(event.target.checked)} />
                C’est un cadeau
              </label>
              {isGift && (
                <label className="mt-4 grid gap-2 text-sm font-black text-navy">
                  Message personnalisé
                  <textarea className="field min-h-28" maxLength={300} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ajoutez un message pour le bénéficiaire..." />
                  <span className="text-right text-xs text-muted">{message.length}/300</span>
                </label>
              )}
            </section>
          </div>

          <StageStickyBar program={program} formula={formula} price={program.price} canContinue={canContinue} onContinue={continueCheckout} />
        </div>
      </section>
    </main>
  );
}

function InfoBlock({ title, items }) {
  return (
    <section className="card p-6">
      <h2 className="text-3xl font-black text-navy">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-white p-4 font-bold">
            <Check size={18} className="mt-0.5 shrink-0 text-ocean" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function Choice({ active, title, text, icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-3xl border p-5 text-left transition ${active ? 'border-turquoise bg-sky text-navy shadow-lift' : 'border-border bg-white hover:border-turquoise/60'}`}>
      <div className="flex items-center gap-2 text-2xl font-black text-navy">{icon}{title}</div>
      <p className="mt-2 text-sm font-medium text-muted">{text}</p>
    </button>
  );
}

function Select({ label, value, options, onChange, disabled = false }) {
  return (
    <label className="grid gap-2 text-sm font-black text-navy">
      {label}
      <select className="field" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choisir</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StageStickyBar({ program, formula, price, canContinue, onContinue }) {
  return (
    <aside className="booking-sidebar fixed inset-x-0 bottom-0 z-40 border-t border-turquoise/40 bg-[#062B4A]/95 p-4 text-white shadow-[0_-18px_44px_rgba(6,43,74,0.28)] backdrop-blur-[10px] lg:inset-x-auto lg:bottom-auto lg:h-fit lg:rounded-3xl lg:border lg:border-white/12 lg:p-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 lg:block lg:max-w-none">
        <div>
          <p className="text-lg font-black leading-tight">{program.title}</p>
          <p className="text-sm font-bold text-white/75">{formula === 'france' ? 'Toute France' : 'Centre précis'}</p>
          <p className="mt-1 text-2xl font-black lg:mt-5">À partir de {price} €</p>
        </div>
        <button disabled={!canContinue} onClick={onContinue} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-turquoise px-5 py-3 text-sm font-black text-navy transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 lg:mt-5 lg:w-full">
          Continuer <ArrowRight size={17} />
        </button>
      </div>
    </aside>
  );
}
