import { Link } from 'react-router-dom';
import { Gift, Star } from 'lucide-react';

export default function OfferCard({ offer }) {
  return (
    <article className="card overflow-hidden">
      <img src={offer.imageUrl} alt="" className="h-48 w-full object-cover" />
      <div className="p-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="rounded-full border border-turquoise/30 bg-sky px-3 py-1 font-bold text-ocean">{offer.duration}</span>
          {offer.rating && <span className="flex items-center gap-1 font-bold"><Star size={16} className="fill-primary text-primary" /> {offer.rating}</span>}
        </div>
        <h3 className="text-xl font-black">{offer.title}</h3>
        <p className="mt-1 text-sm font-bold text-ocean">{offer.schoolName || offer.school} · {offer.region}</p>
        <p className="mt-3 line-clamp-3 text-sm text-muted">{offer.description}</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-2xl font-black text-primary">des {offer.price} €</span>
          <span className="text-sm font-bold text-muted">{offer.level}</span>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link to={`/offres/${offer.id}`} className="btn-primary justify-center text-sm">Voir les disponibilites</Link>
          <Link to="/carte-cadeau" className="btn-secondary justify-center text-sm"><Gift size={16} /> Offrir</Link>
        </div>
      </div>
    </article>
  );
}
