import { getScoreRingColor } from '../../utils/scoreColors';
import { getGrade } from '@stack-decay/shared';

interface ScoreGaugeProps {
  score: number | null;
  grade: string | null;
  size?: number;
}

export function ScoreGauge({ score, grade, size = 96 }: ScoreGaugeProps) {
  const center = size / 2;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = score ?? 0;
  const progress = (normalizedScore / 100) * circumference;
  const color = score != null ? getScoreRingColor(score) : '#d1d5db';
  const displayGrade = grade ?? (score != null ? getGrade(score) : '?');

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={6}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {score != null ? Math.round(score) : '--'}
        </span>
        <span className="text-xs font-semibold text-gray-500">{displayGrade}</span>
      </div>
    </div>
  );
}
