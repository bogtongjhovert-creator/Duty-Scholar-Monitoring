import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Clock,
  AlertTriangle,
  Building,
  GraduationCap,
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { AttendanceRecord, Scholar } from '../../types/index.ts';
import { formatManilaDate, formatManilaTime, getManilaDateString } from '../../lib/constants.ts';

export default function ReportsTab() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeReportSubTab, setActiveReportSubTab] = useState<
    'overview' | 'scholars' | 'departments' | 'incomplete' | 'late'
  >('overview');

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [analyticsData, recordsData, scholarsData] = await Promise.all([
        api.getReports(),
        api.getAttendanceRecords(),
        api.getScholars(),
      ]);
      setAnalytics(analyticsData);
      setRecords(recordsData);
      setScholars(scholarsData);
    } catch (err) {
      console.error('Error fetching reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
    const unsubscribe = api.subscribeToRealtimeSync(() => {
      fetchReportData();
    });
    return () => unsubscribe();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportReportCsv = () => {
    if (!analytics) return;
    const headers = ['Scholar ID', 'Full Name', 'Department', 'Program', 'Total Duty Hours', 'Completed Sessions'];
    const rows = (analytics.scholarRankings || []).map((item: any) => [
      item.scholar.scholarId,
      `"${item.scholar.fullName.replace(/"/g, '""')}"`,
      `"${item.scholar.department.replace(/"/g, '""')}"`,
      `"${item.scholar.program.replace(/"/g, '""')}"`,
      item.hours,
      item.sessionsCount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSC_Duty_Hours_Report_${getManilaDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Report Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Duty Scholars Attendance & Hours Analytics</h2>
          <p className="text-xs text-slate-500">
            Validated duty-hour computations excluding incomplete and duplicate sessions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportReportCsv}
            disabled={!analytics}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export Hours CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
          <button
            onClick={fetchReportData}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Report Sub-Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl overflow-x-auto">
        {[
          { id: 'overview', label: 'Summary Overview', icon: BarChart3 },
          { id: 'scholars', label: 'Individual Scholar Hours', icon: GraduationCap },
          { id: 'departments', label: 'Department Distribution', icon: Building },
          { id: 'incomplete', label: `Incomplete Sessions (${analytics?.incompleteCount ?? 0})`, icon: Clock },
          { id: 'late', label: 'Late Arrivals Audit', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReportSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReportSubTab(tab.id as any)}
              className={`px-3.5 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Subtab Contents */}
      {loading ? (
        <div className="bg-white p-12 rounded-b-xl border border-t-0 border-slate-200 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
          Aggregating verified duty attendance reports...
        </div>
      ) : (
        <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-2xs">
          {/* OVERVIEW SUBTAB */}
          {activeReportSubTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Accumulated Duty Hours
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-1">
                    {analytics?.totalHours ?? 0} <span className="text-sm font-normal text-slate-500">hours</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Across all verified attendance sessions</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Processed Sessions
                  </span>
                  <div className="text-3xl font-black text-emerald-700 mt-1">
                    {analytics?.totalRecords ?? 0} <span className="text-sm font-normal text-slate-500">records</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Automatic scans & authorized manual logs</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Active Scholar Roster
                  </span>
                  <div className="text-3xl font-black text-purple-700 mt-1">
                    {scholars.filter((s) => s.status === 'active').length} <span className="text-sm font-normal text-slate-500">scholars</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Eligible to scan in current academic term</p>
                </div>
              </div>

              {/* Progress Toward 100-hour Duty Scholar Requirement */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                  Institutional Duty Hours Completion Status (Semester Target: 100 hrs/scholar)
                </h4>
                <div className="space-y-3 mt-3">
                  {(analytics?.scholarRankings || []).slice(0, 5).map((item: any) => {
                    const percent = Math.min(100, Math.round((item.hours / 100) * 100));
                    return (
                      <div key={item.scholar.id} className="text-xs space-y-1">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-800">
                            {item.scholar.fullName}{' '}
                            <span className="text-slate-400 font-normal">({item.scholar.department})</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {item.hours} / 100 hrs ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* INDIVIDUAL SCHOLARS SUBTAB */}
          {activeReportSubTab === 'scholars' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Completed duty hours calculated accurately between validated TIME IN and TIME OUT stamps. Incomplete or active shifts are excluded from accumulated totals.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">Scholar ID</th>
                      <th className="py-2.5 px-4">Full Name</th>
                      <th className="py-2.5 px-4">Department</th>
                      <th className="py-2.5 px-4">Program</th>
                      <th className="py-2.5 px-4 text-center">Completed Sessions</th>
                      <th className="py-2.5 px-4 text-right">Accumulated Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(analytics?.scholarRankings || []).map((item: any) => (
                      <tr key={item.scholar.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-700">
                          {item.scholar.scholarId}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {item.scholar.fullName}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{item.scholar.department}</td>
                        <td className="py-2.5 px-4 text-slate-600">{item.scholar.program}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-700">
                          {item.sessionsCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-emerald-700 font-mono text-sm">
                          {item.hours} hrs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DEPARTMENTS SUBTAB */}
          {activeReportSubTab === 'departments' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Total duty hours rendered across university departments, centers, and administrative offices.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(analytics?.departmentStats || []).map((dept: any) => (
                  <div key={dept.department} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{dept.department}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{dept.sessions} completed sessions</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Total Hours:</span>
                      <span className="font-black font-mono text-slate-900 text-base">{dept.hours} hrs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INCOMPLETE SESSIONS SUBTAB */}
          {activeReportSubTab === 'incomplete' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                <strong>Attention:</strong> These attendance sessions have a recorded TIME IN on a previous date but lack a TIME OUT. They are flagged as incomplete and will not count towards duty hours until resolved or corrected by an authorized administrator.
              </div>

              {(analytics?.incompleteSessions || []).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No uncompleted attendance sessions on past dates. All past sessions are closed.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Scholar</th>
                        <th className="py-2.5 px-4">Department</th>
                        <th className="py-2.5 px-4">Time In</th>
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(analytics?.incompleteSessions || []).map((r: AttendanceRecord) => (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-700">{r.sessionDate}</td>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-slate-900">{r.scholarName}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-2">({r.scholarCode})</span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{r.department}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-700">{formatManilaTime(r.timeIn)}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Missing Time Out
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* LATE ARRIVALS SUBTAB */}
          {activeReportSubTab === 'late' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Log of scholars whose arrival timestamp exceeded the shift schedule start time plus the configured grace period (default: 15 minutes).
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Scholar</th>
                      <th className="py-2.5 px-4">Department</th>
                      <th className="py-2.5 px-4">Time In</th>
                      <th className="py-2.5 px-4">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.filter((r) => r.isLate).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          No late arrival infractions recorded.
                        </td>
                      </tr>
                    ) : (
                      records
                        .filter((r) => r.isLate)
                        .map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-4 font-mono font-medium text-slate-700">{r.sessionDate}</td>
                            <td className="py-2.5 px-4">
                              <span className="font-bold text-slate-900">{r.scholarName}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2">({r.scholarCode})</span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{r.department}</td>
                            <td className="py-2.5 px-4 font-mono text-rose-700 font-bold">
                              {formatManilaTime(r.timeIn)}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 font-mono text-[10px]">
                              {r.recordingMethodIn}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
