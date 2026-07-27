import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { IssuesPage } from './pages/IssuesPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="issues" element={<IssuesPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
