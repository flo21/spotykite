import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Gift, MapPin, MessageSquare, ShieldCheck } from 'lucide-react';

const stages = [
  ['Baptême découverte', 'Première expérience encadrée pour découvrir les sensations du kite.', 129],
  ['Stage initiation', 'Les bases pour comprendre le vent, piloter l’aile et démarrer en sécurité.', 199],
  ['Stage progression', 'Pour gagner en autonomie et progresser avec un moniteur diplômé.', 249],
  ['Stage 2 jours', 'Un format complet pour pratiquer davantage et consolider ses acquis.', 389],
  ['Stage 3 jours', 'L’expérience idéale pour progresser sur plusieurs sessions.', 549]
];

const departments = {};

const badges = ['Valable 1 an', 'Utilisable partout en France', 'Écoles sélectionnées par Spotykite', 'Message personnalisé'];

export default function OfferStageGift() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(stages[0][0]);
  const [formula, setFormula] = useState('france');
  const [department, setDepartment] = useState('');
  const [center, setCenter] = useState('');
  const [message, setMessage] = useState('');

  const selectedStage = useMemo(() => stages.find(([name]) => name === stage), [stage]);
  const centers = department ? departments[department] : [];
  const needsCenter = formula === 'centre';
  const canCheckout = stage && formula && (!needsCenter || (department && center));

  function checkout() {
    if (!canCheckout) return;
    const params = new URLSearchParams({
      gift: 'stage',
      stage,
      formula,
      price: String(selectedStage?.[2] || 0)
    });
    if (department) params.set('department', department);
    if (center) params.set('center', center);
    if (message) params.set('message', message);
    navigate(`/stages?${params.toString()}`);
  }

  return (
    <main className="page-with-mobile-sticky-booking bg-bg">
      <section className="relative overflow-hidden bg-navy px-4 pb-14 pt-12 text-white sm:px-6 lg:pb-20 lg:pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(0,191,216,0.34),transparent_28rem),linear-gradient(135deg,#0B2540_0%,#06243D_52%,#007C89_100%)]" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black backdrop-blur">
            Offrir une expérience kitesurf
          </p>
          <h1 className="max-w-4xl text-5xl font-black leading-none text-white sm:text-7xl">Offrir un stage de kitesurf</h1>
          <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-white/84 sm:text-xl">
            Choisissez le type de stage, la formule cadeau et ajoutez un message personnalisé. Le bénéficiaire pourra ensuite profiter de son expérience dans les meilleures conditions.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {badges.map((badge) => (
              <div key={badge} className="flex items-center gap-3 rounded-2xl border border-white/16 bg-white/12 px-4 py-3 font-bold backdrop-blur">
                <Check size={18} className="shrink-0 text-primary" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="grid gap-6">
            <Step title="Étape 1 — Choisir le type de stage" icon={<Gift />}>
              <div className="grid gap-3 md:grid-cols-2">
                {stages.map(([name, description, price]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setStage(name)}
                    className={`rounded-3xl border p-5 text-left transition ${stage === name ? 'border-turquoise bg-sky text-navy shadow-lift' : 'border-border bg-white hover:border-turquoise/60'}`}
                  >
                    <h3 className="text-2xl font-black text-navy">{name}</h3>
                    <p className="mt-2 text-sm font-medium text-muted">{description}</p>
                    <p className="mt-4 text-lg font-black text-ocean">à partir de {price} €</p>
                  </button>
                ))}
              </div>
            </Step>

            <Step title="Étape 2 — Choisir la formule" icon={<MapPin />}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormulaCard
                  active={formula === 'france'}
                  title="Formule Toute France"
                  text="Le bénéficiaire choisira plus tard son école, son spot et sa date dans le réseau Spotykite."
                  points={['Liberté totale', 'Valable partout en France', 'Idéal pour offrir sans se tromper']}
                  onClick={() => setFormula('france')}
                />
                <FormulaCard
                  active={formula === 'centre'}
                  title="Formule école précise"
                  text="Choisissez une école Spotykite dès maintenant. Le bénéficiaire pourra ensuite organiser sa date avec cette école."
                  points={['École choisie à l’avance', 'Date organisée plus tard', 'Parfait si vous connaissez son spot']}
                  onClick={() => setFormula('centre')}
                />
              </div>

              {needsCenter && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-black text-navy">
                    Département
                    <select className="field" value={department} onChange={(event) => { setDepartment(event.target.value); setCenter(''); }}>
                      <option value="">Choisir un département</option>
                      {Object.keys(departments).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-black text-navy">
                    École Spotykite
                    <select className="field" value={center} onChange={(event) => setCenter(event.target.value)} disabled={!department}>
                      <option value="">Choisir un centre</option>
                      {centers.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </Step>

            <Step title="Étape 3 — Personnaliser le message" icon={<MessageSquare />}>
              <label className="grid gap-2 text-sm font-black text-navy">
                Message personnalisé
                <textarea
                  className="field min-h-36"
                  maxLength={300}
                  placeholder="Exemple : Joyeux anniversaire ! Profite de cette expérience unique pour découvrir le kitesurf..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span>Le message sera affiché sur la carte cadeau envoyée par email.</span>
                <span className="font-bold">{message.length}/300</span>
              </div>
            </Step>
          </div>

          <OrderSummary
            stage={stage}
            formula={formula}
            center={center}
            price={selectedStage?.[2] || 0}
            canCheckout={canCheckout}
            onCheckout={checkout}
          />
        </div>
      </section>
    </main>
  );
}

function Step({ title, icon, children }) {
  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-lift sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-3xl font-black text-navy">
        <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-sky text-ocean">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function FormulaCard({ active, title, text, points, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left transition ${active ? 'border-turquoise bg-sky text-navy shadow-lift' : 'border-border bg-white hover:border-turquoise/60'}`}
    >
      <h3 className="text-2xl font-black text-navy">{title}</h3>
      <p className="mt-2 text-sm font-medium text-muted">{text}</p>
      <div className="mt-4 grid gap-2">
        {points.map((point) => (
          <span key={point} className="flex items-center gap-2 text-sm font-bold text-navy">
            <Check size={16} className="text-ocean" />
            {point}
          </span>
        ))}
      </div>
    </button>
  );
}

function OrderSummary({ stage, formula, center, price, canCheckout, onCheckout }) {
  return (
    <aside className="booking-sidebar fixed inset-x-0 bottom-0 z-30 border-t border-turquoise/40 bg-[#062B4A]/95 p-4 text-white shadow-[0_-18px_44px_rgba(6,43,74,0.28)] backdrop-blur-[10px] lg:inset-x-auto lg:bottom-auto lg:h-fit lg:rounded-3xl lg:border lg:border-white/12 lg:p-5">
      <div className="mx-auto max-w-7xl lg:max-w-none">
        <div className="mb-3 flex items-center gap-2 font-black">
          <ShieldCheck size={18} className="text-primary" />
          Résumé de commande
        </div>
        <div className="grid gap-1 text-sm text-white/80">
          <p><strong className="text-white">Stage :</strong> {stage}</p>
          <p><strong className="text-white">Formule :</strong> {formula === 'france' ? 'Toute France' : 'Centre précis'}</p>
          {formula === 'centre' && <p><strong className="text-white">Centre :</strong> {center || 'À sélectionner'}</p>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 lg:block">
          <p className="text-3xl font-black leading-none text-white lg:mt-5">{price} €</p>
          <button
            type="button"
            disabled={!canCheckout}
            onClick={onCheckout}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-turquoise px-5 py-3 text-sm font-black text-navy transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 lg:mt-5 lg:w-full"
          >
            Finaliser ma commande
          </button>
        </div>
      </div>
    </aside>
  );
}
