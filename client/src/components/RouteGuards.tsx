import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type Role } from '../lib/auth-store';

const order: Record<Role, number> = { user: 0, moderator: 1, admin: 2 };

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loaded, refresh } = useAuthStore();
  const location = useLocation();
  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);
  if (!loaded) return <p style={{ padding: 32 }}>Checking session…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export function RequireRole({ min, children }: { min: Role; children: ReactNode }) {
  const { user, loaded, refresh } = useAuthStore();
  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);
  if (!loaded) return <p style={{ padding: 32 }}>Checking permissions…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (order[user.role] < order[min]) return <Navigate to="/" replace />;
  return <>{children}</>;
}
