'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NewNoteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[notes/new error]', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 min-h-screen font-body">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-primary">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-headline text-primary ml-2">發生錯誤</h1>
      </div>

      <div className="dark-glass rounded-[2rem] border border-red-500/30 bg-red-500/10 p-6 space-y-4">
        <p className="text-sm font-bold text-red-300">載入頁面時發生錯誤，請將以下訊息回報：</p>

        <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-red-200 break-all whitespace-pre-wrap">
          <p className="font-bold mb-1">{error.name}: {error.message}</p>
          {error.stack && (
            <p className="text-red-300/70 text-[10px] mt-2">{error.stack}</p>
          )}
          {error.digest && (
            <p className="text-red-300/50 text-[10px] mt-2">Digest: {error.digest}</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={reset} className="rounded-full bg-primary text-xs font-bold">
            重試
          </Button>
          <Button variant="outline" onClick={() => router.push('/')} className="rounded-full text-xs font-bold">
            返回首頁
          </Button>
        </div>
      </div>
    </div>
  );
}
