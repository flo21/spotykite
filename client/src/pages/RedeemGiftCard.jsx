import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Search, ShieldAlert, Waves } from 'lucide-react';
import { api } from '../api.js';
import { publicSchoolMapLabel } from '../utils/schoolDisplay.js';

export default function RedeemGiftCard() {
  const [schools, setSchools] = useState([]);
  const [lookup, setLookup] = useState({ code: '', recipientEmail: '' });
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState({
    region: 'Bretagne',
    schoolId: '',
    date: '2026-07-12'
  });
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    api.schools().then((data) => {
      setSchools(data);
      setBooking((current) => ({ ...current, schoolId: data[0]?.id || '' }));
    });
  }, []);

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => !booking.region || school.region === booking.region);
  }, [schools, booking.region]);

  useEffect(() => {
    if (filteredSchools.length && !filteredSchools.some((school) => String(school.id) === String(booking.schoolId))) {
      setBooking((current) => ({ ...current, schoolId: filteredSchools[0].id }));
    }
  }, [filteredSchools, booking.schoolId]);

  async function validate(event) {
    event.preventDefault();
    setError('');
    setConfirmed(null);
    try {
      const result = await api.validateGiftCard(lookup);
      setCard(result);
    } catch (err) {
      setCard(null);
      setError(err.message);
    }
  }

  async function redeem(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await api.redeemGiftCard({
        ...lookup,
        ...booking,
        schoolId: Number(booking.schoolId),
        customerName: card.recipientName
      });
      setConfirmed(result);
      setCard(result.giftCard);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <section className="border-b border-border bg-gradient-to-br from-sky via-white to-sand px-4 py-14 text-text sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow text-primary">Réserver</p>
          <h1 className="max-w-3xl text-5xl font-black">J’ai une Carte Cadeau <span className="text-primary">SpotyKite</span></h1>
          <p className="mt-4 max-w-2xl text-muted">Validez votre code, choisissez une région, une école Spotykite et réservez votre session.</p>
        </div>
      </section>

      <section className="section">
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={validate} className="h-fit rounded-3xl border border-border bg-white p-6 shadow-lift">
            <h2 className="flex items-center gap-2 text-2xl font-black"><Search /> Valider ma Carte Cadeau SpotyKite</h2>
            <div className="mt-5 grid gap-3">
              <input className="field" required placeholder="Code de la Carte Cadeau SpotyKite" value={lookup.code} onChange={(event) => setLookup({ ...lookup, code: event.target.value })} />
              <input className="field" required type="email" placeholder="Adresse email du bénéficiaire" value={lookup.recipientEmail} onChange={(event) => setLookup({ ...lookup, recipientEmail: event.target.value })} />
              <button className="btn-primary justify-center" type="submit">Valider ma Carte Cadeau</button>
            </div>
            {error && (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/35 bg-primary/10 p-3 text-sm font-bold text-primary">
                <ShieldAlert size={18} /> {error}
              </p>
            )}
          </form>

          <div>
            {!card && !confirmed && (
              <div className="card p-8">
                <Waves className="text-primary" size={42} />
                <h2 className="mt-4 text-3xl font-black">Votre expérience vous attend</h2>
                <p className="mt-3 text-muted">Saisissez le code et l’email du bénéficiaire pour afficher l’expérience offerte, le montant et la date d’expiration.</p>
              </div>
            )}

            {card && !confirmed && (
              <div className="grid gap-5">
                <div className="card p-6">
                  <p className="eyebrow">Carte valide</p>
                  <h2 className="text-3xl font-black">Carte Cadeau SpotyKite</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Info label="Montant" value={`${card.amount} €`} />
                    <Info label="Expiration" value={formatDate(card.expiresAt)} />
                    <Info label="Statut" value={card.status} />
                  </div>
                </div>

                <form onSubmit={redeem} className="rounded-3xl border border-border bg-white p-6 shadow-lift">
                  <h2 className="flex items-center gap-2 text-2xl font-black"><CalendarCheck /> Réserver ma session</h2>
                  <p className="mt-2 text-sm text-muted">Choisissez la région, le spot et la date. Spotykite confirme ensuite la session selon les conditions météo.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-bold">Choix de la région
                      <select className="field" value={booking.region} onChange={(event) => setBooking({ ...booking, region: event.target.value })}>
                        {[...new Set(schools.map((school) => school.region))].map((region) => <option key={region}>{region}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold">Choix du spot
                      <select className="field" value={booking.schoolId} onChange={(event) => setBooking({ ...booking, schoolId: event.target.value })}>
                        {filteredSchools.map((school) => <option key={school.id} value={school.id}>{publicSchoolMapLabel(school)}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold">Choix de la date
                      <input className="field" required type="date" value={booking.date} onChange={(event) => setBooking({ ...booking, date: event.target.value })} />
                    </label>
                  </div>
                  <button className="btn-primary mt-5 w-full justify-center" type="submit">Réserver ma session</button>
                </form>
              </div>
            )}

            {confirmed && (
              <div className="card p-8">
                <CalendarCheck className="text-primary" size={48} />
                <h2 className="mt-4 text-3xl font-black">Session réservée</h2>
                <p className="mt-3 text-muted">Votre Carte Cadeau SpotyKite est maintenant utilisée et associée à la réservation #{confirmed.booking.id}.</p>
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
      <p className="mt-1 font-black text-primary">{value}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'Non définie';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
}
