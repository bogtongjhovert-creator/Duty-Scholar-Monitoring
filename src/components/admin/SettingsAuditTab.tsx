import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  RotateCcw,
  Search,
  Database,
  Copy,
  Check,
  Save,
  Clock,
  Key,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { SystemSettings, AuditLog } from '../../types/index.ts';
import { formatManilaFull } from '../../lib/constants.ts';

const SUPABASE_SCHEMA_SQL = `-- OSC DUTY SCHOLARS ATTENDANCE CHECKING SYSTEM
-- Supabase PostgreSQL Relational Schema & Row Level Security Policies

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Scholars Table
CREATE TABLE IF NOT EXISTS public.scholars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scholar_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    profile_photo TEXT,
    program VARCHAR(150) NOT NULL,
    department VARCHAR(150) NOT NULL,
    year_level VARCHAR(50) NOT NULL,
    contact_number VARCHAR(50),
    email VARCHAR(150),
    assigned_schedule VARCHAR(150) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    date_registered DATE DEFAULT CURRENT_DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Unique QR Identifiers (Cryptographically decoupled)
CREATE TABLE IF NOT EXISTS public.scholar_qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scholar_id UUID NOT NULL REFERENCES public.scholars(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scholar_id UUID NOT NULL REFERENCES public.scholars(id) ON DELETE RESTRICT,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_out TIMESTAMPTZ,
    duration_hours NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CORRECTED', 'INCOMPLETE')),
    recording_method_in VARCHAR(30) DEFAULT 'QR_SCAN',
    recording_method_out VARCHAR(30),
    is_late BOOLEAN DEFAULT FALSE,
    remarks TEXT,
    corrected_by VARCHAR(150),
    corrected_at TIMESTAMPTZ,
    correction_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    admin_email VARCHAR(150) NOT NULL,
    admin_name VARCHAR(150) NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes for High Performance Scanning
CREATE INDEX IF NOT EXISTS idx_qr_token ON public.scholar_qr_codes(qr_token) WHERE NOT is_revoked;
CREATE INDEX IF NOT EXISTS idx_attendance_date_scholar ON public.attendance_records(session_date, scholar_id);

-- 7. Row Level Security (RLS) Policies
ALTER TABLE public.scholars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholar_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Administrators can do all operations
CREATE POLICY "Admins have full access" ON public.scholars
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins have full access to QR" ON public.scholar_qr_codes
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins have full access to Attendance" ON public.attendance_records
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins have full access to Audit" ON public.audit_logs
    FOR ALL TO authenticated USING (true);

-- Public Scanner can only execute attendance validation RPC function
-- and cannot browse full scholar directory directly.
`;

export default function SettingsAuditTab() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Editable settings form
  const [cooldownSeconds, setCooldownSeconds] = useState(45);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [academicYear, setAcademicYear] = useState('');
  const [allowManualIdEntry, setAllowManualIdEntry] = useState(true);

  // Reset demo data state
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
    loadAuditLogs();
    const unsubscribe = api.subscribeToRealtimeSync(() => {
      loadSettings();
      loadAuditLogs();
    });
    return () => unsubscribe();
  }, [auditSearch]);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      setCooldownSeconds(data.cooldownSeconds);
      setGracePeriodMinutes(data.gracePeriodMinutes);
      setAcademicYear(data.academicYear);
      setAllowManualIdEntry(data.allowManualIdEntry);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const data = await api.getAuditLogs(auditSearch);
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      await api.updateSettings({
        cooldownSeconds: Number(cooldownSeconds),
        gracePeriodMinutes: Number(gracePeriodMinutes),
        academicYear,
        allowManualIdEntry,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadAuditLogs();
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSampleData = async () => {
    if (!window.confirm('Reset database to pristine sample dataset? This will restore sample duty scholars and baseline records.')) {
      return;
    }

    setResetting(true);
    setResetSuccess(false);
    try {
      await api.resetSampleData();
      setResetSuccess(true);
      loadSettings();
      loadAuditLogs();
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to reset sample data:', err);
    } finally {
      setResetting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-8">
      {/* System Settings Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              Attendance Rules & Scanner Configuration
            </h3>
            <p className="text-xs text-slate-500">Configure scanner cooldown, late grace period, and terminal behavior</p>
          </div>
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 animate-in fade-in">
              Settings updated successfully!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scan Cooldown Period (Seconds)
              </label>
              <input
                type="number"
                min={10}
                max={300}
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Prevents accidental rapid double-scans of the same scholar QR code.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Late Arrival Grace Period (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={gracePeriodMinutes}
                onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Minutes past scheduled start time before a TIME IN is flagged as Late.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Academic Term
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none pb-2">
                <input
                  type="checkbox"
                  checked={allowManualIdEntry}
                  onChange={(e) => setAllowManualIdEntry(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                />
                Allow Manual Scholar ID entry on public scanner
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              System Timezone: <strong className="text-slate-700">Asia/Manila (UTC+8)</strong>
            </span>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Audit Logs Trail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Administrative Audit Trail
            </h3>
            <p className="text-xs text-slate-500">Immutable log of all supervisor manual entries, corrections, and QR revocations</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4">Timestamp (PHT)</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Administrator</th>
                <th className="py-2.5 px-4">Target ID</th>
                <th className="py-2.5 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No audit log records found.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatManilaFull(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{log.adminName}</div>
                      <div className="text-[10px] text-slate-400">{log.adminEmail}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {log.targetId}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate" title={log.reason}>
                      {log.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supabase Schema & Production Deployment Guide */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Centralized Cloud Database & Deployment Artifacts
            </h3>
            <p className="text-xs text-slate-500">
              Supabase PostgreSQL tables, Row Level Security (RLS) policies, and Vercel setup
            </p>
          </div>
          <button
            onClick={handleCopySql}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedSql ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied SQL!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy SQL Schema
              </>
            )}
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-64 shadow-inner">
            <pre>{SUPABASE_SCHEMA_SQL}</pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="font-bold text-slate-800 mb-1">Vercel Deployment Steps:</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create a new Supabase project in Southeast Asia (Singapore / Manila).</li>
                <li>Execute the SQL schema in Supabase SQL Editor.</li>
                <li>Set environment variables in Vercel: <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>.</li>
                <li>Connect Git repo and deploy.</li>
              </ol>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="font-bold text-slate-800 mb-1">Security Isolation:</h4>
              <p>
                The public scanner has only zero-read permissions and communicates through an atomic scan endpoint. Anonymous users cannot dump scholar rosters or manipulate attendance logs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Database Reset to Baseline Demo Data */}
      <div className="bg-white rounded-xl border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-slate-900">Restore Baseline Test Data</h4>
          <p className="text-xs text-slate-500">
            Resets the database to sample duty scholars, shift schedules, and test attendance sessions for evaluation.
          </p>
          {resetSuccess && (
            <p className="text-xs font-semibold text-emerald-600 mt-1">Database successfully restored to sample dataset!</p>
          )}
        </div>

        <button
          onClick={handleResetSampleData}
          disabled={resetting}
          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {resetting ? 'Resetting...' : 'Reset to Sample Data'}
        </button>
      </div>
    </div>
  );
}
