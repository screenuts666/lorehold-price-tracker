/**
 * Centralized Date Utilities for Lorehold MTG Price Tracker
 */

export const OLD_SCHOOL_CUTOFF_DATE = '2003-07-28';

/**
 * Returns an ISO date string (YYYY-MM-DD) for a given number of days in the past.
 */
export function getIsoDateDaysAgo(days: number, fromDate: Date = new Date()): string {
  return new Date(fromDate.getTime() - (days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
}

/**
 * Returns today's ISO date string (YYYY-MM-DD).
 */
export function getTodayIsoString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parses date strings in 'DD/MM/YYYY' or ISO format into a Date object.
 */
export function parseItalianDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  return new Date(dateStr);
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into full Italian text (e.g., '15 Gennaio 2024').
 */
export function formatItalianDate(dateStr: string): string {
  return formatLocalizedDate(dateStr, 'it');
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into localized text based on language (e.g. '13 November 2026' or '13 Novembre 2026').
 */
export function formatLocalizedDate(dateStr: string, lang: 'it' | 'en' = 'it'): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  if (lang === 'en') {
    const monthsEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${d.getDate()} ${monthsEn[d.getMonth()]} ${d.getFullYear()}`;
  }

  const monthsIt = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  return `${d.getDate()} ${monthsIt[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Calculates day difference between two dates.
 */
export function getDaysDifference(d1: Date | string, d2: Date | string): number {
  const date1 = typeof d1 === 'string' ? new Date(d1) : d1;
  const date2 = typeof d2 === 'string' ? new Date(d2) : d2;
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if a release date is before the 8th Edition Old School cutoff (2003-07-28).
 */
export function isOldSchoolDate(dateStr: string | null | undefined, cutoff: string = OLD_SCHOOL_CUTOFF_DATE): boolean {
  if (!dateStr) return false;
  return dateStr < cutoff;
}
