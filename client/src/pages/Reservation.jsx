import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, CreditCard, UserRound } from 'lucide-react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { api } from '../api.js';
import Loading from '../components/Loading.jsx';
import { publicSchoolLocation, publicSchoolTitle } from '../utils/schoolDisplay.js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export default function Reservation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token: resumeRouteToken } = useParams();
  const type = searchParams.get('type');
  const [resumedOrder, setResumedOrder] = useState(null);
  const isGiftStage = type === 'gift_stage' || type === 'gift-stage';
  const isGiftCard = type === 'gift-card' || resumedOrder?.type === 'gift_card';
  const useUnifiedGiftTunnel = isGiftCard;
  const giftStageName = searchParams.get('stage') || 'Stage de kitesurf';
  const giftStageFormula = searchParams.get('formula') || 'france';
  const giftStageCenter = searchParams.get('center') || '';
  const giftStageDepartment = searchParams.get('department') || '';
  const giftStagePrice = Number(searchParams.get('price') || 199);
  const schoolId = searchParams.get('schoolId');
  const offerId = searchParams.get('offerId');
  const [school, setSchool] = useState(null);
  const [status, setStatus] = useState(isGiftCard || (isGiftStage && !(schoolId && offerId)) ? 'ready' : schoolId && offerId ? 'loading' : 'missing');
  const [step, setStep] = useState(1);
  const [booking, setBooking] = useState({
    customerFirstname: '',
    customerLastname: '',
    customerEmail: '',
    customerPhone: '',
    desiredDate: '',
    dateFlexible: true
  });
  const [giftCard, setGiftCard] = useState({
    buyerFirstname: '',
    buyerLastname: '',
    buyerEmail: '',
    buyerPhone: '',
    recipientMode: 'other',
    recipientFirstname: '',
    recipientEmail: '',
    message: searchParams.get('message') || '',
    amount: searchParams.get('amount') || '199'
  });
  const [giftCardCode, setGiftCardCode] = useState(() => searchParams.get('giftCardCode') || window.localStorage.getItem('spotykiteGiftCardCode') || '');
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [giftCardError, setGiftCardError] = useState('');
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [paymentIntentLoading, setPaymentIntentLoading] = useState(false);
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
          const resumedDate = dateInputValue(data.desiredDate);
          setBooking((current) => ({
            ...current,
            customerFirstname: data.firstName || '',
            customerLastname: data.lastName || '',
            customerEmail: data.email || '',
            customerPhone: data.phone || '',
            desiredDate: resumedDate,
            dateFlexible: !resumedDate
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
    if (isGiftStage && !(schoolId || resumedOrder?.schoolId) && !(offerId || resumedOrder?.formulaId)) {
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
  }, [isGiftCard, isGiftStage, schoolId, offerId, resumedOrder?.schoolId, resumedOrder?.formulaId]);

  const offer = useMemo(() => {
    return school?.formulas?.find((formula) => String(formula.id) === String(offerId || resumedOrder?.formulaId));
  }, [school, offerId, resumedOrder?.formulaId]);
  const canBookSchool = isGiftCard || (school?.frontVisibility === 'active' && school?.bookingEnabled);

  useEffect(() => {
    if (isGiftCard || isGiftStage || !school || !offer) return;
    window.localStorage.setItem('currentBooking', JSON.stringify({
      schoolId: school.id,
      schoolName: publicSchoolTitle(school),
      formulaId: offer.id,
      formulaName: offer.name,
      price: offer.price,
      reservationUrl: `/reservation?schoolId=${encodeURIComponent(school.id)}&offerId=${encodeURIComponent(offer.id)}`
    }));
    window.dispatchEvent(new Event('spotykite-storage-update'));
  }, [isGiftCard, isGiftStage, school, offer]);

  useEffect(() => {
    if (isGiftCard || isGiftStage || !school?.id || !offer?.id) {
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
  }, [isGiftCard, isGiftStage, school?.id, offer?.id]);

  const canContinueContact = booking.customerFirstname && booking.customerLastname && booking.customerEmail && booking.customerPhone;
  const canContinueDate = booking.dateFlexible || booking.desiredDate;
  const customGiftAmount = Number(giftCard.amount || 199);
  const giftAmount = isGiftStage && Number.isFinite(giftStagePrice) && giftStagePrice > 0
    ? giftStagePrice
    : Number.isFinite(customGiftAmount) && customGiftAmount > 0
      ? customGiftAmount
      : 199;
  const giftProductName = isGiftStage ? `Cadeau ${giftStageName}` : 'Carte cadeau Spotykite';
  const giftFormulaLabel = isGiftStage
    ? giftStageFormula === 'centre'
      ? `École précise${giftStageCenter ? ` · ${giftStageCenter}` : ''}`
      : 'Toute France'
    : 'Carte cadeau Spotykite';
  const giftStageLocationLabel = giftStageFormula === 'centre'
    ? [giftStageCenter, giftStageDepartment].filter(Boolean).join(' · ') || 'École précise'
    : 'Réseau Spotykite France';
  const canContinueGiftBuyer = giftCard.buyerFirstname && giftCard.buyerLastname && giftCard.buyerEmail && giftAmount > 0;
  const canContinueGiftRecipient = isGiftCard ? giftCard.recipientFirstname : giftCard.recipientMode === 'self' || giftCard.recipientFirstname;
  const giftRecipientName = giftCard.recipientMode === 'self' ? `${giftCard.buyerFirstname} ${giftCard.buyerLastname}`.trim() : giftCard.recipientFirstname;
  const giftRecipientEmail = giftCard.recipientMode === 'self' ? giftCard.buyerEmail : giftCard.recipientEmail;
  const selectedAvailability = availabilities.find((item) => item.date === booking.desiredDate);
  const selectedPrice = selectedAvailability?.appliedPrice || offer?.price || 0;
  const checkoutAmount = isGiftStage ? giftAmount : selectedPrice;
  const giftCardBalance = Number(appliedGiftCard?.remainingAmount ?? appliedGiftCard?.remaining_amount ?? 0);
  const giftCardDiscount = !isGiftCard && giftCardBalance > 0 ? Math.min(giftCardBalance, checkoutAmount) : 0;
  const payableAmount = Math.max(checkoutAmount - giftCardDiscount, 0);
  const totalDue = payableAmount;
  const giftCardApplied = Boolean(appliedGiftCard?.code && giftCardDiscount > 0);
  const canConfirmGiftCardPayment = !isGiftCard
    && giftCardApplied
    && totalDue <= 0
    && booking.customerFirstname
    && booking.customerLastname
    && booking.customerEmail
    && canContinueDate
    && checkoutAmount > 0;
  const reservationTitle = isGiftStage ? giftProductName : `${offer?.name || ''} · ${school ? publicSchoolTitle(school) : ''}`.trim();
  const canPreparePayment = isGiftCard
    ? canContinueGiftBuyer && canContinueGiftRecipient && giftAmount > 0
    : canContinueContact && canContinueDate && checkoutAmount > 0 && payableAmount > 0 && (isGiftStage || (school && offer));

  useEffect(() => {
    const timeout = setTimeout(() => {
      saveInitiated('contact');
    }, 600);
    return () => clearTimeout(timeout);
  }, [booking.customerEmail, booking.customerPhone, booking.customerFirstname, booking.customerLastname, giftCard.buyerEmail, giftCard.buyerPhone, giftCard.buyerFirstname, giftCard.buyerLastname, isGiftCard, isGiftStage, school?.id, offer?.id]);

  useEffect(() => {
    if (step >= 2) saveInitiated(stepName(step));
  }, [step, booking.desiredDate, booking.dateFlexible]);

  useEffect(() => {
    if (!canPreparePayment) {
      setPaymentIntent(null);
      return;
    }

    let active = true;
    const timeout = setTimeout(() => {
      setPaymentIntentLoading(true);
      setPaymentError('');
      api.createPaymentIntent(isGiftCard ? giftCardPaymentPayload() : bookingPaymentPayload())
        .then((intent) => {
          if (!active) return;
          setPaymentIntent(intent);
        })
        .catch((error) => {
          if (!active) return;
          setPaymentIntent(null);
          setPaymentError(error.message || 'Impossible de préparer le paiement Stripe');
        })
        .finally(() => {
          if (active) setPaymentIntentLoading(false);
        });
    }, 500);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [
    canPreparePayment,
    booking.customerFirstname,
    booking.customerLastname,
    booking.customerEmail,
    booking.customerPhone,
    booking.desiredDate,
    booking.dateFlexible,
    checkoutAmount,
    payableAmount,
    giftCardCode,
    appliedGiftCard?.code,
    giftCardDiscount,
    isGiftStage,
    isGiftCard,
    giftStageName,
    giftStageFormula,
    giftStageCenter,
    giftStageDepartment,
    giftAmount,
    giftCard.buyerFirstname,
    giftCard.buyerLastname,
    giftCard.buyerEmail,
    giftCard.buyerPhone,
    giftCard.recipientMode,
    giftCard.recipientFirstname,
    giftCard.recipientEmail,
    giftCard.message,
    school?.id,
    offer?.id,
    resumeOrder?.resumeToken
  ]);

  useEffect(() => {
    setPaymentIntent(null);
    setPaymentError('');
  }, [payableAmount, appliedGiftCard?.code]);

  async function saveInitiated(lastStep) {
    const email = isGiftCard ? giftCard.buyerEmail : booking.customerEmail;
    const phone = isGiftCard ? giftCard.buyerPhone : booking.customerPhone;
    if (!email && !phone) return;
    const existingToken = resumeOrder?.resumeToken || localStorage.getItem('spotykiteResumeToken');
    const payload = {
      resumeToken: existingToken || undefined,
      type: isGiftCard ? 'gift_card' : isGiftStage ? 'gift_stage' : 'booking',
      schoolId: isGiftCard || (isGiftStage && giftStageFormula !== 'centre') ? null : school?.id,
      formulaId: isGiftCard || isGiftStage ? null : offer?.id,
      desiredDate: booking.dateFlexible ? 'date à définir' : booking.desiredDate,
      firstName: isGiftCard ? giftCard.buyerFirstname : booking.customerFirstname,
      lastName: isGiftCard ? giftCard.buyerLastname : booking.customerLastname,
      email,
      phone,
      amount: isGiftCard || isGiftStage ? giftAmount : selectedPrice,
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

  if (!isGiftCard && !isGiftStage && (status === 'missing' || !(schoolId || resumedOrder?.schoolId) || !(offerId || resumedOrder?.formulaId) || !school || !offer || !canBookSchool)) {
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
    setPaymentError('');
    setPaymentLoading(true);
    try {
      const checkout = await api.createCheckoutSession(isGiftCard ? giftCardCheckoutPayload() : bookingCheckoutPayload());
      if (checkout.checkoutUrl) {
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      throw new Error('Session Stripe invalide');
    } catch (error) {
      setPaymentError(error.message || 'Impossible de démarrer le paiement Stripe');
      setPaymentLoading(false);
    }
  }

  async function applyGiftCardCode() {
    const code = giftCardCode.trim();
    setGiftCardError('');
    setAppliedGiftCard(null);
    if (!code) {
      setGiftCardError('Renseignez un code carte cadeau.');
      return;
    }
    setGiftCardLoading(true);
    try {
      const card = await api.validateGiftCard({ code });
      setAppliedGiftCard(card);
      setGiftCardCode(card.code || code.toUpperCase());
      window.localStorage.setItem('spotykiteGiftCardCode', card.code || code.toUpperCase());
    } catch (error) {
      setGiftCardError(error.message || 'Carte cadeau invalide.');
    } finally {
      setGiftCardLoading(false);
    }
  }

  async function confirmGiftCardCoveredOrder() {
    setPaymentError('');
    if (!canConfirmGiftCardPayment) {
      setPaymentError('Complétez vos coordonnées avant de valider avec la carte cadeau.');
      return;
    }
    setPaymentLoading(true);
    try {
      const result = await api.confirmGiftCardPayment(bookingPaymentPayload());
      window.localStorage.removeItem('spotykiteGiftCardCode');
      navigate(`/paiement-reussi?order=${encodeURIComponent(result.orderNumber || result.orderId || '')}`);
    } catch (error) {
      setPaymentError(error.message || 'Impossible de valider la carte cadeau.');
    } finally {
      setPaymentLoading(false);
    }
  }

  function bookingCheckoutPayload() {
    const desiredDate = booking.dateFlexible ? 'date à définir' : booking.desiredDate;
    const title = `${offer.name} · ${publicSchoolTitle(school)}`;
    return {
      amount: selectedPrice,
      customerEmail: booking.customerEmail,
      title,
      order: {
        customerName: `${booking.customerFirstname} ${booking.customerLastname}`.trim(),
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        productType: 'booking',
        city: school.city,
        spot: school.spot,
        amount: selectedPrice,
        title,
        partnerId: school.id,
        metadata: {
          schoolId: school.id,
          schoolName: publicSchoolTitle(school),
          offerId: offer.id,
          offerName: offer.name,
          formulaId: offer.id,
          desiredDate,
          resumeToken: resumeOrder?.resumeToken || ''
        }
      },
      metadata: {
        type: 'booking',
        schoolId: school.id,
        schoolName: publicSchoolTitle(school),
        offerId: offer.id,
        offerName: offer.name,
        formulaId: offer.id,
        desiredDate,
        resumeToken: resumeOrder?.resumeToken || ''
      }
    };
  }

  function bookingPaymentPayload() {
    const desiredDate = booking.dateFlexible ? 'date à définir' : booking.desiredDate;
    const customerName = `${booking.customerFirstname} ${booking.customerLastname}`.trim();
    const title = isGiftStage ? reservationTitle : `${offer.name} · ${publicSchoolTitle(school)}`;
    const baseMetadata = isGiftStage ? {
      type: 'gift_stage',
      giftType: 'stage',
      giftStage: giftStageName,
      giftFormula: giftStageFormula,
      giftCenter: giftStageCenter,
      giftDepartment: giftStageDepartment,
      giftPrice: String(giftAmount),
      offerName: giftStageName,
      schoolName: giftStageLocationLabel,
      selectedDate: desiredDate,
      desiredDate,
      message: giftCard.message,
      resumeToken: resumeOrder?.resumeToken || ''
    } : {
      type: 'booking',
      schoolId: school.id,
      schoolName: publicSchoolTitle(school),
      offerId: offer.id,
      offerName: offer.name,
      formulaId: offer.id,
      selectedDate: desiredDate,
      desiredDate,
      resumeToken: resumeOrder?.resumeToken || ''
    };
    if (appliedGiftCard?.code && giftCardDiscount > 0) {
      baseMetadata.giftCardCode = appliedGiftCard.code;
      baseMetadata.giftCardDiscount = String(giftCardDiscount);
      baseMetadata.giftCardInitialBalance = String(giftCardBalance);
      baseMetadata.originalAmount = String(checkoutAmount);
    }
    return {
      amount: payableAmount,
      customerEmail: booking.customerEmail,
      customerName,
      title,
      order: {
        customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        productType: isGiftStage ? 'gift_stage' : 'booking',
        city: isGiftStage ? giftStageDepartment || 'France' : school.city,
        spot: isGiftStage ? giftStageLocationLabel : school.spot,
        amount: checkoutAmount,
        title,
        partnerId: isGiftStage ? (giftStageFormula === 'centre' ? school?.id : null) : school.id,
        metadata: baseMetadata
      },
      metadata: baseMetadata
    };
  }

  function giftCardCheckoutPayload() {
    const title = giftProductName;
    return {
      amount: giftAmount,
      customerEmail: giftCard.buyerEmail,
      title,
      order: {
        customerName: `${giftCard.buyerFirstname} ${giftCard.buyerLastname}`.trim(),
        customerEmail: giftCard.buyerEmail,
        customerPhone: giftCard.buyerPhone,
        productType: isGiftStage ? 'gift_stage' : 'gift_card',
        amount: giftAmount,
        title,
        metadata: {
          giftType: isGiftStage ? 'stage' : 'gift_card',
          giftStage: isGiftStage ? giftStageName : '',
          giftFormula: isGiftStage ? giftStageFormula : '',
          giftCenter: giftStageCenter,
          giftDepartment: giftStageDepartment,
          giftPrice: String(giftAmount),
          recipientName: giftRecipientName,
          recipientEmail: giftRecipientEmail,
          message: giftCard.message,
          resumeToken: resumeOrder?.resumeToken || ''
        }
      },
      metadata: {
        type: isGiftStage ? 'gift_stage' : 'gift_card',
        giftType: isGiftStage ? 'stage' : 'gift_card',
        giftStage: isGiftStage ? giftStageName : '',
        giftFormula: isGiftStage ? giftStageFormula : '',
        giftCenter: giftStageCenter,
        giftDepartment: giftStageDepartment,
        giftPrice: String(giftAmount),
        recipientName: giftRecipientName,
        recipientEmail: giftRecipientEmail,
        resumeToken: resumeOrder?.resumeToken || ''
      }
    };
  }

  function giftCardPaymentPayload() {
    const buyerName = `${giftCard.buyerFirstname} ${giftCard.buyerLastname}`.trim();
    return {
      amount: giftAmount,
      customerEmail: giftCard.buyerEmail,
      customerName: buyerName,
      title: 'Carte cadeau Spotykite',
      order: {
        customerName: buyerName,
        customerEmail: giftCard.buyerEmail,
        customerPhone: giftCard.buyerPhone,
        productType: 'gift_card',
        amount: giftAmount,
        title: 'Carte cadeau Spotykite',
        metadata: {
          type: 'gift_card',
          giftType: 'gift_card',
          buyerFirstname: giftCard.buyerFirstname,
          buyerLastname: giftCard.buyerLastname,
          recipientName: giftRecipientName,
          recipientEmail: giftRecipientEmail,
          message: giftCard.message,
          giftPrice: String(giftAmount),
          resumeToken: resumeOrder?.resumeToken || ''
        }
      },
      metadata: {
        type: 'gift_card',
        giftType: 'gift_card',
        buyerFirstname: giftCard.buyerFirstname,
        buyerLastname: giftCard.buyerLastname,
        recipientName: giftRecipientName,
        recipientEmail: giftRecipientEmail,
        message: giftCard.message,
        giftPrice: String(giftAmount),
        resumeToken: resumeOrder?.resumeToken || ''
      }
    };
  }

  return (
    <main>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <p className="eyebrow">Tunnel de réservation</p>
          <h1 className="text-5xl font-black leading-none text-white sm:text-7xl">{isGiftCard ? 'Offrir une carte cadeau' : isGiftStage ? 'Offrir un stage' : 'Réserver votre stage'}</h1>
          <p className="mt-3 text-lg font-bold text-white/80">{isGiftCard || isGiftStage ? `${giftProductName} · ${giftAmount} € · ${giftFormulaLabel}` : `${publicSchoolTitle(school)} · ${publicSchoolLocation(school)}`}</p>
        </div>
      </section>

      <section className="section">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="card p-6 sm:p-8">
            {isGiftCard && !useUnifiedGiftTunnel && <StepNav current={step} isGiftCard />}
            <form onSubmit={(event) => event.preventDefault()} className="mt-8 grid gap-6">
              {isGiftCard && useUnifiedGiftTunnel && (
                <div className="grid gap-6">
                  <div>
                    <h2 className="text-4xl font-black text-navy">Finaliser votre achat</h2>
                    <p className="mt-2 text-sm font-bold text-muted">Renseignez les informations de l’acheteur et du bénéficiaire, puis finalisez le paiement sécurisé.</p>
                  </div>

                  <div className="grid gap-4">
                    <h3 className="text-2xl font-black text-navy">Acheteur</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="field" required placeholder="Prénom acheteur" value={giftCard.buyerFirstname} onChange={(event) => setGiftCard({ ...giftCard, buyerFirstname: event.target.value })} />
                      <input className="field" required placeholder="Nom acheteur" value={giftCard.buyerLastname} onChange={(event) => setGiftCard({ ...giftCard, buyerLastname: event.target.value })} />
                      <input className="field sm:col-span-2" required type="email" placeholder="Email acheteur" value={giftCard.buyerEmail} onChange={(event) => setGiftCard({ ...giftCard, buyerEmail: event.target.value })} />
                      <input className="field sm:col-span-2" placeholder="Téléphone acheteur optionnel" value={giftCard.buyerPhone} onChange={(event) => setGiftCard({ ...giftCard, buyerPhone: event.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <h3 className="text-2xl font-black text-navy">Bénéficiaire</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="field" required placeholder="Prénom du bénéficiaire" value={giftCard.recipientFirstname} onChange={(event) => setGiftCard({ ...giftCard, recipientMode: 'other', recipientFirstname: event.target.value })} />
                      <input className="field" type="email" placeholder="Email bénéficiaire optionnel" value={giftCard.recipientEmail} onChange={(event) => setGiftCard({ ...giftCard, recipientMode: 'other', recipientEmail: event.target.value })} />
                      <textarea className="field min-h-28 sm:col-span-2" placeholder="Message personnalisé optionnel" value={giftCard.message} onChange={(event) => setGiftCard({ ...giftCard, message: event.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <h3 className="text-2xl font-black text-navy">Carte cadeau</h3>
                    <div className="grid gap-3">
                      <input className="field" type="number" min="20" step="1" required placeholder="Montant de la carte cadeau" value={giftCard.amount} onChange={(event) => setGiftCard({ ...giftCard, amount: event.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <SummaryRow label="Produit" value={giftProductName} />
                    <SummaryRow label="Montant" value={`${giftAmount} €`} />
                    <SummaryRow label="Validité" value="1 an" />
                    <SummaryRow label="Envoi" value="Envoi numérique après paiement" />
                    <SummaryRow label="Bénéficiaire" value={[giftRecipientName, giftRecipientEmail].filter(Boolean).join(' · ') || '-'} />
                  </div>

                  <div className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="mb-3 text-xl font-black text-navy">Paiement</h3>
                    {!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY === 'pk_test_xxx' ? (
                      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                        VITE_STRIPE_PUBLISHABLE_KEY doit être configurée avec votre clé publique Stripe.
                      </p>
                    ) : paymentIntentLoading ? (
                      <p className="text-sm font-bold text-muted">Préparation du paiement sécurisé...</p>
                    ) : paymentIntent?.clientSecret ? (
                      <Elements stripe={stripePromise} options={{ clientSecret: paymentIntent.clientSecret, appearance: { theme: 'stripe' } }}>
                        <InlinePaymentForm
                          disabled={!canContinueGiftBuyer || !canContinueGiftRecipient}
                          paymentIntentId={paymentIntent.paymentIntentId}
                          onSuccess={(paymentIntentId) => navigate(`/paiement-reussi?payment_intent=${encodeURIComponent(paymentIntentId)}`)}
                        />
                      </Elements>
                    ) : (
                      <p className="text-sm font-bold text-muted">Complétez les informations pour afficher le paiement.</p>
                    )}
                  </div>
                  {paymentError && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{paymentError}</p>}
                </div>
              )}

              {isGiftCard && !useUnifiedGiftTunnel && step === 1 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 1 : Informations acheteur</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="field" required placeholder="Prénom" value={giftCard.buyerFirstname} onChange={(event) => setGiftCard({ ...giftCard, buyerFirstname: event.target.value })} />
                    <input className="field" required placeholder="Nom" value={giftCard.buyerLastname} onChange={(event) => setGiftCard({ ...giftCard, buyerLastname: event.target.value })} />
                    <input className="field sm:col-span-2" required type="email" placeholder="Email" value={giftCard.buyerEmail} onChange={(event) => setGiftCard({ ...giftCard, buyerEmail: event.target.value })} />
                    <input className="field sm:col-span-2" placeholder="Téléphone optionnel" value={giftCard.buyerPhone} onChange={(event) => setGiftCard({ ...giftCard, buyerPhone: event.target.value })} />
                    <input className="field" type="number" min="20" step="1" required placeholder="Montant de la carte cadeau" value={giftCard.amount} onChange={(event) => setGiftCard({ ...giftCard, amount: event.target.value })} />
                  </div>
                  <button type="button" className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit" disabled={!canContinueGiftBuyer} onClick={() => setStep(2)}>Continuer</button>
                </div>
              )}

              {isGiftCard && !useUnifiedGiftTunnel && step === 2 && (
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
                      <input className="field" type="email" placeholder="Email bénéficiaire optionnel" value={giftCard.recipientEmail} onChange={(event) => setGiftCard({ ...giftCard, recipientEmail: event.target.value })} />
                      <textarea className="field min-h-28 sm:col-span-2" placeholder="Message personnalisé optionnel" value={giftCard.message} onChange={(event) => setGiftCard({ ...giftCard, message: event.target.value })} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary justify-center" onClick={() => setStep(1)}>Retour</button>
                    <button type="button" className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60" disabled={!canContinueGiftRecipient} onClick={() => setStep(3)}>Voir le récapitulatif</button>
                  </div>
                </div>
              )}

              {isGiftCard && !useUnifiedGiftTunnel && step === 3 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 3 : Récapitulatif</h2>
                  <div className="grid gap-3">
                    <SummaryRow label="Produit" value={giftProductName} />
                    <SummaryRow label="Formule" value={giftFormulaLabel} />
                    <SummaryRow label="Montant" value={`${giftAmount} €`} />
                    <SummaryRow label="Validité" value="1 an" />
                    <SummaryRow label="Utilisation" value="Utilisable dans toutes les écoles Spotykite" />
                    <SummaryRow label="Envoi" value="Envoi numérique par e-mail" />
                    <SummaryRow label="Bénéficiaire" value={`${giftRecipientName} · ${giftRecipientEmail}`} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-secondary justify-center" onClick={() => setStep(2)}>Retour</button>
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="mb-3 text-xl font-black text-navy">Paiement</h3>
                    {payableAmount === 0 && appliedGiftCard ? (
                      <button type="button" className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60" disabled={paymentLoading || !canContinueContact || !canContinueDate} onClick={confirmGiftCardCoveredOrder}>
                        {paymentLoading ? 'Validation...' : 'Valider avec la carte cadeau'}
                      </button>
                    ) : !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY === 'pk_test_xxx' ? (
                      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                        VITE_STRIPE_PUBLISHABLE_KEY doit être configurée avec votre clé publique Stripe.
                      </p>
                    ) : paymentIntentLoading ? (
                      <p className="text-sm font-bold text-muted">Préparation du paiement sécurisé...</p>
                    ) : paymentIntent?.clientSecret ? (
                      <Elements stripe={stripePromise} options={{ clientSecret: paymentIntent.clientSecret, appearance: { theme: 'stripe' } }}>
                        <InlinePaymentForm
                          disabled={!canContinueGiftBuyer || !canContinueGiftRecipient}
                          paymentIntentId={paymentIntent.paymentIntentId}
                          onSuccess={(paymentIntentId) => navigate(`/paiement-reussi?payment_intent=${encodeURIComponent(paymentIntentId)}`)}
                        />
                      </Elements>
                    ) : (
                      <p className="text-sm font-bold text-muted">Complétez les informations pour afficher le paiement.</p>
                    )}
                  </div>
                  {paymentError && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{paymentError}</p>}
                </div>
              )}

              {isGiftCard && !useUnifiedGiftTunnel && step === 4 && (
                <div className="grid gap-4">
                  <h2 className="text-4xl font-black text-navy">Étape 4 : Paiement</h2>
                  <div className="rounded-2xl border border-turquoise/30 bg-sky/50 p-5">
                    <p className="font-black text-navy">Carte cadeau créée{created?.code ? ` : ${created.code}` : ''}.</p>
                    <p className="mt-2 text-sm font-bold text-muted">Montant : {giftAmount} € · Statut : active · Expiration : {created?.expiresAt || 'dans 1 an'}.</p>
                    <p className="mt-2 text-sm font-bold text-muted">Le paiement sécurisé Stripe sera finalisé dans l’étape de paiement Spotykite.</p>
                  </div>
                  <Link to="/ecoles" className="btn-secondary justify-center sm:w-fit">Voir les écoles Spotykite</Link>
                </div>
              )}

              {!isGiftCard && (
                <div className="grid gap-6">
                  <div>
                    <h2 className="text-4xl font-black text-navy">Finaliser votre réservation</h2>
                    <p className="mt-2 text-sm font-bold text-muted">Vos coordonnées suffisent pour lancer le paiement sécurisé Stripe.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="field" required placeholder="Prénom" value={booking.customerFirstname} onChange={(event) => setBooking({ ...booking, customerFirstname: event.target.value })} />
                    <input className="field" required placeholder="Nom" value={booking.customerLastname} onChange={(event) => setBooking({ ...booking, customerLastname: event.target.value })} />
                    <input className="field sm:col-span-2" required type="email" placeholder="Email" value={booking.customerEmail} onChange={(event) => setBooking({ ...booking, customerEmail: event.target.value })} />
                    <input className="field sm:col-span-2" required placeholder="Téléphone" value={booking.customerPhone} onChange={(event) => setBooking({ ...booking, customerPhone: event.target.value })} />
                  </div>

                  <div className="grid gap-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-4 text-sm font-black text-navy">
                      <input type="checkbox" checked={booking.dateFlexible} onChange={(event) => setBooking({ ...booking, dateFlexible: event.target.checked, desiredDate: event.target.checked ? '' : booking.desiredDate })} />
                      Définir la date avec l’école après paiement
                    </label>
                    {!booking.dateFlexible && (
                      availabilities.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {availabilities.map((item) => {
                            const isAvailable = item.status === 'available' && Number(item.availablePlaces) > 0;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                disabled={!isAvailable}
                                onClick={() => setBooking({ ...booking, desiredDate: item.date, dateFlexible: false })}
                                className={`rounded-2xl border p-4 text-left transition ${booking.desiredDate === item.date ? 'border-turquoise bg-sky text-navy' : isAvailable ? 'border-turquoise/35 bg-white text-navy hover:border-turquoise' : 'cursor-not-allowed border-border bg-bg text-muted opacity-60'}`}
                              >
                                <span className="block text-lg font-black">{formatReservationDate(item.date)}</span>
                                {item.appliedPrice && <span className="mt-1 block text-sm font-black text-ocean">{item.normalPrice && item.normalPrice !== item.appliedPrice ? <><span className="text-muted line-through">{item.normalPrice} €</span> {item.appliedPrice} €</> : `${item.appliedPrice} €`}</span>}
                                <span className="mt-1 block text-xs font-black uppercase">{isAvailable ? `${item.availablePlaces} place${Number(item.availablePlaces) > 1 ? 's' : ''} disponible${Number(item.availablePlaces) > 1 ? 's' : ''}` : 'Complet'}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input className="field" type="date" required value={booking.desiredDate} onChange={(event) => setBooking({ ...booking, desiredDate: event.target.value })} />
                      )
                    )}
                  </div>

                  <div className="grid gap-3">
                    <SummaryRow label={isGiftStage ? 'Stage offert' : 'Spot'} value={isGiftStage ? giftStageName : (school.spot || school.city)} />
                    <SummaryRow label="Formule" value={isGiftStage ? giftFormulaLabel : offer.name} />
                    <SummaryRow label="Date" value={booking.dateFlexible ? 'Date à définir' : booking.desiredDate} />
                    <SummaryRow label="Prix" value={`${checkoutAmount} €${!isGiftStage && selectedAvailability?.specialOfferName ? ` · ${selectedAvailability.specialOfferName}` : ''}`} />
                    {giftCardDiscount > 0 && <SummaryRow label="Carte cadeau" value={`-${giftCardDiscount} €`} />}
                    {giftCardDiscount > 0 && <SummaryRow label="À payer" value={`${totalDue} €`} />}
                  </div>

                  <div className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="mb-3 text-xl font-black text-navy">Carte cadeau</h3>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input className="field flex-1 uppercase" placeholder="Code carte cadeau" value={giftCardCode} onChange={(event) => setGiftCardCode(event.target.value.toUpperCase())} />
                      <button type="button" className="btn-secondary justify-center disabled:cursor-not-allowed disabled:opacity-60" disabled={giftCardLoading || !giftCardCode.trim()} onClick={applyGiftCardCode}>
                        {giftCardLoading ? 'Vérification...' : 'Appliquer'}
                      </button>
                    </div>
                    {appliedGiftCard && (
                      <p className="mt-3 rounded-2xl border border-turquoise/30 bg-sky/50 p-3 text-sm font-bold text-navy">
                        Carte cadeau appliquée : {giftCardDiscount} € utilisés sur {giftCardBalance} € disponibles.
                      </p>
                    )}
                    {giftCardError && <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{giftCardError}</p>}
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <h3 className="mb-3 text-xl font-black text-navy">Paiement</h3>
                    {totalDue <= 0 && giftCardApplied ? (
                      <button type="button" className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60" disabled={paymentLoading || !canConfirmGiftCardPayment} onClick={confirmGiftCardCoveredOrder}>
                        {paymentLoading ? 'Validation...' : 'Valider avec la carte cadeau'}
                      </button>
                    ) : !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY === 'pk_test_xxx' ? (
                      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                        VITE_STRIPE_PUBLISHABLE_KEY doit être configurée avec votre clé publique Stripe.
                      </p>
                    ) : paymentIntentLoading ? (
                      <p className="text-sm font-bold text-muted">Préparation du paiement sécurisé...</p>
                    ) : paymentIntent?.clientSecret ? (
                      <Elements stripe={stripePromise} options={{ clientSecret: paymentIntent.clientSecret, appearance: { theme: 'stripe' } }}>
                        <InlinePaymentForm
                          disabled={!canContinueContact || !canContinueDate}
                          paymentIntentId={paymentIntent.paymentIntentId}
                          onSuccess={(paymentIntentId) => navigate(`/paiement-reussi?payment_intent=${encodeURIComponent(paymentIntentId)}`)}
                        />
                      </Elements>
                    ) : (
                      <p className="text-sm font-bold text-muted">Complétez vos coordonnées pour afficher le paiement.</p>
                    )}
                  </div>
                  {paymentError && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{paymentError}</p>}
                </div>
              )}
              <p className="text-xs font-bold leading-relaxed text-muted">
                En envoyant ce formulaire, vous acceptez d’être recontacté par Spotykite au sujet de votre demande.
              </p>
            </form>
          </div>

          <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-lift">
            <h2 className="text-2xl font-black text-navy">{isGiftCard ? 'Votre carte cadeau' : isGiftStage ? 'Votre stage offert' : 'Votre réservation'}</h2>
            {isGiftCard ? (
              <div className="mt-5 grid gap-3">
                <SummaryRow label="Produit" value={giftProductName} />
                <SummaryRow label="Formule" value={giftFormulaLabel} />
                <SummaryRow label="Montant" value={`${giftAmount} €`} />
                <SummaryRow label="Validité" value="1 an" />
                <SummaryRow label="Utilisation" value="Toutes les écoles Spotykite" />
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <SummaryRow label={isGiftStage ? 'Stage' : 'Spot'} value={isGiftStage ? giftStageName : (school.spot || school.city)} />
                <SummaryRow label="Formule" value={isGiftStage ? giftFormulaLabel : offer.name} />
                {!isGiftStage && <SummaryRow label="Durée" value={offer.duration} />}
                {!isGiftStage && <SummaryRow label="Niveau" value={offer.level} />}
                <SummaryRow label="Prix" value={`${checkoutAmount} €`} />
                {giftCardDiscount > 0 && <SummaryRow label="Carte cadeau" value={`-${giftCardDiscount} €`} />}
                {giftCardDiscount > 0 && <SummaryRow label="À payer" value={`${totalDue} €`} />}
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function InlinePaymentForm({ disabled, paymentIntentId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function pay() {
    if (!stripe || !elements || disabled) return;
    setStatus('loading');
    setError('');
    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    });

    if (result.error) {
      setError(result.error.message || 'Le paiement a échoué.');
      setStatus('idle');
      return;
    }

    const paidIntentId = result.paymentIntent?.id || paymentIntentId;
    setStatus('paid');
    onSuccess(paidIntentId);
  }

  return (
    <div className="grid gap-4">
      <PaymentElement />
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <button type="button" className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60" disabled={!stripe || !elements || disabled || status === 'loading'} onClick={pay}>
        {status === 'loading' ? 'Paiement en cours...' : 'Payer et réserver'}
      </button>
    </div>
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

function dateInputValue(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
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
