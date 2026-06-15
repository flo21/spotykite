import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

const PRICE = 199;

const reassuranceBadges = [
  'Valable 1 an',
  'Utilisable partout en France',
  'Utilisable sur toutes les prestations SpotyKite',
  'Plus de 100 écoles Spotykite',
  'Livraison immédiate par email'
];

const steps = [
  ['Étape 1', 'Achetez une Carte Cadeau SpotyKite à montant fixe'],
  ['Étape 2', 'Recevez le code cadeau immédiatement par email'],
  ['Étape 3', 'Le bénéficiaire utilise son code plus tard sur SpotyKite'],
  ['Étape 4', 'Il choisit son école, son spot, sa date et la formule qui lui convient']
];

const reasons = [
  'Crédit utilisable sur toutes les prestations SpotyKite',
  'Liberté totale de choisir son expérience plus tard',
  'Plus de 100 écoles Spotykite',
  'Plus de 50 spots en France',
  'Valable pendant 12 mois'
];

const faqs = [
  ['Combien de temps la carte cadeau est-elle valable ?', "La carte cadeau SpotyKite est valable pendant 12 mois à compter de sa date d'achat."],
  ["Peut-on choisir l'école plus tard ?", "Oui. Le bénéficiaire choisit librement son école Spotykite lorsqu'il souhaite réserver son stage."],
  ['Est-elle valable partout en France ?', "Oui. La carte cadeau est utilisable dans l'ensemble des écoles Spotykite."],
  ['Peut-elle servir sur toutes les prestations ?', "Oui. Elle fonctionne comme un crédit utilisable à hauteur de son montant sur toutes les prestations proposées sur SpotyKite."],
  ['Comment reçoit-on la carte cadeau ?', 'Elle est envoyée immédiatement par email après validation du paiement.']
];

export default function GiftCard() {
  const [stickyCompact, setStickyCompact] = useState(false);

  useEffect(() => {
    let previousY = window.scrollY;

    function onScroll() {
      const currentY = window.scrollY;
      setStickyCompact(currentY > previousY && currentY > 80);
      previousY = currentY;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main
      className="page-with-sticky-booking"
      style={{
        '--sticky-booking-mobile-height': '176px',
        '--sticky-booking-height': '132px'
      }}
    >
      <section className="relative overflow-hidden bg-navy px-4 pb-14 pt-12 text-white sm:px-6 lg:pb-20 lg:pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,191,216,0.34),transparent_28rem),linear-gradient(135deg,#0B2540_0%,#06243D_48%,#007C89_100%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white backdrop-blur">
              Valable 1 an partout en France
            </p>
            <h1 className="text-5xl font-black leading-none text-white sm:text-7xl">Carte Cadeau SpotyKite</h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-white/86 sm:text-xl">
              Offrez la liberté de choisir son stage de kitesurf plus tard.
            </p>
            <Link to="/reservation?type=gift-card" className="btn-primary mt-7 justify-center">
              Acheter ma Carte Cadeau SpotyKite
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {reassuranceBadges.map((badge) => (
              <div key={badge} className="flex items-center gap-3 rounded-2xl border border-white/16 bg-white/12 px-4 py-3 font-bold text-white backdrop-blur">
                <Check size={18} className="shrink-0 text-primary" />
                <span>{badge}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 max-w-4xl rounded-3xl border border-white/18 bg-white/12 p-5 text-white/90 backdrop-blur">
            <p className="font-bold leading-relaxed">
              La Carte Cadeau SpotyKite fonctionne comme un crédit utilisable à hauteur de son montant sur toutes les prestations proposées sur SpotyKite.
            </p>
            <p className="mt-3 leading-relaxed text-white/80">
              Le bénéficiaire pourra choisir librement son école Spotykite, son spot, sa date et la formule de stage qui lui convient. Valable pendant 1 an et utilisable partout en France, elle permet d’offrir une expérience kitesurf sans imposer de lieu, de date ou de prestation.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="mx-auto max-w-4xl">
          <article className="card p-7">
            <p className="eyebrow">Liberté</p>
            <h2 className="text-4xl font-black text-navy">Offrez la liberté de choisir</h2>
            <div className="mt-5 grid gap-3">
              {[
                'Son école Spotykite',
                'Son spot de kitesurf',
                'Sa date de stage',
                'La formule qui lui convient',
                'Le moment où il souhaite réserver'
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-border bg-sky/35 px-4 py-3 font-bold">
                  <Check size={18} className="shrink-0 text-ocean" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 font-bold text-text">
              C’est le cadeau parfait pour découvrir le kitesurf, progresser ou vivre une aventure inoubliable au bord de l’eau.
            </p>
          </article>
        </div>
      </section>

      <section className="section pt-0">
        <div className="section-head">
          <div>
            <p className="eyebrow">Fonctionnement</p>
            <h2>Comment ça fonctionne ?</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map(([step, text]) => (
            <article key={step} className="card p-6">
              <p className="text-sm font-black uppercase tracking-wide text-ocean">{step}</p>
              <h3 className="mt-3 text-2xl font-black leading-tight text-navy">{text}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="achat-carte-cadeau" className="section pt-0">
        <div className="mx-auto max-w-3xl">
          <article className="h-fit rounded-3xl border border-border bg-white p-6 shadow-lift">
            <p className="eyebrow">Achat</p>
            <h2 className="text-4xl font-black text-navy">Carte Cadeau SpotyKite</h2>
            <div className="mt-6 rounded-2xl border border-border bg-bg p-4">
              <p className="text-sm font-black uppercase text-muted">Montant de la carte</p>
              <p className="mt-1 text-4xl font-black text-ocean">{PRICE} €</p>
              <p className="mt-1 text-sm font-bold text-muted">Livraison immédiate par email</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section border-y border-border bg-gradient-to-br from-sky via-white to-sand">
        <div className="section-head">
          <div>
            <p className="eyebrow">Réassurance</p>
            <h2>Pourquoi choisir la carte cadeau SpotyKite ?</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reasons.map((reason) => (
            <div key={reason} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 font-bold shadow-sm">
              <Check size={18} className="shrink-0 text-ocean" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>Carte cadeau valable 1 an partout en France</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map(([question, answer]) => (
            <article key={question} className="card p-6">
              <h3 className="text-2xl font-black leading-tight text-navy">{question}</h3>
              <p className="mt-3 text-muted">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-[9999] border-t border-turquoise/45 bg-[#062B4A]/95 px-4 shadow-[0_-18px_44px_rgba(6,43,74,0.28)] backdrop-blur-[10px] transition-all duration-300 sm:px-6">
        <div className={`mx-auto flex max-w-7xl items-center justify-between gap-4 transition-all duration-300 ${stickyCompact ? 'min-h-[62px] py-2' : 'min-h-[78px] py-3'}`}>
          <div className="text-white">
            <div className={`font-black leading-none transition-all duration-300 ${stickyCompact ? 'text-[30px]' : 'text-[36px] sm:text-[38px]'}`}>
              {PRICE} €
            </div>
            <div className="mt-1 text-xs font-bold leading-tight text-white/80">
              Valable 1 an
            </div>
          </div>
          <Link to="/reservation?type=gift-card" className="inline-flex min-h-12 items-center justify-center rounded-full bg-turquoise px-7 py-3 text-sm font-black text-navy transition hover:bg-primary sm:text-base">
            Acheter
          </Link>
        </div>
      </div>
    </main>
  );
}
