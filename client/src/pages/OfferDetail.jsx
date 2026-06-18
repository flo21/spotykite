import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Calendar, Gift, ShieldCheck, Star, Umbrella, Wind } from 'lucide-react';
import { api } from '../api.js';
import Loading from '../components/Loading.jsx';

export default function OfferDetail() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);
  const [booking, setBooking] = useState({ customerName: '', customerEmail: '', customerPhone: '', date: '2026-07-12' });
  const [created, setCreated] = useState(null);

  useEffect(() => {
    api.offer(id).then(setOffer);
  }, [id]);

  if (!offer) return <Loading />;

  async function submit(event) {
    event.preventDefault();
    const result = await api.createBooking({ ...booking, offerId: offer.id });
    setCreated(result);
  }

  return (
    <main className="page-with-mobile-sticky-booking">
      <section className="border-b border-border bg-gradient-to-br from-sky via-white to-bg">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3">
            <img src={offer.imageUrl} alt="" className="h-[420px] w-full rounded-[2rem] object-cover" />
            <div className="grid grid-cols-3 gap-3">
              {[offer.imageUrl, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=800&q=80'].map((src) => (
                <img key={src} src={src} alt="" className="h-28 w-full rounded-2xl object-cover" />
              ))}
            </div>
          </div>
          <div className="grid content-center">
            <p className="eyebrow">Experience kitesurf</p>
            <h1 className="text-4xl font-black sm:text-6xl">{offer.title}</h1>
            <p className="mt-4 text-lg text-muted">{offer.description}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="École Spotykite" value={offer.schoolName} />
              <Info label="Spot" value={`${offer.spot}, ${offer.region}`} />
              <Info label="Duree" value={offer.duration} />
              <Info label="Niveau requis" value={offer.level} />
            </div>
            <div className="mt-6 flex items-center justify-between rounded-3xl border border-border bg-white p-5 shadow-lift">
              <div>
                <p className="text-sm font-bold text-muted">Prix</p>
                <p className="text-4xl font-black text-primary">{offer.price} €</p>
              </div>
              <div className="flex items-center gap-1 font-black"><Star className="fill-primary text-primary" /> {offer.rating}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-5">
            <Detail icon={<ShieldCheck />} title="Ce qui est inclus" text={offer.included} />
            <Detail icon={<Wind />} title="Conditions meteo" text="La session est confirmee selon le vent, la maree et la securite du spot. En cas de conditions defavorables, l ecole propose un report sans frais." />
            <Detail icon={<Umbrella />} title="Securite" text="Briefing avant mise a l eau, materiel adapte, encadrement par un moniteur diplome et zone de pratique definie." />
            <Detail icon={<Calendar />} title="Annulation / report" text="Report meteo inclus. Annulation possible jusqu a 7 jours avant la date de reservation." />
            <div className="card p-6">
              <h2 className="text-2xl font-black">Avis clients</h2>
              <p className="mt-3 text-muted">“Une premiere experience forte mais jamais intimidante. Tout est explique clairement et on sent que la securite guide la seance.”</p>
              <p className="mt-4 font-black">Laura · 5/5</p>
            </div>
          </div>

          <aside id="reservation" className="booking-sidebar h-fit rounded-3xl border border-border bg-white p-6 shadow-lift">
            <h2 className="text-2xl font-black">Reserver cette experience</h2>
            <form onSubmit={submit} className="mt-5 grid gap-3">
              <input className="field" required placeholder="Votre nom" value={booking.customerName} onChange={(event) => setBooking({ ...booking, customerName: event.target.value })} />
              <input className="field" required type="email" placeholder="Email" value={booking.customerEmail} onChange={(event) => setBooking({ ...booking, customerEmail: event.target.value })} />
              <input className="field" required placeholder="Telephone" value={booking.customerPhone} onChange={(event) => setBooking({ ...booking, customerPhone: event.target.value })} />
              <input className="field" required type="date" value={booking.date} onChange={(event) => setBooking({ ...booking, date: event.target.value })} />
              <button className="btn-primary justify-center" type="submit">Reserver maintenant</button>
              <Link to="/offrir" className="btn-secondary justify-center"><Gift size={18} /> Offrir cette experience</Link>
            </form>
            {created && <p className="mt-4 rounded-2xl border border-primary/35 bg-primary/10 p-3 text-sm font-bold text-primary">Reservation creee. Reference #{created.id}</p>}
          </aside>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-[9999] border-t border-turquoise/45 bg-[#062B4A]/95 px-4 py-3 text-white shadow-[0_-18px_44px_rgba(6,43,74,0.28)] backdrop-blur-[10px] sm:px-6 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-tight sm:text-base">{offer.title}</p>
            <p className="truncate text-xs font-bold text-white/75">{offer.schoolName} · {offer.region}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="text-2xl font-black leading-none sm:text-3xl">{offer.price} €</p>
            <a href="#reservation" className="inline-flex min-h-11 items-center justify-center rounded-full bg-turquoise px-5 py-2 text-sm font-black text-navy transition hover:bg-primary sm:min-h-12 sm:px-6">
              Réserver
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }) {
  return <div className="rounded-2xl border border-border bg-white p-4"><p className="text-xs font-bold uppercase text-muted">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function Detail({ icon, title, text }) {
  return <article className="card p-6"><div className="mb-3 text-primary">{icon}</div><h2 className="text-2xl font-black">{title}</h2><p className="mt-3 text-muted">{text}</p></article>;
}
