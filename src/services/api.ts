import {
  AttendanceScanResult,
  DashboardStats,
  Scholar,
  AttendanceRecord,
  AdminUser,
  AuditLog,
  SystemSettings,
} from '../types/index.ts';

const ADMIN_TOKEN_KEY = 'osc_admin_auth_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function getAuthHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Public Scanner API
  async getPublicConfig(): Promise<{ allowManualIdEntry: boolean; academicYear: string; cooldownSeconds: number }> {
    const res = await fetch('/api/public/config');
    if (!res.ok) throw new Error('Failed to load public config');
    return res.json();
  },

  async scanAttendance(payload: {
    qrToken?: string;
    scholarIdInput?: string;
    recordingMethod?: 'QR_SCAN' | 'MANUAL_ENTRY';
  }): Promise<AttendanceScanResult> {
    const res = await fetch('/api/attendance/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Admin Auth API
  async adminLogin(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setAdminToken(data.token);
    return data;
  },

  async adminLogout(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } finally {
      clearAdminToken();
    }
  },

  async getAdminMe(): Promise<AdminUser> {
    const res = await fetch('/api/admin/me', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Session invalid');
    const data = await res.json();
    return data.user;
  },

  // Admin Dashboard
  async getDashboardStats(date?: string): Promise<DashboardStats> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetch(`/api/admin/dashboard-stats${query}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load dashboard stats');
    return res.json();
  },

  // Admin Scholars
  async getScholars(params?: { search?: string; department?: string; status?: string }): Promise<Scholar[]> {
    const sp = new URLSearchParams();
    if (params?.search) sp.append('search', params.search);
    if (params?.department) sp.append('department', params.department);
    if (params?.status) sp.append('status', params.status);

    const res = await fetch(`/api/admin/scholars?${sp.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load scholars');
    return res.json();
  },

  async createScholar(data: Partial<Scholar>): Promise<Scholar> {
    const res = await fetch('/api/admin/scholars', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create scholar');
    }
    return res.json();
  },

  async updateScholar(id: string, updates: Partial<Scholar>): Promise<Scholar> {
    const res = await fetch(`/api/admin/scholars/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update scholar');
    }
    return res.json();
  },

  async deleteScholar(id: string): Promise<void> {
    const res = await fetch(`/api/admin/scholars/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete scholar');
    }
  },

  async regenerateQR(id: string, reason: string): Promise<Scholar> {
    const res = await fetch(`/api/admin/scholars/${id}/regenerate-qr`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to regenerate QR code');
    }
    return res.json();
  },

  // Admin Attendance
  async getAttendanceRecords(filters?: {
    startDate?: string;
    endDate?: string;
    department?: string;
    status?: string;
    search?: string;
    scholarId?: string;
  }): Promise<AttendanceRecord[]> {
    const sp = new URLSearchParams();
    if (filters?.startDate) sp.append('startDate', filters.startDate);
    if (filters?.endDate) sp.append('endDate', filters.endDate);
    if (filters?.department) sp.append('department', filters.department);
    if (filters?.status) sp.append('status', filters.status);
    if (filters?.search) sp.append('search', filters.search);
    if (filters?.scholarId) sp.append('scholarId', filters.scholarId);

    const res = await fetch(`/api/admin/attendance?${sp.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load attendance records');
    return res.json();
  },

  async manualAttendanceEntry(payload: {
    scholarId: string;
    sessionDate: string;
    timeIn: string;
    timeOut?: string;
    reason: string;
    remarks?: string;
  }): Promise<AttendanceRecord> {
    const res = await fetch('/api/admin/attendance/manual', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit manual attendance');
    }
    return res.json();
  },

  async correctAttendanceRecord(
    id: string,
    payload: {
      timeIn?: string;
      timeOut?: string;
      status?: string;
      remarks?: string;
      reason: string;
    }
  ): Promise<AttendanceRecord> {
    const res = await fetch(`/api/admin/attendance/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to correct attendance');
    }
    return res.json();
  },

  async deleteAttendanceRecord(id: string, reason = 'Administrative deletion'): Promise<void> {
    const res = await fetch(`/api/admin/attendance/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete attendance record');
    }
  },

  // Reports & Analytics
  async getReports(): Promise<any> {
    const res = await fetch('/api/admin/reports', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load reports');
    return res.json();
  },

  // Audit Logs & Settings
  async getAuditLogs(search?: string): Promise<AuditLog[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/admin/audit-logs${query}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load audit logs');
    return res.json();
  },

  async getSettings(): Promise<SystemSettings> {
    const res = await fetch('/api/admin/settings', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load settings');
    return res.json();
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  async resetSampleData(): Promise<void> {
    const res = await fetch('/api/admin/reset-sample-data', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reset sample data');
  },

  // Real-time server broadcast listener (SSE)
  subscribeToRealtimeSync(onEvent: (event: any) => void): () => void {
    if (typeof window === 'undefined' || !window.EventSource) {
      return () => {};
    }

    let eventSource: EventSource | null = null;
    let isClosed = false;

    const connect = () => {
      if (isClosed) return;
      try {
        eventSource = new EventSource('/api/realtime/stream');

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            onEvent(data);
          } catch (err) {
            // Ignore non-json or ping frames
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Retry connection after 3 seconds
          if (!isClosed) {
            setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.warn('Realtime connection error:', err);
      }
    };

    connect();

    return () => {
      isClosed = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },
};
