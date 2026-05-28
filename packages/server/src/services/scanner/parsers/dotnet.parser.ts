import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class DotnetParser implements DependencyParser {
  ecosystem = Ecosystem.nuget;

  parse(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];

    // Match <PackageReference Include="..." Version="..." /> or multi-line variants
    const packageRefRegex = /<PackageReference\s+([^>]*?)\/?>(?:\s*<\/PackageReference>)?/gi;
    let match;

    while ((match = packageRefRegex.exec(content)) !== null) {
      const attrs = match[1];

      const name = this.extractAttribute(attrs, 'Include');
      if (!name) continue;

      const version = this.extractAttribute(attrs, 'Version') || '';
      const privateAssets = this.extractAttribute(attrs, 'PrivateAssets');
      const condition = this.extractAttribute(attrs, 'Condition');

      // PrivateAssets="All" typically means a dev/build dependency
      const isDev = privateAssets?.toLowerCase() === 'all';

      results.push({
        name,
        versionConstraint: version,
        isDev,
        isDirect: true,
      });
    }

    return results;
  }

  private extractAttribute(attrs: string, name: string): string | null {
    // Match both double-quoted and single-quoted attribute values
    const regex = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i');
    const match = attrs.match(regex);
    return match ? match[1] : null;
  }
}
