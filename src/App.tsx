import React, { useState, useEffect } from 'react';
import ScannerView from './components/public/ScannerView.tsx';
import AdminLayout from './components/admin/AdminLayout.tsx';
import AdminLogin from './components/admin/AdminLogin.tsx';
import { api, getAdminToken } from './services/api.ts';
import { AdminUser } from './types/index.ts';

const ADMIN_ROUTE_PATH = '/osc-admin-portal';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Synchronize route changes
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Listen for admin shortcut (Ctrl+Shift+A or Cmd+Shift+A) for convenience in evaluation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        navigateToAdmin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Verify stored session token on mount
  useEffect(() => {
    const verifyExistingSession = async () => {
      const token = getAdminToken();
      if (!token) {
        setCheckingAuth(false);
        return;
      }

      try {
        const user = await api.getAdminMe();
        setAdminUser(user);
      } catch (err) {
        // Token expired or invalid
        setAdminUser(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyExistingSession();
  }, []);

  const navigateToAdmin = () => {
    window.history.pushState({}, '', ADMIN_ROUTE_PATH);
    setCurrentPath(ADMIN_ROUTE_PATH);
  };

  const navigateToPublic = () => {
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
  };

  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
  };

  const handleLogout = () => {
    setAdminUser(null);
  };

  const isAdminRoute =
    currentPath === ADMIN_ROUTE_PATH ||
    currentPath.startsWith('/osc-admin-portal') ||
    (typeof window !== 'undefined' && window.location.hash === '#osc-admin-portal');

  // If on admin route:
  if (isAdminRoute) {
    if (checkingAuth) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-mono text-xs">
          Verifying administrative authorization...
        </div>
      );
    }

    if (!adminUser) {
      return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
    }

    return (
      <AdminLayout
        user={adminUser}
        onLogout={handleLogout}
        onSwitchToPublic={navigateToPublic}
      />
    );
  }

  // DEFAULT / HOMEPAGE:
  // Strictly public scanner only. No admin button, no management menu, no portal links.
  return <ScannerView />;
}
