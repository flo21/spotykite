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

  const isPaid = status.state === 'paid';

  return (
    <main className="section pt-12">
      <div className="card mx-auto max-w-2xl p-8 text-center">
        <CheckCircle2 className="mx-auto text-primary" size={48} />
        <p className="eyebrow mt-5 text-primary">Paiement Stripe reçu</p>
        <h1 className="mt-2 text-4xl font-black text-navy">{isPaid ? 'Votre réservation est confirmée' : 'Votre paiement est en cours de confirmation'}</h1>
        <p className="mt-4 text-muted">
          {isPaid
            ? 'Le webhook Stripe a confirmé le paiement. Spotykite a bien validé votre commande.'
            : 'La réservation est validée automatiquement après confirmation du webhook Stripe. Cette page se met à jour dès que Stripe confirme le paiement.'}
        </p>
        {(sessionId || paymentIntentId) && <p className="mt-4 break-all rounded-2xl border border-border bg-bg p-3 text-xs font-bold text-muted">Référence Stripe : {sessionId || paymentIntentId}</p>}
        {status.error && !isPaid && <p className="mt-3 text-sm font-bold text-muted">{status.error}</p>}
        <Link to="/ecoles" className="btn-primary mt-6 justify-center">Voir les écoles</Link>
      </div>
    </main>
  );
}
