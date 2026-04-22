import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import SettingDetailPage from './pages/SettingDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import SubmitPage from './pages/SubmitPage';
import EditPage from './pages/EditPage';
import ProfilePage from './pages/ProfilePage';
import AccountPage from './pages/AccountPage';
import ModPage from './pages/ModPage';
import ModImagesPage from './pages/ModImagesPage';
import ModReportsPage from './pages/ModReportsPage';
import AdminPage from './pages/AdminPage';
import AdminMaterialsPage from './pages/admin/AdminMaterialsPage';
import AdminDevicesPage from './pages/admin/AdminDevicesPage';
import AdminTagsPage from './pages/admin/AdminTagsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminSystemPage from './pages/admin/AdminSystemPage';
import PrivacyPage from './pages/PrivacyPage';
import NotFoundPage from './pages/NotFoundPage';
import { RequireAuth, RequireRole } from './components/RouteGuards';
import { DonationWidget } from './components/DonationWidget';
import { useAuthStore } from './lib/auth-store';

function Nav() {
  const { user, logout } = useAuthStore();
  const items = [
    ['/', 'Home'],
    ['/search', 'Search'],
    ['/submit', 'Submit'],
  ] as const;

  return (
    <header className="app-shell">
      <div className="nav-wrap">
        <Link className="brand" to="/">
          <span>LaserLedger</span>
          <small>precision settings library</small>
        </Link>
        <nav>
          {items.map(([to, label]) => (
            <Link key={to} to={to} className="nav-link">
              {label}
            </Link>
          ))}
          {(user?.role === 'moderator' || user?.role === 'admin') && (
            <Link to="/mod" className="nav-link">Mod</Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin" className="nav-link">Admin</Link>
          )}
          {user ? (
            <>
              <Link to={`/profile/${user.id}`} className="nav-link">{user.display_name}</Link>
              <button onClick={() => logout()} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="cta">Sign in</Link>
          )}
          <DonationWidget />
        </nav>
      </div>
    </header>
  );
}

function AppFooter() {
  useEffect(() => {
    const h = window.location.hostname;
    const base = h.indexOf('test.') > -1 ? 'https://test.lasertools.org' : 'https://lasertools.org';
    const ltBack = document.getElementById('lt-back') as HTMLAnchorElement | null;
    if (ltBack) ltBack.href = base;
    const s = document.createElement('script');
    s.src = base + '/api/widget.js';
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);

  return (
    <footer className="app-footer">
      <div id="donation-tracker" data-variant="compact"></div>
      <div className="footer-links">
        <a id="lt-back" href="https://lasertools.org" className="footer-link">← Back to LaserTools</a>
        <span className="footer-sep">·</span>
        &copy; 2026 Thomas Winnerl
        <span className="footer-sep">·</span>
        <a href="https://github.com/Pixelplanet/LaserLedger" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
        <span className="footer-sep">·</span>
        <Link to="/privacy" className="footer-link">Privacy Policy</Link>
      </div>
    </footer>
  );
}

export default function App() {
  const refresh = useAuthStore((s) => s.refresh);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return (
    <div className="page-bg">
      <Nav />
      <main className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings/:uuid" element={<SettingDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/submit" element={<RequireAuth><SubmitPage /></RequireAuth>} />
          <Route path="/settings/:uuid/edit" element={<RequireAuth><EditPage /></RequireAuth>} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/mod" element={<RequireRole min="moderator"><ModPage /></RequireRole>} />
          <Route path="/mod/images" element={<RequireRole min="moderator"><ModImagesPage /></RequireRole>} />
          <Route path="/mod/reports" element={<RequireRole min="moderator"><ModReportsPage /></RequireRole>} />
          <Route path="/admin" element={<RequireRole min="admin"><AdminPage /></RequireRole>} />
          <Route path="/admin/materials" element={<RequireRole min="admin"><AdminMaterialsPage /></RequireRole>} />
          <Route path="/admin/devices" element={<RequireRole min="admin"><AdminDevicesPage /></RequireRole>} />
          <Route path="/admin/tags" element={<RequireRole min="admin"><AdminTagsPage /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole min="admin"><AdminUsersPage /></RequireRole>} />
          <Route path="/admin/system" element={<RequireRole min="admin"><AdminSystemPage /></RequireRole>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <AppFooter />
    </div>
  );
}
