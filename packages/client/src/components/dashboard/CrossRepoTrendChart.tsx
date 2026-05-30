import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TrendData } from '../../api/dashboard';
import { formatAxisDate } from '../../utils/chartHelpers';

interface CrossRepoTrendChartProps {
  data: TrendData[];
}

export function CrossRepoTrendChart({ data }: CrossRepoTrendChartProps) {
  // Flatten per-repo snapshots into date-keyed rows with an average score
  const chartData = useMemo(() => {
    const byDate = new Map<string, number[]>();
    for (const repo of data) {
      for (const snap of repo.snapshots) {
        const scores = byDate.get(snap.date) || [];
        scores.push(snap.score);
        byDate.set(snap.date, scores);
      }
    }
    return Array.from(byDate.entries())
      .map(([date, scores]) => ({
        date,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <div className="card">
      <h3 className="mb-4 text-base font-semibold text-gray-900">Score Trend (All Repos)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
                fontSize: '0.875rem',
              }}
              formatter={(value: number) => [Math.round(value), 'Avg Score']}
              labelFormatter={formatAxisDate}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageScore"
              name="Average Score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
