// Minimal `cc` global shim so pure-logic jijie2 modules that touch cc.log
// (e.g. JijieContro.ts, 1 occurrence) run in a browser/React context without the
// Cocos runtime. The data/logic files actually read for rendering
// (JijieData / JJConfigData / JJBData / JJBDoubles) are cc.*=0 and do NOT need this.
// Segment-1 PoC: this is the only Cocos-runtime bridge, replacing the full 2.5MB engine.
const ccShim = {
  log: (...a: unknown[]) => console.log('[cc]', ...a),
  warn: (...a: unknown[]) => console.warn('[cc]', ...a),
  error: (...a: unknown[]) => console.error('[cc]', ...a),
};
(globalThis as any).cc = (globalThis as any).cc || ccShim;
export {};
