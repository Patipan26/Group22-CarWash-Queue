import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AdminRoute, ProtectedRoute } from './components/RouteGuards';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import BookingPage from './pages/BookingPage';
import StatusPage from './pages/StatusPage';
import ContactPage from './pages/ContactPage';
import AuthPage from './pages/AuthPage';
import AdminPage from './pages/AdminPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import TrackingPage from './pages/TrackingPage';
import PaymentPage from './pages/PaymentPage';

export default function App() {
  return <Layout><Routes><Route path="/" element={<HomePage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/booking" element={<BookingPage />} /><Route path="/contact" element={<ContactPage />} /><Route path="/auth" element={<AuthPage />} /><Route element={<ProtectedRoute />}><Route path="/payment/:bookingCode" element={<PaymentPage />} /><Route path="/tracking" element={<TrackingPage />} /><Route path="/status" element={<StatusPage />} /><Route path="/notifications" element={<NotificationsPage />} /><Route path="/profile" element={<ProfilePage />} /></Route><Route element={<AdminRoute />}><Route path="/admin" element={<AdminPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></Layout>;
}
