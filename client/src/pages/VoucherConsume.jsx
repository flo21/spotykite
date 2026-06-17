import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { api } from '../api.js';

export default function VoucherConsume() {
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading', message: '' });

  useEffect(() => {
    let cancelled = false;

    async function consume() {
      try {
        const result = await api.consumeVoucher(token);
        if (!cancelled) setState({ status: 'success', message: result.message || 'Bon validé avec succès.', result });
      } catch (error) {
        if (cancelled) return;
        const message = error.message || 'Bon introuvable ou invalide.';
        setState({
          status: message.includes('déjà') ? 'used' : 'invalid',
          message
        });
      }
    }

    consume();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isSuccess = state.status === 'success';
  const isLoading = state.status === 'loading';

  return (
    <main className="section pt-12">
      <div className="card mx-auto max-w-xl px-6 py-10 text-center sm:px-10 sm:py-12">
        {isSuccess ? <CheckCircle2 className="mx-auto text-primary" size={54} /> : <CircleAlert className="mx-auto text-amber-600" size={54} />}
        <h1 className="mt-6 text-4xl font-black leading-tight text-navy">Bon Spotykite validé</h1>
        <p className="mx-auto mt-5 max-w-md text-base font-bold leading-7 text-muted">
          {isLoading && 'Validation du bon en cours...'}
          {isSuccess && 'La réservation a bien été marquée comme consommée. Spotykite pourra maintenant traiter le règlement de l’école partenaire.'}
          {state.status === 'used' && 'Ce bon a déjà été utilisé.'}
          {state.status === 'invalid' && 'Bon introuvable ou invalide.'}
        </p>
        {state.result?.orderNumber && (
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-turquoise/40 bg-sky p-5">
            <p className="text-sm font-black uppercase text-ocean">Numéro de commande</p>
            <p className="mt-2 text-2xl font-black text-navy">{state.result.orderNumber}</p>
          </div>
        )}
        <Link to="/" className="btn-primary mx-auto mt-8 justify-center">Retour à l'accueil</Link>
      </div>
    </main>
  );
}
