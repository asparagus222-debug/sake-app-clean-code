'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getHierarchicalParentPath } from '@/lib/nav-hierarchy';

/**
 * 導航至目前路徑的邏輯上一層（不依 history.back）。
 */
export function useLayerBackNavigation() {
  const router = useRouter();
  const pathname = usePathname() || '/';

  return useCallback(() => {
    const parent = getHierarchicalParentPath(pathname);
    if (parent === pathname) {
      router.push('/');
      return;
    }
    router.push(parent);
  }, [pathname, router]);
}
