import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import AppLayout from '@/components/layout/AppLayout';
import useAuthStore from '@/store/authStore';
import { isAdminRole, isHRLevel } from '@/lib/utils';

import LoginPage from '@/pages/auth/LoginPage';
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage';

import EmployeeDashboard from '@/pages/employee/EmployeeDashboard';
import AttendancePage from '@/pages/employee/AttendancePage';
import LeavePage from '@/pages/employee/LeavePage';

import HRDashboard from '@/pages/hr/HRDashboard';
import HRAttendancePage from '@/pages/hr/HRAttendancePage';
import LeaveManagementPage from '@/pages/hr/LeaveManagementPage';
import EmployeesPage from '@/pages/hr/EmployeesPage';
import IdleMonitorPage from '@/pages/hr/IdleMonitorPage';
import ReportsPage from '@/pages/hr/ReportsPage';
import CalendarPage from '@/pages/CalendarPage';
import ProfilePage from '@/pages/ProfilePage';
import LeaveBalancePage from '@/pages/LeaveBalancePage';
import AnnouncementsPage from '@/pages/AnnouncementsPage';
import MasterDataPage from '@/pages/hr/MasterDataPage';
import AuditLogPage from '@/pages/hr/AuditLogPage';

// Redirect employees away from HR-only routes
function RequireHR({ children }) {
  const { user } = useAuthStore();
  if (!isAdminRole(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// Stricter gate — HR & Superuser only (excludes Team Lead)
function RequireHRLevel({ children }) {
  const { user } = useAuthStore();
  if (!isHRLevel(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 0 } } });

function DashboardRedirect() {
  const { user } = useAuthStore();
  return isAdminRole(user?.role) ? <HRDashboard /> : <EmployeeDashboard />;
}

function AttendanceRedirect() {
  const { user } = useAuthStore();
  return isAdminRole(user?.role) ? <HRAttendancePage /> : <AttendancePage />;
}

function LeavesRedirect() {
  const { user } = useAuthStore();
  return isAdminRole(user?.role) ? <LeaveManagementPage /> : <LeavePage />;
}

function LeaveBalanceRedirect() {
  // LeaveBalancePage itself already handles HR vs employee view internally
  return <LeaveBalancePage />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontSize: '14px', fontWeight: '500' } }} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard"     element={<DashboardRedirect />} />
            <Route path="/attendance"    element={<AttendanceRedirect />} />
            <Route path="/leaves"        element={<LeavesRedirect />} />
            <Route path="/employees"     element={<RequireHR><EmployeesPage /></RequireHR>} />
            <Route path="/idle"          element={<RequireHR><IdleMonitorPage /></RequireHR>} />
            <Route path="/reports"       element={<RequireHR><ReportsPage /></RequireHR>} />
            <Route path="/calendar"      element={<CalendarPage />} />
            <Route path="/profile"       element={<ProfilePage />} />
            <Route path="/leave-balance" element={<LeaveBalanceRedirect />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/master-data"   element={<RequireHR><MasterDataPage /></RequireHR>} />
            <Route path="/audit-log"     element={<RequireHRLevel><AuditLogPage /></RequireHRLevel>} />
            {/* Personal routes — always show the employee view regardless of role */}
            <Route path="/my-attendance" element={<AttendancePage />} />
            <Route path="/my-leaves"     element={<LeavePage />} />
            <Route path="/my-balance"    element={<LeaveBalancePage forceEmployee />} />
          </Route>
          {/* The SSO popup never reaches the router — main.jsx intercepts the MSAL
              auth callback and closes the popup before React mounts. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
