export const SYSTEM_TIMEZONE = 'Asia/Manila';

export const DEPARTMENTS = [
  'Office of Student Affairs (OSA)',
  'Office of the Registrar',
  'University Library Services',
  'College of Computer Studies',
  'College of Engineering',
  'College of Business & Accountancy',
  'College of Arts and Sciences',
  'Guidance & Counseling Center',
  'Health and Wellness Clinic',
  'Audio-Visual Center (AVC)',
];

export const PROGRAMS = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Information Systems',
  'BS Civil Engineering',
  'BS Industrial Engineering',
  'BS Accountancy',
  'BS Business Administration',
  'AB Communication',
  'BS Psychology',
  'BS Nursing',
];

export const YEAR_LEVELS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
];

export const DUTY_SCHEDULES = [
  'Morning Shift (08:00 AM - 12:00 PM)',
  'Afternoon Shift (01:00 PM - 05:00 PM)',
  'Whole Day (08:00 AM - 05:00 PM)',
  'Evening Duty (05:00 PM - 09:00 PM)',
  'Weekend Shift (08:00 AM - 12:00 PM)',
];

/**
 * Format date in Asia/Manila timezone
 */
export function formatManilaDate(date: Date | string = new Date(), options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SYSTEM_TIMEZONE,
    ...options,
  }).format(d);
}

/**
 * Get current Manila date string in YYYY-MM-DD
 */
export function getManilaDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SYSTEM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Format time in Asia/Manila (e.g. 08:30:15 AM)
 */
export function formatManilaTime(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SYSTEM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format full date and time in Asia/Manila
 */
export function formatManilaFull(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SYSTEM_TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}
