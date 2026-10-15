import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  Hourglass,
  RefreshCw,
  TrendingUp,
  UserX,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { DashboardStats, AttendanceRecord } from '../../types/index.ts';
import { formatManilaDate, formatManilaTime, getManilaDateString } from '../../lib/constants.ts';

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getManilaDateString());
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<'today' | 'custom'>('today');

  const fetchDashboardData = async (dateStr?: string) => {
    setLoading(true);
    try {
      const targetDate = dateStr || selectedDate;
      const [statsData, recordsData] = await Promise.all([
        api.getDashboardStats(targetDate),
        api.getAttendanceRecords({ startDate: targetDate, endDate: targetDate }),
      ]);
      setStats(statsData);
      setRecentRecords(recordsData.slice(0, 8));
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedDate);
    // Subscribe to instant multi-device real-time sync stream
    const unsubscribe = api.subscribeToRealtimeSync((event) => {
      fetchDashboardData(selectedDate);
    });
    // Backup polling
    const interval = setInterval(() => fetchDashboardData(selectedDate), 15000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [selectedDate]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setDatePreset(newDate === getManilaDateString() ? 'today' : 'custom');
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Real-Time Attendance Overview</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Centralized Cloud Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring duty sessions for: <span className="font-semibold text-slate-700">{formatManilaDate(selectedDate)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />

          <button
            onClick={() => handleDateChange(getManilaDateString())}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              datePreset === 'today'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Today
          </button>

          <button
            onClick={() => fetchDashboardData(selectedDate)}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (9 metric cards as specified) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {/* Total Registered */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Registered Scholars</span>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{stats?.totalScholars ?? '--'}</span>
            <span className="text-[11px] text-slate-500 ml-1.5">({stats?.activeScholars ?? 0} active)</span>
          </div>
        </div>

        {/* Timed In Today */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Timed In</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-700">{stats?.timedInToday ?? '--'}</span>
            <span className="text-[11px] text-emerald-600 ml-1.5">recorded arrival</span>
          </div>
        </div>

        {/* Currently On Duty */}
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Currently On Duty</span>
            <Hourglass className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-700">{stats?.currentlyOnDuty ?? '--'}</span>
            <span className="text-[11px] text-blue-600 ml-1.5">active shifts now</span>
          </div>
        </div>

        {/* Timed Out Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Timed Out</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-teal-700">{stats?.timedOutToday ?? '--'}</span>
            <span className="text-[11px] text-teal-600 ml-1.5">completed shifts</span>
          </div>
        </div>

        {/* Not Yet Timed In */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Not Yet Timed In</span>
            <UserX className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600">{stats?.notYetTimedIn ?? '--'}</span>
            <span className="text-[11px] text-slate-500 ml-1.5">pending duty</span>
          </div>
        </div>

        {/* Total Attendance Records */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Sessions Count</span>
            <Calendar className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{stats?.totalRecordsDate ?? '--'}</span>
            <span className="text-[11px] text-slate-500 ml-1.5">sessions on date</span>
          </div>
        </div>

        {/* Accumulated Duty Hours */}
        <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Accumulated Hours</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-purple-700">{stats?.totalDutyHours ?? '--'}</span>
            <span className="text-[11px] text-purple-600 ml-1.5">duty hrs today</span>
          </div>
        </div>

        {/* Late Arrivals */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Late Arrivals</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-700">{stats?.lateArrivals ?? '--'}</span>
            <span className="text-[11px] text-rose-600 ml-1.5">past grace period</span>
          </div>
        </div>

        {/* Absences */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Expected / Absences</span>
            <Clock className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-800">{stats?.absentCount ?? '--'}</span>
            <span className="text-[11px] text-slate-500 ml-1.5">scholars unscheduled</span>
          </div>
        </div>
      </div>

      {/* Live Recent Attendance Stream */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Recent Attendance Activity (Selected Date)</h3>
            <p className="text-xs text-slate-500">Real-time scan entries automatically processed by the system</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
            Live Stream
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4">Scholar</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Time In</th>
                <th className="py-2.5 px-4">Time Out</th>
                <th className="py-2.5 px-4">Hours</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No attendance records for {selectedDate}.
                  </td>
                </tr>
              ) : (
                recentRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{r.scholarName}</div>
                      <div className="font-mono text-[10px] text-slate-500">{r.scholarCode}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{r.department}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {formatManilaTime(r.timeIn)}
                      {r.isLate && (
                        <span className="ml-1.5 text-[10px] text-rose-600 font-semibold bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                          Late
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {r.timeOut ? formatManilaTime(r.timeOut) : <span className="text-blue-600 font-medium">On Duty</span>}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {r.durationHours > 0 ? `${r.durationHours} hrs` : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {r.status === 'IN_PROGRESS' ? 'ON DUTY' : r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[10px] font-mono text-slate-500">
                      {r.recordingMethodIn}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
