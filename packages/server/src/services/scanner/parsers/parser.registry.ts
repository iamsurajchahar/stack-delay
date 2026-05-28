import { Ecosystem } from '@stack-decay/shared';
import { DependencyParser } from './parser.interface';
import { NpmParser } from './npm.parser';
import { PythonParser } from './python.parser';
import { RubyParser } from './ruby.parser';
import { GoParser } from './go.parser';
import { JavaParser } from './java.parser';
import { RustParser } from './rust.parser';
import { DotnetParser } from './dotnet.parser';
import { ComposerParser } from './composer.parser';

const parserInstances = new Map<Ecosystem, DependencyParser>();

function createParser(ecosystem: Ecosystem): DependencyParser {
  switch (ecosystem) {
    case Ecosystem.npm:
      return new NpmParser();
    case Ecosystem.pypi:
      return new PythonParser();
    case Ecosystem.rubygems:
      return new RubyParser();
    case Ecosystem.go:
      return new GoParser();
    case Ecosystem.maven:
      return new JavaParser();
    case Ecosystem.cargo:
      return new RustParser();
    case Ecosystem.nuget:
      return new DotnetParser();
    case Ecosystem.composer:
      return new ComposerParser();
    default:
      throw new Error(`No parser available for ecosystem: ${ecosystem}`);
  }
}

/**
 * Get a singleton parser instance for the given ecosystem.
 */
export function getParser(ecosystem: Ecosystem): DependencyParser {
  let parser = parserInstances.get(ecosystem);
  if (!parser) {
    parser = createParser(ecosystem);
    parserInstances.set(ecosystem, parser);
  }
  return parser;
}
