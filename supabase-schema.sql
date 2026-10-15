-- =========================================================================
-- OSC DUTY SCHOLARS ATTENDANCE CHECKING SYSTEM
-- Complete PostgreSQL Schema, Indexes & Row-Level Security (RLS) Policies
-- Designed for Supabase / PostgreSQL (Asia/Manila UTC+8)
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default timezone to Asia/Manila for this session
SET timezone = 'Asia/Manila';

-- 2. TABLE: scholars
-- Stores registered scholar demographic, academic, and eligibility details
CREATE TABLE IF NOT EXISTS public.scholars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholar_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'DS-2026-0001'
    full_name VARCHAR(255) NOT NULL,
    profile_photo TEXT,
    program VARCHAR(150) NOT NULL,
    department VARCHAR(150) NOT NULL,
    year_level VARCHAR(50) NOT NULL,
    contact_number VARCHAR(50),
    email VARCHAR(150) UNIQUE,
    assigned_schedule VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    date_registered DATE NOT NULL DEFAULT CURRENT_DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE: scholar_qr_codes
-- Decoupled secure unique QR tokens to prevent personal info exposure
CREATE TABLE IF NOT EXISTS public.scholar_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholar_id UUID NOT NULL REFERENCES public.scholars(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) UNIQUE NOT NULL, -- Cryptographic random token
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLE: duty_schedules
-- Configurable duty shifts, grace periods, and expected shift hours
CREATE TABLE IF NOT EXISTS public.duty_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INTEGER NOT NULL DEFAULT 15,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLE: attendance_records
-- Authoritative time-in and time-out attendance records
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scholar_id UUID NOT NULL REFERENCES public.scholars(id) ON DELETE RESTRICT,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_out TIMESTAMPTZ,
    duration_hours NUMERIC(5,2) DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS' 
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CORRECTED', 'INCOMPLETE')),
    recording_method_in VARCHAR(30) NOT NULL DEFAULT 'QR_SCAN'
        CHECK (recording_method_in IN ('QR_SCAN', 'MANUAL_ENTRY')),
    recording_method_out VARCHAR(30)
        CHECK (recording_method_out IN ('QR_SCAN', 'MANUAL_ENTRY')),
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT,
    corrected_by VARCHAR(150),
    corrected_at TIMESTAMPTZ,
    correction_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLE: admin_profiles
-- Authorized administrators, supervisors, and role assignments
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(150) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Attendance Officer' 
        CHECK (role IN ('Super Admin', 'Attendance Officer', 'Faculty Supervisor')),
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABLE: audit_logs
-- Immutable audit trail of all manual interventions, adjustments, and revocations
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    admin_email VARCHAR(150) NOT NULL,
    admin_name VARCHAR(150) NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABLE: system_settings
-- System configuration parameters
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial settings
INSERT INTO public.system_settings (key, value) VALUES
    ('cooldown_seconds', '45'::jsonb),
    ('grace_period_minutes', '15'::jsonb),
    ('timezone', '"Asia/Manila"'::jsonb),
    ('allow_manual_id_entry', 'true'::jsonb),
    ('academic_year', '"A.Y. 2026-2027 1st Semester"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_qr_active_token ON public.scholar_qr_codes(qr_token) WHERE NOT is_revoked;
CREATE INDEX IF NOT EXISTS idx_attendance_scholar_date ON public.attendance_records(scholar_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(session_date);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp DESC);

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.scholars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholar_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admins (authenticated) have complete read & write permissions
CREATE POLICY "Admins full access on scholars" ON public.scholars
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins full access on scholar_qr_codes" ON public.scholar_qr_codes
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins full access on duty_schedules" ON public.duty_schedules
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins full access on attendance_records" ON public.attendance_records
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins full access on audit_logs" ON public.audit_logs
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Admins full access on system_settings" ON public.system_settings
    FOR ALL TO authenticated USING (true);

-- Anonymous Public Scanner Terminal permissions:
-- Scanner has NO DIRECT ACCESS to view full scholar roster or audit logs.
-- It can only invoke the secure stored procedure `record_attendance_scan`.
