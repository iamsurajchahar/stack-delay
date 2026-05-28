import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getHealthHistory } from '../../api/packages';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { EmptyState } from '../shared/EmptyState';
import { BarChart3 } from 'lucide-react';

interface Props {
  ecosystem: string;
  name: string;
}

export function MaintenanceChart({ ecosystem, name }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['package-health-history', ecosystem, name],
    queryFn: () => getHealthHistory(ecosystem, name),
  });

  if (isLoading) return <LoadingSpinner />;

  if (!data || data.length === 0) {
    return <EmptyState icon={BarChart3} title="No history data" description="Maintenance data will appear after the first enrichment cycle." />;
  }

  const chartData = data.slice(-12).map((snapshot: any) => ({
    date: new Date(snapshot.snapshotDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    commits: snapshot.maintenance?.commitsLast90d || 0,
    releases: snapshot.maintenance?.releasesLastYear || 0,
    issuesClosed: snapshot.maintenance?.closedIssuesLast90d || 0,
  }));

  return (
    <div className="space-y-4">
      <h3 className="text-md font-medium text-gray-700">Maintenance Activity (Last 12 Months)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Legend />
          <Bar dataKey="commits" fill="#6366f1" name="Commits (90d)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="releases" fill="#10b981" name="Releases (year)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="issuesClosed" fill="#f59e0b" name="Issues Closed (90d)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-600">
            {chartData[chartData.length - 1]?.commits || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Recent commits (90d)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {chartData[chartData.length - 1]?.releases || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Releases this year</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-600">
            {chartData[chartData.length - 1]?.issuesClosed || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Issues closed (90d)</p>
        </div>
      </div>
    </div>
  );
}
