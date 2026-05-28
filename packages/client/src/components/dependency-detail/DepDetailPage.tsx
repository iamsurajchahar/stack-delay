import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Package } from 'lucide-react';
import { getPackage } from '../../api/packages';
import { ScoreBadge } from '../dashboard/ScoreBadge';
import { ScoreBreakdown } from '../repo-detail/ScoreBreakdown';
import { MaintenanceChart } from './MaintenanceChart';
import { CommunityChart } from './CommunityChart';
import { CveList } from './CveList';
import { AlternativesCard } from './AlternativesCard';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { TabNav } from '../repo-detail/TabNav';

const tabs = [
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'community', label: 'Community' },
  { id: 'vulnerabilities', label: 'Vulnerabilities' },
  { id: 'alternatives', label: 'Alternatives' },
];

export function DepDetailPage() {
  const { repoId, packageId } = useParams<{ repoId: string; packageId: string }>();
  const [activeTab, setActiveTab] = useState('maintenance');

  const ecosystemAndName = packageId?.split(':') || [];
  const ecosystem = ecosystemAndName[0] || '';
  const name = ecosystemAndName.slice(1).join(':') || '';

  const { data: pkg, isLoading } = useQuery({
    queryKey: ['package', ecosystem, name],
    queryFn: () => getPackage(ecosystem, name),
    enabled: !!ecosystem && !!name,
  });

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to={`/repos/${repoId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Back to repository
      </Link>

      {/* Package Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pkg?.name || name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {pkg?.ecosystem || ecosystem} &middot; v{pkg?.latestVersion || 'unknown'}
              </p>
              {pkg?.description && (
                <p className="text-sm text-gray-600 mt-2 max-w-xl">{pkg.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {pkg?.latestHealth && (
              <ScoreBadge grade={pkg.latestHealth.license?.riskTier === 'low' ? 'A' : 'C'} size="lg" />
            )}
            {pkg?.homepageUrl && (
              <a
                href={pkg.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>

        {/* Quick stats */}
        {pkg?.latestHealth && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-xs text-gray-500">Stars</p>
              <p className="text-lg font-semibold">{(pkg.latestHealth.community?.starsCount || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Contributors</p>
              <p className="text-lg font-semibold">{pkg.latestHealth.community?.contributorCount || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Open CVEs</p>
              <p className="text-lg font-semibold text-red-600">{pkg.latestHealth.vulnerability?.openCveCount || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Release</p>
              <p className="text-lg font-semibold">{pkg.latestHealth.maintenance?.daysSinceLastRelease || '?'}d ago</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">License</p>
              <p className="text-lg font-semibold">{pkg.latestHealth.license?.spdx || 'Unknown'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Score Breakdown */}
      {pkg?.latestHealth && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
          <ScoreBreakdown scores={{
            maintenance: 0,
            community: 0,
            vulnerability: 0,
            eol: 0,
            license: 0,
          }} />
        </div>
      )}

      {/* Tabs */}
      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === 'maintenance' && <MaintenanceChart ecosystem={ecosystem} name={name} />}
        {activeTab === 'community' && <CommunityChart ecosystem={ecosystem} name={name} />}
        {activeTab === 'vulnerabilities' && <CveList vulnerabilities={pkg?.vulnerabilities || []} />}
        {activeTab === 'alternatives' && <AlternativesCard packageName={name} ecosystem={ecosystem} />}
      </div>
    </div>
  );
}
