import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import { Repository } from '../models/Repository';
import { Scan } from '../models/Scan';
import { Package } from '../models/Package';
import { DependencyScore } from '../models/DependencyScore';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { AppError } from '../middleware/errorHandler.middleware';

function escapeCSV(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportDependencies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;
    if (!Types.ObjectId.isValid(repoId)) throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');

    const repo = await Repository.findOne({ _id: new Types.ObjectId(repoId), userId: new Types.ObjectId(req.userId!) });
    if (!repo) throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');

    const latestScan = await Scan.findOne({ repositoryId: repo._id, status: 'completed' }).sort({ createdAt: -1 }).lean();
    if (!latestScan) { res.status(404).json({ status: 'error', message: 'No completed scan' }); return; }

    const depScores = await DependencyScore.find({ scanId: latestScan._id }).populate('packageId').sort({ compositeScore: 1 }).lean();

    const headers = ['Package', 'Ecosystem', 'Version', 'Score', 'Grade', 'Maintenance', 'Community', 'Vulnerability', 'License', 'Vulnerabilities Count'];
    const rows = depScores.map(ds => {
      const pkg = ds.packageId as unknown as Record<string, unknown>;
      return [
        pkg?.name || 'Unknown',
        pkg?.ecosystem || '',
        pkg?.latestVersion || '',
        ds.compositeScore,
        ds.grade,
        ds.maintenanceScore,
        ds.communityScore,
        ds.vulnerabilityScore,
        ds.licenseScore,
        (pkg?.vulnerabilities as unknown[] || []).length,
      ].map(escapeCSV).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${repo.fullName.replace('/', '_')}_dependencies.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

export async function exportVulnerabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;
    if (!Types.ObjectId.isValid(repoId)) throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');

    const repo = await Repository.findOne({ _id: new Types.ObjectId(repoId), userId: new Types.ObjectId(req.userId!) });
    if (!repo) throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');

    const latestScan = await Scan.findOne({ repositoryId: repo._id, status: 'completed' }).sort({ createdAt: -1 }).lean();
    if (!latestScan) { res.status(404).json({ status: 'error', message: 'No completed scan' }); return; }

    const packageIds = new Set<string>();
    for (const m of latestScan.manifests || []) {
      for (const d of m.dependencies || []) {
        if (d.packageId) packageIds.add(d.packageId.toString());
      }
    }

    const packages = await Package.find({
      _id: { $in: Array.from(packageIds).map(id => new Types.ObjectId(id)) },
      'vulnerabilities.0': { $exists: true },
    }).select('name ecosystem vulnerabilities').lean();

    const headers = ['Package', 'Ecosystem', 'Advisory ID', 'Severity', 'CVSS', 'Summary', 'Affected Versions', 'Fixed Version', 'Published', 'URL'];
    const rows: string[] = [];
    for (const pkg of packages) {
      for (const v of pkg.vulnerabilities) {
        rows.push([
          pkg.name, pkg.ecosystem, v.sourceId, v.severity, v.cvssScore ?? '', v.summary,
          v.affectedVersions, v.fixedVersion || 'N/A',
          v.publishedAt ? new Date(v.publishedAt).toISOString().split('T')[0] : '', v.url,
        ].map(escapeCSV).join(','));
      }
    }

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${repo.fullName.replace('/', '_')}_vulnerabilities.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
}

export async function exportFullReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;
    if (!Types.ObjectId.isValid(repoId)) throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');

    const repo = await Repository.findOne({ _id: new Types.ObjectId(repoId), userId: new Types.ObjectId(req.userId!) });
    if (!repo) throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');

    const scoreSnapshot = await RepoScoreSnapshot.findOne({ repositoryId: repo._id }).sort({ snapshotDate: -1 }).lean();

    const latestScan = await Scan.findOne({ repositoryId: repo._id, status: 'completed' }).sort({ createdAt: -1 }).lean();

    const lines: string[] = [];
    lines.push('STACK DECAY SCORE - HEALTH REPORT');
    lines.push(`Repository: ${repo.fullName}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Last Scan: ${latestScan?.completedAt ? new Date(latestScan.completedAt).toISOString() : 'N/A'}`);
    lines.push('');

    if (scoreSnapshot) {
      lines.push('OVERALL SCORES');
      lines.push(`Composite Score: ${scoreSnapshot.compositeScore}/100 (Grade: ${scoreSnapshot.grade})`);
      lines.push(`Maintenance Avg: ${scoreSnapshot.maintenanceAvg}`);
      lines.push(`Community Avg: ${scoreSnapshot.communityAvg}`);
      lines.push(`Vulnerability Avg: ${scoreSnapshot.vulnerabilityAvg}`);
      lines.push(`EOL Avg: ${scoreSnapshot.eolAvg}`);
      lines.push(`License Avg: ${scoreSnapshot.licenseAvg}`);
      lines.push(`Total Dependencies: ${scoreSnapshot.totalDependencies}`);
      lines.push(`Vulnerable: ${scoreSnapshot.vulnerableCount}`);
      lines.push(`Deprecated: ${scoreSnapshot.deprecatedCount}`);
      lines.push(`Outdated: ${scoreSnapshot.outdatedCount}`);
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${repo.fullName.replace('/', '_')}_report.txt"`);
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
}

export async function exportPdfReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;
    if (!Types.ObjectId.isValid(repoId)) throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');

    const repo = await Repository.findOne({ _id: new Types.ObjectId(repoId), userId: new Types.ObjectId(req.userId!) });
    if (!repo) throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');

    const scoreSnapshot = await RepoScoreSnapshot.findOne({ repositoryId: repo._id }).sort({ snapshotDate: -1 }).lean();
    const latestScan = await Scan.findOne({ repositoryId: repo._id, status: 'completed' }).sort({ createdAt: -1 }).lean();
    const depScores = latestScan
      ? await DependencyScore.find({ scanId: latestScan._id }).populate('packageId').sort({ compositeScore: 1 }).lean()
      : [];

    const packageIds = new Set<string>();
    for (const m of latestScan?.manifests || []) {
      for (const d of m.dependencies || []) {
        if (d.packageId) packageIds.add(d.packageId.toString());
      }
    }
    const vulnPackages = await Package.find({
      _id: { $in: Array.from(packageIds).map(id => new Types.ObjectId(id)) },
      'vulnerabilities.0': { $exists: true },
    }).select('name ecosystem vulnerabilities').lean();

    const totalVulns = vulnPackages.reduce((sum, p) => sum + p.vulnerabilities.length, 0);

    // Page constants
    const PAGE_W = 595.28; // A4 width in points
    const M = 50; // margin
    const CONTENT_W = PAGE_W - M * 2;

    const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${repo.fullName.replace('/', '_')}_report.pdf"`);
    doc.pipe(res);

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // =====================================================================
    //  PAGE 1 — Cover / Executive Summary
    // =====================================================================

    // Top accent bar
    doc.rect(0, 0, PAGE_W, 6).fill('#3b82f6');

    doc.moveDown(3);

    // Title block
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#0f172a')
      .text('Health Report', M, doc.y, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica').fillColor('#64748b')
      .text(repo.fullName, { align: 'center' });
    doc.moveDown(0.15);
    doc.fontSize(10).fillColor('#94a3b8')
      .text(dateStr, { align: 'center' });

    doc.moveDown(2);

    // Big grade circle
    if (scoreSnapshot) {
      const cx = PAGE_W / 2;
      const cy = doc.y + 55;
      const r = 52;

      // Outer ring
      const ringColor = gradeColor(scoreSnapshot.grade);
      doc.circle(cx, cy, r).lineWidth(6).strokeColor(ringColor).stroke();
      // Inner fill
      doc.circle(cx, cy, r - 4).fill('#f8fafc');

      // Grade letter
      doc.fontSize(38).font('Helvetica-Bold').fillColor(ringColor)
        .text(scoreSnapshot.grade, cx - 18, cy - 22, { width: 36, align: 'center' });

      // Score below letter
      doc.fontSize(12).font('Helvetica').fillColor('#475569')
        .text(`${scoreSnapshot.compositeScore} / 100`, cx - 30, cy + 18, { width: 60, align: 'center' });

      doc.y = cy + r + 20;

      // One-line verdict
      const verdict = scoreSnapshot.grade === 'A' ? 'Your dependencies are in great shape.'
        : scoreSnapshot.grade === 'B' ? 'Your stack is healthy with a few areas to improve.'
        : scoreSnapshot.grade === 'C' ? 'Several dependencies need attention soon.'
        : scoreSnapshot.grade === 'D' ? 'Significant risks found — action recommended.'
        : 'Critical issues detected — immediate action needed.';
      doc.fontSize(12).font('Helvetica').fillColor('#334155')
        .text(verdict, M, doc.y, { align: 'center', width: CONTENT_W });

      doc.moveDown(2.5);

      // ---- Quick stats row (4 cards) ----
      const cards = [
        { value: String(scoreSnapshot.totalDependencies), label: 'Dependencies', color: '#3b82f6' },
        { value: String(scoreSnapshot.vulnerableCount), label: 'Vulnerable', color: scoreSnapshot.vulnerableCount > 0 ? '#ef4444' : '#22c55e' },
        { value: String(scoreSnapshot.deprecatedCount), label: 'Deprecated', color: scoreSnapshot.deprecatedCount > 0 ? '#f97316' : '#22c55e' },
        { value: String(scoreSnapshot.outdatedCount), label: 'Outdated', color: scoreSnapshot.outdatedCount > 0 ? '#eab308' : '#22c55e' },
      ];
      const cardW = (CONTENT_W - 30) / 4;
      const cardY = doc.y;
      for (let i = 0; i < cards.length; i++) {
        const x = M + i * (cardW + 10);
        // Card bg
        doc.roundedRect(x, cardY, cardW, 56, 6).fillColor('#f8fafc').fill();
        doc.roundedRect(x, cardY, cardW, 56, 6).lineWidth(1).strokeColor('#e2e8f0').stroke();
        // Top color accent
        doc.rect(x, cardY, cardW, 4).fillColor(cards[i].color).fill();
        // Value
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a')
          .text(cards[i].value, x, cardY + 12, { width: cardW, align: 'center' });
        // Label
        doc.fontSize(8).font('Helvetica').fillColor('#64748b')
          .text(cards[i].label, x, cardY + 36, { width: cardW, align: 'center' });
      }
      doc.y = cardY + 72;

      // ---- Score breakdown bars ----
      doc.moveDown(1);
      sectionTitle(doc, M, CONTENT_W, 'Score Breakdown');
      doc.moveDown(0.6);

      const dims = [
        { label: 'Security', desc: 'Known vulnerabilities in your packages', score: scoreSnapshot.vulnerabilityAvg },
        { label: 'Maintenance', desc: 'How actively packages are maintained', score: scoreSnapshot.maintenanceAvg },
        { label: 'End-of-Life', desc: 'Deprecated or sunset packages', score: scoreSnapshot.eolAvg },
        { label: 'Community', desc: 'Popularity, contributors & adoption', score: scoreSnapshot.communityAvg },
        { label: 'Licensing', desc: 'License compatibility & risk', score: scoreSnapshot.licenseAvg },
      ];

      for (const dim of dims) {
        scoreRow(doc, M, CONTENT_W, dim.label, dim.desc, dim.score);
      }
    }

    // =====================================================================
    //  PAGE 2 — Dependencies
    // =====================================================================
    if (depScores.length > 0) {
      doc.addPage();
      doc.rect(0, 0, PAGE_W, 6).fill('#3b82f6');
      doc.y = M + 10;

      sectionTitle(doc, M, CONTENT_W, `All Dependencies  (${depScores.length})`);
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b')
        .text('Sorted from lowest to highest health score. Packages needing attention appear first.', M);
      doc.moveDown(0.8);

      // Table header
      const cols = { name: M, health: 250, grade: 380, status: 430 };
      const headerY = doc.y;
      doc.rect(M, headerY - 2, CONTENT_W, 18).fill('#f1f5f9');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569');
      doc.text('PACKAGE', cols.name + 8, headerY + 3);
      doc.text('HEALTH', cols.health, headerY + 3);
      doc.text('GRADE', cols.grade, headerY + 3);
      doc.text('STATUS', cols.status, headerY + 3);
      doc.y = headerY + 20;

      let oddRow = false;
      for (const ds of depScores) {
        if (doc.y > 750) {
          doc.addPage();
          doc.rect(0, 0, PAGE_W, 6).fill('#3b82f6');
          doc.y = M + 10;
          // Repeat header
          const rh = doc.y;
          doc.rect(M, rh - 2, CONTENT_W, 18).fill('#f1f5f9');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569');
          doc.text('PACKAGE', cols.name + 8, rh + 3);
          doc.text('HEALTH', cols.health, rh + 3);
          doc.text('GRADE', cols.grade, rh + 3);
          doc.text('STATUS', cols.status, rh + 3);
          doc.y = rh + 20;
          oddRow = false;
        }

        const rowY = doc.y;
        const rowH = 20;

        // Zebra stripe
        if (oddRow) {
          doc.rect(M, rowY - 2, CONTENT_W, rowH).fill('#fafbfc');
        }
        oddRow = !oddRow;

        const pkg = ds.packageId as unknown as Record<string, unknown>;
        const pkgName = String(pkg?.name || 'Unknown');
        const displayName = pkgName.length > 35 ? pkgName.slice(0, 34) + '\u2026' : pkgName;

        // Name
        doc.fontSize(9).font('Helvetica').fillColor('#1e293b')
          .text(displayName, cols.name + 8, rowY + 2, { width: 195 });

        // Health bar (small inline bar)
        const barX = cols.health;
        const barW = 100;
        const barH = 8;
        const barY2 = rowY + 5;
        doc.rect(barX, barY2, barW, barH).fillColor('#e5e7eb').fill();
        const filled = (ds.compositeScore / 100) * barW;
        doc.rect(barX, barY2, filled, barH).fillColor(gradeColor(ds.grade)).fill();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155')
          .text(`${ds.compositeScore}`, barX + barW + 6, rowY + 3);

        // Grade pill
        const gc = gradeColor(ds.grade);
        const pillX = cols.grade;
        doc.roundedRect(pillX, rowY + 1, 24, 14, 4).fillColor(gc).fill();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
          .text(ds.grade, pillX + 1, rowY + 3, { width: 24, align: 'center' });

        // Status flags
        const flags: string[] = [];
        if (ds.vulnerabilityScore < 80) flags.push('Vulnerable');
        if (ds.maintenanceScore < 30) flags.push('Outdated');
        if (ds.eolScore === 0) flags.push('Deprecated');
        const statusText = flags.length > 0 ? flags.join(', ') : 'Healthy';
        const statusColor = flags.length > 0 ? '#dc2626' : '#16a34a';
        doc.fontSize(8).font('Helvetica').fillColor(statusColor)
          .text(statusText, cols.status, rowY + 3, { width: 110 });

        doc.y = rowY + rowH;
      }
    }

    // =====================================================================
    //  PAGE 3 — Security Issues (if any)
    // =====================================================================
    if (totalVulns > 0) {
      doc.addPage();
      doc.rect(0, 0, PAGE_W, 6).fill('#ef4444');
      doc.y = M + 10;

      sectionTitle(doc, M, CONTENT_W, `Security Issues  (${totalVulns})`);
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b')
        .text('Known vulnerabilities found in your dependencies. Upgrade to the suggested version to resolve them.', M);
      doc.moveDown(1);

      for (const pkg of vulnPackages) {
        for (const v of pkg.vulnerabilities) {
          if (doc.y > 710) {
            doc.addPage();
            doc.rect(0, 0, PAGE_W, 6).fill('#ef4444');
            doc.y = M + 10;
          }

          const cardY = doc.y;

          // Severity colors and human labels
          const sevInfo = v.severity === 'critical'
            ? { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', label: 'Critical' }
            : v.severity === 'high'
            ? { bg: '#fff7ed', border: '#fed7aa', color: '#9a3412', label: 'High' }
            : v.severity === 'medium'
            ? { bg: '#fefce8', border: '#fef08a', color: '#854d0e', label: 'Medium' }
            : { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', label: 'Low' };

          // Card background
          doc.roundedRect(M, cardY, CONTENT_W, 60, 5)
            .fillColor(sevInfo.bg).fill();
          doc.roundedRect(M, cardY, CONTENT_W, 60, 5)
            .lineWidth(1).strokeColor(sevInfo.border).stroke();

          // Left severity accent bar
          doc.rect(M, cardY, 4, 60).fillColor(sevInfo.color).fill();

          // Severity pill
          doc.roundedRect(M + 14, cardY + 8, 50, 16, 4).fillColor(sevInfo.color).fill();
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
            .text(sevInfo.label, M + 14, cardY + 11, { width: 50, align: 'center' });

          // Package name
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
            .text(pkg.name, M + 72, cardY + 10, { width: 300 });

          // Description
          const summary = v.summary ? (v.summary.length > 120 ? v.summary.slice(0, 119) + '\u2026' : v.summary) : 'No description available';
          doc.fontSize(8).font('Helvetica').fillColor('#475569')
            .text(summary, M + 14, cardY + 30, { width: CONTENT_W - 28 });

          // Fix suggestion
          if (v.fixedVersion) {
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#16a34a')
              .text(`Upgrade to ${v.fixedVersion}`, M + 14, cardY + 44, { width: CONTENT_W - 28 });
          }

          // Advisory ID on right side
          doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
            .text(v.sourceId || '', M + CONTENT_W - 140, cardY + 10, { width: 130, align: 'right' });

          doc.y = cardY + 68;
        }
      }
    }

    // =====================================================================
    //  PAGE N — What do these scores mean?
    // =====================================================================
    doc.addPage();
    doc.rect(0, 0, PAGE_W, 6).fill('#3b82f6');
    doc.y = M + 10;

    sectionTitle(doc, M, CONTENT_W, 'How to Read This Report');
    doc.moveDown(0.8);

    const explanations = [
      {
        title: 'Overall Health Score (0 \u2013 100)',
        body: 'A weighted average across five areas: Security (30%), Maintenance (25%), End-of-Life (20%), Community (15%), and Licensing (10%). Higher is better.',
      },
      {
        title: 'Grades',
        body: 'A = Excellent (80 \u2013 100)  |  B = Good (65 \u2013 79)  |  C = Fair (50 \u2013 64)  |  D = Poor (35 \u2013 49)  |  F = Critical (0 \u2013 34)',
      },
      {
        title: 'Security',
        body: 'Checks for known vulnerabilities (CVEs) reported in public databases. A low score means your packages have unpatched security issues.',
      },
      {
        title: 'Maintenance',
        body: 'Looks at how recently packages were updated, how often new versions are released, and how quickly bugs are fixed.',
      },
      {
        title: 'End-of-Life',
        body: 'Flags packages that are deprecated, archived, or no longer receiving updates. Using these increases long-term risk.',
      },
      {
        title: 'Community',
        body: 'Considers popularity (stars), download trends, number of contributors, and how widely the package is adopted.',
      },
      {
        title: 'Licensing',
        body: 'Identifies license types. Permissive licenses (MIT, Apache) are low-risk; copyleft licenses (GPL, AGPL) may have compliance requirements.',
      },
    ];

    for (const item of explanations) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(item.title, M);
      doc.moveDown(0.15);
      doc.fontSize(9).font('Helvetica').fillColor('#475569')
        .text(item.body, M + 10, doc.y, { width: CONTENT_W - 10 });
      doc.moveDown(0.8);
    }

    // ---- Footer on every page ----
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      // Bottom line
      doc.moveTo(M, 810).lineTo(PAGE_W - M, 810).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
      doc.text('Stack Decay Score', M, 816, { continued: true, width: CONTENT_W });
      doc.text(`Page ${i + 1} of ${pages.count}`, M, 816, { width: CONTENT_W, align: 'right' });
    }

    doc.end();
  } catch (err) { next(err); }
}

// ============================
//  PDF helper functions
// ============================

function sectionTitle(doc: PDFKit.PDFDocument, x: number, w: number, title: string): void {
  const y = doc.y;
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(title, x, y);
  doc.moveTo(x, doc.y + 4).lineTo(x + w, doc.y + 4).lineWidth(1.5).strokeColor('#cbd5e1').stroke();
  doc.moveDown(0.4);
}

function scoreRow(doc: PDFKit.PDFDocument, x: number, contentW: number, label: string, desc: string, score: number): void {
  const y = doc.y;
  const barX = x + 200;
  const barW = 180;
  const barH = 10;

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(label, x, y + 1);
  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(desc, x, y + 14, { width: 190 });

  // Bar track
  doc.roundedRect(barX, y + 2, barW, barH, 4).fillColor('#e5e7eb').fill();
  // Bar fill
  const filled = Math.max(4, (score / 100) * barW);
  const color = score >= 80 ? '#22c55e' : score >= 65 ? '#3b82f6' : score >= 50 ? '#eab308' : score >= 35 ? '#f97316' : '#ef4444';
  doc.roundedRect(barX, y + 2, filled, barH, 4).fillColor(color).fill();

  // Score number
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#334155')
    .text(`${score}`, barX + barW + 12, y + 1);

  doc.y = y + 30;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#16a34a';
    case 'B': return '#2563eb';
    case 'C': return '#ca8a04';
    case 'D': return '#ea580c';
    case 'F': return '#dc2626';
    default: return '#64748b';
  }
}
