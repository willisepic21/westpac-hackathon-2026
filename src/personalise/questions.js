// The onboarding questions shown in the "Personalise your home" pop-up.
// Each answer feeds buildHome() in ./buildHome.js, which picks a template and tweaks it.
// Pure JS (no React Native imports) so it can be unit tested in Node.

import { PALETTES } from './themes.js';

export const QUESTIONS = [
  {
    id: 'goal',
    title: 'What is your current money goal?',
    options: [
      { value: 'house', label: 'Saving for a house', icon: 'home-outline' },
      { value: 'debt', label: 'Paying off debt', icon: 'trending-down-outline' },
      { value: 'spending', label: 'Tracking daily spending', icon: 'speedometer-outline' },
    ],
  },
  {
    id: 'frequency',
    title: 'How often do you plan to check your bank app?',
    hint: 'Daily puts recent transactions first. Weekly and monthly put net worth and bills first.',
    options: [
      { value: 'daily', label: 'Daily', icon: 'sunny-outline' },
      { value: 'weekly', label: 'Weekly', icon: 'calendar-outline' },
      { value: 'monthly', label: 'Monthly', icon: 'calendar-number-outline' },
    ],
  },
  {
    id: 'accounts',
    multi: true,
    title: 'Which accounts do you use most?',
    hint: 'We will pin these to your home. Pick as many as you like, including joint accounts.',
    options: [
      { value: 'everyday', label: 'Everyday', icon: 'card-outline' },
      { value: 'savings', label: 'Savings', icon: 'wallet-outline' },
      { value: 'credit', label: 'Credit card', icon: 'card' },
      { value: 'joint', label: 'Shared bills (joint)', icon: 'people-outline' },
    ],
  },
  {
    id: 'weeklyTracker',
    title: 'Do you want a tracker for weekly spending?',
    hint: 'Adds a weekly spend gauge to your home.',
    options: [
      { value: 'yes', label: 'Yes please', icon: 'checkmark-circle-outline' },
      { value: 'no', label: 'No thanks', icon: 'close-circle-outline' },
    ],
  },
  {
    id: 'transfers',
    title: 'Do you often send money to yourself or others?',
    options: [
      { value: 'others', label: 'To others (PayID contacts)', icon: 'people-circle-outline' },
      { value: 'self', label: 'To myself (1-tap transfer)', icon: 'swap-horizontal-outline' },
      { value: 'both', label: 'Both', icon: 'repeat-outline' },
      { value: 'rarely', label: 'Rarely', icon: 'remove-circle-outline' },
    ],
  },
  {
    id: 'density',
    title: 'What layout are you after?',
    options: [
      { value: 'compact', label: 'More condensed', icon: 'reorder-four-outline' },
      { value: 'spacious', label: 'More spaced out', icon: 'reorder-two-outline' },
    ],
  },
  {
    id: 'palette',
    title: 'Pick your main and secondary colours',
    hint: 'Main is your background, secondary is your highlight colour.',
    options: [
      { value: 'template', label: "Designer's pick", icon: 'color-wand-outline' },
      ...Object.entries(PALETTES)
        .filter(([, p]) => p.selectable)
        .map(([value, p]) => ({ value, label: p.label, swatches: [p.bg, p.hero] })),
    ],
  },
];

// Answers that pass every question, used as defaults and in tests.
export const DEFAULT_ANSWERS = {
  goal: 'spending',
  frequency: 'daily',
  accounts: ['everyday'],
  weeklyTracker: 'yes',
  transfers: 'others',
  density: 'compact',
  palette: 'template',
};

export const isAnswered = (question, answer) =>
  question.multi ? Array.isArray(answer) && answer.length > 0 : answer != null;
