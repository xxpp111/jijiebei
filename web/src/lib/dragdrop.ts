// dragdrop — 段2 Phase 2 HTML5 原生 pointer 事件自写拖拽吸附。
// 替代真身 Cocos checkHit<30px（JJBSelect.ts:244）；改用 DOM getBoundingClientRect 距离 < 阈值。
// 350ms 窗口防 click/drop 双事件流（镜像真身 GAP-09 lastFillAt=Date.now()）。
// 禁引 dnd-kit（stop_when #scope 约定）；不维护 React state，由调用方传 onDrop 回调。
//
// 用法：
//   const drag = useDragSource({ kind: 'cmd', name: '雷诺', onDrop: (slot, idx) => setSelectedCmd(slot, '雷诺') });
//   <div {...drag} onClick={...} />
//
//   useEffect(() => {
//     const slot = { kind: 'cmd', slot: 0, idx: 0, el: ref.current };
//     registerTarget(slot);
//     return () => unregisterTarget(slot);
//   }, []);

const SNAP_RADIUS = 40; // 吸附半径（px），真机对照手感调（Phase 2 stop_when #5 强调"需真机对照"）
const CLICK_FILL_WINDOW = 350; // ms，释放后 350ms 内 click 不算清槽

interface Target {
  kind: 'cmd' | 'factor';
  slot: number;
  idx: number;
  el: HTMLElement | null;
}

interface DragState {
  name: string;
  kind: 'cmd' | 'factor';
  startX: number;
  startY: number;
  pointerId: number;
  el: HTMLElement;
  rect: DOMRect;
  ghost: HTMLElement | null;
  onDrop?: (slot: number, idx: number) => void;
}

const targets: Target[] = [];
let active: DragState | null = null;
let lastDropAt = 0;

export function registerTarget(t: Target): () => void {
  targets.push(t);
  return () => {
    const i = targets.indexOf(t);
    if (i >= 0) targets.splice(i, 1);
  };
}

/** 在所有 targets 中找距离 (x,y) 最近且 < SNAP_RADIUS 的、且 kind 匹配的 target。
 *  距离 = 中心点欧氏距离。 */
function findNearestTarget(x: number, y: number, kind: 'cmd' | 'factor'): Target | null {
  let best: Target | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    if (t.kind !== kind || !t.el) continue;
    const r = t.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return bestDist <= SNAP_RADIUS ? best : null;
}

function makeGhost(rect: DOMRect, el: HTMLElement): HTMLElement {
  const g = document.createElement('div');
  g.className = 'jjb-drag-ghost';
  g.style.position = 'fixed';
  g.style.left = rect.left + 'px';
  g.style.top = rect.top + 'px';
  g.style.width = rect.width + 'px';
  g.style.height = rect.height + 'px';
  g.style.pointerEvents = 'none';
  g.style.zIndex = '9999';
  g.style.opacity = '0.85';
  g.style.transform = 'scale(1.08)';
  g.style.transition = 'transform 0.12s, opacity 0.12s';
  g.style.boxShadow = '0 8px 24px rgba(0,0,0,0.45)';
  // 把原元素的视觉克隆（只取 img 与背景）
  const inner = el.cloneNode(true) as HTMLElement;
  inner.style.width = '100%';
  inner.style.height = '100%';
  g.appendChild(inner);
  document.body.appendChild(g);
  return g;
}

function onPointerMove(ev: PointerEvent) {
  if (!active || ev.pointerId !== active.pointerId) return;
  if (active.ghost) {
    active.ghost.style.left = (ev.clientX - active.rect.width / 2) + 'px';
    active.ghost.style.top = (ev.clientY - active.rect.height / 2) + 'px';
  }
}

function onPointerUp(ev: PointerEvent) {
  if (!active || ev.pointerId !== active.pointerId) return;
  const hit = findNearestTarget(ev.clientX, ev.clientY, active.kind);
  if (hit && active.onDrop) {
    active.onDrop(hit.slot, hit.idx);
  }
  lastDropAt = Date.now();
  if (active.ghost && active.ghost.parentNode) active.ghost.parentNode.removeChild(active.ghost);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  active = null;
}

export interface StartDragOpts {
  kind: 'cmd' | 'factor';
  name: string;
  el: HTMLElement;
  onDrop?: (slot: number, idx: number) => void;
}

export function startDrag(opts: StartDragOpts, ev: PointerEvent): void {
  if (ev.button !== undefined && ev.button !== 0) return; // 仅左键
  const rect = opts.el.getBoundingClientRect();
  active = {
    name: opts.name,
    kind: opts.kind,
    startX: ev.clientX,
    startY: ev.clientY,
    pointerId: ev.pointerId,
    el: opts.el,
    rect,
    ghost: makeGhost(rect, opts.el),
    onDrop: opts.onDrop,
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

/** 校验 click 是否在 lastDropAt 之后 350ms 窗口内（防 drop 触发后 click 清槽）。 */
export function shouldSuppressClickClear(): boolean {
  return Date.now() - lastDropAt < CLICK_FILL_WINDOW;
}
