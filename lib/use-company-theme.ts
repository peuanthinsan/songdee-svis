import { useMemo } from 'react';
import { createCompanyTheme } from '../constants/theme';
import { useAuth } from './auth-context';

export function useCompanyTheme() {
  const { user } = useAuth();

  return useMemo(
    () => createCompanyTheme(user?.primaryColor, user?.accentColor),
    [user?.primaryColor, user?.accentColor],
  );
}
