'use client';
import { useCallback, useReducer } from 'react';
import { initialHistory, projectHistory } from './history';
import type { Project } from './types';

export function useProjectHistory(initial: () => Project) {
  const [history, dispatch] = useReducer(projectHistory, undefined, () =>
    initialHistory(initial()),
  );
  const setProject = useCallback(
    (update: Project | ((project: Project) => Project), group?: string) =>
      dispatch({ type: 'change', update, group, at: Date.now() }),
    [],
  );
  const resetProject = useCallback((project: Project) => dispatch({ type: 'reset', project }), []);
  const syncProject = useCallback((project: Project) => dispatch({ type: 'sync', project }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  return {
    project: history.present,
    setProject,
    resetProject,
    syncProject,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
