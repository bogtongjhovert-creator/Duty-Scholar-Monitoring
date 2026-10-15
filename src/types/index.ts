export type ScholarStatus = 'active' | 'inactive' | 'archived';

export type AttendanceAction = 'TIME_IN' | 'TIME_OUT';

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CORRECTED' | 'INCOMPLETE';

export type RecordingMethod = 'QR_SCAN' | 'MANUAL_ENTRY';

export interface Scholar {
  id: string;
  scholarId: string; // e.g. "DS-2026-0101"
  fullName: string;
  profilePhoto?: string;
  program: string;
  department: string;
  yearLevel: string;
  contactNumber?: string;
  email?: string;
  assignedSchedule: string;
  status: ScholarStatus;
  dateRegistered: string;
  remarks?: string;
  qrToken: string; // unique identifier encoded in QR code
}

export interface AttendanceRecord {
  id: string;
  scholarId: string;
  scholarName: string;
  scholarCode: string;
  department: string;
  program: string;
  sessionDate: string; // YYYY-MM-DD (Asia/Manila)
  timeIn: string; // ISO string
  timeOut: string | null; // ISO string or null
  durationHours: number; // calculated hours
  status: SessionStatus;
  recordingMethodIn: RecordingMethod;
  recordingMethodOut?: RecordingMethod;
  remarks?: string;
  isLate: boolean;
  correctedBy?: string;
  correctedAt?: string;
  correctionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'Super Admin' | 'Attendance Officer' | 'Faculty Supervisor';
  lastLogin?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  adminEmail: string;
  adminName: string;
  previousValue?: any;
  newValue?: any;
  reason: string;
  timestamp: string;
}

export interface SystemSettings {
  cooldownSeconds: number;
  gracePeriodMinutes: number;
  timezone: string;
  academicYear: string;
  allowManualIdEntry: boolean;
  defaultDutyHoursTarget: number;
}

export interface AttendanceScanResult {
  success: boolean;
  action?: AttendanceAction;
  scholar?: {
    id: string;
    scholarId: string;
    fullName: string;
    profilePhoto?: string;
    department: string;
    program: string;
  };
  record?: AttendanceRecord;
  timestamp?: string;
  formattedTime?: string;
  formattedDate?: string;
  message: string;
  isCooldown?: boolean;
  durationHours?: number;
}

export interface DashboardStats {
  totalScholars: number;
  activeScholars: number;
  timedInToday: number;
  timedOutToday: number;
  currentlyOnDuty: number;
  notYetTimedIn: number;
  totalRecordsDate: number;
  totalDutyHours: number;
  lateArrivals: number;
  absentCount: number;
}
