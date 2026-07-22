import { atom } from '@view/atom';


export const CurrentWorkSpaceAtom = atom('');

export const CurrentSessionAtom = atom<null | string>(null);
