import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ChecklistTab } from './admin/ChecklistTab';

export function ChecklistPage() {
  const { user } = useAuth();

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  return <ChecklistTab />;
}
