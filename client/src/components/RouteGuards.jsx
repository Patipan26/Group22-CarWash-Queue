import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

function Guard({ admin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-20 text-center text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function ProtectedRoute() { return <Guard />; }
export function AdminRoute() { return <Guard admin />; }
