import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function PaymentCancel() {
  return (
    <main className="section pt-12">
      <div className="card mx-auto max-w-2xl p-8 text-center">
        <XCircle className="mx-auto text-primary" size={48} />
        <p className="eyebrow mt-5 text-primary">Paiement annulé</p>
        <h1 className="mt-2 text-4xl font-black text-navy">La réservation n’a pas été validée</h1>
        <p className="mt-4 text-muted">
          Aucun paiement confirmé n’a été reçu. Vous pouvez reprendre votre choix de stage et relancer un paiement sécurisé.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/reservation" className="btn-primary justify-center">Reprendre une réservation</Link>
          <Link to="/ecoles" className="btn-secondary justify-center">Voir les écoles</Link>
        </div>
      </div>
    </main>
  );
}
