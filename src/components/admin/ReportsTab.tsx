import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  Filter,
  ArrowUpDown,
  User,
  UserCheck,
  Eye,
  Award,
  Hourglass,
  LayoutList,
  LayoutGrid,
  X,
  FileSpreadsheet,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { AttendanceRecord, Scholar } from '../../types/index.ts';
import { formatManilaDate, formatManilaTime, getManilaDateString } from '../../lib/constants.ts';

function formatHoursAndMinutes(hours: number): string {
  if (!hours || hours <= 0) return '0 mins';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${h} hr${h > 1 ? 's' : ''} ${m} min${m > 1 ? 's' : ''}`;
}

export default function ReportsTab() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeReportSubTab, setActiveReportSubTab] = useState<
    'duty_hours' | 'overview' | 'departments' | 'incomplete' | 'late'
  >('duty_hours');

  // Search & Filter state for Total Duty Hours per Person
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'met_target' | 'in_progress' | 'zero_hours'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all_time' | 'this_month' | 'this_week' | 'today'>('all_time');
  const [sortBy, setSortBy] = useState<'hours_desc' | 'hours_asc' | 'name_asc' | 'id_asc' | 'sessions_desc'>('hours_desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal state for viewing a specific person's duty session breakdown
  const [selectedPersonForDetail, setSelectedPersonForDetail] = useState<{
    scholar: Scholar;
    hours: number;
    sessionsCount: number;
    activeShift?: AttendanceRecord;
    sessions: AttendanceRecord[];
  } | null>(null);

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

  // Derive unique courses & departments for filter dropdowns
  const uniqueCourses = useMemo(() => {
    return Array.from(new Set(scholars.map((s) => s.program).filter(Boolean))).sort();
  }, [scholars]);

  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(scholars.map((s) => s.department).filter(Boolean))).sort();
  }, [scholars]);

  // Aggregate duty hours per person based on active period filter
  const personDutyHoursList = useMemo(() => {
    const todayStr = getManilaDateString();
    
    // Filter records by selected period if applicable
    let filteredRecords = records.filter((r) => r.status === 'COMPLETED');
    if (selectedPeriod === 'today') {
      filteredRecords = filteredRecords.filter((r) => r.sessionDate === todayStr);
    } else if (selectedPeriod === 'this_month') {
      const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM
      filteredRecords = filteredRecords.filter((r) => r.sessionDate.startsWith(currentMonthPrefix));
    } else if (selectedPeriod === 'this_week') {
      // Calculate start of week (Monday)
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(d.setDate(diff)).toISOString().split('T')[0];
      filteredRecords = filteredRecords.filter((r) => r.sessionDate >= startOfWeek);
    }

    // Map each scholar to their stats and sessions
    return scholars.map((scholar) => {
      // Find all records belonging to this scholar
      const scholarCompletedSessions = filteredRecords.filter(
        (r) => r.scholarId === scholar.id || r.scholarCode === scholar.scholarId
      );

      const allScholarSessions = records.filter(
        (r) => r.scholarId === scholar.id || r.scholarCode === scholar.scholarId
      );

      const totalHours = scholarCompletedSessions.reduce((sum, r) => sum + (r.durationHours || 0), 0);
      const roundedHours = parseFloat(totalHours.toFixed(2));
      const sessionsCount = scholarCompletedSessions.length;

      // Active IN_PROGRESS shift
      const activeShift = records.find(
        (r) => (r.scholarId === scholar.id || r.scholarCode === scholar.scholarId) && r.status === 'IN_PROGRESS'
      );

      // Latest session date
      let lastSessionDate: string | null = null;
      if (allScholarSessions.length > 0) {
        const sortedDates = [...allScholarSessions].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
        lastSessionDate = sortedDates[0].sessionDate;
      }

      return {
        scholar,
        hours: roundedHours,
        sessionsCount,
        activeShift,
        lastSessionDate,
        sessions: allScholarSessions,
      };
    });
  }, [scholars, records, selectedPeriod]);

  // Filter and sort the per-person list
  const filteredPersonList = useMemo(() => {
    let result = personDutyHoursList.filter((item) => {
      const { scholar, hours } = item;

      // Search query (name, id, or program)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = scholar.fullName.toLowerCase().includes(q);
        const matchId = scholar.scholarId.toLowerCase().includes(q);
        const matchProgram = scholar.program.toLowerCase().includes(q);
        const matchDept = scholar.department.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchProgram && !matchDept) return false;
      }

      // Course filter
      if (selectedCourse !== 'all' && scholar.program !== selectedCourse) {
        return false;
      }

      // Department filter
      if (selectedDepartment !== 'all' && scholar.department !== selectedDepartment) {
        return false;
      }

      // Status filter (target is 100 hours standard)
      if (selectedStatusFilter === 'met_target' && hours < 100) {
        return false;
      }
      if (selectedStatusFilter === 'in_progress' && (hours >= 100 || hours === 0)) {
        return false;
      }
      if (selectedStatusFilter === 'zero_hours' && hours > 0) {
        return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'hours_desc') return b.hours - a.hours;
      if (sortBy === 'hours_asc') return a.hours - b.hours;
      if (sortBy === 'name_asc') return a.scholar.fullName.localeCompare(b.scholar.fullName);
      if (sortBy === 'id_asc') return a.scholar.scholarId.localeCompare(b.scholar.scholarId);
      if (sortBy === 'sessions_desc') return b.sessionsCount - a.sessionsCount;
      return 0;
    });

    return result;
  }, [personDutyHoursList, searchQuery, selectedCourse, selectedDepartment, selectedStatusFilter, sortBy]);

  // Overall statistics for the filtered persons
  const totalRenderedHours = useMemo(() => {
    const sum = filteredPersonList.reduce((acc, p) => acc + p.hours, 0);
    return parseFloat(sum.toFixed(2));
  }, [filteredPersonList]);

  const avgHoursPerPerson = useMemo(() => {
    if (filteredPersonList.length === 0) return 0;
    return parseFloat((totalRenderedHours / filteredPersonList.length).toFixed(2));
  }, [totalRenderedHours, filteredPersonList]);

  const scholarsCompletedTarget = useMemo(() => {
    return filteredPersonList.filter((p) => p.hours >= 100).length;
  }, [filteredPersonList]);

  const activeOnDutyCount = useMemo(() => {
    return filteredPersonList.filter((p) => !!p.activeShift).length;
  }, [filteredPersonList]);

  const handleExportReportCsv = () => {
    const headers = [
      'Scholar ID',
      'Full Name',
      'Course / Program',
      'Department',
      'Status',
      'Total Duty Hours',
      'Formatted Duration',
      'Completed Sessions',
      'Target Progress (%)',
      'Requirement Status',
    ];

    const rows = filteredPersonList.map((item) => {
      const targetPercent = Math.min(100, Math.round((item.hours / 100) * 100));
      const reqStatus = item.hours >= 100 ? 'Target Met' : `${(100 - item.hours).toFixed(2)} hrs remaining`;
      return [
        item.scholar.scholarId,
        `"${item.scholar.fullName.replace(/"/g, '""')}"`,
        `"${item.scholar.program.replace(/"/g, '""')}"`,
        `"${item.scholar.department.replace(/"/g, '""')}"`,
        item.activeShift ? 'Currently On Duty' : item.scholar.status,
        item.hours,
        `"${formatHoursAndMinutes(item.hours)}"`,
        item.sessionsCount,
        `${targetPercent}%`,
        `"${reqStatus}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSC_Total_Duty_Hours_Per_Person_${getManilaDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Report Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Summary Reports & Duty Hours Analytics</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified Calculations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of total duty hours per person, shift logs, completion rates, and institutional compliance
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          <button
            onClick={handleExportReportCsv}
            disabled={filteredPersonList.length === 0}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" /> Export Duty Hours CSV
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
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer transition-colors"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Report Sub-Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl overflow-x-auto">
        {[
          {
            id: 'duty_hours',
            label: `Total Duty Hours per Person (${scholars.length})`,
            icon: GraduationCap,
            highlight: true,
          },
          { id: 'overview', label: 'Summary Overview', icon: BarChart3 },
          { id: 'departments', label: 'Department Distribution', icon: Building },
          {
            id: 'incomplete',
            label: `Incomplete Sessions (${analytics?.incompleteCount ?? 0})`,
            icon: Clock,
          },
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
                  ? 'border-slate-900 text-slate-900 bg-slate-50/70'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.highlight && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Subtab Contents */}
      {loading && !analytics ? (
        <div className="bg-white p-12 rounded-b-xl border border-t-0 border-slate-200 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
          Aggregating verified duty attendance records and computing per-person hours...
        </div>
      ) : (
        <div className="bg-white p-6 rounded-b-xl border border-t-0 border-slate-200 shadow-2xs">
          {/* ========================================================= */}
          {/* FEATURE: TOTAL DUTY HOURS PER PERSON (PRIMARY SUBTAB)     */}
          {/* ========================================================= */}
          {activeReportSubTab === 'duty_hours' && (
            <div className="space-y-6">
              {/* Highlight KPI Cards for Total Duty Hours */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Total Duty Hours</span>
                    <Clock className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-black text-slate-900 font-mono">
                      {totalRenderedHours} <span className="text-xs font-normal text-slate-500 font-sans">hrs</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {formatHoursAndMinutes(totalRenderedHours)} total
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Average / Person</span>
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-black text-blue-700 font-mono">
                      {avgHoursPerPerson} <span className="text-xs font-normal text-slate-500 font-sans">hrs</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Across {filteredPersonList.length} persons</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Target Met (100h)</span>
                    <Award className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-black text-purple-700 font-mono">
                      {scholarsCompletedTarget} <span className="text-xs font-normal text-slate-500 font-sans">/ {filteredPersonList.length}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Completed 100-hour requirement</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Currently On Duty</span>
                    <Hourglass className="w-4 h-4 text-emerald-600 animate-pulse" />
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl font-black text-emerald-700 font-mono">
                      {activeOnDutyCount} <span className="text-xs font-normal text-slate-500 font-sans">active</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Clocked in right now</span>
                  </div>
                </div>
              </div>

              {/* Search, Filter & View Controls */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by full name, ID (e.g. OSC-2024-0001), or course..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Period Filter */}
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="all_time">Period: All Time</option>
                    <option value="this_month">Period: This Month</option>
                    <option value="this_week">Period: This Week</option>
                    <option value="today">Period: Today Only</option>
                  </select>

                  {/* Course Filter */}
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer max-w-[150px] truncate"
                    title={selectedCourse === 'all' ? 'All Courses' : selectedCourse}
                  >
                    <option value="all">All Courses</option>
                    {uniqueCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {/* Department Filter */}
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer max-w-[150px] truncate"
                    title={selectedDepartment === 'all' ? 'All Departments' : selectedDepartment}
                  >
                    <option value="all">All Departments</option>
                    {uniqueDepartments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  {/* Status Filter */}
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="all">Status: All</option>
                    <option value="met_target">Met 100h Target</option>
                    <option value="in_progress">In Progress (&lt;100h)</option>
                    <option value="zero_hours">Zero Hours</option>
                  </select>

                  {/* Sort By */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="hours_desc">Sort: Highest Hours</option>
                    <option value="hours_asc">Sort: Lowest Hours</option>
                    <option value="name_asc">Sort: Name (A-Z)</option>
                    <option value="id_asc">Sort: ID Number</option>
                    <option value="sessions_desc">Sort: Most Sessions</option>
                  </select>

                  {/* View Mode Toggle */}
                  <div className="flex border border-slate-300 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 cursor-pointer ${
                        viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Table view"
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`p-1.5 cursor-pointer ${
                        viewMode === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Cards view"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* TABLE VIEW */}
              {viewMode === 'table' ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Scholar / Person</th>
                        <th className="py-3 px-4">ID Number</th>
                        <th className="py-3 px-4">Course & Department</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Completed Shifts</th>
                        <th className="py-3 px-4 min-w-[160px]">Target Progress (100 hrs)</th>
                        <th className="py-3 px-4 text-right">Total Duty Hours</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredPersonList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            No scholars found matching the selected search query or filters.
                          </td>
                        </tr>
                      ) : (
                        filteredPersonList.map((item) => {
                          const { scholar, hours, sessionsCount, activeShift } = item;
                          const percent = Math.min(100, Math.round((hours / 100) * 100));
                          const remainingHours = Math.max(0, parseFloat((100 - hours).toFixed(2)));

                          return (
                            <tr key={scholar.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Person Avatar & Full Name */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {scholar.profilePhoto ? (
                                    <img
                                      src={scholar.profilePhoto}
                                      alt={scholar.fullName}
                                      className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                      {scholar.fullName
                                        .split(' ')
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join('')}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">{scholar.fullName}</div>
                                    <div className="text-[11px] text-slate-400">
                                      {scholar.yearLevel || 'Duty Scholar'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* ID Number */}
                              <td className="py-3 px-4">
                                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs inline-block">
                                  {scholar.scholarId}
                                </span>
                              </td>

                              {/* Course & Department */}
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-800">{scholar.program}</div>
                                <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                  {scholar.department}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4 text-center">
                                {activeShift ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                                    On Duty
                                  </span>
                                ) : hours >= 100 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                    Completed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    {scholar.status === 'active' ? 'Active' : scholar.status}
                                  </span>
                                )}
                              </td>

                              {/* Completed Shifts */}
                              <td className="py-3 px-4 text-center">
                                <span className="font-mono font-bold text-slate-700 text-xs">
                                  {sessionsCount}
                                </span>
                                <span className="text-[10px] text-slate-400 block">shifts</span>
                              </td>

                              {/* Target Progress Bar */}
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-medium text-slate-600">
                                      {hours} / 100 hrs
                                    </span>
                                    <span
                                      className={`font-mono font-bold ${
                                        percent >= 100
                                          ? 'text-emerald-700'
                                          : percent >= 50
                                          ? 'text-blue-700'
                                          : 'text-slate-600'
                                      }`}
                                    >
                                      {percent}%
                                    </span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        percent >= 100
                                          ? 'bg-emerald-600'
                                          : percent >= 50
                                          ? 'bg-blue-600'
                                          : percent >= 25
                                          ? 'bg-amber-500'
                                          : 'bg-slate-400'
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {hours >= 100 ? (
                                      <span className="text-emerald-700 font-semibold">100-hr Goal Reached!</span>
                                    ) : (
                                      <span>{remainingHours} hrs remaining</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Total Duty Hours */}
                              <td className="py-3 px-4 text-right">
                                <div className="font-mono font-black text-slate-900 text-base">
                                  {hours} <span className="text-xs font-semibold text-slate-500">hrs</span>
                                </div>
                                <div className="text-[11px] font-medium text-slate-500">
                                  {formatHoursAndMinutes(hours)}
                                </div>
                              </td>

                              {/* Action */}
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setSelectedPersonForDetail(item)}
                                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded-lg border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="View detailed duty session logs for this person"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Duty Logs</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* CARDS VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPersonList.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400">
                      No scholars found matching the selected search query or filters.
                    </div>
                  ) : (
                    filteredPersonList.map((item) => {
                      const { scholar, hours, sessionsCount, activeShift } = item;
                      const percent = Math.min(100, Math.round((hours / 100) * 100));
                      const remainingHours = Math.max(0, parseFloat((100 - hours).toFixed(2)));

                      return (
                        <div
                          key={scholar.id}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Person Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {scholar.profilePhoto ? (
                                  <img
                                    src={scholar.profilePhoto}
                                    alt={scholar.fullName}
                                    className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-full bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                                    {scholar.fullName
                                      .split(' ')
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join('')}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="font-bold text-slate-900 text-sm truncate">{scholar.fullName}</h4>
                                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                                    {scholar.scholarId}
                                  </span>
                                </div>
                              </div>

                              {activeShift ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                                  On Duty
                                </span>
                              ) : hours >= 100 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                  <Award className="w-3 h-3 text-purple-600" />
                                  100h Met
                                </span>
                              ) : null}
                            </div>

                            {/* Program & Department */}
                            <div className="mt-3 text-xs space-y-0.5">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{scholar.program}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{scholar.department}</span>
                              </div>
                            </div>

                            {/* Total Duty Hours Highlight Box */}
                            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                                  Total Duty Hours
                                </span>
                                <div className="text-xl font-black text-slate-900 font-mono">
                                  {hours} <span className="text-xs font-normal text-slate-500 font-sans">hrs</span>
                                </div>
                                <span className="text-[10px] text-slate-500">{formatHoursAndMinutes(hours)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                                  Shifts
                                </span>
                                <span className="text-base font-bold text-slate-800 font-mono">{sessionsCount}</span>
                              </div>
                            </div>

                            {/* Progress toward 100 hours */}
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-medium">Progress (100h requirement)</span>
                                <span className="font-mono font-bold text-slate-700">{percent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    percent >= 100
                                      ? 'bg-emerald-600'
                                      : percent >= 50
                                      ? 'bg-blue-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {hours >= 100 ? (
                                  <span className="text-emerald-700 font-semibold">100-hour requirement met</span>
                                ) : (
                                  <span>{remainingHours} hrs to completion</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              {sessionsCount > 0 ? `${sessionsCount} logged sessions` : 'No duty shifts yet'}
                            </span>
                            <button
                              onClick={() => setSelectedPersonForDetail(item)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Logs</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* OVERVIEW SUBTAB                                           */}
          {/* ========================================================= */}
          {activeReportSubTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Accumulated Duty Hours
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-1 font-mono">
                    {analytics?.totalHours ?? 0} <span className="text-sm font-normal text-slate-500 font-sans">hours</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Across all verified attendance sessions</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Processed Sessions
                  </span>
                  <div className="text-3xl font-black text-emerald-700 mt-1 font-mono">
                    {analytics?.totalRecords ?? 0} <span className="text-sm font-normal text-slate-500 font-sans">records</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Automatic scans & authorized manual logs</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Active Scholar Roster
                  </span>
                  <div className="text-3xl font-black text-purple-700 mt-1 font-mono">
                    {scholars.filter((s) => s.status === 'active').length}{' '}
                    <span className="text-sm font-normal text-slate-500 font-sans">scholars</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Eligible to render duty in current term</p>
                </div>
              </div>

              {/* Progress Toward 100-hour Duty Scholar Requirement */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Duty Hours Completion Leaderboard (100 hrs requirement)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Top performers and cumulative progress per person
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveReportSubTab('duty_hours')}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>View All Scholars</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3 mt-3">
                  {personDutyHoursList.slice(0, 7).map((item) => {
                    const percent = Math.min(100, Math.round((item.hours / 100) * 100));
                    return (
                      <div key={item.scholar.id} className="text-xs space-y-1">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-800 flex items-center gap-2">
                            <span className="font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                              {item.scholar.scholarId}
                            </span>
                            <span className="font-bold text-slate-900">{item.scholar.fullName}</span>
                            <span className="text-slate-400 font-normal">({item.scholar.program})</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {item.hours} / 100 hrs ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent >= 100 ? 'bg-emerald-600' : 'bg-slate-800'
                            }`}
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

          {/* ========================================================= */}
          {/* DEPARTMENTS SUBTAB                                        */}
          {/* ========================================================= */}
          {activeReportSubTab === 'departments' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Total duty hours rendered across university departments, centers, and administrative offices.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(analytics?.departmentStats || []).map((dept: any) => (
                  <div
                    key={dept.department}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between"
                  >
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

          {/* ========================================================= */}
          {/* INCOMPLETE SESSIONS SUBTAB                                */}
          {/* ========================================================= */}
          {activeReportSubTab === 'incomplete' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                <strong>Attention:</strong> These attendance sessions have a recorded TIME IN on a previous date but
                lack a TIME OUT. They are flagged as incomplete and will not count towards duty hours until resolved or
                corrected by an authorized administrator.
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

          {/* ========================================================= */}
          {/* LATE ARRIVALS SUBTAB                                      */}
          {/* ========================================================= */}
          {activeReportSubTab === 'late' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Log of scholars whose arrival timestamp exceeded the shift schedule start time plus the configured grace
                period (default: 15 minutes).
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

      {/* ========================================================= */}
      {/* MODAL: INDIVIDUAL DUTY SESSIONS BREAKDOWN PER PERSON      */}
      {/* ========================================================= */}
      {selectedPersonForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {selectedPersonForDetail.scholar.profilePhoto ? (
                  <img
                    src={selectedPersonForDetail.scholar.profilePhoto}
                    alt={selectedPersonForDetail.scholar.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-700 text-white font-bold text-base flex items-center justify-center shrink-0">
                    {selectedPersonForDetail.scholar.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-white">
                      {selectedPersonForDetail.scholar.fullName}
                    </h3>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {selectedPersonForDetail.scholar.scholarId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedPersonForDetail.scholar.program} • {selectedPersonForDetail.scholar.department}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPersonForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scholar Summary Quick KPI Bar */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Duty Hours
                </span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {selectedPersonForDetail.hours} hrs
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {formatHoursAndMinutes(selectedPersonForDetail.hours)}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Completed Shifts
                </span>
                <span className="text-xl font-bold text-emerald-700 font-mono">
                  {selectedPersonForDetail.sessionsCount}
                </span>
                <span className="text-[10px] text-slate-500 block">sessions recorded</span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  100h Target Progress
                </span>
                <span className="text-xl font-bold text-purple-700 font-mono">
                  {Math.min(100, Math.round((selectedPersonForDetail.hours / 100) * 100))}%
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {selectedPersonForDetail.hours >= 100
                    ? 'Target Completed'
                    : `${(100 - selectedPersonForDetail.hours).toFixed(2)} hrs left`}
                </span>
              </div>
            </div>

            {/* Sessions Table */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  Individual Duty Shift Logs
                </h4>
                <span className="text-xs text-slate-500">
                  {selectedPersonForDetail.sessions.length} total entries
                </span>
              </div>

              {selectedPersonForDetail.sessions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No attendance sessions or duty hours recorded for this scholar yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Time In</th>
                        <th className="py-2.5 px-3">Time Out</th>
                        <th className="py-2.5 px-3 text-right">Duration</th>
                        <th className="py-2.5 px-3 text-center">Method</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPersonForDetail.sessions.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{rec.sessionDate}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {formatManilaTime(rec.timeIn)}
                            {rec.isLate && (
                              <span className="ml-1 px-1 py-0.2 rounded text-[9px] bg-rose-50 text-rose-700 border border-rose-200">
                                Late
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {rec.timeOut ? formatManilaTime(rec.timeOut) : '--'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {rec.durationHours > 0 ? (
                              <span>
                                {rec.durationHours} hrs
                                <span className="block text-[10px] text-slate-400 font-sans font-normal">
                                  {formatHoursAndMinutes(rec.durationHours)}
                                </span>
                              </span>
                            ) : rec.status === 'IN_PROGRESS' ? (
                              <span className="text-emerald-700 font-sans text-[11px]">In Progress</span>
                            ) : (
                              '0 hrs'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {rec.recordingMethodIn === 'QR_SCAN' ? 'QR Code' : 'Manual Entry'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {rec.status === 'COMPLETED' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Completed
                              </span>
                            ) : rec.status === 'IN_PROGRESS' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                In Progress
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                {rec.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Official duty hours record calculated by Office of Student Affairs
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Scholar Record
                </button>
                <button
                  onClick={() => setSelectedPersonForDetail(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
