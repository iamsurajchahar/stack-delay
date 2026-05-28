import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class GoParser implements DependencyParser {
  ecosystem = Ecosystem.go;

  parse(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];
    const lines = content.split('\n');

    // Collect replace directives to understand replacements
    const replacements = new Map<string, string>();
    let inReplaceBlock = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === 'replace (') {
        inReplaceBlock = true;
        continue;
      }
      if (inReplaceBlock) {
        if (line === ')') {
          inReplaceBlock = false;
          continue;
        }
        const replaceMatch = line.match(/^(\S+)\s+\S+\s+=>\s+(\S+)\s+(\S+)/);
        if (replaceMatch) {
          replacements.set(replaceMatch[1], replaceMatch[2]);
        }
        continue;
      }
      // Single-line replace
      const singleReplace = line.match(/^replace\s+(\S+)\s+\S+\s+=>\s+(\S+)\s+(\S+)/);
      if (singleReplace) {
        replacements.set(singleReplace[1], singleReplace[2]);
      }
    }

    // Parse require blocks and single-line requires
    let inRequireBlock = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line === 'require (') {
        inRequireBlock = true;
        continue;
      }

      if (inRequireBlock) {
        if (line === ')') {
          inRequireBlock = false;
          continue;
        }

        const dep = this.parseRequireLine(line);
        if (dep) {
          results.push(dep);
        }
        continue;
      }

      // Single-line require
      const singleMatch = line.match(/^require\s+(\S+)\s+(\S+)(.*)/);
      if (singleMatch) {
        const isIndirect = singleMatch[3].includes('// indirect');
        results.push({
          name: singleMatch[1],
          versionConstraint: singleMatch[2],
          isDev: false,
          isDirect: !isIndirect,
        });
      }
    }

    return results;
  }

  private parseRequireLine(line: string): ParsedDependency | null {
    if (!line || line.startsWith('//')) return null;

    // Format: module/path v1.2.3 // indirect
    const match = line.match(/^(\S+)\s+(\S+)(.*)/);
    if (!match) return null;

    const isIndirect = match[3].includes('// indirect');

    return {
      name: match[1],
      versionConstraint: match[2],
      isDev: false,
      isDirect: !isIndirect,
    };
  }
}
