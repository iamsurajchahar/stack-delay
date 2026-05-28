import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { IRepoScoreSnapshot } from '../../types';

interface ScoreBreakdownProps {
  score: IRepoScoreSnapshot | null;
  previousScore?: IRepoScoreSnapshot | null;
}

export function ScoreBreakdown({ score, previousScore }: ScoreBreakdownProps) {
  if (!score) {
    return (
      <div className="card flex h-full items-center justify-center text-sm text-gray-400">
        No score data available
      </div>
    );
  }

  const data = [
    { dimension: 'Maintenance', current: score.maintenanceAvg, previous: previousScore?.maintenanceAvg },
    { dimension: 'Community', current: score.communityAvg, previous: previousScore?.communityAvg },
    { dimension: 'Vulnerability', current: score.vulnerabilityAvg, previous: previousScore?.vulnerabilityAvg },
    { dimension: 'EOL', current: score.eolAvg, previous: previousScore?.eolAvg },
    { dimension: 'License', current: score.licenseAvg, previous: previousScore?.licenseAvg },
  ];

  return (
    <div className="card">
      <h3 className="mb-4 text-base font-semibold text-gray-900">Score Breakdown</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
            />
            <Radar
              name="Current"
              dataKey="current"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            {previousScore && (
              <Radar
                name="Previous"
                dataKey="previous"
                stroke="#d1d5db"
                fill="#d1d5db"
                fillOpacity={0.1}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
