import { useEffect, useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Listings from './pages/Listings.jsx';
import StageProgram from './pages/StageProgram.jsx';
import OfferDetail from './pages/OfferDetail.jsx';
import SchoolDetail from './pages/SchoolDetail.jsx';
import Reservation from './pages/Reservation.jsx';
import GiftCard from './pages/GiftCard.jsx';
import OfferStageGift from './pages/OfferStageGift.jsx';
import RedeemGiftCard from './pages/RedeemGiftCard.jsx';
import Admin from './pages/Admin.jsx';
import FAQ from './pages/FAQ.jsx';
import CGV from './pages/CGV.jsx';
import PaymentSuccess from './pages/PaymentSuccess.jsx';
import PaymentCancel from './pages/PaymentCancel.jsx';
import VoucherConsume from './pages/VoucherConsume.jsx';
import SeoCityPage from './pages/SeoCityPage.jsx';

export default function App() {
  return (
    <>
      <RouteScrollManager />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/ecoles" element={<Listings />} />
          <Route path="/stages" element={<Listings />} />
          <Route path="/stage-kitesurf/:region" element={<Listings seoType="region" />} />
          <Route path="/stage-kitesurf/departement/:departement" element={<Listings seoType="departement" />} />
          <Route path="/stage-kitesurf/spot/:ville-ou-spot" element={<Listings seoType="spot" />} />
          <Route path="/stages/:slug" element={<StageProgram />} />
          <Route path="/spots" element={<Listings focus="spots" />} />
          <Route path="/ecole-kitesurf/:slug" element={<SchoolDetail />} />
          <Route path="/reservation" element={<Reservation />} />
          <Route path="/reservation/reprendre/:token" element={<Reservation />} />
          <Route path="/offres/:id" element={<OfferDetail />} />
          <Route path="/offrir" element={<GiftCard />} />
          <Route path="/cadeau" element={<Navigate to="/offrir" replace />} />
          <Route path="/carte-cadeau" element={<Navigate to="/offrir" replace />} />
          <Route path="/offrir-un-stage" element={<OfferStageGift />} />
          <Route path="/utiliser-carte-cadeau" element={<RedeemGiftCard />} />
          <Route path="/jai-une-carte-cadeau" element={<RedeemGiftCard />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/cgv" element={<CGV />} />
          <Route path="/paiement-reussi" element={<PaymentSuccess />} />
          <Route path="/paiement-annule" element={<PaymentCancel />} />
          <Route path="/voucher/consume/:token" element={<VoucherConsume />} />
          <Route path="/:seoCityPath" element={<SeoCityPage />} />
        </Route>
        <Route path="/admin" element={<Admin />} />
        <Route path="/backoffice" element={<Admin />} />
      </Routes>
    </>
  );
}

function RouteScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    if (location.pathname !== '/') return;

    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => {
    if (location.pathname !== '/') return;

    if (location.hash === '#map') {
      window.requestAnimationFrame(() => {
        document.getElementById('map')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    const timeout = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [location.pathname, location.hash, location.key]);

  return null;
}
