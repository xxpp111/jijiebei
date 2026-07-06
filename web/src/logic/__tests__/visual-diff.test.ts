import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, afterEach } from 'vitest';
import { PNG } from 'pngjs';
import { comparePngs } from '../../../scripts/visual-diff.mjs';

let tmpRoot = '';

function tempDir() {
  tmpRoot = mkdtempSync(join(tmpdir(), 'jjb-visual-diff-'));
  return tmpRoot;
}

function writeSolidPng(path: string, rgba: [number, number, number, number], w = 4, h = 4) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    png.data[off] = rgba[0];
    png.data[off + 1] = rgba[1];
    png.data[off + 2] = rgba[2];
    png.data[off + 3] = rgba[3];
  }
  writeFileSync(path, PNG.sync.write(png));
}

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = '';
});

describe('visual-diff comparePngs', () => {
  it('缺 baseline 时返回 missing-baseline，而不是把新截图静默当通过', () => {
    const dir = tempDir();
    const actual = join(dir, 'actual.png');
    const baseline = join(dir, 'missing.png');
    const diff = join(dir, 'diff.png');
    writeSolidPng(actual, [20, 30, 40, 255]);

    const result = comparePngs(actual, baseline, diff);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing-baseline');
  });

  it('同尺寸像素差异超过阈值时输出 diff 并失败', () => {
    const dir = tempDir();
    const actual = join(dir, 'actual.png');
    const baseline = join(dir, 'baseline.png');
    const diff = join(dir, 'diff.png');
    writeSolidPng(actual, [255, 0, 0, 255]);
    writeSolidPng(baseline, [0, 0, 255, 255]);

    const result = comparePngs(actual, baseline, diff, { maxDiffRatio: 0 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('pixel-diff');
    expect(result.diffPixels).toBeGreaterThan(0);
    expect(existsSync(diff)).toBe(true);
  });
});
