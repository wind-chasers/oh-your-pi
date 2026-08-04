import { local } from '@view/atom/local';
import type { UserViewItem } from '@view/chat-store/session-view';
import {
  deriveEditEditorState,
  deriveChatEditorState,
  zeroEditorState,
} from './chat/composer/editor/state';
export type { ChatEditorState } from './chat/composer/editor/state';

export const [SessionProvider, define] = local();

export const ChatEditorAtom = define.derive(zeroEditorState, deriveChatEditorState);
export const EditEditorAtom = define.derive(zeroEditorState, deriveEditEditorState);

export const EditMessageAtom = define.derive(null as UserViewItem | null, ({ set }, use) => {
  const start = (state: UserViewItem) => {
    const editor = use(EditEditorAtom)[1];
    editor.reset(state.text);
    set(state);
	};
  const cancel = () => {
    const editor = use(EditEditorAtom)[1];
    editor.reset();
    set(null);
  };
  return { start, cancel };
});
