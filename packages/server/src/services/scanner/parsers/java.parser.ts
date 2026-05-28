import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser, ParsedDependency } from './parser.interface';
import { logger } from '../../../utils/logger';

export class JavaParser implements DependencyParser {
  ecosystem = Ecosystem.maven;

  parse(content: string, filePath: string): ParsedDependency[] {
    const results: ParsedDependency[] = [];

    // Extract properties for variable resolution
    const properties = this.extractProperties(content);

    // Find all <dependency> blocks within <dependencies> sections
    // We need to handle both top-level and plugin dependencies
    const depRegex = /<dependency>\s*([\s\S]*?)<\/dependency>/g;
    let match;

    while ((match = depRegex.exec(content)) !== null) {
      const depBlock = match[1];

      const groupId = this.extractTag(depBlock, 'groupId');
      const artifactId = this.extractTag(depBlock, 'artifactId');
      let version = this.extractTag(depBlock, 'version');
      const scope = this.extractTag(depBlock, 'scope');

      if (!groupId || !artifactId) continue;

      // Resolve property references like ${project.version}
      if (version) {
        version = this.resolveProperties(version, properties);
      }

      const name = `${groupId}:${artifactId}`;
      const isDev = scope === 'test' || scope === 'provided';

      results.push({
        name,
        versionConstraint: version || '',
        isDev,
        isDirect: true,
      });
    }

    return results;
  }

  private extractTag(block: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}>\\s*([^<]*)\\s*</${tagName}>`);
    const match = block.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractProperties(content: string): Map<string, string> {
    const props = new Map<string, string>();

    const propsBlockMatch = content.match(/<properties>([\s\S]*?)<\/properties>/);
    if (!propsBlockMatch) return props;

    const propsContent = propsBlockMatch[1];
    const propRegex = /<([^/>\s]+)>\s*([^<]*)\s*<\/\1>/g;
    let match;

    while ((match = propRegex.exec(propsContent)) !== null) {
      props.set(match[1], match[2].trim());
    }

    return props;
  }

  private resolveProperties(value: string, properties: Map<string, string>): string {
    return value.replace(/\$\{([^}]+)\}/g, (fullMatch, propName) => {
      const resolved = properties.get(propName);
      return resolved ?? fullMatch;
    });
  }
}
