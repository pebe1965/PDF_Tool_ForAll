import { useEffect, useRef } from 'react';
import { rasterizeTextArt } from '../lib/textArtHelper';
import type { TextArtAnnotation } from '../types/pdf';

export function TextArtPreview({ markup, align, text }: { markup: string; text: string; align: TextArtAnnotation['textAlign'] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let revision = 0;
    const observer = new ResizeObserver(async () => {
      const request = ++revision;
      const scale = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(canvas.clientWidth * scale));
      const height = Math.max(1, Math.round(canvas.clientHeight * scale));
      try {
        const result = await rasterizeTextArt(markup, width, height, align);
        if (request !== revision) return;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(result, 0, 0);
      } catch (error) {
        console.error('TextArt-Vorschau konnte nicht gezeichnet werden.', error);
      }
    });
    observer.observe(canvas);
    return () => { revision++; observer.disconnect(); };
  }, [markup, align]);
  return <canvas ref={ref} role="img" aria-label={text} className="block w-full h-full pointer-events-none" />;
}
