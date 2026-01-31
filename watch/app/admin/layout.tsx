'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Mail,
  Inbox,
  Settings,
  Webhook,
  Key,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'read_emails' | 'write_emails' | 'admin_users' | 'admin_system';
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Caixas de Email', href: '/admin/boxes', icon: Inbox },
  { name: 'Emails', href: '/admin/emails', icon: Mail },
  { name: 'Webhooks', href: '/admin/webhooks', icon: Webhook },
  { name: 'API Keys', href: '/admin/api-keys', icon: Key },
  { name: 'Configurações', href: '/admin/settings', icon: Settings, permission: 'admin_system' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout, hasPermission, loading } = useAuth();

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [userMenuOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  const filteredNavigation = navigation.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-layout">
      {/* Skip link for keyboard navigation (WCAG AAA 2.4.1) */}
      <a
        href="#main-content"
        className="skip-link"
        data-testid="skip-link"
      >
        Pular para o conteúdo principal
      </a>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        data-testid="admin-sidebar"
        role="navigation"
        aria-label="Menu de navegação principal"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <Link href="/admin/dashboard" className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #e2498a, #5636d1)' }}
              >
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gradient-brand">MockMail</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu principal">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <Link
              href="/admin/profile"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 transition-colors"
              data-testid="nav-profile"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center text-white font-medium">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email || 'email@exemplo.com'}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header
          className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16"
          role="banner"
          aria-label="Barra de navegação superior"
        >
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              aria-label="Abrir menu"
              data-testid="mobile-menu-button"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            {/* Page title placeholder */}
            <div className="lg:hidden" />

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* User menu */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserMenuOpen(!userMenuOpen);
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                  data-testid="user-menu-button"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e2498a] to-[#5636d1] flex items-center justify-center text-white text-sm font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {user?.name || 'Usuário'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
                    role="menu"
                    data-testid="user-menu-dropdown"
                  >
                    <Link
                      href="/admin/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <User className="w-4 h-4" />
                      Meu Perfil
                    </Link>
                    <Link
                      href="/admin/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <Settings className="w-4 h-4" />
                      Configurações
                    </Link>
                    <hr className="my-1 border-gray-200" />
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      role="menuitem"
                      data-testid="logout-button"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          className="p-4 lg:p-6"
          data-testid="admin-main-content"
          role="main"
          aria-label="Conteúdo principal"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
