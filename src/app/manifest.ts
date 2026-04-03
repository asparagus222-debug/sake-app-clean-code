import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '品飲筆記',
    short_name: '品飲帖',
    description: '記錄每一款清酒的獨特風味與回憶',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#130800',
    theme_color: '#130800',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
