// Every widget the home page can show, plus pure helpers to add / remove / move them.
// The AI assistant reads this catalogue (see homeTools.js) so it knows what it can put on Home.
// Pure JS so it can be tested in Node (see tests/personalise.test.mjs).
//
// Keep in sync with SECTIONS in PersonalisedHome.js: every `type` here must render there.

export const WIDGETS = {
  goal: {
    name: 'Money goal',
    description: "The user's goal widget: house deposit save tracker, debt paid-off bar or daily spending gauge.",
    variants: ['hero', 'carousel', 'mini'],
  },
  weekly: {
    name: 'Weekly spend gauge',
    description: 'How much has been spent this week against the weekly budget.',
    variants: ['card', 'carousel', 'bars'],
  },
  pinned: {
    name: 'Pinned accounts',
    description: "The user's pinned accounts, including joint accounts.",
    variants: ['carousel', 'grid', 'list'],
  },
  tiles: {
    name: 'Quick tiles',
    description: 'Two small tiles: the top pinned account and a goal fact.',
    variants: [],
  },
  recent: {
    name: 'Recent transactions',
    description: 'The latest few transactions.',
    variants: [],
  },
  netWorth: {
    name: 'Net worth',
    description: 'Net worth with assets and debt.',
    variants: [],
  },
  bills: {
    name: 'Upcoming bills',
    description: 'Bills coming up soon.',
    variants: ['hero', 'list'],
  },
  move: {
    name: 'Move money',
    description: 'Quick PayID contacts and/or a 1-tap transfer between their own accounts.',
    variants: ['button', 'slider'],
  },
  total: {
    name: 'Total available',
    description: 'Total money available across all accounts.',
    variants: [],
  },
};

export const WIDGET_TYPES = Object.keys(WIDGETS);

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

/** The full catalogue as text, for the AI prompt. */
export function describeCatalog() {
  return WIDGET_TYPES.map((type) => {
    const w = WIDGETS[type];
    const variants = w.variants.length ? ` Variants: ${w.variants.join(', ')}.` : '';
    return `- ${type}: ${w.name}. ${w.description}${variants}`;
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
    const section = { type };
    if (w.variants.length) section.variant = w.variants.includes(variant) ? variant : w.variants[0];
    if (type === 'recent') section.count = 3;
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
