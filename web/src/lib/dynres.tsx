import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const STAGE_WIDTH = 1280;
const DEFAULT_STAGE_HEIGHT = 720;

export type StageHeightMode = 'fixed' | 'content';

interface AdaptiveViewportProps {
  children: ReactNode;
  screen: string;
  heightMode?: StageHeightMode;
}

interface StageMetrics {
  logicalHeight: number;
  scale: number;
}

function fitScale(viewportWidth: number, viewportHeight: number, logicalHeight: number): number {
  const safeHeight = Math.max(DEFAULT_STAGE_HEIGHT, Math.ceil(logicalHeight || DEFAULT_STAGE_HEIGHT));
  const raw = Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / safeHeight);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function AdaptiveViewport({ children, screen, heightMode = 'fixed' }: AdaptiveViewportProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<StageMetrics>({ logicalHeight: DEFAULT_STAGE_HEIGHT, scale: 1 });

  useLayoutEffect(() => {
    const update = () => {
      const viewportWidth = window.innerWidth || STAGE_WIDTH;
      const viewportHeight = window.innerHeight || DEFAULT_STAGE_HEIGHT;
      const stage = frameRef.current?.querySelector<HTMLElement>(':scope > .jjb-fit-transform > .jjb');
      const measuredHeight = heightMode === 'content' && stage
        ? Math.max(DEFAULT_STAGE_HEIGHT, Math.ceil(stage.scrollHeight), Math.ceil(stage.offsetHeight))
        : DEFAULT_STAGE_HEIGHT;
      const next = {
        logicalHeight: measuredHeight,
        scale: fitScale(viewportWidth, viewportHeight, measuredHeight),
      };
      setMetrics((prev) => (
        prev.logicalHeight === next.logicalHeight && Math.abs(prev.scale - next.scale) < 0.0001
          ? prev
          : next
      ));
    };

    update();
    const raf = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (observer) {
      observer.observe(frameRef.current!);
      const stage = frameRef.current?.querySelector<HTMLElement>(':scope > .jjb-fit-transform > .jjb');
      if (stage) observer.observe(stage);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [heightMode, screen]);

  const style = {
    '--jjb-stage-height': `${metrics.logicalHeight}px`,
    '--jjb-stage-scale': String(metrics.scale),
  } as CSSProperties;

  return (
    <div
      className="jjb-fit-viewport"
      data-adaptive-stage={screen}
      data-stage-height-mode={heightMode}
      data-stage-logical-height={metrics.logicalHeight}
      data-stage-scale={metrics.scale.toFixed(6)}
      style={style}
    >
      <div className="jjb-fit-scale" ref={frameRef}>
        <div className="jjb-fit-transform">
          {children}
        </div>
      </div>
    </div>
  );
}
