import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export const DEFAULT_PIXEL_THRESHOLD = 0.08;
export const DEFAULT_MAX_DIFF_RATIO = 0.001;

export function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

export function writePng(path, png) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

export function comparePngs(actualPath, baselinePath, diffPath, opts = {}) {
  if (!existsSync(baselinePath)) {
    return { ok: false, reason: 'missing-baseline', actualPath, baselinePath, diffPath };
  }

  const actual = readPng(actualPath);
  const baseline = readPng(baselinePath);
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return {
      ok: false,
      reason: 'size-mismatch',
      actualPath,
      baselinePath,
      diffPath,
      actualSize: `${actual.width}x${actual.height}`,
      baselineSize: `${baseline.width}x${baseline.height}`,
    };
  }

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(
    actual.data,
    baseline.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: opts.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD },
  );
  writePng(diffPath, diff);

  const totalPixels = actual.width * actual.height;
  const diffRatio = diffPixels / totalPixels;
  const maxDiffRatio = opts.maxDiffRatio ?? DEFAULT_MAX_DIFF_RATIO;
  return {
    ok: diffRatio <= maxDiffRatio,
    reason: diffRatio <= maxDiffRatio ? 'match' : 'pixel-diff',
    actualPath,
    baselinePath,
    diffPath,
    diffPixels,
    totalPixels,
    diffRatio,
    maxDiffRatio,
  };
}
