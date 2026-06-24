// vitest node env 无 window；jjbSession 的 exposeSelectDebug/exposeBattleDebug/capturePayload 写 window.__jjbDebug。
// 镜像 e2e/run.mjs 的 `globalThis.window ||= globalThis` trick，让 __jjbDebug 落到 global 上、断言可读。
const g = globalThis as any;
if (typeof g.window === 'undefined') g.window = g;
