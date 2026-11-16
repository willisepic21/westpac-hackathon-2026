// Turns onboarding answers into a ready-to-render home:
//   1. score every template and pick the best match
//   2. apply the user's tweaks (colours, density, pinned accounts, weekly tracker, transfers)
//   3. reorder so daily users see transactions first, weekly/monthly users see net worth and bills first
// Pure JS so it can be tested in Node (see tests/personalise.test.mjs).

import { TEMPLATES } from './templates.js';
import { PALETTES, DENSITY } from './themes.js';
import { DEFAULT_ANSWERS } from './questions.js';

const GOAL_LABEL = { house: 'House deposit', debt: 'Debt repayment', spending: 'Spending' };
const CAP = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function scoreTemplate(template, answers) {
  let score = 0;
  if (template.goal === answers.goal) score += 4;
  else if (template.goal === 'any') score += 2;
  if (template.frequency === answers.frequency) score += 3;
  if (template.density === answers.density) score += 1;
  if (template.joint && answers.accounts?.includes('joint')) score += 1;
  return score;
}

// Best match first. Ties keep the order in TEMPLATES.
export function rankTemplates(answers) {
  return TEMPLATES.map((t, i) => ({ t, i, s: scoreTemplate(t, answers) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ t }) => t);
}

// Daily: recent transactions come before net worth / bills.
// Weekly + monthly: net worth / bills come before recent transactions.
// Only these three section types swap places; everything else stays where the template put it.
const PRIORITY = {
  daily: ['recent', 'netWorth', 'bills'],
  weekly: ['netWorth', 'bills', 'recent'],
  monthly: ['netWorth', 'bills', 'recent'],
};

export function prioritise(sections, frequency) {
  const order = PRIORITY[frequency] ?? PRIORITY.daily;
  const slots = [];
  const movable = [];
  sections.forEach((s, i) => {
    if (order.includes(s.type)) {
      slots.push(i);
      movable.push(s);
    }
  });
  movable.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const out = [...sections];
  slots.forEach((slot, k) => {
    out[slot] = movable[k];
  });
  return out;
}

export function buildHome(rawAnswers, { templateId } = {}) {
  const answers = { ...DEFAULT_ANSWERS, ...rawAnswers };
  const template =
    (templateId && TEMPLATES.find((t) => t.id === templateId)) || rankTemplates(answers)[0];

  const paletteKey = answers.palette === 'template' ? template.palette : answers.palette;
  const theme = PALETTES[paletteKey] ?? PALETTES[template.palette];
  const density = DENSITY[answers.density] ? answers.density : template.density;

  const showContacts = answers.transfers === 'others' || answers.transfers === 'both';
  const showTransfer = answers.transfers === 'self' || answers.transfers === 'both';
  const weeklyTracker = answers.weeklyTracker === 'yes';

  let sections = template.sections.filter((s) => {
    if (s.type === 'weekly') return weeklyTracker;
    if (s.type === 'move') return showContacts || showTransfer;
    return true;
  });
  sections = prioritise(sections, answers.frequency);

  return {
    answers,
    template,
    theme,
    density,
    d: DENSITY[density],
    goal: answers.goal,
    pinned: answers.accounts?.length ? answers.accounts : ['everyday'],
    weeklyTracker,
    showContacts,
    showTransfer,
    sections,
    tags: [
      GOAL_LABEL[answers.goal],
      CAP(answers.frequency),
      density === 'compact' ? 'Compact' : 'Spacious',
      ...(answers.accounts?.includes('joint') ? ['Joint accounts'] : []),
    ].join(' · '),
  };
}
