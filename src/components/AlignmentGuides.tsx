export interface GuidePosition { x?: number; y?: number }

export function AlignmentGuides({ x, y }: GuidePosition) {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
    {x !== undefined && <div data-guide="vertical" className="absolute inset-y-0 border-l border-dashed border-fuchsia-600"
      style={{ left: `min(${x * 100}%, calc(100% - 1px))` }} />}
    {y !== undefined && <div data-guide="horizontal" className="absolute inset-x-0 border-t border-dashed border-fuchsia-600"
      style={{ top: `min(${y * 100}%, calc(100% - 1px))` }} />}
  </div>;
}
