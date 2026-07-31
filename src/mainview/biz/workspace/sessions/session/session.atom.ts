import { local, type Unit } from '@view/atom/local';
import type { UserViewItem } from '@view/chat-store/session-view';

export const [SessionProvider, define] = local();

export const EditMessageAtom = define.derive(null as UserViewItem | null, ({ set }) => {
  const start = (state: UserViewItem) => set(state);
  const cancel = () => set(null);
  return { start, cancel };
});

export interface ChatEditorState {
  draft: string;
}

const zeroEditorState: ChatEditorState = { draft: '' };

function deriveEditorState({ get, set, select}: Unit<ChatEditorState>) {
  function change(draft: string) {
    set({ draft });
  }

  function reset() {
    set(zeroEditorState);
  }

  const useValid = select(d => d.draft.trim() !== '');

  const useDraft = select(d => d.draft);

  return { change, reset, get, useValid, useDraft };
}

export const ChatEditorAtom = define.derive({ draft: '' }, deriveEditorState);
