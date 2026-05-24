import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import AppLayout from '@/components/layout/AppLayout';
import useAuthStore from '@/store/authStore';

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

// Redirect employees away from HR-only routes
function RequireHR({ children }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'hr' || user?.role === 'lead';
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 0 } } });

function DashboardRedirect() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'hr' || user?.role === 'lead';
  return isAdmin ? <HRDashboard /> : <EmployeeDashboard />;
}

function AttendanceRedirect() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'hr' || user?.role === 'lead';
  return isAdmin ? <HRAttendancePage /> : <AttendancePage />;
}

function LeavesRedirect() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'hr' || user?.role === 'lead';
  return isAdmin ? <LeaveManagementPage /> : <LeavePage />;
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
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/attendance" element={<AttendanceRedirect />} />
            <Route path="/leaves" element={<LeavesRedirect />} />
            <Route path="/employees" element={<RequireHR><EmployeesPage /></RequireHR>} />
            <Route path="/idle"      element={<RequireHR><IdleMonitorPage /></RequireHR>} />
            <Route path="/reports"   element={<RequireHR><ReportsPage /></RequireHR>} />
            <Route path="/calendar"       element={<CalendarPage />} />
            <Route path="/profile"        element={<ProfilePage />} />
            <Route path="/leave-balance"  element={<LeaveBalancePage />} />
            <Route path="/announcements"  element={<AnnouncementsPage />} />
            <Route path="/master-data"    element={<RequireHR><MasterDataPage /></RequireHR>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
