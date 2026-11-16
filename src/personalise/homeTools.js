// Tools that let the AI assistant see and change the widgets and colour theme on Home.
// The AI only ever sees widget names, their order and theme names, never the balances or transactions
// inside them (see ai_perms.md). Pure JS: the store and database are passed in, so it can be tested in Node.
//
//   const { tools, context } = createHomeTools({ getState, setSections, setTheme, getCatalog });
//   new VoiceAssistant({ tools, getContext: context });

import { buildHome } from './buildHome.js';
import { DEFAULT_ANSWERS } from './questions.js';
import { PALETTES } from './themes.js';
import { WIDGETS, WIDGET_TYPES, describeCatalog, describeLayout, editLayout, widgetType } from './widgetCatalog.js';

// Used when the database API can't be reached, so the assistant still works.
const CODE_CATALOG = {
  widgets: WIDGET_TYPES.map((type) => ({ id: WIDGETS[type].id, name: WIDGETS[type].name })),
  themes: Object.entries(PALETTES).map(([name, p]) => ({ name, label: p.label })),
};

const NOT_SAVED = ' (The database could not be reached, so this will reset when the app reloads.)';

/**
 * getState()           -> null (standard home) or { answers, sections? } from store.js
 * setSections(list)    saves the edited section list (switches a standard home to a personalised one)
 * setTheme(name)       saves the colour theme (also switches a standard home to a personalised one)
 * getCatalog()         -> Promise<{ widgets: [{ id, name }], themes: [{ name, label }] }> from the database
 * setSections / setTheme may return a Promise<boolean>; false means it wasn't saved to the database.
 */
export function createHomeTools({ getState, setSections, setTheme, getCatalog }) {
  // What the database offered on the latest question; the tools only allow these.
  let catalog = CODE_CATALOG;

  const currentHome = () => {
    const state = getState();
    return buildHome(state?.answers ?? DEFAULT_ANSWERS, { sections: state?.sections });
  };

  const run = async (edit) => {
    if (edit.action === 'add' && !catalog.widgets.some((w) => widgetType(w.id) === edit.type)) {
      throw new Error(`${edit.type} is not one of the available widgets.`);
    }
    const { sections, message } = editLayout(currentHome().sections, edit);
    const saved = await setSections(sections);
    return `${message}${saved === false ? NOT_SAVED : ''}\nHome is now:\n${describeLayout(sections)}`;
  };

  const changeTheme = async ({ theme }) => {
    const found = catalog.themes.find((t) => t.name === theme);
    if (!found) throw new Error(`Unknown theme "${theme}". Choose one of: ${catalog.themes.map((t) => t.name).join(', ')}.`);
    const saved = await setTheme(theme);
    return `Theme changed to ${found.label}.${saved === false ? NOT_SAVED : ''}`;
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
    {
      name: 'set_theme',
      description: "Change the app's colour theme. Only call this when the user asks for it.",
      parameters: {
        type: 'object',
        properties: { theme: { type: 'string', description: 'Theme name from the themes list, e.g. forest.' } },
        required: ['theme'],
      },
      run: changeTheme,
    },
  ];

  // Fresh every time the user asks something: re-reads the available widgets and themes from the database,
  // so the AI always sees what is in there and the live layout.
  const context = async () => {
    try {
      catalog = await getCatalog();
    } catch (e) {
      console.warn(`Database API unavailable, using the built-in widget and theme lists: ${e.message}`);
      catalog = CODE_CATALOG;
    }
    const state = getState();
    const home = currentHome();
    const layout = state
      ? `Widgets on the user's home right now, top to bottom:\n${describeLayout(home.sections)}`
      : 'The user is on the standard home, which has no widgets yet. Adding or removing a widget or changing ' +
        `the theme switches them to a personalised home that starts with:\n${describeLayout(home.sections)}`;
    return [
      'You can change which widgets are on the home page with the add_widget, remove_widget and ' +
        'move_widget tools, and the colour theme with the set_theme tool. When the user asks to add, show, ' +
        'remove, hide or move something on their home, or to change its colours or theme, you must call the ' +
        'tool: the home only changes when a tool is called, so never say you changed it without calling one. ' +
        'Only change the home when the user asks, then tell them in one short sentence what changed. To change ' +
        'a widget style, remove it and add it again with the new variant.',
      `Widgets available:\n${describeCatalog(catalog.widgets)}`,
      `Themes available:\n${catalog.themes.map((t) => `- ${t.name}: ${t.label}`).join('\n')}`,
      `Current theme: ${state ? home.paletteKey : 'the standard Westpac home'}`,
      layout,
    ].join('\n\n');
  };

  return { tools, context };
}
