import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Edit3,
  Download,
  Printer,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  RefreshCw,
  X,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { AttendanceRecord, Scholar, SessionStatus } from '../../types/index.ts';
import { DEPARTMENTS, formatManilaDate, formatManilaTime, getManilaDateString } from '../../lib/constants.ts';

export default function AttendanceTab() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState(getManilaDateString());
  const [endDate, setEndDate] = useState(getManilaDateString());
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Manual Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualScholarId, setManualScholarId] = useState('');
  const [manualDate, setManualDate] = useState(getManilaDateString());
  const [manualTimeIn, setManualTimeIn] = useState('08:00');
  const [manualTimeOut, setManualTimeOut] = useState('12:00');
  const [manualReason, setManualReason] = useState('');
  const [manualRemarks, setManualRemarks] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Correction Modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedRecordToCorrect, setSelectedRecordToCorrect] = useState<AttendanceRecord | null>(null);
  const [correctTimeIn, setCorrectTimeIn] = useState('');
  const [correctTimeOut, setCorrectTimeOut] = useState('');
  const [correctStatus, setCorrectStatus] = useState<SessionStatus>('COMPLETED');
  const [correctReason, setCorrectReason] = useState('');
  const [correctRemarks, setCorrectRemarks] = useState('');
  const [correcting, setCorrecting] = useState(false);

  // Delete Record Modal
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceRecords({
        startDate,
        endDate,
        department: selectedDept,
        status: selectedStatus,
        search,
      });
      setRecords(data);
    } catch (err) {
      console.error('Error fetching attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScholarsList = async () => {
    try {
      const data = await api.getScholars();
      setScholars(data);
      if (data.length > 0 && !manualScholarId) {
        setManualScholarId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching scholars:', err);
    }
  };

  useEffect(() => {
    fetchRecords();
    // Subscribe to live multi-device attendance events
    const unsubscribe = api.subscribeToRealtimeSync((event) => {
      fetchRecords();
    });
    return () => unsubscribe();
  }, [startDate, endDate, selectedDept, selectedStatus, search]);

  useEffect(() => {
    fetchScholarsList();
  }, []);

  const handleConfirmDeleteRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordToDelete || !deleteReason.trim()) return;

    setDeleting(true);
    try {
      await api.deleteAttendanceRecord(recordToDelete.id, deleteReason.trim());
      setRecordToDelete(null);
      setDeleteReason('');
      fetchRecords();
    } catch (err) {
      console.error('Failed to delete attendance record:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCorrection = (record: AttendanceRecord) => {
    setSelectedRecordToCorrect(record);

    // Format ISO strings to local datetime-local format for inputs
    const formatForInput = (iso?: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    setCorrectTimeIn(formatForInput(record.timeIn));
    setCorrectTimeOut(formatForInput(record.timeOut));
    setCorrectStatus(record.status);
    setCorrectRemarks(record.remarks || '');
    setCorrectReason('');
    setShowCorrectionModal(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordToCorrect || !correctReason.trim()) return;

    setCorrecting(true);
    try {
      await api.correctAttendanceRecord(selectedRecordToCorrect.id, {
        timeIn: correctTimeIn ? new Date(correctTimeIn).toISOString() : undefined,
        timeOut: correctTimeOut ? new Date(correctTimeOut).toISOString() : undefined,
        status: correctStatus,
        remarks: correctRemarks,
        reason: correctReason,
      });
      setShowCorrectionModal(false);
      fetchRecords();
    } catch (err) {
      console.error('Failed to correct record:', err);
    } finally {
      setCorrecting(false);
    }
  };

  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualScholarId || !manualReason.trim()) return;

    setManualSubmitting(true);
    try {
      const timeInIso = new Date(`${manualDate}T${manualTimeIn}:00`).toISOString();
      const timeOutIso = manualTimeOut ? new Date(`${manualDate}T${manualTimeOut}:00`).toISOString() : undefined;

      await api.manualAttendanceEntry({
        scholarId: manualScholarId,
        sessionDate: manualDate,
        timeIn: timeInIso,
        timeOut: timeOutIso,
        reason: manualReason,
        remarks: manualRemarks,
      });

      setShowManualModal(false);
      setManualReason('');
      setManualRemarks('');
      fetchRecords();
    } catch (err) {
      console.error('Failed to record manual attendance:', err);
    } finally {
      setManualSubmitting(false);
    }
  };

  // CSV Export feature
  const exportToCsv = () => {
    if (records.length === 0) return;

    const headers = [
      'Record ID',
      'Scholar Code',
      'Scholar Name',
      'Department',
      'Program',
      'Session Date',
      'Time In',
      'Time Out',
      'Duty Hours',
      'Status',
      'Late',
      'Recording Method',
      'Corrected By',
      'Correction Reason',
    ];

    const rows = records.map((r) => [
      r.id,
      r.scholarCode,
      `"${r.scholarName.replace(/"/g, '""')}"`,
      `"${r.department.replace(/"/g, '""')}"`,
      `"${r.program.replace(/"/g, '""')}"`,
      r.sessionDate,
      r.timeIn ? formatManilaTime(r.timeIn) : '',
      r.timeOut ? formatManilaTime(r.timeOut) : 'ON DUTY',
      r.durationHours || 0,
      r.status,
      r.isLate ? 'YES' : 'NO',
      r.recordingMethodIn,
      r.correctedBy ? `"${r.correctedBy}"` : '',
      r.correctionReason ? `"${r.correctionReason.replace(/"/g, '""')}"` : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSC_Attendance_Export_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by scholar name or ID number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowManualModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Manual Entry
            </button>

            <button
              onClick={exportToCsv}
              disabled={records.length === 0}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>

            <button
              onClick={handlePrintSummary}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        {/* Date and dropdown filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">On Duty (In Progress)</option>
            <option value="CORRECTED">Corrected</option>
          </select>

          <button
            onClick={() => {
              setStartDate(getManilaDateString());
              setEndDate(getManilaDateString());
              setSelectedDept('all');
              setSelectedStatus('all');
              setSearch('');
            }}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-auto cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Scholar Details</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Time In</th>
                <th className="py-3 px-4">Time Out</th>
                <th className="py-3 px-4 text-center">Duty Hours</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Audit / Method</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading attendance entries...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No attendance records match the selected date or filter criteria.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isIncomplete =
                    r.status === 'IN_PROGRESS' && r.sessionDate !== getManilaDateString();

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isIncomplete ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                        {r.sessionDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{r.scholarName}</div>
                        <div className="font-mono text-[10px] text-slate-500">{r.scholarCode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{r.department}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {formatManilaTime(r.timeIn)}
                        {r.isLate && (
                          <span className="ml-1 text-[10px] text-rose-600 font-bold bg-rose-50 px-1 rounded border border-rose-200">
                            LATE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {r.timeOut ? (
                          formatManilaTime(r.timeOut)
                        ) : isIncomplete ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Missing Out
                          </span>
                        ) : (
                          <span className="text-blue-600 font-semibold">Active On Duty</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {r.durationHours > 0 ? `${r.durationHours} hrs` : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[10px] text-slate-500">
                        <div>Method: {r.recordingMethodIn}</div>
                        {r.correctedBy && (
                          <div className="text-amber-700 font-medium">
                            Corrected by {r.correctedBy}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenCorrection(r)}
                            className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="Correct or adjust attendance record"
                          >
                            <Edit3 className="w-3 h-3" /> Correct
                          </button>
                          <button
                            onClick={() => setRecordToDelete(r)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                            title="Delete Attendance Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Attendance Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Add Manual Attendance Entry</h3>
                <p className="text-xs text-slate-500">An audit trail entry will be permanently logged.</p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Duty Scholar *
                </label>
                <select
                  value={manualScholarId}
                  onChange={(e) => setManualScholarId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {scholars.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.scholarId}) - {s.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attendance Date *
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time In (24h) *
                  </label>
                  <input
                    type="time"
                    value={manualTimeIn}
                    onChange={(e) => setManualTimeIn(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Out (Optional)
                  </label>
                  <input
                    type="time"
                    value={manualTimeOut}
                    onChange={(e) => setManualTimeOut(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Manual Entry (Required for Audit Trail) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scholar forgot physical phone/badge, verified by coordinator"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Additional supervisor notes"
                  value={manualRemarks}
                  onChange={(e) => setManualRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting || !manualReason.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {manualSubmitting ? 'Recording...' : 'Save Attendance Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Record Correction Modal */}
      {showCorrectionModal && selectedRecordToCorrect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Correct Attendance Record</h3>
                <p className="text-xs text-slate-500">
                  {selectedRecordToCorrect.scholarName} ({selectedRecordToCorrect.scholarCode})
                </p>
              </div>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Time In Timestamp
                </label>
                <input
                  type="datetime-local"
                  value={correctTimeIn}
                  onChange={(e) => setCorrectTimeIn(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Time Out Timestamp
                </label>
                <input
                  type="datetime-local"
                  value={correctTimeOut}
                  onChange={(e) => setCorrectTimeOut(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Session Status
                </label>
                <select
                  value={correctStatus}
                  onChange={(e) => setCorrectStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="COMPLETED">Completed</option>
                  <option value="IN_PROGRESS">In Progress (Active Duty)</option>
                  <option value="CORRECTED">Mark as Corrected</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Correction Justification Reason *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Camera error during departure scan, confirmed with supervisor"
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supervisor Remarks
                </label>
                <input
                  type="text"
                  value={correctRemarks}
                  onChange={(e) => setCorrectRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correcting || !correctReason.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {correcting ? 'Saving correction...' : 'Save Audit Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Attendance Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Delete Attendance Record?</h3>
              <p className="text-xs text-slate-600 mt-1">
                Permanently delete attendance record for <strong>{recordToDelete.scholarName}</strong> on <strong>{recordToDelete.sessionDate}</strong>?
              </p>
            </div>

            <form onSubmit={handleConfirmDeleteRecord} className="px-5 pb-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Deletion (Audit Trail Mandatory) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Duplicate test scan, system administrative cleanup"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecordToDelete(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deleteReason.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
