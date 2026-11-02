import type { Project } from './types';

export type ProjectHistory = {
  past: Project[];
  present: Project;
  future: Project[];
  group?: string;
  at: number;
};
export type HistoryAction =
  | {
      type: 'change';
      update: Project | ((project: Project) => Project);
      group?: string;
      at: number;
    }
  | { type: 'sync' | 'reset'; project: Project }
  | { type: 'undo' | 'redo' };
export const initialHistory = (project: Project): ProjectHistory => ({
  past: [],
  present: project,
  future: [],
  at: 0,
});
const sameContent = (a: Project, b: Project) =>
  a.product === b.product &&
  a.kit === b.kit &&
  a.image === b.image &&
  a.sampleId === b.sampleId &&
  a.gallery === b.gallery &&
  a.slidePhotos === b.slidePhotos &&
  a.generationBrief === b.generationBrief &&
  a.review === b.review &&
  a.theme === b.theme &&
  a.branding === b.branding &&
  a.design === b.design;
const preserveIdentity = (snapshot: Project, present: Project) => ({
  ...snapshot,
  id: present.id,
  updatedAt: present.updatedAt,
});

export function projectHistory(state: ProjectHistory, action: HistoryAction): ProjectHistory {
  if (action.type === 'reset') return initialHistory(action.project);
  if (action.type === 'sync') return { ...state, present: action.project, group: undefined };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: preserveIdentity(state.past.at(-1)!, state.present),
      future: [state.present, ...state.future].slice(0, 40),
      at: 0,
    };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present].slice(-40),
      present: preserveIdentity(state.future[0], state.present),
      future: state.future.slice(1),
      at: 0,
    };
  }
  if (action.type === 'change') {
    const next = typeof action.update === 'function' ? action.update(state.present) : action.update;
    if (sameContent(next, state.present)) return { ...state, present: next };
    const merge = action.group && action.group === state.group && action.at - state.at < 650;
    return {
      past: merge ? state.past : [...state.past, state.present].slice(-40),
      present: next,
      future: [],
      group: action.group,
      at: action.at,
    };
  }
  return state;
}
