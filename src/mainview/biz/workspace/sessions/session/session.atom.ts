import { local } from '@view/atom/local';
import type { UserViewItem } from '@view/chat-store/session-view';
import { deriveEditorState, zeroEditorState } from './chat/composer/editor/state';
export type { ChatEditorState } from './chat/composer/editor/state';

export const [SessionProvider, define] = local();

export const EditMessageAtom = define.derive(null as UserViewItem | null, ({ set }) => {
  const start = (state: UserViewItem) => set(state);
  const cancel = () => set(null);
  return { start, cancel };
});

export const ChatEditorAtom = define.derive(zeroEditorState, deriveEditorState);
