import { Link } from 'react-router-dom';
import { publicSchoolTitle } from '../utils/schoolDisplay.js';
import heroKitesurf from '../assets/spotykite-hero-kitesurf.png';
import giftCardLagoonImage from '../assets/carte-cadeau-kitesurf-lagon.png';
import initiationImage from '../assets/initiation-kitesurf.png';
import stageThreeDaysImage from '../assets/stage-3-jours-kitesurf.png';
import stageFiveDaysImage from '../assets/stage-5-jours-kitesurf.png';
import privateLessonImage from '../assets/cours-particulier-kitesurf.png';
import improvementImage from '../assets/perfectionnement-kitesurf.png';

const fallbackImages = [
  heroKitesurf,
  giftCardLagoonImage,
  initiationImage,
  stageThreeDaysImage,
  stageFiveDaysImage,
  privateLessonImage,
  improvementImage
];

export default function SchoolCard({ school, index = 0 }) {
  const title = publicSchoolTitle(school);
  const reviewCount = Number(school.reviewCount || school.reviewsCount || school.review_count || 280);
  const startingPrice = Number(school.startingPrice || 0);
  const crossedPrice = Number(school.publicPrice || school.normalPrice || school.crossedPrice || 0);
  const dedicatedImage = [school.imageUrl, ...(school.photos || [])].find((item) => item && !isGenericImage(item));
  const image = dedicatedImage || fallbackSchoolImage(school, index);
  const badges = presentationBadges(school);

  return (
    <Link
      to={`/ecole-kitesurf/${school.slug}`}
      className="card group block cursor-pointer overflow-hidden no-underline shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_24px_54px_rgba(6,43,73,0.24)]"
    >
      <div className="relative">
        <img src={image} alt="" className="h-72 w-full object-cover" />
        <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
          {badges.map((badge) => (
            <span key={badge} className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-navy shadow-lift">
              {badge}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-start gap-4 p-5">
        <div className="min-w-0">
          <h3 className="text-2xl font-black uppercase leading-tight text-navy">{title}</h3>
          <p className="mt-2 text-sm font-black text-[#FFC107]">
            <span aria-hidden="true">★★★★★</span> <span className="text-navy">{reviewCount} avis</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-black uppercase text-muted">À partir de</p>
          <div className="mt-1 grid justify-items-end gap-1">
            <p className="text-3xl font-black leading-none text-primary">{startingPrice ? `${startingPrice} €` : 'Sur demande'}</p>
            {crossedPrice > startingPrice && (
              <p className="text-base font-black text-muted line-through">{crossedPrice} €</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function presentationBadges(school) {
  const badges = school.presentationBadges || school.presentation_badges || school.badges || [];
  if (Array.isArray(badges)) {
    const cleaned = badges.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length ? cleaned : ['Stage de kitesurf'];
  }
  const cleaned = String(badges).split(',').map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : ['Stage de kitesurf'];
}

function fallbackSchoolImage(school, index) {
  const seed = `${school.region || ''}${school.spot || ''}${school.city || ''}${index}`;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackImages[hash % fallbackImages.length];
}

function isGenericImage(value = '') {
  return String(value).includes('spotykite-hero-kitesurf')
    || String(value).includes('old-spotykite-hero-kitesurf')
    || String(value).includes('placeholder');
}
