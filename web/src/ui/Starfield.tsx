// The starry background behind the planet (stars.ts), drawn once on a
// canvas and again only when the view changes size. It is decoration: still,
// behind everything, hidden from screen readers and closed to the pointer.

import { useEffect, useRef } from "react";
import { starCount, starField } from "./stars";

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const draw = (): void => {
      const { width, height } = canvas.getBoundingClientRect();
      const context = canvas.getContext("2d");
      if (!context || width <= 0 || height <= 0) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      for (const star of starField(starCount(width, height))) {
        context.globalAlpha = star.alpha;
        context.fillStyle = star.color;
        context.beginPath();
        context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
        context.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="starfield"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
