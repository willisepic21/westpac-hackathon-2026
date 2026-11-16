// Pre-designed home templates. buildHome() scores every template against the
// onboarding answers and picks the best match, then applies the user's tweaks.
//
// Templates 1-4 follow the Figma mockups; 5-10 fill in the other goal/frequency combos.
//
// `goal`       'house' | 'debt' | 'spending' | 'any'
// `frequency`  'daily' | 'weekly' | 'monthly'
// `joint`      bonus match when the user pins a joint account
// `sections`   rendered top to bottom. Each has a `type` and an optional `variant`:
//
//   goal     hero | carousel | mini       the money-goal widget (save tracker / debt bar / daily gauge)
//   weekly   card | carousel | bars       weekly spend gauge (removed if the user says no to Q4)
//   pinned   carousel | grid | list       pinned accounts from Q3
//   tiles                                 two small tiles: top pinned account + a goal fact
//   recent                                recent transactions (`count`)
//   netWorth                              net worth, assets and debt
//   bills    hero | list                  upcoming bills
//   move     button | slider              PayID contacts and/or 1-tap transfer, from Q5
//   total                                 total available across accounts
//
// `title` on a section overrides its heading.

export const TEMPLATES = [
  // 1. Figma: Daily spending · Compact — Netflix-style rows
  {
    id: 'daily-checkin',
    name: 'Daily check-in',
    title: 'Your daily check-in',
    goal: 'spending',
    frequency: 'daily',
    density: 'compact',
    palette: 'forest',
    sections: [
      { type: 'goal', variant: 'carousel' },
      { type: 'pinned', variant: 'carousel' },
      { type: 'recent', count: 2 },
      { type: 'move', variant: 'button' },
    ],
  },
  // 2. Figma: House saver · Weekly · Spacious
  {
    id: 'room-for-home',
    name: 'House saver',
    title: 'Make room for home',
    goal: 'house',
    frequency: 'weekly',
    density: 'spacious',
    palette: 'lavender',
    sections: [
      { type: 'goal', variant: 'hero' },
      { type: 'weekly', variant: 'carousel' },
      { type: 'move', variant: 'button', title: 'Keep the habit going' },
      { type: 'total' },
    ],
  },
  // 3. Figma: Debt freedom · Focused
  {
    id: 'debt-freedom',
    name: 'Debt freedom',
    title: 'Less debt. More freedom.',
    goal: 'debt',
    frequency: 'daily',
    density: 'compact',
    palette: 'sand',
    sections: [
      { type: 'goal', variant: 'hero' },
      { type: 'tiles' },
      { type: 'weekly', variant: 'bars' },
      { type: 'recent', count: 2, title: 'Recent activity' },
      { type: 'move', variant: 'button' },
    ],
  },
  // 4. Figma: Shared money · Monthly — dark, big picture first
  {
    id: 'bigger-picture',
    name: 'Shared money',
    title: 'The bigger picture',
    goal: 'any',
    frequency: 'monthly',
    density: 'spacious',
    palette: 'midnight',
    joint: true,
    sections: [
      { type: 'netWorth' },
      { type: 'bills', variant: 'hero' },
      { type: 'pinned', variant: 'list' },
      { type: 'goal', variant: 'mini' },
      { type: 'move', variant: 'slider' },
    ],
  },
  // 5. House · Daily — all carousels
  {
    id: 'deposit-sprint',
    name: 'Deposit sprint',
    title: 'Every dollar closer',
    goal: 'house',
    frequency: 'daily',
    density: 'compact',
    palette: 'ocean',
    sections: [
      { type: 'goal', variant: 'carousel' },
      { type: 'recent', count: 3 },
      { type: 'pinned', variant: 'carousel' },
      { type: 'weekly', variant: 'card' },
      { type: 'move', variant: 'slider' },
    ],
  },
  // 6. House · Monthly — calm vertical stack
  {
    id: 'home-stretch',
    name: 'Home stretch',
    title: 'The home stretch',
    goal: 'house',
    frequency: 'monthly',
    density: 'spacious',
    palette: 'sage',
    sections: [
      { type: 'goal', variant: 'hero' },
      { type: 'netWorth' },
      { type: 'bills', variant: 'list' },
      { type: 'pinned', variant: 'grid' },
      { type: 'weekly', variant: 'card' },
      { type: 'move', variant: 'slider' },
    ],
  },
  // 7. Debt · Weekly — rows of swipeable cards
  {
    id: 'paydown-plan',
    name: 'Paydown plan',
    title: 'Your paydown plan',
    goal: 'debt',
    frequency: 'weekly',
    density: 'compact',
    palette: 'slate',
    sections: [
      { type: 'goal', variant: 'carousel' },
      { type: 'weekly', variant: 'bars' },
      { type: 'bills', variant: 'list' },
      { type: 'pinned', variant: 'carousel' },
      { type: 'move', variant: 'button' },
      { type: 'recent', count: 3 },
    ],
  },
  // 8. Debt · Monthly — dark, bold
  {
    id: 'clean-slate',
    name: 'Clean slate',
    title: 'Clearing the slate',
    goal: 'debt',
    frequency: 'monthly',
    density: 'spacious',
    palette: 'charcoal',
    sections: [
      { type: 'netWorth' },
      { type: 'goal', variant: 'hero' },
      { type: 'bills', variant: 'hero' },
      { type: 'pinned', variant: 'list' },
      { type: 'move', variant: 'slider' },
    ],
  },
  // 9. Spending · Weekly — Westpac colours, week first
  {
    id: 'week-at-a-glance',
    name: 'Week at a glance',
    title: 'Your week at a glance',
    goal: 'spending',
    frequency: 'weekly',
    density: 'compact',
    palette: 'westpac',
    sections: [
      { type: 'weekly', variant: 'carousel' },
      { type: 'goal', variant: 'hero' },
      { type: 'bills', variant: 'list' },
      { type: 'pinned', variant: 'carousel' },
      { type: 'recent', count: 3 },
      { type: 'move', variant: 'button' },
    ],
  },
  // 10. Spending · Monthly — grid + stack mix
  {
    id: 'month-in-focus',
    name: 'Month in focus',
    title: 'Your month in focus',
    goal: 'spending',
    frequency: 'monthly',
    density: 'spacious',
    palette: 'plum',
    sections: [
      { type: 'netWorth' },
      { type: 'goal', variant: 'carousel' },
      { type: 'bills', variant: 'list' },
      { type: 'pinned', variant: 'grid' },
      { type: 'recent', count: 3 },
      { type: 'move', variant: 'slider' },
    ],
  },
];
