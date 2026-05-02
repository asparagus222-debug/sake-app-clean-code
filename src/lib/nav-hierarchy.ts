function normalizePathname(pathname: string): string {
  const base = pathname.split('?')[0] ?? pathname;
  if (!base || base === '/') return '/';
  const trimmed = base.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * 依網址結構決定「往上一層」的路由（不依瀏覽器 history）。
 * 用於頂部返回鈕、以及支援 Navigation API 時攔截系統「返回」。
 */
export function getHierarchicalParentPath(pathname: string): string {
  const p = normalizePathname(pathname);
  if (p === '/') return '/';

  const noteEdit = /^\/notes\/([^/]+)\/edit$/.exec(p);
  if (noteEdit) return `/notes/${noteEdit[1]}`;

  if (p === '/notes/new') return '/';
  if (p === '/notes/edit') return '/profile';

  const expoAlbum = /^\/expo\/([^/]+)\/album$/.exec(p);
  if (expoAlbum) return `/expo/${expoAlbum[1]}`;

  const expoRanking = /^\/expo\/([^/]+)\/ranking$/.exec(p);
  if (expoRanking) return `/expo/${expoRanking[1]}`;

  if (/^\/expo\/[^/]+$/.test(p)) return '/expo';
  if (p === '/expo') return '/';

  if (p === '/profile/notes') return '/profile';

  if (/^\/notes\/[^/]+$/.test(p)) return '/';

  if (/^\/users\/[^/]+$/.test(p)) return '/';

  const topToHome = new Set([
    '/profile',
    '/rankings',
    '/my-tasting',
    '/sake',
    '/vision-lab',
    '/recover',
    '/admin',
    '/card-preview',
    '/badge-preview',
  ]);
  if (topToHome.has(p)) return '/';

  const segments = p.split('/').filter(Boolean);
  if (segments.length <= 1) return '/';
  segments.pop();
  const candidate = `/${segments.join('/')}`;
  if (candidate === '/notes') return '/';
  return candidate;
}
