import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class RustParser implements DependencyParser {
  ecosystem = Ecosystem.cargo;

  parse(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];

    const sections = this.parseSections(content);

    // Parse [dependencies]
    const deps = sections.get('dependencies');
    if (deps) {
      for (const dep of this.parseDependencySection(deps)) {
        results.push({ ...dep, isDev: false });
      }
    }

    // Parse [dev-dependencies]
    const devDeps = sections.get('dev-dependencies');
    if (devDeps) {
      for (const dep of this.parseDependencySection(devDeps)) {
        results.push({ ...dep, isDev: true });
      }
    }

    // Parse [build-dependencies]
    const buildDeps = sections.get('build-dependencies');
    if (buildDeps) {
      for (const dep of this.parseDependencySection(buildDeps)) {
        results.push({ ...dep, isDev: true });
      }
    }

    return results;
  }

  /**
   * Split TOML content into named sections with their body text.
   */
  private parseSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = '';
    let currentBody: string[] = [];

    for (const line of lines) {
      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        if (currentSection) {
          sections.set(currentSection, currentBody.join('\n'));
        }
        currentSection = sectionMatch[1].trim();
        currentBody = [];
      } else {
        currentBody.push(line);
      }
    }

    if (currentSection) {
      sections.set(currentSection, currentBody.join('\n'));
    }

    return sections;
  }

  private parseDependencySection(sectionContent: string): Array<{ name: string; versionConstraint: string; isDirect: boolean }> {
    const results: Array<{ name: string; versionConstraint: string; isDirect: boolean }> = [];
    const lines = sectionContent.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      // Match: package_name = "version"
      const simpleMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/);
      if (simpleMatch) {
        results.push({
          name: simpleMatch[1],
          versionConstraint: simpleMatch[2],
          isDirect: true,
        });
        continue;
      }

      // Match: package_name = { version = "1.0", ... } or { workspace = true }
      const tableMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*\{([^}]*)\}/);
      if (tableMatch) {
        const name = tableMatch[1];
        const tableContent = tableMatch[2];

        // Check for workspace dependency
        if (/workspace\s*=\s*true/.test(tableContent)) {
          results.push({
            name,
            versionConstraint: 'workspace',
            isDirect: true,
          });
          continue;
        }

        const versionMatch = tableContent.match(/version\s*=\s*"([^"]+)"/);
        results.push({
          name,
          versionConstraint: versionMatch ? versionMatch[1] : '*',
          isDirect: true,
        });
        continue;
      }
    }

    return results;
  }
}
