import { useState } from 'react';
import { ArrowUp, RefreshCw, Trash2, Lightbulb, ChevronDown, ChevronRight, Terminal, ExternalLink, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { getPriorityColor } from '../../utils/scoreColors';
import { EmptyState } from '../shared/EmptyState';
import type { IRecommendation } from '../../types';

interface RecommendationsPanelProps {
  recommendations: IRecommendation[];
}

const typeIcons = {
  upgrade: ArrowUp,
  replace: RefreshCw,
  remove: Trash2,
};

const typeLabels: Record<string, string> = {
  upgrade: 'Upgrade',
  replace: 'Replace',
  remove: 'Remove',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-auto flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
      title="Copy command"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function isCommand(step: string): boolean {
  return step.startsWith('Run:') || step.startsWith('Install ') || step.startsWith('Remove ');
}

function extractCommand(step: string): string | null {
  const match = step.match(/^Run:\s*(.+)$/);
  return match ? match[1].trim() : null;
}

function FixStep({ step, index }: { step: string; index: number }) {
  const command = extractCommand(step);
  const isLink = step.includes('http://') || step.includes('https://');
  const urlMatch = step.match(/(https?:\/\/[^\s]+)/);

  if (command) {
    return (
      <li className="flex items-start gap-3">
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-[10px] font-bold text-white mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 font-mono text-sm text-green-400">
            <Terminal className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            <code className="flex-1 overflow-x-auto">{command}</code>
            <CopyButton text={command} />
          </div>
        </div>
      </li>
    );
  }

  if (isLink && urlMatch) {
    const url = urlMatch[1];
    const textBefore = step.substring(0, step.indexOf(url));
    return (
      <li className="flex items-start gap-3">
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 text-sm text-gray-700">
          {textBefore}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 underline"
          >
            {url.length > 60 ? url.substring(0, 57) + '...' : url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </li>
    );
  }

  // Check for "Why:" prefix
  if (step.startsWith('Why:') || step.startsWith('WARNING:')) {
    const isWarning = step.startsWith('WARNING:');
    return (
      <li className="flex items-start gap-3">
        <span className={clsx(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5',
          isWarning ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
        )}>
          !
        </span>
        <p className={clsx(
          'text-sm italic',
          isWarning ? 'text-red-600 font-medium' : 'text-amber-700',
        )}>
          {step}
        </p>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 mt-0.5">
        {index + 1}
      </span>
      <p className="text-sm text-gray-700">{step}</p>
    </li>
  );
}

function RecommendationCard({ rec }: { rec: IRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = typeIcons[rec.type] || Lightbulb;
  const fixSteps = rec.fixSteps || [];
  const hasSteps = fixSteps.length > 0;

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      {/* Main card content */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={clsx(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
              rec.type === 'upgrade' && 'bg-blue-50 text-blue-600',
              rec.type === 'replace' && 'bg-purple-50 text-purple-600',
              rec.type === 'remove' && 'bg-red-50 text-red-600',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx('badge border', getPriorityColor(rec.priority))}>
                {rec.priority}
              </span>
              <span className={clsx(
                'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                rec.type === 'upgrade' && 'bg-blue-50 text-blue-600',
                rec.type === 'replace' && 'bg-purple-50 text-purple-600',
                rec.type === 'remove' && 'bg-red-50 text-red-600',
              )}>
                {typeLabels[rec.type]}
              </span>
              <h4 className="text-sm font-semibold text-gray-900">{rec.title}</h4>
            </div>
            <p className="mt-1 text-sm text-gray-600">{rec.description}</p>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
              {rec.packageName && (
                <span className="text-gray-500">
                  Package: <span className="font-medium text-gray-700">{rec.packageName}</span>
                </span>
              )}
              {rec.ecosystem && (
                <span className="text-gray-500">
                  Ecosystem: <span className="font-medium text-gray-700">{rec.ecosystem}</span>
                </span>
              )}
              {rec.currentVersion && rec.suggestedVersion && (
                <span className="text-gray-500">
                  {rec.currentVersion} → <span className="font-semibold text-green-600">{rec.suggestedVersion}</span>
                </span>
              )}
              {rec.alternativePackage && (
                <span className="text-gray-500">
                  Alternative: <span className="font-medium text-green-600">{rec.alternativePackage}</span>
                </span>
              )}
              {rec.currentScore != null && (
                <span className="text-gray-500">
                  Score: <span className="font-medium">{rec.currentScore}/100</span>
                  {rec.grade && <span className="ml-1">({rec.grade})</span>}
                </span>
              )}
              {rec.scoreImpact > 0 && (
                <span className="font-semibold text-green-600">
                  +{rec.scoreImpact} points potential
                </span>
              )}
              {rec.migrationUrl && (
                <a
                  href={rec.migrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700"
                >
                  Migration Guide <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fix steps expandable section */}
      {hasSteps && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className={clsx(
              'flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm font-medium transition-colors',
              expanded
                ? 'bg-gray-50 text-gray-900'
                : 'bg-gray-50/50 text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
            How to fix — {fixSteps.length} step{fixSteps.length > 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="border-t bg-gray-50/30 px-4 py-4">
              <ol className="space-y-3">
                {fixSteps.map((step, i) => (
                  <FixStep key={i} step={step} index={i} />
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  const [filterPriority, setFilterPriority] = useState<string>('');

  if (recommendations.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No recommendations"
        description="Your stack is looking good! No actionable improvements found right now."
      />
    );
  }

  const sorted = [...recommendations].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });

  const filtered = filterPriority
    ? sorted.filter((r) => r.priority === filterPriority)
    : sorted;

  // Counts
  const counts = recommendations.reduce<Record<string, number>>((acc, r) => {
    acc[r.priority] = (acc[r.priority] || 0) + 1;
    return acc;
  }, {});

  const criticalCount = counts.critical || 0;
  const highCount = counts.high || 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={clsx(
        'flex items-center gap-3 rounded-lg border p-4',
        criticalCount > 0
          ? 'border-red-200 bg-red-50'
          : highCount > 0
            ? 'border-orange-200 bg-orange-50'
            : 'border-blue-200 bg-blue-50',
      )}>
        <Lightbulb className={clsx(
          'h-5 w-5 flex-shrink-0',
          criticalCount > 0 ? 'text-red-500' : highCount > 0 ? 'text-orange-500' : 'text-blue-500',
        )} />
        <div>
          <p className={clsx(
            'text-sm font-medium',
            criticalCount > 0 ? 'text-red-800' : highCount > 0 ? 'text-orange-800' : 'text-blue-800',
          )}>
            {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} to improve your stack health
          </p>
          <p className={clsx(
            'text-xs mt-0.5',
            criticalCount > 0 ? 'text-red-600' : highCount > 0 ? 'text-orange-600' : 'text-blue-600',
          )}>
            {criticalCount > 0 && `${criticalCount} critical`}
            {criticalCount > 0 && highCount > 0 && ', '}
            {highCount > 0 && `${highCount} high priority`}
            {(criticalCount > 0 || highCount > 0) && (counts.medium || counts.low) ? ', ' : ''}
            {counts.medium ? `${counts.medium} medium` : ''}
            {counts.medium && counts.low ? ', ' : ''}
            {counts.low ? `${counts.low} low` : ''}
            {' — click "How to fix" on each card for step-by-step instructions'}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'critical', 'high', 'medium', 'low'].map((p) => {
          const count = p ? counts[p] || 0 : recommendations.length;
          if (p && count === 0) return null;
          return (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                filterPriority === p
                  ? p
                    ? p === 'critical' ? 'bg-red-600 text-white'
                    : p === 'high' ? 'bg-orange-500 text-white'
                    : p === 'medium' ? 'bg-yellow-500 text-white'
                    : 'bg-blue-500 text-white'
                  : 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
            >
              {p ? `${p.charAt(0).toUpperCase() + p.slice(1)} (${count})` : `All (${count})`}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No recommendations match filter"
          description="Try selecting a different priority level."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((rec, idx) => (
            <RecommendationCard key={rec.id || idx} rec={rec} />
          ))}
        </div>
      )}
    </div>
  );
}
