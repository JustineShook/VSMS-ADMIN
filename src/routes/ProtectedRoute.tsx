import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loading } from '../components/Loading';

/** UX guard only. Every future data operation also requires server-side rules. */
export function ProtectedRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (status !== 'admin') return <Navigate to="/access" replace />;
  return <Outlet />;
}
