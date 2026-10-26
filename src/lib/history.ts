import { useCallback, useState } from 'react';
import type { Storyboard } from '../remotion/types';

export const useBoardHistory = (initial: () => Storyboard) => {
  const [history, set] = useState(() => ({
    past: [] as Storyboard[],
    board: initial(),
    future: [] as Storyboard[],
  }));
  const change = useCallback(
    (next: Storyboard | ((board: Storyboard) => Storyboard)) =>
      set((current) => {
        const board = typeof next === 'function' ? next(current.board) : next;
        if (JSON.stringify(board) === JSON.stringify(current.board)) return current;
        return { past: [...current.past.slice(-49), current.board], board, future: [] };
      }),
    [],
  );
  const undo = useCallback(
    () =>
      set((h) =>
        h.past.length
          ? { past: h.past.slice(0, -1), board: h.past.at(-1)!, future: [h.board, ...h.future] }
          : h,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      set((h) =>
        h.future.length ? { past: [...h.past, h.board], board: h.future[0]!, future: h.future.slice(1) } : h,
      ),
    [],
  );
  return {
    board: history.board,
    change,
    undo,
    redo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
};
