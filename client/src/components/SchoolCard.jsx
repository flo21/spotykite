import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { publicSchoolLocation, publicSchoolTitle } from '../utils/schoolDisplay.js';

export default function SchoolCard({ school }) {
  const title = publicSchoolTitle(school);
  const location = publicSchoolLocation(school);
  return (
    <article className="card overflow-hidden">
      <img src={school.imageUrl || school.photos?.[0]} alt="" className="h-48 w-full object-cover" />
      <div className="p-5">
        <p className="mb-2 inline-flex rounded-full border border-turquoise/30 bg-sky px-3 py-1 text-xs font-black uppercase text-ocean">
          {school.activeFormulas || 0} formule{Number(school.activeFormulas || 0) > 1 ? 's' : ''}
        </p>
        <h3 className="text-2xl font-black text-navy">{title}</h3>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-ocean">
          <MapPin size={16} /> {location}
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{school.description}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-muted">À partir de</p>
            <p className="text-3xl font-black text-primary">{school.startingPrice ? `${school.startingPrice} €` : 'Sur demande'}</p>
          </div>
          <Link to={`/ecole-kitesurf/${school.slug}`} className="btn-primary justify-center text-sm">
            Voir le spot <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
