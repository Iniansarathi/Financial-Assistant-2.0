import React, { useRef, useState, useEffect } from 'react';

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
  const [scrollTop, setScrollTop] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const ITEM_HEIGHT = 42; // height of each item in pixels
  const VISIBLE_HEIGHT = ITEM_HEIGHT * 5; // display 5 items at once

  // Trigger haptic feedback tick
  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10); // Light haptic click tick (10ms)
      } catch (err) {
        // Vibrate API might be blocked on some secure contexts or unsupported
      }
    }
  };

  // Synchronize initial selection on mount
  useEffect(() => {
    const initialIndex = items.findIndex((item) => item.id === selectedValue);
    if (initialIndex !== -1 && containerRef.current) {
      const scrollPosition = initialIndex * ITEM_HEIGHT;
      containerRef.current.scrollTop = scrollPosition;
      setScrollTop(scrollPosition);
      setActiveIndex(initialIndex);
    }
  }, [items, selectedValue]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollVal = e.currentTarget.scrollTop;
    setScrollTop(scrollVal);

    const index = Math.round(scrollVal / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

    if (clampedIndex !== activeIndex) {
      setActiveIndex(clampedIndex);
      triggerHaptic();
      onChange(items[clampedIndex].id);
    }
  };

  return (
    <div
      className="relative overflow-hidden w-full select-none"
      style={{ height: `${VISIBLE_HEIGHT}px` }}
    >
      {/* Selection Highlighter Lines (like iPhone drum picker) */}
      <div className="absolute top-[84px] left-0 w-full h-[42px] border-y border-white/10 pointer-events-none bg-white/3" />

      {/* 3D Cylindrical Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scroll-snap-y-mandatory scrollbar-none text-center relative"
        style={{
          scrollSnapType: 'y mandatory',
          paddingTop: '84px', // padding to offset center target
          paddingBottom: '84px',
        }}
      >
        {items.map((item, index) => {
          // Calculate distance from center active target
          const itemOffset = index * ITEM_HEIGHT;
          const distanceFromCenter = (itemOffset - scrollTop) / ITEM_HEIGHT;
          
          // Apply 3D perspective transitions based on distance
          const scale = 1 - Math.min(Math.abs(distanceFromCenter) * 0.12, 0.4);
          const opacity = 1 - Math.min(Math.abs(distanceFromCenter) * 0.25, 0.7);
          const rotation = distanceFromCenter * 20; // 3D cylinder tilt

          return (
            <div
              key={item.id}
              className="flex items-center justify-center font-semibold text-caption text-white scroll-snap-align-center cursor-pointer transition-all duration-75"
              style={{
                height: `${ITEM_HEIGHT}px`,
                scrollSnapAlign: 'center',
                transform: `perspective(400px) rotateX(${rotation}deg) scale(${scale})`,
                opacity: opacity,
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
          );
        })}
      </div>
    </div>
  );
};
