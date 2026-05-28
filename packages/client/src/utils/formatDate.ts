import { formatDistanceToNow, format, parseISO } from 'date-fns';

function toDate(d: string | Date): Date {
  if (typeof d === 'string') return parseISO(d);
  return d;
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return 'Never';
  try {
    return formatDistanceToNow(toDate(date), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

export function formatShort(date: string | Date | null | undefined): string {
  if (!date) return '--';
  try {
    return format(toDate(date), 'MMM d, yyyy');
  } catch {
    return '--';
  }
}

export function formatFull(date: string | Date | null | undefined): string {
  if (!date) return '--';
  try {
    return format(toDate(date), 'MMM d, yyyy h:mm a');
  } catch {
    return '--';
  }
}

export function formatChartDate(date: string | Date): string {
  try {
    return format(toDate(date), 'MMM d');
  } catch {
    return '';
  }
}
