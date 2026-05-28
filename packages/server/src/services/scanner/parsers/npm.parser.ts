import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class NpmParser implements DependencyParser {
  ecosystem = Ecosystem.npm;

  parse(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.warn({ filePath }, 'Failed to parse package.json as JSON');
      return results;
    }

    const deps = parsed.dependencies;
    const devDeps = parsed.devDependencies;

    if (deps && typeof deps === 'object') {
      for (const [name, version] of Object.entries(deps as Record<string, unknown>)) {
        const constraint = typeof version === 'string' ? version : '';
        // Skip workspace references, git URLs, file references as version constraints
        // but still include the dependency with the raw constraint
        results.push({
          name,
          versionConstraint: constraint,
          isDev: false,
          isDirect: true,
        });
      }
    }

    if (devDeps && typeof devDeps === 'object') {
      for (const [name, version] of Object.entries(devDeps as Record<string, unknown>)) {
        const constraint = typeof version === 'string' ? version : '';
        results.push({
          name,
          versionConstraint: constraint,
          isDev: true,
          isDirect: true,
        });
      }
    }

    return results;
  }
}
