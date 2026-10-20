import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { CredentialsPage } from '../pages/CredentialsPage';
import { AccessPage } from '../pages/AccessPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminLayout } from '../layouts/AdminLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { ProviderDirectoryPage } from '../pages/ProviderDirectoryPage';
import { BookingsPage } from '../pages/BookingsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { StaffPage } from '../pages/StaffPage';
import { HomeGaragePage } from '../pages/HomeGaragePage';
import { VerificationPage } from '../pages/VerificationPage';
import { ReportsPage } from '../pages/ReportsPage';
import { ComplaintsPage } from '../pages/ComplaintsPage';
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
        <Route path="admin/verification" element={<VerificationPage />} />
        <Route path="admin/staff" element={<StaffPage />} />
        <Route path="admin/mechanics" element={<ProviderDirectoryPage role="onsite-mechanic" />} />
        <Route path="admin/auto-shops" element={<ProviderDirectoryPage role="shop-owner" />} />
        <Route path="admin/towing" element={<ProviderDirectoryPage role="towing-company" />} />
        <Route path="admin/home-garage" element={<HomeGaragePage />} />
        <Route path="admin/vehicle-owners" element={<ProviderDirectoryPage role="owner" />} />
        <Route path="admin/bookings" element={<BookingsPage />} />
        <Route path="admin/notifications" element={<NotificationsPage />} />
        <Route path="admin/reports" element={<ReportsPage />} />
        <Route path="admin/complaints" element={<ComplaintsPage />} />
      </Route>
    </Route>
  </Routes>;
}
