import { useQuery } from '@tanstack/react-query';
import { getTeamOverview } from '../../api/team';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { Shield, AlertTriangle, Package, TrendingDown, TrendingUp, Users } from 'lucide-react';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444', 'N/A': '#9ca3af',
};

export function TeamDashboardPage() {
  const navigate = useNavigate();
  const { data: overview, isLoading } = useQuery({
    queryKey: ['team', 'overview'],
    queryFn: getTeamOverview,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!overview || overview.totalRepos === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <Users className="mx-auto h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-lg font-medium">No repositories connected</p>
        <p className="text-sm">Connect repos to see the team overview.</p>
      </div>
    );
  }

  const gradeData = Object.entries(overview.gradeDistribution).map(([grade, count]) => ({
    name: grade, value: count, fill: GRADE_COLORS[grade] || '#9ca3af',
  }));

  const repoBarData = overview.repoScores
    .slice(0, 15)
    .map((r) => ({
      name: r.name.length > 20 ? r.name.slice(0, 18) + '...' : r.name,
      fullName: r.fullName,
      score: r.score,
      id: r.id,
      fill: GRADE_COLORS[r.grade] || '#9ca3af',
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Team Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aggregate view across all {overview.totalRepos} repositories
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Avg Score"
          value={overview.avgScore}
          suffix="/100"
          icon={TrendingUp}
          color="indigo"
        />
        <SummaryCard
          label="Total Dependencies"
          value={overview.totalDependencies}
          icon={Package}
          color="blue"
        />
        <SummaryCard
          label="Vulnerable Deps"
          value={overview.totalVulnerable}
          icon={AlertTriangle}
          color={overview.totalVulnerable > 0 ? 'red' : 'green'}
        />
        <SummaryCard
          label="Deprecated Deps"
          value={overview.totalDeprecated}
          icon={TrendingDown}
          color={overview.totalDeprecated > 0 ? 'orange' : 'green'}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Repo scores bar chart */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Repository Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={repoBarData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg, #fff)',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(val: number) => [`${val}/100`, 'Score']}
              />
              <Bar
                dataKey="score"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(entry: any) => navigate(`/repos/${entry.id}`)}
              >
                {repoBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Grade distribution pie */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Grade Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={gradeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {gradeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(val: number, name: string) => [`${val} repo(s)`, `Grade ${name}`]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {gradeData.map((g) => (
              <div key={g.name} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.fill }} />
                {g.name}: {g.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best / Worst */}
      <div className="grid gap-4 sm:grid-cols-2">
        {overview.bestRepo && (
          <div
            className="cursor-pointer rounded-lg border border-green-200 bg-green-50 p-4 transition hover:shadow-md dark:border-green-800 dark:bg-green-900/20"
            onClick={() => navigate(`/repos/${overview.bestRepo!.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600 dark:text-green-400">Best Performing</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{overview.bestRepo.fullName}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{overview.bestRepo.score}</p>
                <p className="text-xs text-gray-500">Grade {overview.bestRepo.grade}</p>
              </div>
            </div>
          </div>
        )}

        {overview.worstRepo && (
          <div
            className="cursor-pointer rounded-lg border border-red-200 bg-red-50 p-4 transition hover:shadow-md dark:border-red-800 dark:bg-red-900/20"
            onClick={() => navigate(`/repos/${overview.worstRepo!.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">Needs Attention</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{overview.worstRepo.fullName}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overview.worstRepo.score}</p>
                <p className="text-xs text-gray-500">Grade {overview.worstRepo.grade}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shared vulnerabilities */}
      {overview.sharedVulnerabilities.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              <Shield className="mr-1.5 inline h-4 w-4 text-red-500" />
              Shared Vulnerabilities
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Vulnerabilities affecting multiple repositories
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {overview.sharedVulnerabilities.map((v, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  v.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  v.severity === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {v.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{v.packageName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{v.summary}</p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    Affects: {v.affectedRepos.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All repos table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Repositories</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700">
                <th className="px-4 py-2">Repository</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Grade</th>
                <th className="px-4 py-2">Deps</th>
                <th className="px-4 py-2">Vulnerable</th>
                <th className="px-4 py-2">Language</th>
                <th className="px-4 py-2">Last Scan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {overview.repoScores.map((repo) => (
                <tr
                  key={repo.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => navigate(`/repos/${repo.id}`)}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{repo.fullName}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${repo.score}%`, backgroundColor: GRADE_COLORS[repo.grade] || '#9ca3af' }}
                        />
                      </div>
                      <span>{repo.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-bold" style={{ color: GRADE_COLORS[repo.grade] }}>{repo.grade}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{repo.totalDeps}</td>
                  <td className="px-4 py-2.5">
                    {repo.vulnerableCount > 0 ? (
                      <span className="text-red-600 font-medium">{repo.vulnerableCount}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{repo.language || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {repo.lastScannedAt ? new Date(repo.lastScannedAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, suffix, icon: Icon, color }: {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorMap[color] || colorMap.indigo}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {value.toLocaleString()}{suffix || ''}
          </p>
        </div>
      </div>
    </div>
  );
}
