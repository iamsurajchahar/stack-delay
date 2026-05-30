import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDependencyTree, type TreeNode } from '../../api/deptree';
import { ChevronRight, ChevronDown, Package, AlertTriangle, Shield, Code2, FileJson } from 'lucide-react';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

interface DependencyTreeProps {
  repoId: string;
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case 'A': return 'text-green-600 dark:text-green-400';
    case 'B': return 'text-lime-600 dark:text-lime-400';
    case 'C': return 'text-yellow-600 dark:text-yellow-400';
    case 'D': return 'text-orange-600 dark:text-orange-400';
    case 'F': return 'text-red-600 dark:text-red-400';
    default: return 'text-gray-400';
  }
}

function scoreBarColor(score: number | null): string {
  if (score === null) return 'bg-gray-300 dark:bg-gray-600';
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-lime-500';
  if (score >= 40) return 'bg-yellow-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

function TreeNodeRow({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className="group flex items-center gap-2 border-b border-gray-100 py-1.5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <Package className="h-3.5 w-3.5 text-gray-400" />

        <button
          onClick={() => navigate(`/packages/${node.id}`)}
          className="text-sm font-medium text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400"
        >
          {node.name}
        </button>

        <span className="text-xs text-gray-400">{node.version}</span>

        {node.isDev && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            DEV
          </span>
        )}

        {node.vulnerabilityCount > 0 && (
          <span className="flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {node.vulnerabilityCount}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {node.score !== null && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full ${scoreBarColor(node.score)}`}
                  style={{ width: `${node.score}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-gray-500">{node.score}</span>
            </div>
          )}
          {node.grade && (
            <span className={`w-5 text-center text-xs font-bold ${gradeColor(node.grade)}`}>
              {node.grade}
            </span>
          )}
        </div>
      </div>

      {expanded && node.children.map((child, i) => (
        <TreeNodeRow key={`${child.id}-${i}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

function ecosystemIcon(ecosystem: string) {
  switch (ecosystem) {
    case 'npm':
    case 'yarn':
    case 'pnpm':
      return <FileJson className="h-4 w-4 text-red-500" />;
    case 'pip':
    case 'poetry':
      return <Code2 className="h-4 w-4 text-blue-500" />;
    default:
      return <Package className="h-4 w-4 text-gray-500" />;
  }
}

export function DependencyTree({ repoId }: DependencyTreeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['dependency-tree', repoId],
    queryFn: () => getDependencyTree(repoId),
  });

  const [filter, setFilter] = useState<'all' | 'direct' | 'dev' | 'vulnerable'>('all');

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Dependency Tree</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {data.stats.totalDependencies} deps across {data.stats.manifests} manifest(s) —
            {' '}{data.stats.directCount} direct, {data.stats.devCount} dev
          </p>
        </div>

        <div className="flex gap-1">
          {(['all', 'direct', 'dev', 'vulnerable'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {f === 'all' ? 'All' : f === 'direct' ? 'Direct' : f === 'dev' ? 'Dev' : 'Vulnerable'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {data.tree.map((manifest) => {
          const filteredDeps = manifest.dependencies.filter((d) => {
            if (filter === 'direct') return d.isDirect && !d.isDev;
            if (filter === 'dev') return d.isDev;
            if (filter === 'vulnerable') return d.vulnerabilityCount > 0;
            return true;
          });

          if (filteredDeps.length === 0) return null;

          return (
            <div key={manifest.manifest}>
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 dark:bg-gray-800/50">
                {ecosystemIcon(manifest.ecosystem)}
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {manifest.manifest}
                </span>
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {manifest.ecosystem}
                </span>
                <span className="text-[10px] text-gray-400">{filteredDeps.length} deps</span>
              </div>

              {filteredDeps.map((dep, i) => (
                <TreeNodeRow key={`${dep.id}-${i}`} node={dep} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
