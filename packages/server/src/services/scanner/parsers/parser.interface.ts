import { Ecosystem } from '@stack-decay/shared';

export interface ParsedDependency {
  name: string;
  versionConstraint: string;
  isDev: boolean;
  isDirect: boolean;
}

export interface DependencyParser {
  ecosystem: Ecosystem;
  parse(content: string, filePath: string): ParsedDependency[];
}
