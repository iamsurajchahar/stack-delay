import axios from 'axios';
import { Ecosystem } from '@stack-decay/shared';
import { logger } from '../../utils/logger';
import { detectManifests } from './detector';
import { getParser } from './parsers/parser.registry';
import { ParsedDependency } from './parsers/parser.interface';

export interface ScanResult {
  filePath: string;
  ecosystem: Ecosystem;
  dependencies: ParsedDependency[];
}

export interface RepositoryInfo {
  owner: string;
  name: string;
  defaultBranch: string;
}

/**
 * Orchestrates the scanning of a repository:
 * 1. Fetches the repository file tree from GitHub
 * 2. Detects manifest files
 * 3. Parses each manifest for dependencies
 */
export async function scanRepository(
  repo: RepositoryInfo,
  githubToken: string,
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  // Step 1: Fetch the repository tree from GitHub
  let treePaths: string[];
  try {
    treePaths = await fetchRepoTree(repo, githubToken);
  } catch (err) {
    logger.error(
      { err, repo: `${repo.owner}/${repo.name}` },
      'Failed to fetch repository tree from GitHub',
    );
    return results;
  }

  if (treePaths.length === 0) {
    logger.info({ repo: `${repo.owner}/${repo.name}` }, 'Repository tree is empty');
    return results;
  }

  // Step 2: Detect manifest files
  const manifests = detectManifests(treePaths);

  if (manifests.length === 0) {
    logger.info(
      { repo: `${repo.owner}/${repo.name}`, fileCount: treePaths.length },
      'No manifest files detected in repository',
    );
    return results;
  }

  logger.info(
    { repo: `${repo.owner}/${repo.name}`, manifestCount: manifests.length },
    'Detected manifest files',
  );

  // Step 3: Fetch and parse each manifest
  for (const manifest of manifests) {
    try {
      const content = await fetchFileContent(
        repo,
        manifest.filePath,
        githubToken,
      );

      if (!content) {
        logger.warn(
          { filePath: manifest.filePath, repo: `${repo.owner}/${repo.name}` },
          'Empty or unreadable manifest file, skipping',
        );
        continue;
      }

      const parser = getParser(manifest.ecosystem);
      const dependencies = parser.parse(content, manifest.filePath);

      results.push({
        filePath: manifest.filePath,
        ecosystem: manifest.ecosystem,
        dependencies,
      });

      logger.debug(
        {
          filePath: manifest.filePath,
          ecosystem: manifest.ecosystem,
          depCount: dependencies.length,
        },
        'Parsed manifest file',
      );
    } catch (err) {
      logger.error(
        { err, filePath: manifest.filePath, repo: `${repo.owner}/${repo.name}` },
        'Failed to parse manifest file, skipping',
      );
      // Continue with other manifests instead of failing the whole scan
    }
  }

  return results;
}

/**
 * Fetch the full file tree of a repository using the GitHub Trees API.
 * Uses recursive=1 to get the entire tree in one call.
 */
async function fetchRepoTree(
  repo: RepositoryInfo,
  githubToken: string,
): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/git/trees/${repo.defaultBranch}?recursive=1`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
    timeout: 30000,
  });

  const tree = response.data?.tree;
  if (!Array.isArray(tree)) {
    return [];
  }

  // Only return blob paths (files), not trees (directories)
  return tree
    .filter((entry: { type: string; path: string }) => entry.type === 'blob')
    .map((entry: { path: string }) => entry.path);
}

/**
 * Fetch the raw content of a single file from a GitHub repository.
 */
async function fetchFileContent(
  repo: RepositoryInfo,
  filePath: string,
  githubToken: string,
): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(filePath)}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3.raw',
      },
      timeout: 15000,
      // Return raw text, not parsed JSON
      responseType: 'text',
      // Prevent axios from auto-parsing JSON responses (like package.json)
      transformResponse: [(data: string) => data],
    });

    return typeof response.data === 'string' ? response.data : null;
  } catch (err) {
    logger.warn(
      { err, filePath, repo: `${repo.owner}/${repo.name}` },
      'Failed to fetch file content from GitHub',
    );
    return null;
  }
}
