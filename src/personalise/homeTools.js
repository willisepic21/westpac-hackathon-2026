// Tools that let the AI assistant see and change the widgets on Home.
// The AI only ever sees widget names and their order, never the balances or transactions inside them
// (see ai_perms.md). Pure JS: the store is passed in, so it can be tested in Node.
//
//   const { tools, context } = createHomeTools({ getState: getPersonalisation, setSections: setHomeSections });
//   new VoiceAssistant({ tools, getContext: context });

import { buildHome } from './buildHome.js';
import { DEFAULT_ANSWERS } from './questions.js';
import { WIDGET_TYPES, describeCatalog, describeLayout, editLayout } from './widgetCatalog.js';

/**
 * getState()          -> null (standard home) or { answers, sections? } from store.js
 * setSections(list)   saves the edited section list (switches a standard home to a personalised one)
 */
export function createHomeTools({ getState, setSections }) {
  const currentSections = () => {
    const state = getState();
    return buildHome(state?.answers ?? DEFAULT_ANSWERS, { sections: state?.sections }).sections;
  };

  const run = (edit) => {
    const { sections, message } = editLayout(currentSections(), edit);
    setSections(sections);
    return `${message}\nHome is now:\n${describeLayout(sections)}`;
  };

  const typeParam = { type: 'string', enum: WIDGET_TYPES, description: 'Widget type from the catalogue.' };
  const positionParam = { type: 'integer', minimum: 1, description: '1 is the top of the home.' };

  const tools = [
    {
      name: 'add_widget',
      description: 'Add a widget to the home page. Only call this when the user asks for it.',
      parameters: {
        type: 'object',
        properties: {
          type: typeParam,
          variant: { type: 'string', description: 'Optional style from the catalogue, e.g. hero, carousel, list.' },
          position: { ...positionParam, description: 'Optional. 1 is the top; leave out to add at the bottom.' },
        },
        required: ['type'],
      },
      run: ({ type, variant, position }) => run({ action: 'add', type, variant, position }),
    },
    {
      name: 'remove_widget',
      description: 'Remove a widget from the home page. Only call this when the user asks for it.',
      parameters: { type: 'object', properties: { type: typeParam }, required: ['type'] },
      run: ({ type }) => run({ action: 'remove', type }),
    },
    {
      name: 'move_widget',
      description: 'Move a widget that is already on the home page to a new position.',
      parameters: {
        type: 'object',
        properties: { type: typeParam, position: positionParam },
        required: ['type', 'position'],
      },
      run: ({ type, position }) => run({ action: 'move', type, position }),
    },
  ];

  // Fresh every time the user asks something, so the AI always sees the live layout.
  const context = () => {
    const state = getState();
    const layout = state
      ? `Widgets on the user's home right now, top to bottom:\n${describeLayout(currentSections())}`
      : 'The user is on the standard home, which has no widgets yet. Adding or removing a widget switches ' +
        `them to a personalised home that starts with:\n${describeLayout(currentSections())}`;
    return [
      'You can change which widgets are on the home page with the add_widget, remove_widget and ' +
        'move_widget tools. When the user asks to add, show, remove, hide or move something on their home, ' +
        'you must call the tool: the home only changes when a tool is called, so never say you changed it ' +
        'without calling one. Only change the home when the user asks, then tell them in one short sentence ' +
        'what changed. To change a widget style, remove it and add it again with the new variant.',
      `Widgets available:\n${describeCatalog()}`,
      layout,
    ].join('\n\n');
  };

  return { tools, context };
}
