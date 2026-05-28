import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class PythonParser implements DependencyParser {
  ecosystem = Ecosystem.pypi;

  parse(content: string, filePath: string): ParsedDependency[] {
    const fileName = filePath.split('/').pop() ?? filePath;

    if (fileName === 'pyproject.toml' || fileName.endsWith('pyproject.toml')) {
      return this.parsePyprojectToml(content, filePath);
    }

    // Default: requirements.txt style
    return this.parseRequirementsTxt(content, filePath);
  }

  private parseRequirementsTxt(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];
    const lines = content.split('\n');
    let continuationLine = '';

    for (let rawLine of lines) {
      // Handle line continuations
      if (continuationLine) {
        rawLine = continuationLine + rawLine.trim();
        continuationLine = '';
      }
      if (rawLine.trimEnd().endsWith('\\')) {
        continuationLine = rawLine.trimEnd().slice(0, -1);
        continue;
      }

      let line = rawLine.trim();

      // Remove inline comments
      const commentIdx = line.indexOf('#');
      if (commentIdx === 0) continue; // full line comment
      if (commentIdx > 0) {
        line = line.substring(0, commentIdx).trim();
      }

      if (!line) continue;

      // Skip -r includes, -e editable installs, --options
      if (line.startsWith('-r ') || line.startsWith('-c ') || line.startsWith('--')) continue;
      if (line.startsWith('-e ') || line.startsWith('-f ') || line.startsWith('-i ')) continue;

      // Remove environment markers: ; python_version >= "3.8"
      const markerIdx = line.indexOf(';');
      if (markerIdx > 0) {
        line = line.substring(0, markerIdx).trim();
      }

      // Remove extras: package[security]
      const extrasMatch = line.match(/^([A-Za-z0-9._-]+)\[([^\]]*)\](.*)/);
      if (extrasMatch) {
        line = extrasMatch[1] + extrasMatch[3];
      }

      // Parse name and version constraint
      // Supported operators: ==, >=, <=, ~=, !=, >, <
      const constraintMatch = line.match(/^([A-Za-z0-9._-]+)\s*((?:[><=!~]=?|===?).*)$/);
      if (constraintMatch) {
        results.push({
          name: this.normalizePypiName(constraintMatch[1]),
          versionConstraint: constraintMatch[2].trim(),
          isDev: false,
          isDirect: true,
        });
      } else if (/^[A-Za-z0-9._-]+$/.test(line)) {
        // Bare package name with no constraint
        results.push({
          name: this.normalizePypiName(line),
          versionConstraint: '*',
          isDev: false,
          isDirect: true,
        });
      }
      // Skip URLs, paths, and other non-standard lines
    }

    return results;
  }

  private parsePyprojectToml(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];

    // Parse [project.dependencies]
    const projectDeps = this.extractTomlArray(content, 'project', 'dependencies');
    for (const dep of projectDeps) {
      const parsed = this.parseRequirementString(dep);
      if (parsed) {
        results.push({ ...parsed, isDev: false, isDirect: true });
      }
    }

    // Parse [project.optional-dependencies] sections
    const optionalDeps = this.extractTomlOptionalDependencies(content);
    for (const dep of optionalDeps) {
      const parsed = this.parseRequirementString(dep);
      if (parsed) {
        results.push({ ...parsed, isDev: true, isDirect: true });
      }
    }

    return results;
  }

  private parseRequirementString(req: string): { name: string; versionConstraint: string } | null {
    let line = req.trim();
    if (!line) return null;

    // Remove inline comments
    const commentIdx = line.indexOf('#');
    if (commentIdx >= 0) line = line.substring(0, commentIdx).trim();

    // Remove environment markers
    const markerIdx = line.indexOf(';');
    if (markerIdx > 0) line = line.substring(0, markerIdx).trim();

    // Remove extras
    const extrasMatch = line.match(/^([A-Za-z0-9._-]+)\[([^\]]*)\](.*)/);
    if (extrasMatch) {
      line = extrasMatch[1] + extrasMatch[3];
    }

    const constraintMatch = line.match(/^([A-Za-z0-9._-]+)\s*((?:[><=!~]=?|===?).*)$/);
    if (constraintMatch) {
      return {
        name: this.normalizePypiName(constraintMatch[1]),
        versionConstraint: constraintMatch[2].trim(),
      };
    }

    if (/^[A-Za-z0-9._-]+$/.test(line)) {
      return {
        name: this.normalizePypiName(line),
        versionConstraint: '*',
      };
    }

    return null;
  }

  /**
   * Extract an array value from a TOML section like [project] dependencies = [...]
   */
  private extractTomlArray(content: string, section: string, key: string): string[] {
    const results: string[] = [];
    // Match [section]\n...\nkey = [...]
    const sectionRegex = new RegExp(`\\[${this.escapeRegex(section)}\\]`);
    const sectionMatch = content.match(sectionRegex);
    if (!sectionMatch || sectionMatch.index === undefined) return results;

    const afterSection = content.substring(sectionMatch.index + sectionMatch[0].length);
    // Find where next section starts
    const nextSectionMatch = afterSection.match(/\n\s*\[/);
    const sectionContent = nextSectionMatch && nextSectionMatch.index !== undefined
      ? afterSection.substring(0, nextSectionMatch.index)
      : afterSection;

    // Find key = [...]
    const keyRegex = new RegExp(`^${this.escapeRegex(key)}\\s*=\\s*\\[`, 'm');
    const keyMatch = sectionContent.match(keyRegex);
    if (!keyMatch || keyMatch.index === undefined) return results;

    const startIdx = keyMatch.index + keyMatch[0].length;
    let depth = 1;
    let idx = startIdx;
    while (idx < sectionContent.length && depth > 0) {
      if (sectionContent[idx] === '[') depth++;
      else if (sectionContent[idx] === ']') depth--;
      idx++;
    }

    const arrayContent = sectionContent.substring(startIdx, idx - 1);
    // Extract quoted strings
    const stringMatches = arrayContent.matchAll(/["']([^"']+)["']/g);
    for (const m of stringMatches) {
      results.push(m[1]);
    }

    return results;
  }

  /**
   * Extract all optional-dependencies sections from pyproject.toml
   */
  private extractTomlOptionalDependencies(content: string): string[] {
    const results: string[] = [];
    const sectionRegex = /\[project\.optional-dependencies\]/;
    const sectionMatch = content.match(sectionRegex);
    if (!sectionMatch || sectionMatch.index === undefined) return results;

    const afterSection = content.substring(sectionMatch.index + sectionMatch[0].length);
    const nextSectionMatch = afterSection.match(/\n\s*\[(?!project\.optional)/);
    const sectionContent = nextSectionMatch && nextSectionMatch.index !== undefined
      ? afterSection.substring(0, nextSectionMatch.index)
      : afterSection;

    // Find all key = [...] pairs
    const keyArrayRegex = /\w+\s*=\s*\[([^\]]*)\]/g;
    let match;
    while ((match = keyArrayRegex.exec(sectionContent)) !== null) {
      const arrayContent = match[1];
      const stringMatches = arrayContent.matchAll(/["']([^"']+)["']/g);
      for (const m of stringMatches) {
        results.push(m[1]);
      }
    }

    return results;
  }

  private normalizePypiName(name: string): string {
    // PEP 503: normalize by lowercasing and replacing [-_.] with -
    return name.toLowerCase().replace(/[-_.]+/g, '-');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
