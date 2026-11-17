// The AI assistant's Actions tools, wired to the app's actions store.
//   <AssistantSheet tools={actionTools.tools} getContext={actionTools.context} />

import { createActionTools } from './actionTools';
import { deleteAction, proposeAction, refreshActions } from './store';

export const actionTools = createActionTools({
  getActions: async () => {
    const s = await refreshActions();
    if (s.error) throw new Error(s.error);
    return s;
  },
  propose: proposeAction,
  remove: deleteAction,
});
