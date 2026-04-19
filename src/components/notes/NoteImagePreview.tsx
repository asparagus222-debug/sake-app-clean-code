'use client';

import React from 'react';
import { NoteImageTransform, buildRenderedNoteImageStyle } from '@/lib/note-image-layout';

type NoteImagePreviewProps = {
  imageUrls?: string[];
  imageOriginals?: string[];
  imageTransforms?: NoteImageTransform[];
  imageSplitRatio?: number;
  alt: string;
  className?: string;
};

export function NoteImagePreview({
  imageUrls,
  imageOriginals,
  imageTransforms,
  imageSplitRatio,
  alt,
  className,
}: NoteImagePreviewProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [rootSize, setRootSize] = React.useState({ width: 1, height: 1 });
  const [imgRatios, setImgRatios] = React.useState<number[]>([1, 1]);

  const sources = React.useMemo(
    () => (imageOriginals && imageOriginals.length > 0 ? imageOriginals : (imageUrls || [])),
    [imageOriginals, imageUrls]
  );

  React.useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setRootSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!sources.length) return;
    let cancelled = false;

    sources.forEach((src, idx) => {
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        const ratio = img.width && img.height ? img.width / img.height : 1;
        setImgRatios(prev => {
          const next = [...prev];
          next[idx] = ratio;
          return next;
        });
      };
      img.onerror = () => {
        if (cancelled) return;
        setImgRatios(prev => {
          const next = [...prev];
          next[idx] = 1;
          return next;
        });
      };
      img.src = src;
    });

    return () => {
      cancelled = true;
    };
  }, [sources]);

  if (!sources[0]) {
    return (
      <div ref={rootRef} className={className}>
        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground/30">
          NO PHOTO
        </div>
      </div>
    );
  }

  const transforms = imageTransforms || sources.map(() => ({ x: 0, y: 0, scale: 1 }));
  const splitRatio = imageSplitRatio || 50;
  const renderImage = (src: string, idx: number, containerWidth: number, containerHeight: number, imageAlt: string) => {
    const style = buildRenderedNoteImageStyle(
      imgRatios[idx] || 1,
      containerWidth,
      containerHeight,
      transforms[idx]
    );

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={imageAlt}
        className="absolute pointer-events-none select-none"
        style={style}
      />
    );
  };

  return (
    <div ref={rootRef} className={className}>
      {sources.length === 2 ? (
        <>
          <div className="h-full relative overflow-hidden" style={{ width: `${splitRatio}%` }}>
            {renderImage(sources[0], 0, rootSize.width * (splitRatio / 100), rootSize.height, `${alt}-1`)}
          </div>
          <div className="h-full w-px bg-white/20 z-10" />
          <div className="h-full relative overflow-hidden" style={{ width: `${100 - splitRatio}%` }}>
            {renderImage(sources[1], 1, rootSize.width * ((100 - splitRatio) / 100), rootSize.height, `${alt}-2`)}
          </div>
        </>
      ) : (
        <div className="w-full h-full relative overflow-hidden">
          {renderImage(sources[0], 0, rootSize.width, rootSize.height, alt)}
        </div>
      )}
    </div>
  );
}