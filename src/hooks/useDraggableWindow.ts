import { type CSSProperties, type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from 'react';

type DialogDragStyle = CSSProperties & {
  '--dialog-drag-x': string;
  '--dialog-drag-y': string;
};

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, a, [data-no-drag]'));
}

export function useDraggableWindow() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<DragState | undefined>(undefined);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || isInteractiveTarget(event.target)) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    setOffset({
      x: state.originX + event.clientX - state.startX,
      y: state.originY + event.clientY - state.startY
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const state = dragState.current;
    if (state?.pointerId === event.pointerId) {
      dragState.current = undefined;
      setIsDragging(false);
    }
  }

  const style = useMemo(
    () =>
      ({
        '--dialog-drag-x': `${offset.x}px`,
        '--dialog-drag-y': `${offset.y}px`
      }) as DialogDragStyle,
    [offset.x, offset.y]
  );

  return {
    dragHandleProps: {
      onPointerCancel: endDrag,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag
    },
    isDragging,
    style
  };
}
