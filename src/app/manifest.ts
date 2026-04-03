import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '酒跡 - Sake Notes',
    short_name: '酒跡',
    description: '記錄每一款清酒的獨特風味與回憶',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080808',
    theme_color: '#080808',
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
