import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef<number>(-1);
  
  // Track selection in a Ref during active scrolling to avoid trigger re-renders
  const localSelectedValueRef = useRef<string>(selectedValue);

  const ITEM_HEIGHT = 44; // standard iOS picker item height in px
  const VISIBLE_HEIGHT = ITEM_HEIGHT * 5; // 5 items visible in dial

  const selectedItem = items.find(item => item.id === selectedValue);

  // 1. Detect Screen Width (Desktop vs Mobile Viewport)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch (err) {}
    }
  };

  // 2. Handle Click Outside to Collapse without Selecting (Mobile)
  useEffect(() => {
    if (!isExpanded || !isMobile) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsExpanded(false); // Close without calling onChange
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded, isMobile]);

  // 3. Handle Scroll Snapping & 3D cylinder calculations (Mobile)
  useEffect(() => {
    if (!isExpanded || !isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    // Reset local selection tracker to current value on open
    localSelectedValueRef.current = selectedValue;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

      // Direct DOM style overrides on scroll for 120fps performance
      const children = container.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLDivElement;
        const itemOffset = i * ITEM_HEIGHT;
        const distanceFromCenter = (itemOffset - scrollTop) / ITEM_HEIGHT;
        
        const scale = 1 - Math.min(Math.abs(distanceFromCenter) * 0.12, 0.4);
        const opacity = 1 - Math.min(Math.abs(distanceFromCenter) * 0.35, 0.85);
        const rotation = distanceFromCenter * 20;

        child.style.transform = `perspective(500px) rotateX(${rotation}deg) scale(${scale})`;
        child.style.opacity = `${opacity}`;
      }

      if (clampedIndex !== activeIndexRef.current) {
        activeIndexRef.current = clampedIndex;
        triggerHaptic();
        // Update local ref tracker silently (doesn't trigger render)
        localSelectedValueRef.current = items[clampedIndex].id;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Position selection immediately in center
    const targetValue = selectedValue || (items.length > 0 ? items[0].id : '');
    const initialIndex = items.findIndex((item) => item.id === targetValue);
    if (initialIndex !== -1) {
      container.scrollTop = initialIndex * ITEM_HEIGHT;
    }

    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isExpanded, isMobile, items, selectedValue]);

  // DESKTOP VERSION: Render standard, optimized native select dropdown
  if (!isMobile) {
    return (
      <select
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#f2f2f7] dark:bg-[#1c1c1e] border border-slate-200 dark:border-[#3a3a3c] rounded-xl px-4 py-3 text-caption font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
      >
        <option value="" className="text-gray-400 dark:text-gray-500">
          Select Category
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id} className="bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white">
            {item.name}
          </option>
        ))}
      </select>
    );
  }

  // MOBILE VERSION - COLLAPSED: Render single selector button
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsExpanded(true);
        }}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#f2f2f7] dark:bg-[#1c1c1e] border border-slate-200 dark:border-[#3a3a3c] rounded-xl text-caption font-semibold text-slate-800 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2c2c2e] active:scale-98 transition-all"
      >
        <div className="flex items-center gap-2">
          {selectedItem ? (
            <>
              {selectedItem.color && (
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedItem.color }} />
              )}
              <span>{selectedItem.name}</span>
            </>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 font-medium">Select Category</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
      </button>
    );
  }

  // MOBILE VERSION - EXPANDED: Render 3D dial picker wheel
  return (
    <div 
      ref={pickerRef}
      className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-[#3a3a3c] bg-[#f2f2f7] dark:bg-[#1c1c1e] shadow-2xl transition-all duration-300"
    >
      {/* 3D Wheel view container */}
      <div className="relative overflow-hidden w-full" style={{ height: `${VISIBLE_HEIGHT}px` }}>
        
        {/* iOS Selection Highlighter Overlay Line indicators */}
        <div className="absolute top-[88px] left-0 w-full h-[44px] border-y border-slate-300 dark:border-white/10 pointer-events-none bg-black/[0.03] dark:bg-white/[0.04]" />
        
        {/* iOS Gradient masks (Fade outer categories to match Apple's picker body) */}
        <div className="absolute top-0 left-0 w-full h-[48px] bg-gradient-to-b from-[#f2f2f7] dark:from-[#1c1c1e] to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 left-0 w-full h-[48px] bg-gradient-to-t from-[#f2f2f7] dark:from-[#1c1c1e] to-transparent pointer-events-none z-10" />

        {/* Scroll cylinder list */}
        <div
          ref={containerRef}
          className="h-full overflow-y-auto scrollbar-none text-center relative"
          style={{
            scrollSnapType: 'y mandatory',
            paddingTop: '88px', // Center active offset paddings
            paddingBottom: '88px',
            scrollBehavior: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center justify-center font-bold text-caption tracking-wide text-slate-800 dark:text-white transition-all duration-75"
              style={{
                height: `${ITEM_HEIGHT}px`,
                scrollSnapAlign: 'center',
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

      {/* iOS Picker Footer Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-[#3a3a3c] bg-[#e5e5ea] dark:bg-[#2c2c2e]">
        <span className="text-micro font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Select Category</span>
        <button
          type="button"
          onClick={() => {
            onChange(localSelectedValueRef.current); // Finalize select values on Done click
            setIsExpanded(false);
          }}
          className="text-caption font-bold text-[#007aff] hover:text-[#0051a8] cursor-pointer"
        >
          Done
        </button>
      </div>

    </div>
  );
};
