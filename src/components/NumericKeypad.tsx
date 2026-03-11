
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
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return (
    <div className="grid grid-cols-3 gap-4 w-full max-w-[280px] mx-auto">
      {numbers.slice(0, 9).map((num) => (
        <Button
          key={num}
          variant="outline"
          type="button"
          onClick={() => onNumberClick(num)}
          className="h-16 w-16 rounded-full border-white/10 bg-white/5 text-lg font-bold hover:bg-primary hover:text-white transition-all shadow-lg"
        >
          {num}
        </Button>
      ))}
      <Button
        variant="ghost"
        type="button"
        onClick={onClear}
        className="h-16 w-16 rounded-full text-muted-foreground hover:text-white"
      >
        <X className="w-5 h-5" />
      </Button>
      <Button
        variant="outline"
        type="button"
        onClick={() => onNumberClick("0")}
        className="h-16 w-16 rounded-full border-white/10 bg-white/5 text-lg font-bold hover:bg-primary hover:text-white transition-all shadow-lg"
      >
        0
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={onDelete}
        className="h-16 w-16 rounded-full text-muted-foreground hover:text-white"
      >
        <Delete className="w-5 h-5" />
      </Button>
    </div>
  );
}
