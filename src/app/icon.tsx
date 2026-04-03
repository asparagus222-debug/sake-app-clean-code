import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 42% 38%, #2c2c2c, #111 55%, #040404)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer faint hint ring */}
        <div
          style={{
            position: 'absolute',
            width: '86%',
            height: '86%',
            borderRadius: '50%',
            border: '2px solid rgba(212,175,55,0.18)',
          }}
        />
        {/* Outer gold enso ring */}
        <div
          style={{
            position: 'absolute',
            width: '72%',
            height: '72%',
            borderRadius: '50%',
            border: '36px solid #c9a227',
            boxShadow:
              '0 0 32px rgba(201,162,39,0.55), 0 0 10px rgba(201,162,39,0.35), inset 0 0 18px rgba(201,162,39,0.12)',
          }}
        />
        {/* Ouuter ring highlight arc (brushstroke shimmer top-left) */}
        <div
          style={{
            position: 'absolute',
            width: '72%',
            height: '72%',
            borderRadius: '50%',
            border: '8px solid rgba(255,220,80,0.22)',
            transform: 'rotate(-40deg)',
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
          }}
        />
        {/* Inner gold ring */}
        <div
          style={{
            position: 'absolute',
            width: '43%',
            height: '43%',
            borderRadius: '50%',
            border: '30px solid #c9a227',
            boxShadow:
              '0 0 24px rgba(201,162,39,0.50), 0 0 8px rgba(201,162,39,0.28), inset 0 0 12px rgba(201,162,39,0.10)',
          }}
        />
        {/* Inner ring shimmer */}
        <div
          style={{
            position: 'absolute',
            width: '43%',
            height: '43%',
            borderRadius: '50%',
            border: '7px solid rgba(255,220,80,0.20)',
            transform: 'rotate(130deg)',
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
          }}
        />
        {/* Center dark void */}
        <div
          style={{
            position: 'absolute',
            width: '14%',
            height: '14%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #1a1a1a, #050505)',
          }}
        />
        {/* Gold speckles */}
        {[
          { top: '22%', left: '62%', s: 3, o: 0.55 },
          { top: '30%', left: '75%', s: 2, o: 0.4 },
          { top: '65%', left: '28%', s: 2.5, o: 0.45 },
          { top: '70%', left: '68%', s: 2, o: 0.35 },
          { top: '38%', left: '18%', s: 2, o: 0.4 },
          { top: '55%', left: '80%', s: 3, o: 0.5 },
        ].map((d, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: d.top,
              left: d.left,
              width: d.s,
              height: d.s,
              borderRadius: '50%',
              background: '#d4af37',
              opacity: d.o,
            }}
          />
        ))}
      </div>
    ),
    { ...size }
  );
}
