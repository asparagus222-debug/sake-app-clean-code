'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SAKE_DATABASE, sakeEntryMatchesSearchQuery, type SakeDatabaseEntry } from '@/lib/sake-data';

/**
 * 依 SAKE_DATABASE 篩選銘柄／酒造／產地，供品飲筆記與展場快速品鑑共用。
 */
export function useSakeBrandSuggestions() {
  const [brandSuggestions, setBrandSuggestions] = useState<SakeDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshSuggestionsForQuery = useCallback((query: string) => {
    if (!query.length) {
      setBrandSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const filtered = SAKE_DATABASE.filter((item) => sakeEntryMatchesSearchQuery(item, query));
    setBrandSuggestions(filtered);
    setShowSuggestions(true);
  }, []);

  const pickSuggestionFields = useCallback((item: SakeDatabaseEntry) => {
    setShowSuggestions(false);
    return {
      brandName: item.brand,
      brewery: item.brewery,
      origin: item.location,
    };
  }, []);

  return {
    suggestionRef,
    brandSuggestions,
    showSuggestions,
    refreshSuggestionsForQuery,
    pickSuggestionFields,
  };
}
