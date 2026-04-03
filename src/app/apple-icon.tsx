import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        <div
          style={{
            position: 'absolute',
            width: '86%',
            height: '86%',
            borderRadius: '50%',
            border: '1px solid rgba(212,175,55,0.18)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '72%',
            height: '72%',
            borderRadius: '50%',
            border: '13px solid #c9a227',
            boxShadow:
              '0 0 12px rgba(201,162,39,0.55), inset 0 0 6px rgba(201,162,39,0.12)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '72%',
            height: '72%',
            borderRadius: '50%',
            border: '3px solid rgba(255,220,80,0.22)',
            transform: 'rotate(-40deg)',
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '43%',
            height: '43%',
            borderRadius: '50%',
            border: '11px solid #c9a227',
            boxShadow:
              '0 0 9px rgba(201,162,39,0.50), inset 0 0 5px rgba(201,162,39,0.10)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '14%',
            height: '14%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #1a1a1a, #050505)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
