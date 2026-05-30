import { useState, useMemo } from 'react';
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
import { useScoreHistory } from '../../hooks/useScores';
import { formatAxisDate, getLineColor, getDimensionLabel } from '../../utils/chartHelpers';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { clsx } from 'clsx';

interface DecayGraphProps {
  repoId: string;
}

const dimensions = [
  'compositeScore',
  'maintenanceAvg',
  'communityAvg',
  'vulnerabilityAvg',
  'eolAvg',
  'licenseAvg',
] as const;

const timeRanges = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: 0 },
];

export function DecayGraph({ repoId }: DecayGraphProps) {
  const [selectedRange, setSelectedRange] = useState('90d');
  const [visibleDimensions, setVisibleDimensions] = useState<Set<string>>(
    new Set(['compositeScore']),
  );

  const range = timeRanges.find((r) => r.label === selectedRange)!;
  const from = useMemo(() => {
    if (!range.days) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - range.days);
    return d.toISOString().split('T')[0];
  }, [range.days]);

  const { data: history, isLoading, isError } = useScoreHistory(repoId, { from });

  const toggleDimension = (dim: string) => {
    const next = new Set(visibleDimensions);
    if (next.has(dim)) {
      if (next.size > 1) next.delete(dim);
    } else {
      next.add(dim);
    }
    setVisibleDimensions(next);
  };

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-gray-900">Score Over Time</h3>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {timeRanges.map((r) => (
            <button
              key={r.label}
              onClick={() => setSelectedRange(r.label)}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                selectedRange === r.label
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dimension toggles */}
      <div className="mb-4 flex flex-wrap gap-2">
        {dimensions.map((dim) => (
          <button
            key={dim}
            onClick={() => toggleDimension(dim)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
              visibleDimensions.has(dim)
                ? 'border-transparent text-white'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
            )}
            style={
              visibleDimensions.has(dim)
                ? { backgroundColor: getLineColor(dim) }
                : undefined
            }
          >
            {getDimensionLabel(dim)}
          </button>
        ))}
      </div>

      {isLoading && !isError ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="snapshotDate"
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
                labelFormatter={formatAxisDate}
                formatter={(value: number, name: string) => [
                  Math.round(value),
                  getDimensionLabel(name),
                ]}
              />
              <Legend formatter={(value) => getDimensionLabel(value)} />
              {dimensions.map(
                (dim) =>
                  visibleDimensions.has(dim) && (
                    <Line
                      key={dim}
                      type="monotone"
                      dataKey={dim}
                      stroke={getLineColor(dim)}
                      strokeWidth={dim === 'compositeScore' ? 3 : 2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ),
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
