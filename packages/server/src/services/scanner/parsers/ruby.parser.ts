import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class RubyParser implements DependencyParser {
  ecosystem = Ecosystem.rubygems;

  parse(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];
    const lines = content.split('\n');

    // Track current group context for isDev detection
    const groupStack: string[][] = [];
    let inSourceBlock = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Skip comments and blank lines
      if (!line || line.startsWith('#')) continue;

      // Track source blocks (source 'https://rubygems.org' do ... end)
      if (/^source\s+/.test(line) && line.includes('do')) {
        inSourceBlock = true;
        continue;
      }

      // Track group blocks
      const groupMatch = line.match(/^group\s+((?::\w+(?:\s*,\s*)?)+)\s+do/);
      if (groupMatch) {
        const groups = groupMatch[1].match(/:\w+/g) || [];
        groupStack.push(groups);
        continue;
      }

      // End of block
      if (line === 'end') {
        if (groupStack.length > 0) {
          groupStack.pop();
        } else if (inSourceBlock) {
          inSourceBlock = false;
        }
        continue;
      }

      // Parse gem declarations
      const gemMatch = line.match(/^gem\s+['"]([^'"]+)['"]\s*(.*)/);
      if (!gemMatch) continue;

      const name = gemMatch[1];
      const rest = gemMatch[2] || '';

      // Extract version constraint(s) from the arguments
      const versionConstraint = this.extractVersionConstraint(rest);

      // Skip git/path sourced gems for version tracking (but still record them)
      // Determine if this is a dev dependency
      const currentGroups = groupStack.flat();
      const isDev = currentGroups.some(
        (g) => g === ':development' || g === ':test',
      );

      // Also check inline group: option
      const inlineGroupMatch = rest.match(/group:\s*\[?((?::\w+(?:\s*,\s*)?)+)\]?/);
      let inlineIsDev = false;
      if (inlineGroupMatch) {
        const inlineGroups = inlineGroupMatch[1].match(/:\w+/g) || [];
        inlineIsDev = inlineGroups.some(
          (g) => g === ':development' || g === ':test',
        );
      }

      results.push({
        name,
        versionConstraint: versionConstraint || '*',
        isDev: isDev || inlineIsDev,
        isDirect: true,
      });
    }

    return results;
  }

  private extractVersionConstraint(rest: string): string {
    // Version constraints come as quoted string arguments before any key: value options
    // e.g., '~> 1.0', '>= 1.0', '< 2.0', or just '1.0'
    const constraints: string[] = [];
    const versionRegex = /['"]([~<>=!]+\s*[\d.]+(?:\.\w+)*|[\d.]+(?:\.\w+)*)['"]/g;
    let match;

    // Only match constraints before any key: value pairs
    const keyValueIdx = rest.search(/\w+:/);
    const constraintPart = keyValueIdx >= 0 ? rest.substring(0, keyValueIdx) : rest;

    while ((match = versionRegex.exec(constraintPart)) !== null) {
      constraints.push(match[1]);
    }

    return constraints.join(', ');
  }
}
