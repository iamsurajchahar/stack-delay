import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Repository } from '../models/Repository';
import { Scan } from '../models/Scan';
import { Package } from '../models/Package';
import { DependencyScore } from '../models/DependencyScore';
import { AppError } from '../middleware/errorHandler.middleware';

// License compatibility matrix
const LICENSE_CATEGORIES: Record<string, { category: string; permissive: boolean }> = {
  'MIT': { category: 'Permissive', permissive: true },
  'ISC': { category: 'Permissive', permissive: true },
  'BSD-2-Clause': { category: 'Permissive', permissive: true },
  'BSD-3-Clause': { category: 'Permissive', permissive: true },
  'Apache-2.0': { category: 'Permissive', permissive: true },
  'Unlicense': { category: 'Public Domain', permissive: true },
  '0BSD': { category: 'Public Domain', permissive: true },
  'CC0-1.0': { category: 'Public Domain', permissive: true },
  'WTFPL': { category: 'Public Domain', permissive: true },
  'GPL-2.0': { category: 'Copyleft', permissive: false },
  'GPL-2.0-only': { category: 'Copyleft', permissive: false },
  'GPL-2.0-or-later': { category: 'Copyleft', permissive: false },
  'GPL-3.0': { category: 'Copyleft', permissive: false },
  'GPL-3.0-only': { category: 'Copyleft', permissive: false },
  'GPL-3.0-or-later': { category: 'Copyleft', permissive: false },
  'AGPL-3.0': { category: 'Strong Copyleft', permissive: false },
  'AGPL-3.0-only': { category: 'Strong Copyleft', permissive: false },
  'LGPL-2.1': { category: 'Weak Copyleft', permissive: false },
  'LGPL-3.0': { category: 'Weak Copyleft', permissive: false },
  'MPL-2.0': { category: 'Weak Copyleft', permissive: false },
  'EUPL-1.2': { category: 'Copyleft', permissive: false },
  'CC-BY-4.0': { category: 'Creative Commons', permissive: true },
  'CC-BY-SA-4.0': { category: 'Creative Commons (Copyleft)', permissive: false },
  'CC-BY-NC-4.0': { category: 'Non-Commercial', permissive: false },
};

function analyzeLicense(spdx: string | null): { category: string; permissive: boolean; risk: string } {
  if (!spdx || spdx === '' || spdx === 'UNKNOWN' || spdx === 'NONE') {
    return { category: 'Unknown', permissive: false, risk: 'high' };
  }
  const info = LICENSE_CATEGORIES[spdx];
  if (info) {
    return { ...info, risk: info.permissive ? 'low' : (info.category.includes('Strong') || info.category === 'Non-Commercial' ? 'high' : 'medium') };
  }
  // Try partial match
  for (const [key, val] of Object.entries(LICENSE_CATEGORIES)) {
    if (spdx.includes(key)) return { ...val, risk: val.permissive ? 'low' : 'medium' };
  }
  return { category: 'Other', permissive: true, risk: 'low' };
}

export async function getRepoLicenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;
    if (!Types.ObjectId.isValid(repoId)) {
      throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
    }

    const repo = await Repository.findOne({
      _id: new Types.ObjectId(repoId),
      userId: new Types.ObjectId(req.userId!),
    });
    if (!repo) throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');

    const latestScan = await Scan.findOne({ repositoryId: repo._id, status: 'completed' })
      .sort({ createdAt: -1 }).lean();

    if (!latestScan) {
      res.json({ status: 'success', data: { licenses: [], summary: {} } });
      return;
    }

    const packageIds = new Set<string>();
    for (const manifest of latestScan.manifests || []) {
      for (const dep of manifest.dependencies || []) {
        if (dep.packageId) packageIds.add(dep.packageId.toString());
      }
    }

    const packages = await Package.find({
      _id: { $in: Array.from(packageIds).map(id => new Types.ObjectId(id)) },
    }).select('name ecosystem license latestHealth.license').lean();

    const licenses = packages.map(pkg => {
      const spdx = pkg.latestHealth?.license?.spdx || pkg.license || null;
      const analysis = analyzeLicense(spdx);
      return {
        packageName: pkg.name,
        ecosystem: pkg.ecosystem,
        license: spdx || 'Unknown',
        category: analysis.category,
        permissive: analysis.permissive,
        risk: analysis.risk,
      };
    });

    // Summary
    const summary = {
      total: licenses.length,
      permissive: licenses.filter(l => l.permissive).length,
      copyleft: licenses.filter(l => !l.permissive && l.risk !== 'high').length,
      high_risk: licenses.filter(l => l.risk === 'high').length,
      unknown: licenses.filter(l => l.license === 'Unknown').length,
    };

    licenses.sort((a, b) => {
      const riskOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (riskOrder[a.risk] ?? 3) - (riskOrder[b.risk] ?? 3);
    });

    res.json({ status: 'success', data: { licenses, summary } });
  } catch (err) {
    next(err);
  }
}
