// Every widget the home page can show, plus pure helpers to add / remove / move them.
// The AI assistant reads this catalogue (see homeTools.js) so it knows what it can put on Home.
// Pure JS so it can be tested in Node (see tests/personalise.test.mjs).
//
// Keep in sync with SECTIONS in PersonalisedHome.js: every `type` here must render there.
// `id` is the widget's widget_ID in the database `widgets` table (database/schema.sql).

export const WIDGETS = {
  goal: {
    id: 1,
    name: 'Money goal',
    description: "The user's goal widget: house deposit save tracker, debt paid-off bar or daily spending gauge.",
    variants: ['hero', 'carousel', 'mini'],
  },
  weekly: {
    id: 2,
    name: 'Weekly spend gauge',
    description: 'How much has been spent this week against the weekly budget.',
    variants: ['card', 'carousel', 'bars'],
  },
  pinned: {
    id: 3,
    name: 'Pinned accounts',
    description: "The user's pinned accounts, including joint accounts.",
    variants: ['carousel', 'grid', 'list'],
  },
  tiles: {
    id: 4,
    name: 'Quick tiles',
    description: 'Two small tiles: the top pinned account and a goal fact.',
    variants: [],
  },
  recent: {
    id: 5,
    name: 'Recent transactions',
    description: 'The latest few transactions.',
    variants: [],
  },
  netWorth: {
    id: 6,
    name: 'Net worth',
    description: 'Net worth with assets and debt.',
    variants: [],
  },
  bills: {
    id: 7,
    name: 'Upcoming bills',
    description: 'Bills coming up soon.',
    variants: ['hero', 'list'],
  },
  move: {
    id: 8,
    name: 'Move money',
    description: 'Quick PayID contacts and/or a 1-tap transfer between their own accounts.',
    variants: ['button', 'slider'],
  },
  total: {
    id: 9,
    name: 'Total available',
    description: 'Total money available across all accounts.',
    variants: [],
  },
};

export const WIDGET_TYPES = Object.keys(WIDGETS);

/** Widget type for a database widget_ID, e.g. 1 -> 'goal' (undefined if the app can't render it). */
export const widgetType = (id) => WIDGET_TYPES.find((type) => WIDGETS[type].id === id);

/** A new section for a widget, with its first variant unless a valid one is given. */
export function newSection(type, variant) {
  const w = WIDGETS[type];
  const section = { type };
  if (w.variants.length) section.variant = w.variants.includes(variant) ? variant : w.variants[0];
  if (type === 'recent') section.count = 3;
  return section;
}

const label = (s) => {
  const w = WIDGETS[s.type];
  const name = w ? w.name : s.type;
  return s.variant ? `${name} (${s.variant})` : name;
};

/** Numbered list of what is on the home, top to bottom, e.g. "1. goal: Money goal (hero)". */
export function describeLayout(sections) {
  if (!sections.length) return 'The home has no widgets.';
  return sections.map((s, i) => `${i + 1}. ${s.type}: ${label(s)}`).join('\n');
}

/**
 * The catalogue as text, for the AI prompt.
 * `available` (optional) is the database's widgets table, [{ id, name }]; only those widgets are listed,
 * using the database name. Without it, every widget in WIDGETS is listed.
 */
export function describeCatalog(available) {
  const rows = available
    ? available.map(({ id, name }) => ({ type: widgetType(id), name })).filter((r) => r.type)
    : WIDGET_TYPES.map((type) => ({ type, name: WIDGETS[type].name }));
  return rows.map(({ type, name }) => {
    const w = WIDGETS[type];
    const variants = w.variants.length ? ` Variants: ${w.variants.join(', ')}.` : '';
    return `- ${type}: ${name}. ${w.description}${variants}`;
  }).join('\n');
}

// 1-based position from the AI -> array index, clamped to the list.
const toIndex = (position, length) => {
  const n = Number(position);
  if (!Number.isFinite(n)) return length;
  return Math.min(Math.max(Math.round(n) - 1, 0), length);
};

function checkType(type) {
  if (!WIDGETS[type]) throw new Error(`Unknown widget "${type}". Choose one of: ${WIDGET_TYPES.join(', ')}.`);
}

/**
 * Apply one edit to a section list and return { sections, message }. Never mutates the input.
 *   { action: 'add', type, variant?, position? }   position is 1-based, default is the bottom
 *   { action: 'remove', type }
 *   { action: 'move', type, position }
 * Throws an Error with a readable message when the edit isn't possible.
 */
export function editLayout(sections, { action, type, variant, position }) {
  checkType(type);
  const w = WIDGETS[type];
  const index = sections.findIndex((s) => s.type === type);

  if (action === 'add') {
    if (index >= 0) throw new Error(`${w.name} is already on the home (position ${index + 1}).`);
    const section = newSection(type, variant);
    const out = [...sections];
    out.splice(toIndex(position, out.length), 0, section);
    return { sections: out, message: `Added ${label(section)} at position ${out.indexOf(section) + 1}.` };
  }

  if (index < 0) throw new Error(`${w.name} is not on the home.`);

  if (action === 'remove') {
    return { sections: sections.filter((s) => s.type !== type), message: `Removed ${w.name}.` };
  }

  if (action === 'move') {
    const out = [...sections];
    const [section] = out.splice(index, 1);
    out.splice(toIndex(position, out.length), 0, section);
    return { sections: out, message: `Moved ${w.name} to position ${out.indexOf(section) + 1}.` };
  }

  throw new Error(`Unknown action "${action}".`);
}

// ---- Manual editing (the "Customise" widget editor, src/personalise/WidgetEditor.js) ----

/** Friendly names for variants, shown in the widget editor. */
export const VARIANT_LABELS = {
  hero: 'Big card',
  carousel: 'Swipe row',
  mini: 'Compact',
  card: 'Card',
  bars: 'Bars',
  grid: 'Grid',
  list: 'List',
  button: 'Buttons',
  slider: 'Slider',
};

/** How many transactions the Recent transactions widget can show. */
export const RECENT_COUNTS = [3, 5, 8];

/** Move the section at `index` up (delta -1) or down (+1). Returns a new list; out-of-range moves are ignored. */
export function moveSection(sections, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= sections.length || to < 0 || to >= sections.length) return sections;
  const out = [...sections];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

/** Change a section's settings (variant and/or count), keeping only values the widget supports. */
export function updateSection(sections, index, { variant, count }) {
  return sections.map((s, i) => {
    if (i !== index) return s;
    const next = { ...s };
    if (variant !== undefined && WIDGETS[s.type].variants.includes(variant)) next.variant = variant;
    if (count !== undefined && s.type === 'recent' && RECENT_COUNTS.includes(count)) next.count = count;
    return next;
  });
}

/** Widgets not on the home yet, in catalogue order. */
export const missingWidgets = (sections) => WIDGET_TYPES.filter((type) => !sections.some((s) => s.type === type));
