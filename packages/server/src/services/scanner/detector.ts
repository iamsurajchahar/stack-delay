import { Ecosystem, detectEcosystem } from '@stack-decay/shared';

/** Directories to exclude from manifest detection */
const EXCLUDED_DIRS = [
  'node_modules',
  'vendor',
  '.git',
  '__pycache__',
  '.tox',
  '.venv',
  'venv',
  'dist',
  'build',
  '.cache',
  '.gradle',
  'target', // Rust/Java build output
];

/**
 * Detect manifest files from a list of file tree paths.
 * Returns an array of detected manifests with their ecosystem.
 * Handles monorepo structures (nested paths like packages/api/package.json).
 * Filters out files in excluded directories (node_modules, vendor, .git, etc.).
 */
export function detectManifests(
  treePaths: string[],
): Array<{ filePath: string; ecosystem: Ecosystem }> {
  const results: Array<{ filePath: string; ecosystem: Ecosystem }> = [];

  for (const filePath of treePaths) {
    // Check if the path contains any excluded directory
    if (isExcludedPath(filePath)) continue;

    const ecosystem = detectEcosystem(filePath);
    if (ecosystem !== null) {
      // Only include parseable manifests, not lock files
      if (isParseableManifest(filePath, ecosystem)) {
        results.push({ filePath, ecosystem });
      }
    }
  }

  return results;
}

/**
 * Check if a file path traverses through an excluded directory.
 */
function isExcludedPath(filePath: string): boolean {
  const segments = filePath.split('/');
  // Check all directory segments (not the filename itself)
  for (let i = 0; i < segments.length - 1; i++) {
    if (EXCLUDED_DIRS.includes(segments[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Determine if a manifest file is one we can/should parse for dependencies.
 * We skip lock files and certain files that we don't have parsers for.
 */
function isParseableManifest(filePath: string, ecosystem: Ecosystem): boolean {
  const fileName = filePath.split('/').pop() ?? filePath;

  // Skip lock files - we parse the manifest, not the lock
  if (
    fileName === 'package-lock.json' ||
    fileName === 'yarn.lock' ||
    fileName === 'pnpm-lock.yaml' ||
    fileName === 'Gemfile.lock' ||
    fileName === 'Cargo.lock' ||
    fileName === 'go.sum' ||
    fileName === 'poetry.lock' ||
    fileName === 'Pipfile.lock' ||
    fileName === 'composer.lock'
  ) {
    return false;
  }

  // Skip files we don't have parsers for yet
  if (
    fileName === 'Pipfile' ||
    fileName === 'setup.py' ||
    fileName === 'setup.cfg' ||
    fileName === 'build.gradle' ||
    fileName === 'build.gradle.kts' ||
    fileName === 'packages.config' ||
    fileName === 'Directory.Packages.props' ||
    fileName.endsWith('.gemspec') ||
    fileName.endsWith('.fsproj') ||
    fileName.endsWith('.vbproj')
  ) {
    return false;
  }

  return true;
}
