import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  QrCode,
  Edit2,
  Trash2,
  Download,
  Printer,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Archive,
  RefreshCw,
  User,
  X,
  Upload,
  Sparkles,
  Camera,
  GraduationCap,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { Scholar, ScholarStatus } from '../../types/index.ts';
import { generateQrDataUrl } from '../../lib/qr.ts';
import { DEPARTMENTS, PROGRAMS, YEAR_LEVELS, DUTY_SCHEDULES } from '../../lib/constants.ts';

export const COURSES = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Information Systems',
  'BS Computer Engineering',
  'BS Civil Engineering',
  'BS Industrial Engineering',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Accountancy',
  'BS Business Administration',
  'BS Hospitality Management',
  'BS Tourism Management',
  'BS Nursing',
  'BS Pharmacy',
  'BS Medical Technology',
  'BS Psychology',
  'BS Criminology',
  'AB Communication',
  'Bachelor of Elementary Education',
  'Bachelor of Secondary Education',
  'Other',
];

export default function ScholarsTab() {
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Add / Edit Modal state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingScholar, setEditingScholar] = useState<Scholar | null>(null);
  const [formData, setFormData] = useState<Partial<Scholar>>({
    scholarId: '',
    fullName: '',
    department: 'Office of Student Affairs (OSA)',
    program: 'BS Information Technology',
    yearLevel: '1st Year',
    assignedSchedule: 'Morning Shift (08:00 AM - 12:00 PM)',
    contactNumber: '',
    email: '',
    remarks: '',
    status: 'active',
    profilePhoto: '',
  });
  const [customCourse, setCustomCourse] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // ID generator: format strictly OSC-2024-0001
  const generateUniqueScholarId = () => {
    let maxSeq = 0;
    for (const s of scholars) {
      const match = s.scholarId.match(/OSC-2024-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `OSC-2024-${nextSeq}`;
  };

  // Profile image upload handler (reads image & optimizes resolution to prevent large payloads)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setModalError('Photo must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setFormData((prev) => ({ ...prev, profilePhoto: dataUrl }));
          setModalError(null);
        }
      };
      img.onerror = () => {
        setModalError('Failed to read photo image');
      };
    };
    reader.onerror = () => {
      setModalError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  // QR Card Modal State
  const [selectedScholarForQr, setSelectedScholarForQr] = useState<Scholar | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Revoke & Regenerate QR State
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Delete Scholar Modal State
  const [scholarToDelete, setScholarToDelete] = useState<Scholar | null>(null);
  const [deletingScholar, setDeletingScholar] = useState(false);

  const fetchScholars = async () => {
    setLoading(true);
    try {
      const data = await api.getScholars({
        search,
        department: selectedDept,
        status: selectedStatus,
      });
      setScholars(data);
    } catch (err) {
      console.error('Error fetching scholars:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScholars();
    // Subscribe to live multi-device updates
    const unsubscribe = api.subscribeToRealtimeSync((event) => {
      fetchScholars();
    });
    return () => unsubscribe();
  }, [search, selectedDept, selectedStatus]);

  const handleOpenAddModal = () => {
    setEditingScholar(null);
    setFormData({
      scholarId: generateUniqueScholarId(),
      fullName: '',
      department: 'Office of Student Affairs (OSA)',
      program: 'BS Information Technology',
      yearLevel: '1st Year',
      assignedSchedule: 'Morning Shift (08:00 AM - 12:00 PM)',
      contactNumber: '',
      email: '',
      remarks: '',
      status: 'active',
      profilePhoto: '',
    });
    setCustomCourse('');
    setModalError(null);
    setShowAddEditModal(true);
  };

  const handleOpenEditModal = (scholar: Scholar) => {
    setEditingScholar(scholar);
    setFormData({ ...scholar });
    if (!COURSES.includes(scholar.program)) {
      setCustomCourse(scholar.program);
    } else {
      setCustomCourse('');
    }
    setModalError(null);
    setShowAddEditModal(true);
  };

  const handleSaveScholar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName?.trim()) {
      setModalError('Scholar full name is required');
      return;
    }

    const effectiveId = formData.scholarId?.trim() || generateUniqueScholarId();
    const effectiveCourse =
      formData.program === 'Other' && customCourse.trim()
        ? customCourse.trim()
        : formData.program || 'BS Information Technology';

    const payload: Partial<Scholar> = {
      ...formData,
      fullName: formData.fullName.trim(),
      scholarId: effectiveId,
      program: effectiveCourse,
      status: formData.status || 'active',
      department: formData.department || 'Office of Student Affairs (OSA)',
      yearLevel: formData.yearLevel || '1st Year',
      assignedSchedule: formData.assignedSchedule || 'Morning Shift (08:00 AM - 12:00 PM)',
    };

    setSaving(true);
    setModalError(null);
    try {
      if (editingScholar) {
        await api.updateScholar(editingScholar.id, payload);
      } else {
        await api.createScholar(payload);
      }
      setShowAddEditModal(false);
      fetchScholars();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save scholar record');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (scholar: Scholar, newStatus: ScholarStatus) => {
    try {
      await api.updateScholar(scholar.id, { status: newStatus });
      fetchScholars();
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  const handleViewQr = async (scholar: Scholar) => {
    setSelectedScholarForQr(scholar);
    setLoadingQr(true);
    try {
      const dataUrl = await generateQrDataUrl(scholar.qrToken, 320);
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR data URL:', err);
    } finally {
      setLoadingQr(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrCodeDataUrl || !selectedScholarForQr) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `OSC-QR-${selectedScholarForQr.scholarId}-${selectedScholarForQr.fullName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintIdCard = () => {
    window.print();
  };

  const handleConfirmRevokeQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScholarForQr) return;

    setRevoking(true);
    try {
      const updated = await api.regenerateQR(
        selectedScholarForQr.id,
        revokeReason || 'Administrative security reset'
      );
      setSelectedScholarForQr(updated);
      const dataUrl = await generateQrDataUrl(updated.qrToken, 320);
      setQrCodeDataUrl(dataUrl);
      setShowRevokeModal(false);
      setRevokeReason('');
      fetchScholars();
    } catch (err) {
      console.error('Failed to regenerate QR:', err);
    } finally {
      setRevoking(false);
    }
  };

  const handleConfirmDeleteScholar = async () => {
    if (!scholarToDelete) return;
    setDeletingScholar(true);
    try {
      await api.deleteScholar(scholarToDelete.id);
      setScholarToDelete(null);
      fetchScholars();
    } catch (err) {
      console.error('Failed to delete scholar:', err);
    } finally {
      setDeletingScholar(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, scholar ID, course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="w-full md:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Duty Scholar
        </button>
      </div>

      {/* Scholars Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Scholar Details</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Department Assignment</th>
                <th className="py-3 px-4">Duty Schedule</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">QR Card</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-500" />
                    Loading duty scholars roster...
                  </td>
                </tr>
              ) : scholars.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No scholars found matching the filters.
                  </td>
                </tr>
              ) : (
                scholars.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {s.profilePhoto ? (
                          <img
                            src={s.profilePhoto}
                            alt={s.fullName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900">{s.fullName}</div>
                          <div className="font-mono text-[10px] text-slate-500">{s.scholarId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{s.program}</div>
                      <div className="text-[10px] text-slate-500">{s.yearLevel}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{s.department}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{s.assignedSchedule}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.status === 'inactive'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleViewQr(s)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-[11px] border border-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                        title="View printable QR ID Card"
                      >
                        <QrCode className="w-3.5 h-3.5 text-slate-600" />
                        View QR
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                          title="Edit Scholar Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {s.status === 'active' ? (
                          <button
                            onClick={() => handleToggleStatus(s, 'inactive')}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md cursor-pointer"
                            title="Deactivate Scholar"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(s, 'active')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                            title="Activate Scholar"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleStatus(s, 'archived')}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                          title="Archive Scholar"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setScholarToDelete(s)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                          title="Delete Scholar from System"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Scholar Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {editingScholar ? 'Edit Duty Scholar' : 'Register New Duty Scholar'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingScholar
                    ? `Update record for ${editingScholar.fullName}`
                    : 'A unique QR code will be generated automatically.'}
                </p>
              </div>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScholar} className="p-6 space-y-4 overflow-y-auto">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                  <span>{modalError}</span>
                  <button
                    type="button"
                    onClick={() => setModalError(null)}
                    className="text-rose-500 hover:text-rose-700 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 1. Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Jhovhert Bogtong"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>

              {/* 2. Generate a ID Number */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    ID Number <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                    Format: <span className="text-emerald-700 font-semibold">OSC-2024-0001</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="OSC-2024-0001"
                    value={formData.scholarId || ''}
                    onChange={(e) => setFormData({ ...formData, scholarId: e.target.value.toUpperCase() })}
                    required
                    className="w-full px-3 py-2 text-sm font-mono uppercase font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        scholarId: generateUniqueScholarId(),
                      }))
                    }
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold shrink-0 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    title="Generate ID Number in OSC-2024-0001 format"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Generate ID Number</span>
                  </button>
                </div>
              </div>

              {/* 3. Upload Profile */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Upload Profile
                </label>
                <div className="flex items-center gap-4 p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div className="relative group shrink-0">
                    {formData.profilePhoto ? (
                      <img
                        src={formData.profilePhoto}
                        alt="Profile Preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                    <label
                      htmlFor="scholar-photo-upload"
                      className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Upload or change photo"
                    >
                      <Camera className="w-4 h-4" />
                    </label>
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="scholar-photo-upload"
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Photo</span>
                      </label>
                      <input
                        id="scholar-photo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      {formData.profilePhoto && (
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, profilePhoto: '' }))}
                          className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Upload portrait photo from device or camera (auto-optimized)
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Course */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Course <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <select
                    value={formData.program || COURSES[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, program: val });
                      if (val !== 'Other') setCustomCourse('');
                    }}
                    required
                    className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  >
                    {COURSES.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.program === 'Other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Type custom course (e.g. BS Hospitality Management)"
                      value={customCourse}
                      onChange={(e) => setCustomCourse(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingScholar ? 'Update Scholar' : 'Register Scholar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code and Printable ID Card Modal */}
      {selectedScholarForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">Scholar Duty ID & QR Code</h3>
              <button
                onClick={() => setSelectedScholarForQr(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center">
              {/* Printable ID Card Container */}
              <div
                id="printable-scholar-card"
                className="w-full max-w-xs bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-md border-2 border-slate-700 text-center relative overflow-hidden"
              >
                {/* Accent top stripe */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500"></div>

                <div className="pt-1 mb-2">
                  <p className="text-[10px] tracking-widest font-black uppercase text-emerald-400">
                    DUTY SCHOLAR ATTENDANCE PASS
                  </p>
                  <p className="text-[9px] text-slate-300">Office of Student Affairs</p>
                </div>

                {/* QR Code Image */}
                <div className="bg-white p-3 rounded-xl inline-block shadow-inner my-2">
                  {loadingQr ? (
                    <div className="w-44 h-44 flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
                    </div>
                  ) : qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Scholar QR Code"
                      className="w-44 h-44 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-rose-500">
                      Failed to render QR
                    </div>
                  )}
                </div>

                {/* Scholar Details */}
                <div className="mt-2 space-y-0.5">
                  <h4 className="font-black text-sm text-white">{selectedScholarForQr.fullName}</h4>
                  <p className="font-mono text-xs font-bold text-emerald-400">
                    {selectedScholarForQr.scholarId}
                  </p>
                  <p className="text-[10px] text-slate-300">{selectedScholarForQr.department}</p>
                  <p className="text-[9px] text-slate-400">{selectedScholarForQr.program}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-700/60 text-[9px] text-slate-400">
                  Scan terminal for automatic TIME IN and TIME OUT
                </div>
              </div>

              {/* Security info */}
              <p className="text-[11px] text-slate-500 mt-4 text-center">
                Secure QR identifier is cryptographically linked to the scholar roster without exposing raw personal data.
              </p>

              {/* Action Buttons */}
              <div className="w-full mt-5 grid grid-cols-3 gap-2">
                <button
                  onClick={handleDownloadQr}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                >
                  <Download className="w-3.5 h-3.5" /> Save PNG
                </button>

                <button
                  onClick={handlePrintIdCard}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Card
                </button>

                <button
                  onClick={() => setShowRevokeModal(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-200"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Reset QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke & Regenerate QR Confirmation Modal */}
      {showRevokeModal && selectedScholarForQr && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Revoke & Regenerate QR Code?</h3>
              <p className="text-xs text-slate-500 mt-1">
                The current QR code for <strong>{selectedScholarForQr.fullName}</strong> will be
                immediately revoked and will no longer be accepted by the scanner.
              </p>
            </div>

            <form onSubmit={handleConfirmRevokeQr} className="px-5 pb-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Revocation (Logged in Audit Trail) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lost ID card, security replacement"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revoking || !revokeReason.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {revoking ? 'Revoking...' : 'Confirm Revoke & Issue New'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Scholar Confirmation Modal */}
      {scholarToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Delete Duty Scholar?</h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to permanently remove <strong>{scholarToDelete.fullName}</strong> ({scholarToDelete.scholarId})?
              </p>
              <p className="text-[11px] text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                This deletion will be reflected across all devices immediately and recorded in the audit trail.
              </p>
            </div>

            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setScholarToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteScholar}
                disabled={deletingScholar}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {deletingScholar ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
