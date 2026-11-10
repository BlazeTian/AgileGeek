import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A draggable line between two parts.
 *
 * Invisible at rest, a hairline while pointed at or dragged; double
 * clicked, it resets the part it sizes. The cursor stays with it while
 * dragged — the pointer can leave the few pixels it occupies without the
 * drag ending or the cursor changing to whatever is underneath.
 */
export function Sash({
  onDrag,
  onStart,
  onEnd,
  onReset,
  canMoveBack = true,
  canMoveForward = true,
  label,
}: {
  /** How far the pointer has moved since the drag began, in pixels. */
  onDrag: (delta: number) => void;
  onStart: () => void;
  onEnd: () => void;
  /** A double click: back to the default width. */
  onReset: () => void;
  canMoveBack?: boolean;
  canMoveForward?: boolean;
  label: string;
}) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(0);
  const lastRef = useRef(0);

  const cursor = !canMoveBack && !canMoveForward
    ? 'default'
    : canMoveBack && canMoveForward
      ? 'col-resize'
      : canMoveBack
        ? 'w-resize'
        : 'e-resize';

  const begin = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      (event.target as Element).setPointerCapture?.(event.pointerId);
      startRef.current = event.clientX;
      lastRef.current = event.clientX;
      setDragging(true);
      onStart();
    },
    [onStart],
  );

  const move = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging) return;
      lastRef.current = event.clientX;
      onDrag(event.clientX - startRef.current);
    },
    [dragging, onDrag],
  );

  const finish = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging) return;
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      setDragging(false);
      onEnd();
    },
    [dragging, onEnd],
  );

  // While dragged, the whole window takes the cursor: the pointer runs
  // ahead of the line it moves, and must not turn into a text cursor on
  // the way.
  useEffect(() => {
    if (!dragging) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = '';
    };
  }, [dragging, cursor]);

  return (
    <div
      className={`sash ${dragging ? 'dragging' : ''}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      style={{ cursor }}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onReset}
    />
  );
}

/** What a part may be, in the reference's own numbers. */
export const COLUMNS = {
  minSidebar: 170,
  minEditor: 320,
  minChat: 360,
  defaultSidebar: 240,
  defaultChat: 420,
  /** Past its minimum by this share, a part snaps shut. */
  snap: (minimum: number) => minimum / 6,
} as const;

/** A width kept inside what the window has room for. */
export function clampWidth(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
