import { Request, Response, NextFunction } from 'express';
import { Package } from '../models/Package';
import { PackageHealthHistory } from '../models/PackageHealthHistory';
import { AppError } from '../middleware/errorHandler.middleware';
import { cacheGet, cacheSet } from '../utils/cache';
import { CACHE_TTL } from '@stack-decay/shared';

export async function getPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ecosystem = req.params.ecosystem as string;
    const name = req.params.name as string;

    if (!ecosystem || !name) {
      throw new AppError('Ecosystem and package name are required', 400, 'MISSING_PARAMS');
    }

    const cacheKey = `pkg:${ecosystem}:${name}`;
    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.json({ status: 'success', data: { package: cached } });
      return;
    }

    const pkg = await Package.findOne({
      ecosystem,
      name: decodeURIComponent(name),
    }).lean();

    if (!pkg) {
      throw new AppError(`Package ${ecosystem}/${name} not found`, 404, 'PACKAGE_NOT_FOUND');
    }

    await cacheSet(cacheKey, pkg, CACHE_TTL.PACKAGE_METADATA);

    res.json({
      status: 'success',
      data: { package: pkg },
    });
  } catch (err) {
    next(err);
  }
}

export async function getHealthHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ecosystem = req.params.ecosystem as string;
    const name = req.params.name as string;

    if (!ecosystem || !name) {
      throw new AppError('Ecosystem and package name are required', 400, 'MISSING_PARAMS');
    }

    const pkg = await Package.findOne({
      ecosystem,
      name: decodeURIComponent(name),
    }).select('_id');

    if (!pkg) {
      throw new AppError(`Package ${ecosystem}/${name} not found`, 404, 'PACKAGE_NOT_FOUND');
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    const dateFilter: Record<string, Date> = {};
    if (req.query.from) {
      const fromDate = new Date(req.query.from as string);
      if (!isNaN(fromDate.getTime())) {
        dateFilter.$gte = fromDate;
      }
    }
    if (req.query.to) {
      const toDate = new Date(req.query.to as string);
      if (!isNaN(toDate.getTime())) {
        dateFilter.$lte = toDate;
      }
    }

    const query: Record<string, unknown> = { packageId: pkg._id };
    if (Object.keys(dateFilter).length > 0) {
      query.snapshotDate = dateFilter;
    }

    const history = await PackageHealthHistory.find(query)
      .sort({ snapshotDate: -1 })
      .limit(limit)
      .lean();

    res.json({
      status: 'success',
      data: { history },
    });
  } catch (err) {
    next(err);
  }
}

export async function getVulnerabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ecosystem = req.params.ecosystem as string;
    const name = req.params.name as string;

    if (!ecosystem || !name) {
      throw new AppError('Ecosystem and package name are required', 400, 'MISSING_PARAMS');
    }

    const cacheKey = `vuln:${ecosystem}:${name}`;
    const cached = await cacheGet<unknown[]>(cacheKey);
    if (cached) {
      res.json({ status: 'success', data: { vulnerabilities: cached } });
      return;
    }

    const pkg = await Package.findOne({
      ecosystem,
      name: decodeURIComponent(name),
    })
      .select('vulnerabilities')
      .lean();

    if (!pkg) {
      throw new AppError(`Package ${ecosystem}/${name} not found`, 404, 'PACKAGE_NOT_FOUND');
    }

    const vulnerabilities = pkg.vulnerabilities || [];

    // Filter by severity if provided
    const severity = req.query.severity as string;
    const filtered = severity
      ? vulnerabilities.filter((v) => v.severity === severity)
      : vulnerabilities;

    await cacheSet(cacheKey, filtered, CACHE_TTL.VULNERABILITY_DATA);

    res.json({
      status: 'success',
      data: { vulnerabilities: filtered },
    });
  } catch (err) {
    next(err);
  }
}
