import { clsx } from 'clsx';

interface ScoreBadgeProps {
  grade: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-xl',
};

const gradeStyles: Record<string, string> = {
  A: 'bg-green-100 text-green-700 ring-green-300',
  B: 'bg-blue-100 text-blue-700 ring-blue-300',
  C: 'bg-yellow-100 text-yellow-700 ring-yellow-300',
  D: 'bg-orange-100 text-orange-700 ring-orange-300',
  F: 'bg-red-100 text-red-700 ring-red-300',
};

export function ScoreBadge({ grade, size = 'md' }: ScoreBadgeProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-full font-bold ring-2',
        sizeStyles[size],
        gradeStyles[grade] || 'bg-gray-100 text-gray-500 ring-gray-300',
      )}
    >
      {grade}
    </div>
  );
}
