
"use client"

import React from 'react';
import { Button } from '@/components/ui/button';
import { Delete, X } from 'lucide-react';

interface NumericKeypadProps {
  onNumberClick: (num: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

export function NumericKeypad({ onNumberClick, onDelete, onClear }: NumericKeypadProps) {
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="w-full max-w-xs mx-auto space-y-3">
      {/* 1-9 按鈕 - 3x3 網格 */}
      <div className="grid grid-cols-3 gap-3">
        {numbers.map((num) => (
          <Button
            key={num}
            type="button"
            onClick={() => onNumberClick(num)}
            className="h-20 w-full rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10 text-2xl font-bold text-primary hover:from-primary/40 hover:to-primary/20 active:from-primary/50 active:to-primary/30 transition-all shadow-lg hover:shadow-xl"
          >
            {num}
          </Button>
        ))}
      </div>
      
      {/* 0 和操作按鈕 */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          type="button"
          onClick={onClear}
          className="h-16 rounded-2xl border-2 border-red-500/30 bg-gradient-to-br from-red-500/20 to-red-500/10 text-red-400 hover:from-red-500/40 hover:to-red-500/20 transition-all shadow-lg"
        >
          <X className="w-6 h-6" />
        </Button>
        <Button
          type="button"
          onClick={() => onNumberClick("0")}
          className="h-16 col-span-1 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10 text-2xl font-bold text-primary hover:from-primary/40 hover:to-primary/20 active:from-primary/50 active:to-primary/30 transition-all shadow-lg hover:shadow-xl"
        >
          0
        </Button>
        <Button
          type="button"
          onClick={onDelete}
          className="h-16 rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-500/10 text-amber-400 hover:from-amber-500/40 hover:to-amber-500/20 transition-all shadow-lg"
        >
          <Delete className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
