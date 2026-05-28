import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class ComposerParser implements DependencyParser {
  ecosystem = Ecosystem.composer;

  parse(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.warn({ filePath }, 'Failed to parse composer.json as JSON');
      return results;
    }

    const require = parsed.require;
    const requireDev = parsed['require-dev'];

    if (require && typeof require === 'object') {
      for (const [name, version] of Object.entries(require as Record<string, unknown>)) {
        if (this.shouldSkip(name)) continue;
        const constraint = typeof version === 'string' ? version : '';
        results.push({
          name,
          versionConstraint: constraint,
          isDev: false,
          isDirect: true,
        });
      }
    }

    if (requireDev && typeof requireDev === 'object') {
      for (const [name, version] of Object.entries(requireDev as Record<string, unknown>)) {
        if (this.shouldSkip(name)) continue;
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

  /**
   * Skip PHP version constraints and ext-* extensions.
   */
  private shouldSkip(name: string): boolean {
    if (name === 'php') return true;
    if (name.startsWith('ext-')) return true;
    // Skip branch aliases like "dev-master as 1.0"
    if (name.startsWith('lib-')) return true;
    return false;
  }
}
