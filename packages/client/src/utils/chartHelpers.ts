import { format, parseISO } from 'date-fns';
import { getGrade } from '@stack-decay/shared';
import { getScoreRingColor } from './scoreColors';

export function formatAxisDate(value: string): string {
  try {
    return format(typeof value === 'string' ? parseISO(value) : value, 'MMM d');
  } catch {
    return value;
  }
}

export function formatAxisScore(value: number): string {
  return `${Math.round(value)}`;
}

export interface ScoreTooltipPayload {
  date: string;
  compositeScore?: number;
  maintenanceAvg?: number;
  communityAvg?: number;
  vulnerabilityAvg?: number;
  eolAvg?: number;
  licenseAvg?: number;
}

export function getLineColor(dimension: string): string {
  switch (dimension) {
    case 'compositeScore':
      return '#6366f1';
    case 'maintenanceAvg':
      return '#22c55e';
    case 'communityAvg':
      return '#3b82f6';
    case 'vulnerabilityAvg':
      return '#ef4444';
    case 'eolAvg':
      return '#f97316';
    case 'licenseAvg':
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
}

export function getDimensionLabel(key: string): string {
  switch (key) {
    case 'compositeScore':
      return 'Composite';
    case 'maintenanceAvg':
      return 'Maintenance';
    case 'communityAvg':
      return 'Community';
    case 'vulnerabilityAvg':
      return 'Vulnerability';
    case 'eolAvg':
      return 'EOL';
    case 'licenseAvg':
      return 'License';
    default:
      return key;
  }
}

export const RADAR_DIMENSIONS = [
  { key: 'maintenanceAvg', label: 'Maintenance' },
  { key: 'communityAvg', label: 'Community' },
  { key: 'vulnerabilityAvg', label: 'Vulnerability' },
  { key: 'eolAvg', label: 'EOL' },
  { key: 'licenseAvg', label: 'License' },
];

export { getScoreRingColor, getGrade };
