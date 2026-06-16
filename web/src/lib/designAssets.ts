// Resolves design/v4-r2 PNG assets (commander / factor / map / border / logo) to Vite
// asset URLs, so React components can keep using the design-relative paths
// ("assets/cmd-raynor.png", "input/border-factor-normal.png") that the design jsx used.
// import.meta.glob eager+url only emits URLs (no image bytes pulled into the bundle eagerly).
const urls = import.meta.glob('../../../design/v4-r2/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function dz(rel: string): string {
  for (const k in urls) {
    if (k.endsWith('/' + rel)) return urls[k];
  }
  // eslint-disable-next-line no-console
  console.warn('[designAssets] not found:', rel);
  return '';
}
