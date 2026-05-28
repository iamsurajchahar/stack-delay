import { ArrowRight, ExternalLink, TrendingUp } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';

interface Props {
  packageName: string;
  ecosystem: string;
}

const KNOWN_ALTERNATIVES: Record<string, { name: string; reason: string }[]> = {
  'moment': [
    { name: 'date-fns', reason: 'Tree-shakeable, immutable, modern API' },
    { name: 'luxon', reason: 'By Moment team, immutable, timezone support' },
    { name: 'dayjs', reason: '2KB, same API as Moment, plugin system' },
  ],
  'request': [
    { name: 'axios', reason: 'Promise-based, interceptors, browser + Node' },
    { name: 'got', reason: 'Lightweight, streams, retries built-in' },
    { name: 'node-fetch', reason: 'Minimal, spec-compliant fetch for Node' },
  ],
  'underscore': [
    { name: 'lodash', reason: 'Superset of underscore, better performance' },
    { name: 'ramda', reason: 'Functional programming focused, auto-curried' },
  ],
  'express': [
    { name: 'fastify', reason: '2-3x faster, schema validation, plugin system' },
    { name: 'hono', reason: 'Ultra-fast, edge-ready, TypeScript first' },
  ],
  'chalk': [
    { name: 'picocolors', reason: '14x smaller, no dependencies, faster' },
  ],
  'enzyme': [
    { name: '@testing-library/react', reason: 'Tests behavior not implementation, React recommended' },
  ],
  'tslint': [
    { name: 'eslint', reason: 'TSLint deprecated, ESLint with typescript-eslint replaces it' },
  ],
};

export function AlternativesCard({ packageName, ecosystem }: Props) {
  const alternatives = KNOWN_ALTERNATIVES[packageName.toLowerCase()];

  if (!alternatives || alternatives.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No alternatives to suggest"
        description="This package doesn't have well-known alternatives in our database, or it's the recommended choice in its category."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-md font-medium text-gray-700">Recommended Alternatives</h3>
        <p className="text-sm text-gray-500 mt-1">
          Consider migrating from <code className="bg-gray-100 px-1 rounded">{packageName}</code> to one of these actively maintained packages:
        </p>
      </div>

      <div className="grid gap-4">
        {alternatives.map((alt) => (
          <div
            key={alt.name}
            className="border rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{alt.name}</h4>
                  <p className="text-sm text-gray-500">{alt.reason}</p>
                </div>
              </div>
              <a
                href={`https://www.npmjs.com/package/${alt.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        <strong>Migration tip:</strong> Check the package's README for migration guides. Most popular packages provide codemods or step-by-step upgrade paths.
      </div>
    </div>
  );
}
