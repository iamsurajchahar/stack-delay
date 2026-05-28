export enum Ecosystem {
  npm = 'npm',
  pypi = 'pypi',
  rubygems = 'rubygems',
  go = 'go',
  maven = 'maven',
  cargo = 'cargo',
  nuget = 'nuget',
  composer = 'composer',
}

export const ECOSYSTEM_MANIFEST_MAP: Record<Ecosystem, string[]> = {
  [Ecosystem.npm]: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
  [Ecosystem.pypi]: ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py', 'setup.cfg', 'poetry.lock'],
  [Ecosystem.rubygems]: ['Gemfile', 'Gemfile.lock', '*.gemspec'],
  [Ecosystem.go]: ['go.mod', 'go.sum'],
  [Ecosystem.maven]: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  [Ecosystem.cargo]: ['Cargo.toml', 'Cargo.lock'],
  [Ecosystem.nuget]: ['*.csproj', '*.fsproj', '*.vbproj', 'packages.config', 'Directory.Packages.props'],
  [Ecosystem.composer]: ['composer.json', 'composer.lock'],
};

export const ECOSYSTEM_REGISTRY_URLS: Record<Ecosystem, string> = {
  [Ecosystem.npm]: 'https://registry.npmjs.org',
  [Ecosystem.pypi]: 'https://pypi.org',
  [Ecosystem.rubygems]: 'https://rubygems.org',
  [Ecosystem.go]: 'https://proxy.golang.org',
  [Ecosystem.maven]: 'https://repo1.maven.org/maven2',
  [Ecosystem.cargo]: 'https://crates.io',
  [Ecosystem.nuget]: 'https://api.nuget.org/v3/index.json',
  [Ecosystem.composer]: 'https://packagist.org',
};

export const ECOSYSTEM_DISPLAY_NAMES: Record<Ecosystem, string> = {
  [Ecosystem.npm]: 'npm (Node.js)',
  [Ecosystem.pypi]: 'PyPI (Python)',
  [Ecosystem.rubygems]: 'RubyGems (Ruby)',
  [Ecosystem.go]: 'Go Modules',
  [Ecosystem.maven]: 'Maven / Gradle (Java)',
  [Ecosystem.cargo]: 'Cargo (Rust)',
  [Ecosystem.nuget]: 'NuGet (.NET)',
  [Ecosystem.composer]: 'Composer (PHP)',
};

const FILENAME_ECOSYSTEM_MAP: Array<{ pattern: RegExp; ecosystem: Ecosystem }> = [
  { pattern: /^package\.json$/, ecosystem: Ecosystem.npm },
  { pattern: /^package-lock\.json$/, ecosystem: Ecosystem.npm },
  { pattern: /^yarn\.lock$/, ecosystem: Ecosystem.npm },
  { pattern: /^pnpm-lock\.yaml$/, ecosystem: Ecosystem.npm },
  { pattern: /^requirements.*\.txt$/, ecosystem: Ecosystem.pypi },
  { pattern: /^Pipfile(\.lock)?$/, ecosystem: Ecosystem.pypi },
  { pattern: /^pyproject\.toml$/, ecosystem: Ecosystem.pypi },
  { pattern: /^setup\.(py|cfg)$/, ecosystem: Ecosystem.pypi },
  { pattern: /^poetry\.lock$/, ecosystem: Ecosystem.pypi },
  { pattern: /^Gemfile(\.lock)?$/, ecosystem: Ecosystem.rubygems },
  { pattern: /\.gemspec$/, ecosystem: Ecosystem.rubygems },
  { pattern: /^go\.(mod|sum)$/, ecosystem: Ecosystem.go },
  { pattern: /^pom\.xml$/, ecosystem: Ecosystem.maven },
  { pattern: /^build\.gradle(\.kts)?$/, ecosystem: Ecosystem.maven },
  { pattern: /^Cargo\.(toml|lock)$/, ecosystem: Ecosystem.cargo },
  { pattern: /\.(csproj|fsproj|vbproj)$/, ecosystem: Ecosystem.nuget },
  { pattern: /^packages\.config$/, ecosystem: Ecosystem.nuget },
  { pattern: /^Directory\.Packages\.props$/, ecosystem: Ecosystem.nuget },
  { pattern: /^composer\.(json|lock)$/, ecosystem: Ecosystem.composer },
];

export function detectEcosystem(filePath: string): Ecosystem | null {
  const fileName = filePath.split('/').pop() ?? filePath;
  for (const { pattern, ecosystem } of FILENAME_ECOSYSTEM_MAP) {
    if (pattern.test(fileName)) {
      return ecosystem;
    }
  }
  return null;
}
