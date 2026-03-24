import { useState, useCallback } from 'react';
import { ViewMode } from './types.ts';

interface ViewModeState {
  readonly mode: ViewMode;
  readonly enterEdit: () => void;
  readonly exitEdit: () => void;
}

export function useViewMode(): ViewModeState {
  const [mode, setMode] = useState<ViewMode>(ViewMode.List);

  const enterEdit = useCallback(() => {
    setMode(ViewMode.Edit);
  }, []);

  const exitEdit = useCallback(() => {
    setMode(ViewMode.List);
  }, []);

  return { mode, enterEdit, exitEdit };
}
