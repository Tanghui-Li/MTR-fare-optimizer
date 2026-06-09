import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

const MIN_SHEET_HEIGHT = 100;
const NAV_HEIGHT = 76;
const MIN_INERTIA_VELOCITY = 0.08;
const MAX_INERTIA_VELOCITY = 1.2;
const STOP_INERTIA_VELOCITY = 0.02;
const INERTIA_DECAY_PER_FRAME = 0.92;
const FRAME_MS = 16.67;
const MAX_FRAME_DELTA_MS = 32;
const VELOCITY_SAMPLE_WINDOW_MS = 90;

export function useMobileSheetDrag(defaultHeight = 400) {
  const [sheetHeight, setSheetHeightState] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(defaultHeight);
  const currentHeight = useRef<number | null>(null);
  const velocitySamples = useRef<{ y: number; time: number }[]>([]);
  const heightVelocity = useRef(0);
  const inertiaFrame = useRef<number | null>(null);

  const applySheetHeight = useCallback((height: number | null) => {
    currentHeight.current = height;
    if (!sheetRef.current) return;

    if (height === null) {
      sheetRef.current.style.height = '';
    } else {
      sheetRef.current.style.height = `${height}px`;
    }
  }, []);

  const commitSheetHeight = useCallback((height: number | null) => {
    applySheetHeight(height);
    setSheetHeightState(height);
  }, [applySheetHeight]);

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

  const setSheetHeight = useCallback((height: number | null) => {
    cancelInertia();
    commitSheetHeight(height);
  }, [commitSheetHeight]);

  const getPointerSamples = (event: PointerEvent<HTMLButtonElement>): globalThis.PointerEvent[] => {
    const coalescedEvents = event.nativeEvent.getCoalescedEvents?.();
    return coalescedEvents && coalescedEvents.length > 0 ? coalescedEvents : [event.nativeEvent];
  };

  const recordVelocitySamples = (samples: globalThis.PointerEvent[]) => {
    for (const sample of samples) {
      velocitySamples.current.push({
        y: sample.clientY,
        time: sample.timeStamp || performance.now(),
      });
    }

    const latest = velocitySamples.current[velocitySamples.current.length - 1];
    if (!latest) return;

    velocitySamples.current = velocitySamples.current.filter(
      (sample) => sample.time >= latest.time - VELOCITY_SAMPLE_WINDOW_MS,
    );

    const first = velocitySamples.current[0];
    const last = velocitySamples.current[velocitySamples.current.length - 1];
    if (!first || !last || first === last) return;

    heightVelocity.current = -(last.y - first.y) / Math.max(1, last.time - first.time);
  };

  const startInertia = (initialVelocity: number) => {
    if (
      Math.abs(initialVelocity) < MIN_INERTIA_VELOCITY ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      commitSheetHeight(currentHeight.current ?? dragStartHeight.current);
      return;
    }

    let projectedHeight = currentHeight.current ?? dragStartHeight.current;
    let velocity = Math.max(-MAX_INERTIA_VELOCITY, Math.min(initialVelocity, MAX_INERTIA_VELOCITY));
    let previousFrameTime = performance.now();

    const finishInertia = () => {
      inertiaFrame.current = null;
      commitSheetHeight(projectedHeight);
    };

    const step = (frameTime: number) => {
      const deltaTime = Math.min(MAX_FRAME_DELTA_MS, frameTime - previousFrameTime);
      previousFrameTime = frameTime;

      projectedHeight = clampHeight(projectedHeight + velocity * deltaTime);
      applySheetHeight(projectedHeight);

      const isAtMin = projectedHeight <= MIN_SHEET_HEIGHT && velocity < 0;
      const isAtMax = projectedHeight >= getMaxHeight() && velocity > 0;
      if (isAtMin || isAtMax) {
        finishInertia();
        return;
      }

      velocity *= Math.pow(INERTIA_DECAY_PER_FRAME, deltaTime / FRAME_MS);
      if (Math.abs(velocity) < STOP_INERTIA_VELOCITY) {
        finishInertia();
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
    velocitySamples.current = [{ y: event.clientY, time: event.timeStamp || performance.now() }];
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
    const samples = getPointerSamples(event);
    const latestSample = samples[samples.length - 1] ?? event.nativeEvent;
    const deltaY = latestSample.clientY - dragStartY.current;
    
    // deltaY positive means dragging down (decreasing height)
    // deltaY negative means dragging up (increasing height)
    const newHeight = clampHeight(dragStartHeight.current - deltaY);
    applySheetHeight(newHeight);
    recordVelocitySamples(samples);
  };

  const finishPointerInteraction = (event: PointerEvent<HTMLButtonElement>, shouldStartInertia: boolean) => {
    const releaseVelocity = heightVelocity.current;
    dragStartY.current = null;
    velocitySamples.current = [];
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
    sheetRef,
    setSheetHeight,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
