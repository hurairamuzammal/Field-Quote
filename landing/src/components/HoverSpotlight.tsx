'use client';
import React, { useRef } from 'react';

export default function HoverSpotlight({ children, className, style }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('.glow-card');
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      (card as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
      (card as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
    });
  };

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className={className} style={style}>
      {children}
    </div>
  );
}
