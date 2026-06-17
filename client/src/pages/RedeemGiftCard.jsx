import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Gift, Search, ShieldAlert } from 'lucide-react';
import { api } from '../api.js';

export default function RedeemGiftCard() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [code, setCode] = useState(initialCode);
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialCode) return;
    validateCode(initialCode);
  }, [initialCode]);

  const remainingAmount = useMemo(() => Number(card?.remainingAmount ?? card?.remaining_amount ?? card?.amount ?? 0), [card]);
  const initialAmount = useMemo(() => Number(card?.initial_amount ?? card?.amount ?? 0), [card]);

  async function validate(event) {
    event.preventDefault();
    validateCode(code);
  }

  async function validateCode(nextCode) {
    const normalizedCode = String(nextCode || '').trim().toUpperCase();
    setCode(normalizedCode);
    setCard(null);
    setError('');
    if (!normalizedCode) {
      setError('Code carte cadeau invalide.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.validateGiftCard({ code: normalizedCode });
      const balance = Number(result.remainingAmount ?? result.remaining_amount ?? result.amount ?? 0);
      if (balance <= 0 || result.status === 'used' || result.status === 'redeemed') {
        setError('Cette carte cadeau a déjà été utilisée.');
        return;
      }
      setCard(result);
      window.localStorage.setItem('spotykiteGiftCardCode', result.code || normalizedCode);
    } catch (err) {
      setError(normalizeGiftCardError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="bg-navy px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="eyebrow text-primary">Carte cadeau</p>
          <h1 className="mt-3 text-5xl font-black leading-none sm:text-6xl">J’ai une carte cadeau</h1>
          <p className="mx-auto mt-5 max-w-2xl text-white/78">
            Vérifiez votre solde, votre date d’expiration et utilisez votre crédit pour réserver une prestation Spotykite.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={validate} className="h-fit rounded-3xl border border-border bg-white p-6 shadow-lift">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky text-ocean">
                <Search size={22} />
              </span>
              <div>
                <p className="eyebrow text-ocean">Vérification</p>
                <h2 className="text-2xl font-black text-navy">Votre code</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <input
                className="field uppercase"
                required
                placeholder="SKC-XXXXX-XXXX"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
              <button className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                {loading ? 'Vérification...' : 'Vérifier ma carte cadeau'}
              </button>
            </div>
            {error && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                <ShieldAlert size={18} /> {error}
              </p>
            )}
          </form>

          <div>
            {!card && (
              <div className="rounded-3xl border border-border bg-white p-8 shadow-lift">
                <Gift className="text-ocean" size={46} />
                <h2 className="mt-4 text-3xl font-black text-navy">Utilisez votre carte cadeau Spotykite</h2>
                <p className="mt-3 text-muted">
                  Saisissez votre code pour vérifier le solde disponible. Vous pourrez ensuite choisir une école, un spot ou un stage et appliquer votre carte dans le tunnel de réservation.
                </p>
              </div>
            )}

            {card && (
              <div className="grid gap-5">
                <div className="rounded-3xl border border-turquoise/35 bg-white p-6 shadow-lift">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow text-ocean">Carte active</p>
                      <h2 className="text-3xl font-black text-navy">Carte cadeau Spotykite</h2>
                    </div>
                    <CheckCircle2 className="text-ocean" size={34} />
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Info label="Code" value={card.code} />
                    <Info label="Montant initial" value={`${initialAmount} €`} />
                    <Info label="Solde restant" value={`${remainingAmount} €`} />
                    <Info label="Expiration" value={formatDate(card.expiresAt || card.expires_at)} />
                  </div>

                  <div className="mt-6 rounded-2xl border border-border bg-bg p-4">
                    <p className="font-black text-navy">Comment l’utiliser ?</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-muted">
                      Choisissez une prestation Spotykite, puis renseignez ce code dans le tunnel de réservation. Si le prix dépasse le solde, vous réglerez seulement le complément.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/ecoles" className="btn-primary justify-center">Choisir une prestation</Link>
                    <Link to="/stages" className="btn-secondary justify-center">Voir les stages</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-sky/40 p-4">
      <p className="text-xs font-black uppercase text-muted">{label}</p>
      <p className="mt-1 break-words font-black text-navy">{value || '-'}</p>
    </div>
  );
}

function normalizeGiftCardError(message = '') {
  const text = String(message).toLowerCase();
  if (text.includes('expir')) return 'Cette carte cadeau a expiré.';
  if (text.includes('utilis') || text.includes('used') || text.includes('redeemed')) return 'Cette carte cadeau a déjà été utilisée.';
  return 'Code carte cadeau invalide.';
}

function formatDate(value) {
  if (!value) return 'Non définie';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}
