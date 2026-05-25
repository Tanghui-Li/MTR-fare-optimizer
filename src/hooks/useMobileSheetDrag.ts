import { useState, useRef, type PointerEvent } from 'react';

export function useMobileSheetDrag(defaultHeight = 400) {
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(defaultHeight);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    
    dragStartY.current = event.clientY;
    
    // Get current actual height
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (rect) {
      dragStartHeight.current = rect.height;
    } else {
      dragStartHeight.current = sheetHeight ?? defaultHeight;
    }
    
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;
    const deltaY = event.clientY - dragStartY.current;
    
    // deltaY positive means dragging down (decreasing height)
    // deltaY negative means dragging up (increasing height)
    let newHeight = dragStartHeight.current - deltaY;
    
    // clamp height to sensible values
    const minHeight = 100; // minimum panel height
    const maxHeight = window.innerHeight - 76; // leave room for nav
    
    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
    setSheetHeight(newHeight);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    dragStartY.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    sheetHeight,
    setSheetHeight,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
  };
}
