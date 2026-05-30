import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRepoLicenses } from '../../api/licenses';
import type { LicenseInfo } from '../../api/licenses';
import { Scale, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { EmptyState } from '../shared/EmptyState';

interface LicensePanelProps {
  repoId: string;
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
      risk === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
      risk === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    )}>
      {risk === 'high' ? 'High Risk' : risk === 'medium' ? 'Copyleft' : 'Permissive'}
    </span>
  );
}

export function LicensePanel({ repoId }: LicensePanelProps) {
  const [riskFilter, setRiskFilter] = useState<string>('');
  const { data, isLoading } = useQuery({
    queryKey: ['licenses', repoId],
    queryFn: () => getRepoLicenses(repoId),
    enabled: !!repoId,
  });

  if (isLoading) {
    return <div className="flex h-40 items-center justify-center"><LoadingSpinner /></div>;
  }

  const licenses = data?.licenses || [];
  const summary = data?.summary;

  if (licenses.length === 0) {
    return <EmptyState icon={Scale} title="No license data" description="License information will appear after scanning." />;
  }

  const filtered = riskFilter ? licenses.filter(l => l.risk === riskFilter) : licenses;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-800 dark:text-green-400">Permissive</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">{summary?.permissive ?? 0}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-800 dark:text-yellow-400">Copyleft</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-yellow-700 dark:text-yellow-300">{summary?.copyleft ?? 0}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-red-800 dark:text-red-400">High Risk</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">{summary?.high_risk ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Unknown</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-700 dark:text-gray-300">{summary?.unknown ?? 0}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'high', 'medium', 'low'].map(r => (
          <button
            key={r}
            onClick={() => setRiskFilter(r)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              riskFilter === r
                ? r === 'high' ? 'bg-red-600 text-white' : r === 'medium' ? 'bg-yellow-500 text-white' : r === 'low' ? 'bg-green-600 text-white' : 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600',
            )}
          >
            {r === '' ? `All (${licenses.length})` : r === 'high' ? `High Risk (${licenses.filter(l=>l.risk==='high').length})` : r === 'medium' ? `Copyleft (${licenses.filter(l=>l.risk==='medium').length})` : `Permissive (${licenses.filter(l=>l.risk==='low').length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Package</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">License</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((lic, idx) => (
              <tr key={`${lic.packageName}-${idx}`} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900 dark:text-white">{lic.packageName}</span>
                  <span className="ml-2 text-xs text-gray-400">{lic.ecosystem}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{lic.license}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{lic.category}</td>
                <td className="px-4 py-3"><RiskBadge risk={lic.risk} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
