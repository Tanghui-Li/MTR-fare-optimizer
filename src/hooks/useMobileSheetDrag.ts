import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

const MIN_SHEET_HEIGHT = 100;
const NAV_HEIGHT = 76;
const MIN_INERTIA_VELOCITY = 0.08;
const STOP_INERTIA_VELOCITY = 0.02;
const INERTIA_DECAY_PER_FRAME = 0.92;
const FRAME_MS = 16.67;
const MAX_FRAME_DELTA_MS = 32;

export function useMobileSheetDrag(defaultHeight = 400) {
  const [sheetHeight, setSheetHeightState] = useState<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(defaultHeight);
  const currentHeight = useRef<number | null>(null);
  const lastPointerY = useRef<number | null>(null);
  const lastPointerTime = useRef<number | null>(null);
  const heightVelocity = useRef(0);
  const inertiaFrame = useRef<number | null>(null);

  const setSheetHeight = useCallback((height: number | null) => {
    currentHeight.current = height;
    setSheetHeightState(height);
  }, []);

  const getMaxHeight = () => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    return Math.max(MIN_SHEET_HEIGHT, viewportHeight - NAV_HEIGHT);
  };

  const clampHeight = (height: number) => {
    return Math.max(MIN_SHEET_HEIGHT, Math.min(height, getMaxHeight()));
  };

  const cancelInertia = () => {
    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }
  };

  const startInertia = (initialVelocity: number) => {
    if (Math.abs(initialVelocity) < MIN_INERTIA_VELOCITY) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let projectedHeight = currentHeight.current ?? dragStartHeight.current;
    let velocity = initialVelocity;
    let previousFrameTime = performance.now();

    const step = (frameTime: number) => {
      const deltaTime = Math.min(MAX_FRAME_DELTA_MS, frameTime - previousFrameTime);
      previousFrameTime = frameTime;

      projectedHeight = clampHeight(projectedHeight + velocity * deltaTime);
      setSheetHeight(projectedHeight);

      const isAtMin = projectedHeight <= MIN_SHEET_HEIGHT && velocity < 0;
      const isAtMax = projectedHeight >= getMaxHeight() && velocity > 0;
      if (isAtMin || isAtMax) {
        inertiaFrame.current = null;
        return;
      }

      velocity *= Math.pow(INERTIA_DECAY_PER_FRAME, deltaTime / FRAME_MS);
      if (Math.abs(velocity) < STOP_INERTIA_VELOCITY) {
        inertiaFrame.current = null;
        return;
      }

      inertiaFrame.current = requestAnimationFrame(step);
    };

    inertiaFrame.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return cancelInertia;
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    cancelInertia();
    dragStartY.current = event.clientY;
    lastPointerY.current = event.clientY;
    lastPointerTime.current = event.timeStamp || performance.now();
    heightVelocity.current = 0;
    
    // Get current actual height
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (rect) {
      dragStartHeight.current = rect.height;
    } else {
      dragStartHeight.current = currentHeight.current ?? defaultHeight;
    }
    
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;
    const deltaY = event.clientY - dragStartY.current;
    
    // deltaY positive means dragging down (decreasing height)
    // deltaY negative means dragging up (increasing height)
    const newHeight = clampHeight(dragStartHeight.current - deltaY);
    setSheetHeight(newHeight);

    const now = event.timeStamp || performance.now();
    const previousY = lastPointerY.current ?? event.clientY;
    const previousTime = lastPointerTime.current ?? now;
    const deltaTime = Math.max(1, now - previousTime);
    const sampleVelocity = -(event.clientY - previousY) / deltaTime;

    heightVelocity.current = heightVelocity.current * 0.6 + sampleVelocity * 0.4;
    lastPointerY.current = event.clientY;
    lastPointerTime.current = now;
  };

  const finishPointerInteraction = (event: PointerEvent<HTMLButtonElement>, shouldStartInertia: boolean) => {
    const releaseVelocity = heightVelocity.current;
    dragStartY.current = null;
    lastPointerY.current = null;
    lastPointerTime.current = null;
    heightVelocity.current = 0;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (shouldStartInertia) {
      startInertia(releaseVelocity);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    finishPointerInteraction(event, true);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    finishPointerInteraction(event, false);
  };

  return {
    sheetHeight,
    setSheetHeight,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
