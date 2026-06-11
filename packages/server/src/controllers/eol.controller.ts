import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Repository } from '../models/Repository';
import { Scan } from '../models/Scan';
import { AppError } from '../middleware/errorHandler.middleware';
import { getEolInfo } from '../services/enrichment/endoflife.client';

/** Map scan ecosystem values to endoflife.date product names */
const ECOSYSTEM_TO_PRODUCT: Record<string, string> = {
  npm: 'nodejs',
  pip: 'python',
  pypi: 'python',
  gem: 'ruby',
  rubygems: 'ruby',
  go: 'go',
  cargo: 'rust',
  maven: 'java',
  nuget: 'dotnet',
  composer: 'php',
};

/** Well-known frameworks we can detect by dependency name */
const FRAMEWORK_DEPS: Record<string, string> = {
  react: 'react',
  '@angular/core': 'angular',
  vue: 'vue',
  django: 'django',
  rails: 'rails',
  'spring-boot-starter': 'spring-boot',
  laravel: 'laravel',
  next: 'nextjs',
  nuxt: 'nuxt',
  express: 'express',
};

export async function getRepoEol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;

    if (!Types.ObjectId.isValid(repoId)) {
      throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
    }

    const repo = await Repository.findOne({
      _id: new Types.ObjectId(repoId),
      userId: new Types.ObjectId(req.userId!),
    });

    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
    }

    // Find the latest completed scan
    const latestScan = await Scan.findOne({
      repositoryId: repo._id,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestScan || !latestScan.manifests?.length) {
      res.json({
        status: 'success',
        data: { entries: [] },
      });
      return;
    }

    // Collect unique runtimes from ecosystems
    const productsToFetch = new Map<string, string | undefined>(); // product -> version hint

    for (const manifest of latestScan.manifests) {
      const product = ECOSYSTEM_TO_PRODUCT[manifest.ecosystem.toLowerCase()];
      if (product && !productsToFetch.has(product)) {
        productsToFetch.set(product, undefined);
      }

      // Detect known frameworks from dependency names
      for (const dep of manifest.dependencies) {
        const depNameLower = dep.name.toLowerCase();
        for (const [depPattern, frameworkProduct] of Object.entries(FRAMEWORK_DEPS)) {
          if (depNameLower === depPattern && !productsToFetch.has(frameworkProduct)) {
            const version = dep.resolvedVersion || undefined;
            productsToFetch.set(frameworkProduct, version);
          }
        }
      }
    }

    // Fetch EOL info in parallel
    const entries: Array<{
      name: string;
      product: string;
      eolDate: string | null;
      isEol: boolean;
      supportEndDate: string | null;
      latestVersion: string | null;
      daysUntilEol: number | null;
    }> = [];

    const fetches = Array.from(productsToFetch.entries()).map(
      async ([product, version]) => {
        const info = await getEolInfo(product, version);
        if (!info) return;

        let daysUntilEol: number | null = null;
        if (info.eolDate) {
          daysUntilEol = Math.ceil(
            (new Date(info.eolDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
        }

        entries.push({
          name: product.charAt(0).toUpperCase() + product.slice(1),
          product,
          eolDate: info.eolDate,
          isEol: info.isEol,
          supportEndDate: info.supportEndDate,
          latestVersion: info.latestVersion,
          daysUntilEol,
        });
      },
    );

    await Promise.all(fetches);

    // Sort: past EOL first, then by soonest EOL date
    entries.sort((a, b) => {
      if (a.isEol !== b.isEol) return a.isEol ? -1 : 1;
      if (a.daysUntilEol == null) return 1;
      if (b.daysUntilEol == null) return -1;
      return a.daysUntilEol - b.daysUntilEol;
    });

    res.json({
      status: 'success',
      data: { entries },
    });
  } catch (err) {
    next(err);
  }
}
