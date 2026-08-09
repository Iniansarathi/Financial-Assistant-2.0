import React, { useRef, useEffect } from 'react';

interface ScrollWheelPickerProps {
  items: { id: string; name: string; color?: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
}

export const ScrollWheelPicker: React.FC<ScrollWheelPickerProps> = ({
  items,
  selectedValue,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeIndexRef = useRef<number>(-1);

  const ITEM_HEIGHT = 44; // standard iOS drum wheel item height in px
  const VISIBLE_HEIGHT = ITEM_HEIGHT * 5; // display 5 items at once

  // Synthesize a premium taptic clock sound tick (highly effective on iOS Safari speakers)
  const playClickSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime); // crisp mechanical pitch
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.004); // ultra-fast decay
      
      gain.gain.setValueAtTime(0.02, ctx.currentTime); // quiet tick
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.004);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.005);
    } catch (err) {
      // AudioContext blocks play on load until interaction
    }
  };

  const triggerHaptic = () => {
    // 1. Synthesize speaker taptic click
    playClickSound();

    // 2. Fallback physical vibration (Android/Chrome)
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch (err) {}
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

      // Direct DOM style overrides on scroll.
      // Bypasses React state updates entirely for locked 120fps rendering.
      const children = container.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLDivElement;
        const itemOffset = i * ITEM_HEIGHT;
        const distanceFromCenter = (itemOffset - scrollTop) / ITEM_HEIGHT;
        
        const scale = 1 - Math.min(Math.abs(distanceFromCenter) * 0.12, 0.4);
        const opacity = 1 - Math.min(Math.abs(distanceFromCenter) * 0.25, 0.7);
        const rotation = distanceFromCenter * 22; // Cylindrical tilt angle

        child.style.transform = `perspective(500px) rotateX(${rotation}deg) scale(${scale})`;
        child.style.opacity = `${opacity}`;
      }

      if (clampedIndex !== activeIndexRef.current) {
        activeIndexRef.current = clampedIndex;
        triggerHaptic();
        onChange(items[clampedIndex].id);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial layout styling
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [items, onChange]);

  // Synchronize component state value changes
  useEffect(() => {
    const initialIndex = items.findIndex((item) => item.id === selectedValue);
    if (initialIndex !== -1 && containerRef.current) {
      const scrollPosition = initialIndex * ITEM_HEIGHT;
      if (Math.abs(containerRef.current.scrollTop - scrollPosition) > 2) {
        containerRef.current.scrollTop = scrollPosition;
      }
    }
  }, [selectedValue, items]);

  return (
    <div
      className="relative overflow-hidden w-full select-none bg-black/15 rounded-2xl border border-white/5"
      style={{ height: `${VISIBLE_HEIGHT}px` }}
    >
      {/* iOS-style Selection Overlay Highlight */}
      <div className="absolute top-[88px] left-0 w-full h-[44px] border-y border-white/10 pointer-events-none bg-white/4 shadow-[inset_0_1px_4px_rgba(255,255,255,0.05)]" />
      
      {/* Cylindrical Gradient Shadows (Fades outer items into background) */}
      <div className="absolute top-0 left-0 w-full h-[48px] bg-gradient-to-b from-[#18181b] dark:from-[#0b0b0c] to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 w-full h-[48px] bg-gradient-to-t from-[#18181b] dark:from-[#0b0b0c] to-transparent pointer-events-none z-10" />

      {/* Snap Container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-none text-center relative"
        style={{
          scrollSnapType: 'y mandatory',
          paddingTop: '88px', // Center active line offsets
          paddingBottom: '88px',
          scrollBehavior: 'auto',
          WebkitOverflowScrolling: 'touch', // Smooth Momentum Scroll on iOS Safari
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center justify-center font-bold text-caption tracking-wide text-white transition-all duration-75"
            style={{
              height: `${ITEM_HEIGHT}px`,
              scrollSnapAlign: 'center',
              color: item.color ? item.color : '#ffffff',
            }}
            onClick={() => {
              if (containerRef.current) {
                containerRef.current.scrollTo({
                  top: index * ITEM_HEIGHT,
                  behavior: 'smooth',
                });
              }
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    </div>
  );
};
