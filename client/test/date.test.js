import { describe, expect, it } from 'vitest';
import { formatThaiDate, getBangkokToday, isSunday, toDateInputValue } from '../src/utils/date.js';

describe('date utilities', () => {
  it('normalizes valid dates to an HTML date input value', () => {
    expect(toDateInputValue('2026-10-31T14:30:00.000Z')).toBe('2026-10-31');
    expect(toDateInputValue(new Date(2026, 9, 31))).toBe('2026-10-31');
  });

  it('returns an empty value for missing or invalid dates', () => {
    expect(toDateInputValue('')).toBe('');
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
    expect(toDateInputValue(new Date('invalid'))).toBe('');
  });

  it('identifies Sundays without depending on the machine timezone', () => {
    expect(isSunday('2026-11-01')).toBe(true);
    expect(isSunday('2026-10-31')).toBe(false);
    expect(isSunday('invalid')).toBe(false);
  });

  it('formats Gregorian dates as Thai Buddhist calendar dates', () => {
    expect(formatThaiDate('2026-10-31')).toBe('31 ตุลาคม พ.ศ. 2569');
    expect(formatThaiDate('2026-11-01', { withWeekday: true })).toBe('วันอาทิตย์ที่ 1 พฤศจิกายน พ.ศ. 2569');
    expect(formatThaiDate('invalid')).toBe('-');
  });

  it('returns today in the Bangkok timezone as an ISO date', () => {
    expect(getBangkokToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
