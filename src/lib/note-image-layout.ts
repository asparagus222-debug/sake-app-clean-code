export type NoteImageTransform = {
  x: number;
  y: number;
  scale: number;
  coordinateSpace?: 'pixels' | 'relative';
};

export type NoteImageOffset = {
  x: number;
  y: number;
};

export type NoteImageFrame = {
  width: number;
  height: number;
  left: number;
  top: number;
};

function clampDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getCoverFrame(imageRatio: number, containerWidth: number, containerHeight: number): NoteImageFrame {
  const safeRatio = Number.isFinite(imageRatio) && imageRatio > 0 ? imageRatio : 1;
  const safeWidth = clampDimension(containerWidth);
  const safeHeight = clampDimension(containerHeight);
  const containerRatio = safeWidth / safeHeight;

  if (safeRatio > containerRatio) {
    const height = safeHeight;
    const width = height * safeRatio;
    return { width, height, left: (safeWidth - width) / 2, top: 0 };
  }

  const width = safeWidth;
  const height = width / safeRatio;
  return { width, height, left: 0, top: (safeHeight - height) / 2 };
}

export function resolveNoteImageTransform(
  transform: NoteImageTransform | undefined,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; scale: number } {
  if (!transform) {
    return { x: 0, y: 0, scale: 1 };
  }

  const safeWidth = clampDimension(containerWidth);
  const safeHeight = clampDimension(containerHeight);
  const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;

  if (transform.coordinateSpace === 'relative') {
    return {
      x: transform.x * safeWidth,
      y: transform.y * safeHeight,
      scale,
    };
  }

  return {
    x: Number.isFinite(transform.x) ? transform.x : 0,
    y: Number.isFinite(transform.y) ? transform.y : 0,
    scale,
  };
}

export function normalizeNoteImageTransform(
  offset: NoteImageOffset,
  scale: number,
  containerWidth: number,
  containerHeight: number
): NoteImageTransform {
  const safeWidth = clampDimension(containerWidth);
  const safeHeight = clampDimension(containerHeight);

  return {
    x: offset.x / safeWidth,
    y: offset.y / safeHeight,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    coordinateSpace: 'relative',
  };
}

export function buildRenderedNoteImageStyle(
  imageRatio: number,
  containerWidth: number,
  containerHeight: number,
  transform: NoteImageTransform | undefined
): {
  width: string;
  height: string;
  left: string;
  top: string;
  transform: string;
  transformOrigin: 'center center';
} {
  const frame = getCoverFrame(imageRatio, containerWidth, containerHeight);
  const resolved = resolveNoteImageTransform(transform, containerWidth, containerHeight);

  return {
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    left: `${frame.left}px`,
    top: `${frame.top}px`,
    transform: `translate(${resolved.x}px, ${resolved.y}px) scale(${resolved.scale})`,
    transformOrigin: 'center center',
  };
}