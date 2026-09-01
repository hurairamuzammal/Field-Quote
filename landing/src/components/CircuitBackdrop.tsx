'use client';

import { useEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Trace = {
  points: Point[];
  length: number;
  lengths: number[];
};

function seeded(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSeg(px: number, py: number, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function distToTrace(px: number, py: number, trace: Trace) {
  let min = Infinity;
  for (let i = 1; i < trace.points.length; i += 1) {
    min = Math.min(min, distToSeg(px, py, trace.points[i - 1], trace.points[i]));
  }
  return min;
}

function measure(points: Point[]) {
  const lengths = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    lengths.push(total);
  }
  return { length: total, lengths };
}

function pointAt(trace: Trace, distance: number): Point | null {
  if (trace.length <= 0) return null;
  const d = ((distance % trace.length) + trace.length) % trace.length;
  for (let i = 1; i < trace.points.length; i += 1) {
    if (d <= trace.lengths[i]) {
      const span = trace.lengths[i] - trace.lengths[i - 1] || 1;
      const t = (d - trace.lengths[i - 1]) / span;
      return {
        x: trace.points[i - 1].x + (trace.points[i].x - trace.points[i - 1].x) * t,
        y: trace.points[i - 1].y + (trace.points[i].y - trace.points[i - 1].y) * t,
      };
    }
  }
  return trace.points[trace.points.length - 1];
}

function readColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildLayout(width: number, height: number) {
  const rand = seeded(Math.round(width * 0.41 + height * 1.07));
  const cell = Math.max(34, Math.min(46, Math.round(width / 36)));
  const cols = Math.max(14, Math.floor((width - 40) / cell));
  const rows = Math.max(8, Math.floor((height - 40) / cell));
  const ox = (width - (cols - 1) * cell) / 2;
  const oy = (height - (rows - 1) * cell) / 2 + 8;
  const gx = (c: number) => ox + c * cell;
  const gy = (r: number) => oy + r * cell;
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const traces: Trace[] = [];
  const nodes: Point[] = [];
  const seen = new Set<string>();
  const split = Math.floor(cols * 0.42);

  const addNode = (point: Point, chance = 0.32) => {
    if (rand() > chance) return;
    const key = `${Math.round(point.x / 2)}:${Math.round(point.y / 2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push(point);
  };

  const walk = (startC: number, startR: number, longRun: boolean) => {
    const points: Point[] = [{ x: gx(startC), y: gy(startR) }];
    let c = startC;
    let r = startR;
    let dir = dirs[Math.floor(rand() * 4)];
    const segments = longRun ? 2 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);

    for (let i = 0; i < segments; i += 1) {
      if (i > 0) {
        const perp = dir[0] === 0 ? [dirs[0], dirs[1]] : [dirs[2], dirs[3]];
        dir = perp[rand() > 0.5 ? 1 : 0];
      }
      const run = longRun ? 1 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 2);
      const nextC = Math.max(0, Math.min(cols - 1, c + dir[0] * run));
      const nextR = Math.max(0, Math.min(rows - 1, r + dir[1] * run));
      if (nextC === c && nextR === r) continue;
      c = nextC;
      r = nextR;
      points.push({ x: gx(c), y: gy(r) });
    }

    if (points.length < 2) return;
    traces.push({ points, ...measure(points) });
    addNode(points[0], 0.38);
    addNode(points[points.length - 1], 0.4);
  };

  const leftLong = Math.max(4, Math.round((split * rows) / 55));
  const leftShort = Math.max(5, Math.round((split * rows) / 48));
  const rightLong = Math.max(16, Math.round(((cols - split) * rows) / 18));
  const rightShort = Math.max(22, Math.round(((cols - split) * rows) / 14));

  for (let i = 0; i < leftLong; i += 1) {
    walk(Math.floor(rand() * split), Math.floor(rand() * rows), true);
  }
  for (let i = 0; i < leftShort; i += 1) {
    walk(Math.floor(rand() * split), Math.floor(rand() * rows), false);
  }
  for (let i = 0; i < rightLong; i += 1) {
    walk(split + Math.floor(rand() * (cols - split)), Math.floor(rand() * rows), true);
  }
  for (let i = 0; i < rightShort; i += 1) {
    walk(split + Math.floor(rand() * (cols - split)), Math.floor(rand() * rows), false);
  }

  return { traces, nodes };
}

export default function CircuitBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let disposed = false;
    let visible = true;
    let w = 0;
    let h = 0;
    let layout: ReturnType<typeof buildLayout> | null = null;
    const mouse = { x: -9999, y: -9999 };
    const cursor = { x: -9999, y: -9999 };

    const shouldAnimate = () =>
      !reduced && visible && document.visibilityState === 'visible';

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, reduced ? 1 : 1.5);
      const rect = host.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout = buildLayout(w, h);
    };

    const draw = (now: number) => {
      if (disposed || !layout) return;
      const { traces, nodes } = layout;
      const stroke = readColor('--circuit-stroke', '#d6dee8');
      const hover = readColor('--circuit-hover', '#9aa6b4');
      const node = readColor('--circuit-node', '#c5ced8');
      if (!reduced && mouse.x > -9000) {
        if (cursor.x < -9000) {
          cursor.x = mouse.x;
          cursor.y = mouse.y;
        } else {
          cursor.x += (mouse.x - cursor.x) * 0.1;
          cursor.y += (mouse.y - cursor.y) * 0.1;
        }
      } else {
        cursor.x = mouse.x;
        cursor.y = mouse.y;
      }

      const mx = cursor.x;
      const my = cursor.y;
      const radius = 130;
      const t = now / 1000;

      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'square';

      traces.forEach((trace, index) => {
        const d = distToTrace(mx, my, trace);
        const near = Math.max(0, 1 - d / radius);
        const idle = reduced
          ? 0
          : 0.2 + 0.8 * Math.sin(t * 0.22 + index * 0.55) ** 12;

        ctx.beginPath();
        ctx.moveTo(trace.points[0].x, trace.points[0].y);
        for (let i = 1; i < trace.points.length; i += 1) {
          ctx.lineTo(trace.points[i].x, trace.points[i].y);
        }
        ctx.strokeStyle = near > 0.1 ? hover : stroke;
        ctx.globalAlpha = 0.2 + near * 0.28 + idle * 0.05;
        ctx.lineWidth = 0.85 + near * 0.25;
        ctx.stroke();

        if (!reduced && trace.length > 60) {
          const travel = ((t * 18 + index * 47) % (trace.length + 120)) - 60;
          const head = pointAt(trace, travel);
          if (head) {
            ctx.beginPath();
            ctx.arc(head.x, head.y, 1.05, 0, Math.PI * 2);
            ctx.fillStyle = hover;
            ctx.globalAlpha = 0.14 + near * 0.16;
            ctx.fill();
          }
        }
      });

      for (const point of nodes) {
        const d = Math.hypot(mx - point.x, my - point.y);
        const near = Math.max(0, 1 - d / radius);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.15 + near * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = near > 0.14 ? hover : node;
        ctx.globalAlpha = 0.22 + near * 0.22;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (shouldAnimate()) {
        frame = window.requestAnimationFrame(draw);
      } else {
        frame = 0;
      }
    };

    const startLoop = () => {
      if (disposed || frame) return;
      frame = window.requestAnimationFrame(draw);
    };

    const toLocal = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };

    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    resize();
    startLoop();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const vis = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (shouldAnimate()) startLoop();
      },
      { threshold: 0.05 },
    );
    vis.observe(host);
    const onVisibility = () => {
      if (shouldAnimate()) startLoop();
    };
    host.addEventListener('pointermove', toLocal);
    host.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    const themeWatcher = new MutationObserver(() => {
      if (!frame) startLoop();
    });
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      vis.disconnect();
      host.removeEventListener('pointermove', toLocal);
      host.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      themeWatcher.disconnect();
    };
  }, []);

  return <canvas className="circuit-backdrop" aria-hidden="true" ref={canvasRef} />;
}
