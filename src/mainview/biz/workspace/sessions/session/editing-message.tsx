import { local } from '@view/atom/local';
import type { UserViewItem } from '@view/chat-store/session-view';

const [EditMessageProvider, EditMessageAtom] = local(null as UserViewItem | null, (_get, set) => {
  function start(state: UserViewItem) {
    set(state);
  }

  function cancel() {
    set(null);
  }

  return { start, cancel };
});

export {
  EditMessageProvider,
  EditMessageAtom,
  type UserViewItem,
}

