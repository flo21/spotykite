import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, CreditCard, UserRound } from 'lucide-react';
import { api } from '../api.js';
import Loading from '../components/Loading.jsx';
import { publicSchoolLocation, publicSchoolTitle } from '../utils/schoolDisplay.js';

export default function Reservation() {
  const [searchParams] = useSearchParams();
  const { token: resumeRouteToken } = useParams();
  const type = searchParams.get('type');
  const [resumedOrder, setResumedOrder] = useState(null);
  const isGiftCard = type === 'gift-card' || resumedOrder?.type === 'gift_card';
  const schoolId = searchParams.get('schoolId');
  const offerId = searchParams.get('offerId');
  const [school, setSchool] = useState(null);
  const [status, setStatus] = useState(isGiftCard ? 'ready' : schoolId && offerId ? 'loading' : 'missing');
  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState({
    customerFirstname: '',
    customerLastname: '',
    customerEmail: '',
    customerPhone: '',
    desiredDate: '',
    dateFlexible: false
  });
  const [giftCard, setGiftCard] = useState({
    buyerFirstname: '',
    buyerLastname: '',
    buyerEmail: '',
    buyerPhone: '',
    recipientMode: 'self',
    recipientFirstname: '',
    recipientEmail: '',
    message: ''
  });
  const [created, setCreated] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);
  const [resumeOrder, setResumeOrder] = useState(null);

  useEffect(() => {
    if (!resumeRouteToken) return;
    let active = true;
    setStatus('loading');
    api.resumeOrder(resumeRouteToken)
      .then((data) => {
        if (!active) return;
        setResumedOrder(data);
        setResumeOrder(data);
        localStorage.setItem('spotykiteResumeToken', data.resumeToken);
        if (data.type === 'gift_card') {
          setGiftCard((current) => ({
            ...current,
            buyerFirstname: data.firstName || '',
            buyerLastname: data.lastName || '',
            buyerEmail: data.email || '',
            buyerPhone: data.phone || ''
          }));
          setStatus('ready');
        } else {
          setBooking((current) => ({
            ...current,
            customerFirstname: data.firstName || '',
            customerLastname: data.lastName || '',
            customerEmail: data.email || '',
            customerPhone: data.phone || '',
            desiredDate: data.desiredDate || ''
          }));
        }
        setStep(stepFromName(data.lastStep));
      })
      .catch(() => setStatus('missing'));
    return () => {
      active = false;
    };
  }, [resumeRouteToken]);

  useEffect(() => {
    if (isGiftCard) {
      setStatus('ready');
      return;
    }
    const nextSchoolId = schoolId || resumedOrder?.schoolId;
    const nextOfferId = offerId || resumedOrder?.formulaId;
    if (!nextSchoolId || !nextOfferId) {
      setStatus('missing');
      return;
    }
    let active = true;
    setStatus('loading');
    api.school(nextSchoolId)
      .then((data) => {
        if (!active) return;
        setSchool(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('missing');
      });
    return () => {
      active = false;
    };
  }, [isGiftCard, schoolId, offerId, resumedOrder?.schoolId, resumedOrder?.formulaId]);

  const offer = useMemo(() => {
    return school?.formulas?.find((formula) => String(formula.id) === String(offerId || resumedOrder?.formulaId));
  }, [school, offerId, resumedOrder?.formulaId]);
  const canBookSchool = isGiftCard || (school?.frontVisibility === 'active' && school?.bookingEnabled);

  useEffect(() => {
    if (isGiftCard || !school || !offer) return;
    window.localStorage.setItem('currentBooking', JSON.stringify({
      schoolId: school.id,
      schoolName: publicSchoolTitle(school),
      formulaId: offer.id,
      formulaName: offer.name,
      price: offer.price,
      reservationUrl: `/reservation?schoolId=${encodeURIComponent(school.id)}&offerId=${encodeURIComponent(offer.id)}`
    }));
    window.dispatchEvent(new Event('spotykite-storage-update'));
  }, [isGiftCard, school, offer]);

  useEffect(() => {
    if (isGiftCard || !school?.id || !offer?.id) {
      setAvailabilities([]);
      return;
    }
    let active = true;
    api.availabilities({ schoolId: school.id, formulaId: offer.id })
      .then((data) => {
        if (!active) return;
        setAvailabilities(data || []);
      })
      .catch(() => {
        if (!active) return;
        setAvailabilities([]);
      });
    return () => {
      active = false;
    };
  }, [isGiftCard, school?.id, offer?.id]);

  const canContinueContact = booking.customerFirstname && booking.customerLastname && booking.customerEmail && booking.customerPhone;
  const canContinueDate = booking.dateFlexible || booking.desiredDate;
  const canContinueGiftBuyer = giftCard.buyerFirstname && giftCard.buyerLastname && giftCard.buyerEmail;
  const canContinueGiftRecipient = giftCard.recipientMode === 'self' || (giftCard.recipientFirstname && giftCard.recipientEmail);
  const giftRecipientName = giftCard.recipientMode === 'self' ? `${giftCard.buyerFirstname} ${giftCard.buyerLastname}`.trim() : giftCard.recipientFirstname;
  const giftRecipientEmail = giftCard.recipientMode === 'self' ? giftCard.buyerEmail : giftCard.recipientEmail;
  const selectedAvailability = availabilities.find((item) => item.date === booking.desiredDate);
  const selectedPrice = selectedAvailability?.appliedPrice || offer?.price || 0;

  useEffect(() => {
    const timeout = setTimeout(() => {
      saveInitiated('contact');
    }, 600);
    return () => clearTimeout(timeout);
  }, [booking.customerEmail, booking.customerPhone, booking.customerFirstname, booking.customerLastname, giftCard.buyerEmail, giftCard.buyerPhone, giftCard.buyerFirstname, giftCard.buyerLastname, isGiftCard, school?.id, offer?.id]);

  useEffect(() => {
    if (step >= 2) saveInitiated(stepName(step));
  }, [step, booking.desiredDate, booking.dateFlexible]);

  async function saveInitiated(lastStep) {
    const email = isGiftCard ? giftCard.buyerEmail : booking.customerEmail;
    const phone = isGiftCard ? giftCard.buyerPhone : booking.customerPhone;
    if (!email && !phone) return;
    const existingToken = resumeOrder?.resumeToken || localStorage.getItem('spotykiteResumeToken');
    const payload = {
      resumeToken: existingToken || undefined,
      type: isGiftCard ? 'gift_card' : 'booking',
      schoolId: isGiftCard ? null : school?.id,
      formulaId: isGiftCard ? null : offer?.id,
      desiredDate: booking.dateFlexible ? 'date à définir' : booking.desiredDate,
      firstName: isGiftCard ? giftCard.buyerFirstname : booking.customerFirstname,
      lastName: isGiftCard ? giftCard.buyerLastname : booking.customerLastname,
      email,
      phone,
      amount: isGiftCard ? 199 : selectedPrice,
      sourcePage: window.location.pathname + window.location.search,
      lastStep
    };
    try {
      const saved = await api.createInitiatedOrder(payload);
      setResumeOrder(saved);
      localStorage.setItem('spotykiteResumeToken', saved.resumeToken);
    } catch {
      // Silent autosave failure: final submit still shows blocking API errors.
    }
  }

  if (status === 'loading') return <Loading />;

  if (!isGiftCard && (status === 'missing' || !(schoolId || resumedOrder?.schoolId) || !(offerId || resumedOrder?.formulaId) || !school || !offer || !canBookSchool)) {
    return (
      <main className="section pt-12">
        <div className="card mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-4xl font-black text-navy">{!canBookSchool && school ? 'Préparez votre stage' : 'Réservation incomplète'}</h1>
          <p className="mt-3 text-muted">{!canBookSchool && school ? 'Faites votre demande et notre équipe vous proposera la solution la plus adaptée sur ce spot.' : 'Sélectionnez un spot et une formule avant de démarrer votre réservation.'}</p>
          <Link to="/ecoles" className="btn-primary mt-6 justify-center">Voir les écoles</Link>
        </div>
      </main>
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (isGiftCard) {
      const result = await api.createGiftCard({
        buyerName: `${giftCard.buyerFirstname} ${giftCard.buyerLastname}`.trim(),
        buyerEmail: giftCard.buyerEmail,
        buyerPhone: giftCard.buyerPhone,
        recipientName: giftRecipientName,
        recipientEmail: giftRecipientEmail,
        message: giftCard.message,
        amount: 199,
        paymentStatus: 'paid',
        paymentProvider: 'stripe',
        resumeToken: resumeOrder?.resumeToken
      });
      setCreated(result);
      setStep(4);
      return;
    }
    const result = await api.createBooking({
      ...booking,
      offerId: offer.id,
      schoolId: school.id,
      region: school.region,
      level: offer.level,
      desiredDate: booking.dateFlexible ? 'date à définir' : booking.desiredDate,
      resumeToken: resumeOrder?.resumeToken
    });
    setCreated(result);
    setStep(4);
  }

  return (
    <main>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <p className="eyebrow">Tunnel de réservation</p>
          <h1 className="text-5xl font-black leading-none text-white sm:text-7xl">{isGiftCard ? 'Offrir une carte cadeau' : 'Réserver votre stage'}</h1>
          <p className="mt-3 text-lg font-bold text-white/80">{isGiftCard ? 'Carte cadeau Spotykite · 199 € · valable 1 an' : `${publicSchoolTitle(school)} · ${publicSchoolLocation(school)}`}</p>
        </div>
      </section>

      <section className="section">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="card p-6 sm:p-8">
            <StepNav current={step} isGiftCard={isGiftCard} />
            <form onSubmit={submit} className="mt-8 grid gap-6">
              {isGiftCard && step === 1 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 1 : Informations acheteur</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="field" required placeholder="Prénom" value={giftCard.buyerFirstname} onChange={(event) => setGiftCard({ ...giftCard, buyerFirstname: event.target.value })} />
                    <input className="field" required placeholder="Nom" value={giftCard.buyerLastname} onChange={(event) => setGiftCard({ ...giftCard, buyerLastname: event.target.value })} />
                    <input className="field sm:col-span-2" required type="email" placeholder="Email" value={giftCard.buyerEmail} onChange={(event) => setGiftCard({ ...giftCard, buyerEmail: event.target.value })} />
                    <input className="field sm:col-span-2" placeholder="Téléphone optionnel" value={giftCard.buyerPhone} onChange={(event) => setGiftCard({ ...giftCard, buyerPhone: event.target.value })} />
                  </div>
                  <button type="button" className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit" disabled={!canContinueGiftBuyer} onClick={() => setStep(2)}>Continuer</button>
                </div>
              )}

              {isGiftCard && step === 2 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 2 : Informations bénéficiaire</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setGiftCard({ ...giftCard, recipientMode: 'self' })} className={`rounded-2xl border p-4 text-left font-black ${giftCard.recipientMode === 'self' ? 'border-turquoise bg-sky text-navy' : 'border-border bg-bg text-muted'}`}>
                      J’offre à moi-même
                    </button>
                    <button type="button" onClick={() => setGiftCard({ ...giftCard, recipientMode: 'other' })} className={`rounded-2xl border p-4 text-left font-black ${giftCard.recipientMode === 'other' ? 'border-turquoise bg-sky text-navy' : 'border-border bg-bg text-muted'}`}>
                      J’offre à quelqu’un
                    </button>
                  </div>
                  {giftCard.recipientMode === 'other' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="field" required placeholder="Prénom bénéficiaire" value={giftCard.recipientFirstname} onChange={(event) => setGiftCard({ ...giftCard, recipientFirstname: event.target.value })} />
                      <input className="field" required type="email" placeholder="Email bénéficiaire" value={giftCard.recipientEmail} onChange={(event) => setGiftCard({ ...giftCard, recipientEmail: event.target.value })} />
                      <textarea className="field min-h-28 sm:col-span-2" placeholder="Message personnalisé optionnel" value={giftCard.message} onChange={(event) => setGiftCard({ ...giftCard, message: event.target.value })} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary justify-center" onClick={() => setStep(1)}>Retour</button>
                    <button type="button" className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60" disabled={!canContinueGiftRecipient} onClick={() => setStep(3)}>Voir le récapitulatif</button>
                  </div>
                </div>
              )}

              {isGiftCard && step === 3 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 3 : Récapitulatif</h2>
                  <div className="grid gap-3">
                    <SummaryRow label="Produit" value="Carte cadeau Spotykite" />
                    <SummaryRow label="Montant" value="199 €" />
                    <SummaryRow label="Validité" value="1 an" />
                    <SummaryRow label="Utilisation" value="Utilisable dans toutes les écoles Spotykite" />
                    <SummaryRow label="Envoi" value="Envoi numérique par e-mail" />
                    <SummaryRow label="Bénéficiaire" value={`${giftRecipientName} · ${giftRecipientEmail}`} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary justify-center" onClick={() => setStep(2)}>Retour</button>
                    <button type="submit" className="btn-primary justify-center">Confirmer et passer au paiement</button>
                  </div>
                </div>
              )}

              {isGiftCard && step === 4 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 4 : Paiement</h2>
                  <div className="rounded-2xl border border-turquoise/30 bg-sky/50 p-5">
                    <p className="font-black text-navy">Carte cadeau créée{created?.code ? ` : ${created.code}` : ''}.</p>
                    <p className="mt-2 text-sm font-bold text-muted">Montant : 199 € · Solde initial : 199 € · Statut : active · Expiration : {created?.expiresAt || 'dans 1 an'}.</p>
                    <p className="mt-2 text-sm font-bold text-muted">Le paiement sécurisé Stripe sera finalisé dans l’étape de paiement Spotykite.</p>
                  </div>
                  <Link to="/ecoles" className="btn-secondary justify-center sm:w-fit">Voir les écoles Spotykite</Link>
                </div>
              )}

              {!isGiftCard && step === 1 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 1 : Coordonnées</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="field" required placeholder="Prénom" value={booking.customerFirstname} onChange={(event) => setBooking({ ...booking, customerFirstname: event.target.value })} />
                    <input className="field" required placeholder="Nom" value={booking.customerLastname} onChange={(event) => setBooking({ ...booking, customerLastname: event.target.value })} />
                    <input className="field sm:col-span-2" required type="email" placeholder="Email" value={booking.customerEmail} onChange={(event) => setBooking({ ...booking, customerEmail: event.target.value })} />
                    <input className="field sm:col-span-2" required placeholder="Téléphone" value={booking.customerPhone} onChange={(event) => setBooking({ ...booking, customerPhone: event.target.value })} />
                  </div>
                  <button type="button" className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit" disabled={!canContinueContact} onClick={() => setStep(2)}>Continuer</button>
                </div>
              )}

              {!isGiftCard && step === 2 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 2 : Date</h2>
                  {availabilities.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {availabilities.map((item) => {
                        const isAvailable = item.status === 'available' && Number(item.availablePlaces) > 0;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={!isAvailable || booking.dateFlexible}
                            onClick={() => setBooking({ ...booking, desiredDate: item.date, dateFlexible: false })}
                            className={`rounded-2xl border p-4 text-left transition ${booking.desiredDate === item.date && !booking.dateFlexible ? 'border-turquoise bg-sky text-navy' : isAvailable ? 'border-turquoise/35 bg-white text-navy hover:border-turquoise' : 'cursor-not-allowed border-border bg-bg text-muted opacity-60'}`}
                          >
                            <span className="block text-lg font-black">{formatReservationDate(item.date)}</span>
                            {item.appliedPrice && (
                              <span className="mt-1 block text-sm font-black text-ocean">
                                {item.normalPrice && item.normalPrice !== item.appliedPrice ? <><span className="text-muted line-through">{item.normalPrice} €</span> {item.appliedPrice} €</> : `${item.appliedPrice} €`}
                              </span>
                            )}
                            <span className="mt-1 block text-xs font-black uppercase">{isAvailable ? `${item.availablePlaces} place${Number(item.availablePlaces) > 1 ? 's' : ''} disponible${Number(item.availablePlaces) > 1 ? 's' : ''}` : 'Complet'}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input className="field" type="date" disabled={booking.dateFlexible} required={!booking.dateFlexible} value={booking.desiredDate} onChange={(event) => setBooking({ ...booking, desiredDate: event.target.value })} />
                  )}
                  <label className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-4 text-sm font-black text-navy">
                    <input type="checkbox" checked={booking.dateFlexible} onChange={(event) => setBooking({ ...booking, dateFlexible: event.target.checked, desiredDate: event.target.checked ? '' : booking.desiredDate })} />
                    Je souhaite définir la date avec l’école
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary justify-center" onClick={() => setStep(1)}>Retour</button>
                    <button type="button" className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60" disabled={!canContinueDate} onClick={() => setStep(3)}>Voir le récapitulatif</button>
                  </div>
                </div>
              )}

              {!isGiftCard && step === 3 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 3 : Récapitulatif</h2>
                  <div className="grid gap-3">
                    <SummaryRow label="Spot" value={school.spot || school.city} />
                    <SummaryRow label="Formule" value={offer.name} />
                    <SummaryRow label="Date" value={booking.dateFlexible ? 'Date à définir' : booking.desiredDate} />
                    <SummaryRow label="Prix" value={`${selectedPrice} €${selectedAvailability?.specialOfferName ? ` · ${selectedAvailability.specialOfferName}` : ''}`} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary justify-center" onClick={() => setStep(2)}>Retour</button>
                    <button type="submit" className="btn-primary justify-center">Confirmer et passer au paiement</button>
                  </div>
                </div>
              )}

              {!isGiftCard && step === 4 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 4 : Paiement</h2>
                  <div className="rounded-2xl border border-turquoise/30 bg-sky/50 p-5">
                    <p className="font-black text-navy">Réservation créée{created?.id ? ` #${created.id}` : ''}.</p>
                    <p className="mt-2 text-sm font-bold text-muted">Le paiement sécurisé sera finalisé dans l’étape de paiement Spotykite.</p>
                  </div>
                  <Link to="/ecoles" className="btn-secondary justify-center sm:w-fit">Retour aux écoles</Link>
                </div>
              )}
              <p className="text-xs font-bold leading-relaxed text-muted">
                En envoyant ce formulaire, vous acceptez d’être recontacté par Spotykite au sujet de votre demande.
              </p>
            </form>
          </div>

          <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-lift">
            <h2 className="text-2xl font-black text-navy">{isGiftCard ? 'Votre carte cadeau' : 'Votre réservation'}</h2>
            {isGiftCard ? (
              <div className="mt-5 grid gap-3">
                <SummaryRow label="Produit" value="Carte cadeau Spotykite" />
                <SummaryRow label="Montant" value="199 €" />
                <SummaryRow label="Validité" value="1 an" />
                <SummaryRow label="Utilisation" value="Toutes les écoles Spotykite" />
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <SummaryRow label="Spot" value={school.spot || school.city} />
                <SummaryRow label="Formule" value={offer.name} />
                <SummaryRow label="Durée" value={offer.duration} />
                <SummaryRow label="Niveau" value={offer.level} />
                <SummaryRow label="Prix" value={`${selectedPrice} €`} />
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function StepNav({ current, isGiftCard = false }) {
  const steps = isGiftCard ? [
    [UserRound, 'Acheteur'],
    [Calendar, 'Bénéficiaire'],
    [CheckCircle2, 'Récapitulatif'],
    [CreditCard, 'Paiement']
  ] : [
    [UserRound, 'Coordonnées'],
    [Calendar, 'Date'],
    [CheckCircle2, 'Récapitulatif'],
    [CreditCard, 'Paiement']
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {steps.map(([Icon, label], index) => {
        const stepNumber = index + 1;
        const active = current >= stepNumber;
        return (
          <div key={label} className={`rounded-2xl border p-4 ${active ? 'border-turquoise bg-sky text-navy' : 'border-border bg-bg text-muted'}`}>
            <Icon size={22} />
            <p className="mt-2 text-sm font-black">{stepNumber}. {label}</p>
          </div>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-4">
      <p className="text-xs font-black uppercase text-muted">{label}</p>
      <p className="mt-1 font-black text-navy">{value || '-'}</p>
    </div>
  );
}

function formatReservationDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(value));
}

function stepName(step) {
  return {
    1: 'contact',
    2: 'date',
    3: 'recap',
    4: 'payment'
  }[step] || 'contact';
}

function stepFromName(value) {
  return {
    contact: 1,
    buyer: 1,
    date: 2,
    recipient: 2,
    recap: 3,
    payment: 4
  }[value] || 1;
}
