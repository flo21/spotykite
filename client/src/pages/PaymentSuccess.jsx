import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const paymentIntentId = searchParams.get('payment_intent');
  const [status, setStatus] = useState({ state: 'checking', error: '' });

  useEffect(() => {
    if (!sessionId && !paymentIntentId) {
      setStatus({ state: 'missing', error: '' });
      return;
    }

    let cancelled = false;
    let attempts = 0;

    async function checkPaymentStatus() {
      try {
        const payment = paymentIntentId
          ? await api.paymentIntent(paymentIntentId)
          : await api.checkoutSession(sessionId);
        if (cancelled) return;
        if (payment.paid) {
          setStatus({ state: 'paid', payment, error: '' });
          return;
        }
        attempts += 1;
        setStatus({ state: 'pending', payment, error: '' });
        if (attempts < 8) setTimeout(checkPaymentStatus, 2500);
      } catch (error) {
        if (cancelled) return;
        attempts += 1;
        setStatus({ state: 'pending', error: error.message || '' });
        if (attempts < 8) setTimeout(checkPaymentStatus, 2500);
      }
    }

    checkPaymentStatus();
    return () => {
      cancelled = true;
    };
  }, [sessionId, paymentIntentId]);

  const orderNumber = status.payment?.orderNumber;

  return (
    <main className="section pt-12">
      <div className="card mx-auto max-w-xl px-6 py-10 text-center sm:px-10 sm:py-12">
        <CheckCircle2 className="mx-auto text-primary" size={48} />
        <div>
          <h1 className="mx-auto mt-6 max-w-lg text-4xl font-black leading-tight text-navy">Votre réservation est confirmée</h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted">Merci pour votre commande. Votre demande a bien été prise en compte par Spotykite.</p>
        </div>

        {orderNumber && (
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-turquoise/40 bg-sky p-6 text-center">
            <p className="text-sm font-black uppercase text-ocean">Numéro de commande</p>
            <p className="mt-2 text-2xl font-black text-navy">{orderNumber}</p>
          </div>
        )}

        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-bg px-5 py-7 text-center sm:px-8">
          <h2 className="text-xl font-black text-navy">Prochaines étapes</h2>
          <ul className="mx-auto mt-5 grid max-w-sm gap-4 text-center text-sm font-bold leading-7 text-muted">
            <li>Vous allez recevoir un email de confirmation récapitulatif.</li>
            <li>Si votre date de stage reste à définir, vous devrez contacter directement votre moniteur sur place à l'aide des coordonnées indiquées sur votre bon de réservation Spotykite.</li>
            <li>Conservez votre numéro de commande pour toute demande concernant votre réservation.</li>
          </ul>
        </div>

        <p className="mx-auto mt-10 max-w-md text-center text-lg font-black leading-7 text-navy">À très vite sur le spot, ride cool 🌊</p>
        <Link to="/" className="btn-primary mx-auto mt-7 justify-center">Retour à l'accueil</Link>
      </div>
    </main>
  );
}
