import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, KeyRound, Eye, EyeOff, Zap, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.ts';
import { AdminUser } from '../../types/index.ts';

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setError(null);
    setLoading(true);

    try {
      const res = await api.adminLogin(loginEmail.trim(), loginPass);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(
        err.message ||
          'Authentication failed. Please verify your credentials or use the Quick Sign In buttons below.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('Please provide both administrator email and master password.');
      return;
    }

    await performLogin(email, password);
  };

  // Instant 1-click login for testing and authorized administrators
  const handleQuickSignIn = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    await performLogin(demoEmail, demoPass);
  };

  const handleFillOnly = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900/5 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="bg-slate-900 px-6 py-8 text-center text-white relative overflow-hidden">
          <div className="inline-flex p-3 rounded-xl bg-slate-800 text-emerald-400 mb-3 border border-slate-700 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">OSC Administrative Portal</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Restricted Attendance & Duty Scholars Management Console
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold block mb-0.5">Authentication Failed</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Administrator Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@osc.edu.ph"
                required
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-shadow"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Master Password
              </label>
              {password && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                required
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-shadow"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying authorization...
              </span>
            ) : (
              <>
                <span>Sign In to Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Authorized Accounts & 1-Click Access Section */}
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Authorized Demo Accounts
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Click to Sign In
              </span>
            </div>

            <div className="space-y-2">
              {/* Super Admin Quick Sign-In */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-emerald-400 transition-colors flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleFillOnly('admin@osc.edu.ph', 'AdminPass2026!')}
                  className="text-left font-mono text-[11px] cursor-pointer flex-1"
                >
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>admin@osc.edu.ph</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-sans font-bold">
                      Super Admin
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                    Password: <span className="font-mono font-medium text-slate-700">AdminPass2026!</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSignIn('admin@osc.edu.ph', 'AdminPass2026!')}
                  className="shrink-0 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Sign in immediately as Super Admin"
                >
                  <Zap className="w-3 h-3" />
                  <span>1-Click Login</span>
                </button>
              </div>

              {/* Attendance Officer Quick Sign-In */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-400 transition-colors flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleFillOnly('officer@osc.edu.ph', 'Officer2026!')}
                  className="text-left font-mono text-[11px] cursor-pointer flex-1"
                >
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>officer@osc.edu.ph</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px] font-sans font-bold">
                      Officer
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                    Password: <span className="font-mono font-medium text-slate-700">Officer2026!</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSignIn('officer@osc.edu.ph', 'Officer2026!')}
                  className="shrink-0 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Sign in immediately as Attendance Officer"
                >
                  <Zap className="w-3 h-3" />
                  <span>1-Click Login</span>
                </button>
              </div>

              {/* User Admin Quick Sign-In */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-purple-400 transition-colors flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleFillOnly('bogtong.jhovert@panpacificu.edu.ph', 'AdminPass2026!')}
                  className="text-left font-mono text-[11px] cursor-pointer flex-1 truncate"
                >
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                    <span className="truncate">bogtong.jhovert@panpacificu.edu.ph</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-sans font-bold shrink-0">
                      Lead Admin
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                    Password: <span className="font-mono font-medium text-slate-700">AdminPass2026!</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSignIn('bogtong.jhovert@panpacificu.edu.ph', 'AdminPass2026!')}
                  className="shrink-0 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Sign in with your email"
                >
                  <Zap className="w-3 h-3" />
                  <span>1-Click Login</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Real-time audit trail and administrative authentication enabled.</span>
        </div>
      </div>
    </div>
  );
}
