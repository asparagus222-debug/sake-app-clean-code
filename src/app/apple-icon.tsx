import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS applies its own corner rounding — do NOT pre-round the container
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#130800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '84%',
            height: '84%',
            borderRadius: '50%',
            border: '4px solid rgba(249,115,22,0.25)',
          }}
        />
        <div
          style={{
            width: '64%',
            height: '64%',
            borderRadius: '50%',
            border: '13px solid #f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '38%',
              height: '38%',
              borderRadius: '50%',
              background: '#f97316',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
