import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  BarChart3,
  Settings,
  LogOut,
  Shield,
  Eye,
  UserCheck,
} from 'lucide-react';
import { AdminUser } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import DashboardTab from './DashboardTab.tsx';
import ScholarsTab from './ScholarsTab.tsx';
import AttendanceTab from './AttendanceTab.tsx';
import ReportsTab from './ReportsTab.tsx';
import SettingsAuditTab from './SettingsAuditTab.tsx';

interface AdminLayoutProps {
  user: AdminUser;
  onLogout: () => void;
  onSwitchToPublic: () => void;
}

export type AdminTab = 'dashboard' | 'scholars' | 'attendance' | 'reports' | 'settings';

export default function AdminLayout({ user, onLogout, onSwitchToPublic }: AdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const handleLogout = async () => {
    await api.adminLogout();
    onLogout();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scholars', label: 'Duty Scholars', icon: Users },
    { id: 'attendance', label: 'Attendance Records', icon: CalendarCheck },
    { id: 'reports', label: 'Reports & Hours', icon: BarChart3 },
    { id: 'settings', label: 'Settings & Audit', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-slate-300 text-slate-900">
      {/* Top Administrative Bar - Typography ONLY, NO LOGO as specified */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding Typography */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  OSC ADMIN PORTAL
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Restricted
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 tracking-wide">
                  Office of Student Affairs • Attendance Administration
                </span>
              </div>
            </div>

            {/* Admin Profile & Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onSwitchToPublic}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                title="Switch to public scanner view"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open Scanner Terminal</span>
              </button>

              <div className="h-6 w-px bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-2 text-right">
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-white">{user.fullName}</div>
                  <div className="text-[10px] text-emerald-400">{user.role}</div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Sign out of Admin Portal"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as AdminTab)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Administrative Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'scholars' && <ScholarsTab />}
        {activeTab === 'attendance' && <AttendanceTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'settings' && <SettingsAuditTab />}
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>OSC Duty Scholars Management Console • Confidential System</span>
          <span>Asia/Manila (UTC+8) • Enforcing Audit Trail</span>
        </div>
      </footer>
    </div>
  );
}
