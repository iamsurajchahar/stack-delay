import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getHealthHistory } from '../../api/packages';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { EmptyState } from '../shared/EmptyState';
import { Users } from 'lucide-react';

interface Props {
  ecosystem: string;
  name: string;
}

export function CommunityChart({ ecosystem, name }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['package-health-history', ecosystem, name],
    queryFn: () => getHealthHistory(ecosystem, name),
  });

  if (isLoading) return <LoadingSpinner />;

  if (!data || data.length === 0) {
    return <EmptyState icon={Users} title="No community data" description="Community metrics will appear after enrichment." />;
  }

  const chartData = data.slice(-12).map((snapshot: any) => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    stars: snapshot.community?.starsCount || 0,
    forks: snapshot.community?.forksCount || 0,
    contributors: snapshot.community?.contributorCount || 0,
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-md font-medium text-gray-700">Community Growth (Last 12 Months)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="stars" stroke="#f59e0b" strokeWidth={2} name="Stars" dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="forks" stroke="#6366f1" strokeWidth={2} name="Forks" dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="contributors" stroke="#10b981" strokeWidth={2} name="Contributors" dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-600">
            {(chartData[chartData.length - 1]?.stars || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total Stars</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-600">
            {(chartData[chartData.length - 1]?.forks || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total Forks</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {chartData[chartData.length - 1]?.contributors || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Contributors</p>
        </div>
      </div>
    </div>
  );
}
