import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { CredentialsPage } from '../pages/CredentialsPage';
import { AccessPage } from '../pages/AccessPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminLayout } from '../layouts/AdminLayout';
import { DashboardPage } from '../pages/DashboardPage';
export function AppRoutes() {
  return <Routes>
    <Route element={<AuthLayout />}>
      <Route index element={<Navigate to="/login" replace />} />
      <Route path="login" element={<CredentialsPage key="login" mode="login" />} />
      <Route path="register" element={<CredentialsPage key="register" mode="register" />} />
      <Route path="access" element={<AccessPage />} />
      <Route path="*" element={<><h2 className="text-2xl font-semibold">Page not found</h2><Link to="/" className="mt-4 inline-block text-brand">Return to account access</Link></>} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route element={<AdminLayout />}>
        <Route path="admin" element={<DashboardPage />} />
      </Route>
    </Route>
  </Routes>;
}
