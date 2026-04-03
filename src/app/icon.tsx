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
          background: '#130800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '23%',
        }}
      >
        {/* Outer faint ring */}
        <div
          style={{
            position: 'absolute',
            width: '84%',
            height: '84%',
            borderRadius: '50%',
            border: '10px solid rgba(249,115,22,0.25)',
          }}
        />
        {/* Main amber ring */}
        <div
          style={{
            width: '64%',
            height: '64%',
            borderRadius: '50%',
            border: '36px solid #f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Center filled dot */}
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
