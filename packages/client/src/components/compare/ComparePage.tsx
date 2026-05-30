import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { comparePackages, type PackageComparison } from '../../api/compare';
import { Search, ArrowRightLeft, Star, Download, GitFork, Shield, AlertTriangle, Clock, Users } from 'lucide-react';
import { LoadingSpinner } from '../shared/LoadingSpinner';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function MetricRow({ label, icon: Icon, values, format = 'number', higherIsBetter = true }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  values: (number | string | null | undefined)[];
  format?: 'number' | 'days' | 'text';
  higherIsBetter?: boolean;
}) {
  const numValues = values.map(v => typeof v === 'number' ? v : null);
  const validValues = numValues.filter((v): v is number => v !== null);
  const best = validValues.length > 0
    ? (higherIsBetter ? Math.max(...validValues) : Math.min(...validValues))
    : null;

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
      </td>
      {values.map((val, i) => {
        const isNum = typeof val === 'number';
        const isBest = isNum && val === best && validValues.length > 1;
        return (
          <td key={i} className={`py-2.5 text-center text-sm ${isBest ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {val === null || val === undefined ? (
              <span className="text-gray-300 dark:text-gray-600">—</span>
            ) : format === 'number' && isNum ? (
              formatNumber(val)
            ) : format === 'days' && isNum ? (
              `${val}d`
            ) : (
              String(val)
            )}
          </td>
        );
      })}
    </tr>
  );
}

function PackageHeader({ pkg }: { pkg: PackageComparison }) {
  if (!pkg.found) {
    return (
      <th className="pb-3 text-center">
        <div className="text-sm font-semibold text-gray-400">{pkg.name}</div>
        <div className="text-xs text-red-400">Not found</div>
      </th>
    );
  }

  return (
    <th className="pb-3 text-center">
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{pkg.name}</div>
      <div className="text-xs text-gray-500">{pkg.latestVersion} — {pkg.license || 'Unknown license'}</div>
      {pkg.description && (
        <div className="mt-1 text-[11px] text-gray-400 line-clamp-2">{pkg.description}</div>
      )}
    </th>
  );
}

export function ComparePage() {
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [ecosystem, setEcosystem] = useState('npm');
  const [packages, setPackages] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['compare', packages, ecosystem],
    queryFn: () => comparePackages(packages, ecosystem),
    enabled: packages.length >= 2,
  });

  const handleCompare = () => {
    const a = inputA.trim();
    const b = inputB.trim();
    if (a && b) setPackages([a, b]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dependency Comparison</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Compare two packages side by side</p>
      </div>

      {/* Search form */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Package A</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={inputA}
                onChange={(e) => setInputA(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
                placeholder="e.g. react"
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <ArrowRightLeft className="mb-2 h-5 w-5 text-gray-400" />

          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Package B</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={inputB}
                onChange={(e) => setInputB(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
                placeholder="e.g. preact"
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Ecosystem</label>
            <select
              value={ecosystem}
              onChange={(e) => setEcosystem(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white py-2 px-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="npm">npm</option>
              <option value="pip">PyPI</option>
              <option value="gem">RubyGems</option>
              <option value="go">Go</option>
              <option value="cargo">Cargo</option>
            </select>
          </div>

          <button
            onClick={handleCompare}
            disabled={!inputA.trim() || !inputB.trim()}
            className="btn-primary"
          >
            Compare
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {data && (
        <>
          {/* Highlights */}
          {data.highlights.length > 0 && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-900/20">
              <h3 className="mb-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">Key Differences</h3>
              <ul className="space-y-1">
                {data.highlights.map((h, i) => (
                  <li key={i} className="text-sm text-indigo-600 dark:text-indigo-400">• {h}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="w-48 pb-3 pl-4 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                  {data.comparison.map((pkg) => (
                    <PackageHeader key={pkg.name} pkg={pkg} />
                  ))}
                </tr>
              </thead>
              <tbody className="px-4">
                <tr><td colSpan={3} className="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-gray-400">Community</td></tr>
                <MetricRow label="Stars" icon={Star} values={data.comparison.map(p => p.health?.community.starsCount)} />
                <MetricRow label="Forks" icon={GitFork} values={data.comparison.map(p => p.health?.community.forksCount)} />
                <MetricRow label="Contributors" icon={Users} values={data.comparison.map(p => p.health?.community.contributorCount)} />
                <MetricRow label="Weekly Downloads" icon={Download} values={data.comparison.map(p => p.health?.community.downloadsLastWeek)} />
                <MetricRow label="Dependent Repos" icon={GitFork} values={data.comparison.map(p => p.health?.community.dependentReposCount)} />

                <tr><td colSpan={3} className="px-4 pt-4 pb-1 text-xs font-semibold uppercase text-gray-400">Maintenance</td></tr>
                <MetricRow label="Commits (90d)" icon={Clock} values={data.comparison.map(p => p.health?.maintenance.commitsLast90d)} />
                <MetricRow label="Releases (1yr)" icon={Clock} values={data.comparison.map(p => p.health?.maintenance.releasesLastYear)} />
                <MetricRow label="Days Since Release" icon={Clock} values={data.comparison.map(p => p.health?.maintenance.daysSinceLastRelease)} format="days" higherIsBetter={false} />
                <MetricRow label="Open Issues" icon={AlertTriangle} values={data.comparison.map(p => p.health?.maintenance.openIssuesCount)} higherIsBetter={false} />
                <MetricRow label="Avg Issue Close" icon={Clock} values={data.comparison.map(p => p.health?.maintenance.avgIssueCloseDays)} format="days" higherIsBetter={false} />

                <tr><td colSpan={3} className="px-4 pt-4 pb-1 text-xs font-semibold uppercase text-gray-400">Security</td></tr>
                <MetricRow label="Open CVEs" icon={Shield} values={data.comparison.map(p => p.health?.vulnerability.openCveCount)} higherIsBetter={false} />
                <MetricRow label="Critical CVEs" icon={Shield} values={data.comparison.map(p => p.health?.vulnerability.criticalCveCount)} higherIsBetter={false} />
                <MetricRow label="Avg Fix Time" icon={Clock} values={data.comparison.map(p => p.health?.vulnerability.avgFixTimeDays)} format="days" higherIsBetter={false} />

                <tr><td colSpan={3} className="px-4 pt-4 pb-1 text-xs font-semibold uppercase text-gray-400">License</td></tr>
                <MetricRow label="License" icon={Shield} values={data.comparison.map(p => p.health?.license.spdx)} format="text" />
                <MetricRow label="Risk Tier" icon={AlertTriangle} values={data.comparison.map(p => p.health?.license.riskTier)} format="text" />
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
