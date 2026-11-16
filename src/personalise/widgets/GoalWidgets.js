// Money-goal widgets (question 1):
//   house    → save tracker
//   debt     → debt fulfilled bar
//   spending → daily spending gauge
// Each comes in three variants: hero (one big card), carousel (swipe row), mini (one line).

import React from 'react';
import { View } from 'react-native';

import { Section, Card, Carousel, Bar, Gauge, T, formatMoney, useHomeStyle } from '../ui';
import { GOALS, WEEKLY } from '../mockData';

const money = (n) => formatMoney(n, { cents: false });

// ---------- Main cards (used by hero + carousel) ----------

function HouseCard() {
  const { saved, target, account } = GOALS.house;
  const pct = saved / target;
  return (
    <Card tone="hero">
      <T on="hero" bold>Your first home</T>
      <T v="hero" on="hero" style={{ marginTop: 8 }}>{money(saved)}</T>
      <T v="small" on="hero" muted>saved of {money(target)}</T>
      <Bar value={pct} on="hero" style={{ marginTop: 14 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <T v="small" on="hero" bold>{Math.round(pct * 100)}% there</T>
        <T v="small" on="hero" muted>{money(target - saved)} to go</T>
      </View>
      <T v="small" on="hero" muted style={{ marginTop: 10 }}>{account}</T>
    </Card>
  );
}

function DebtCard() {
  const { paid, total } = GOALS.debt;
  const pct = paid / total;
  return (
    <Card tone="hero">
      <T on="hero" bold>Your debt-free progress</T>
      <T v="big" on="hero" style={{ marginTop: 8 }}>{Math.round(pct * 100)}% paid off</T>
      <Bar value={pct} on="hero" style={{ marginTop: 12 }} />
      <T v="small" on="hero" muted style={{ marginTop: 8 }}>
        {money(paid)} paid of {money(total)}
      </T>
      <T v="small" on="hero" bold style={{ marginTop: 4 }}>{money(total - paid)} remaining</T>
    </Card>
  );
}

// Bar version (for carousels, matches the Figma "Today" card)
function SpendingTodayCard() {
  const { spentToday, dailyBudget } = GOALS.spending;
  return (
    <Card tone="hero">
      <T v="small" on="hero" muted>Today</T>
      <T v="hero" on="hero" style={{ marginTop: 6 }}>{money(spentToday)}</T>
      <T v="small" on="hero" muted>of {money(dailyBudget)} daily budget</T>
      <Bar value={spentToday / dailyBudget} on="hero" style={{ marginTop: 12 }} />
      <T v="small" on="hero" bold style={{ marginTop: 8 }}>{money(dailyBudget - spentToday)} left today</T>
    </Card>
  );
}

// Gauge version (hero variant)
function SpendingGaugeCard() {
  const { d } = useHomeStyle();
  const { spentToday, dailyBudget } = GOALS.spending;
  return (
    <Card tone="hero" style={{ alignItems: 'center' }}>
      <T on="hero" bold style={{ alignSelf: 'flex-start' }}>Daily spending</T>
      <View style={{ marginTop: d.gap }}>
        <Gauge value={spentToday / dailyBudget} size={d.hero * 6.4} on="hero">
          <T v="hero" on="hero">{money(spentToday)}</T>
          <T v="small" on="hero" muted>of {money(dailyBudget)} today</T>
        </Gauge>
      </View>
      <T on="hero" bold style={{ marginTop: d.gap }}>{money(dailyBudget - spentToday)} left to spend today</T>
    </Card>
  );
}

// ---------- Supporting cards (carousel extras) ----------

function FactCard({ label, value, note, bar }) {
  return (
    <Card tone="soft" style={{ flex: 1 }}>
      <T v="small" muted>{label}</T>
      <T v="big" style={{ marginTop: 6 }}>{value}</T>
      {bar != null ? <Bar value={bar} style={{ marginTop: 10 }} /> : null}
      {note ? <T v="small" muted style={{ marginTop: 8 }}>{note}</T> : null}
    </Card>
  );
}

function supportingCards(goal, weeklyTracker) {
  if (goal === 'house') {
    const { saved, target, weeklyDeposit } = GOALS.house;
    const weeks = Math.ceil((target - saved) / weeklyDeposit);
    return [
      <FactCard key="pace" label="At your current pace" value={`${weeks} weeks`} note={`Saving ${money(weeklyDeposit)} a week`} />,
      <FactCard key="last" label="Last deposit" value={money(weeklyDeposit)} note="Monday · from Everyday" />,
    ];
  }
  if (goal === 'debt') {
    const { nextPayment, nextDate, interestSaved } = GOALS.debt;
    return [
      <FactCard key="next" label="Next payment" value={money(nextPayment)} note={`Due ${nextDate}`} />,
      <FactCard key="saved" label="Interest saved" value={money(interestSaved)} note="This year, by paying extra" />,
    ];
  }
  const { spentMonth, monthlyBudget } = GOALS.spending;
  return [
    weeklyTracker ? (
      <FactCard
        key="week"
        label="This week"
        value={money(WEEKLY.spent)}
        bar={WEEKLY.spent / WEEKLY.budget}
        note={`of ${money(WEEKLY.budget)} weekly budget`}
      />
    ) : null,
    <FactCard
      key="month"
      label="This month"
      value={money(spentMonth)}
      bar={spentMonth / monthlyBudget}
      note={`of ${money(monthlyBudget)} monthly budget`}
    />,
  ];
}

const MAIN = { house: HouseCard, debt: DebtCard, spending: SpendingTodayCard };
const TITLE = { house: 'Your home goal', debt: 'Debt payoff', spending: 'Spending' };

// ---------- Section ----------

export default function GoalSection({ section, home }) {
  const { goal, weeklyTracker } = home;
  const Main = MAIN[goal] ?? SpendingTodayCard;

  if (section.variant === 'carousel') {
    return (
      <Section title={section.title ?? TITLE[goal]} action="Swipe →" bleed>
        <Carousel>
          <Main />
          {supportingCards(goal, weeklyTracker)}
        </Carousel>
      </Section>
    );
  }

  if (section.variant === 'mini') {
    const [label, pct] =
      goal === 'house'
        ? ['Home deposit', GOALS.house.saved / GOALS.house.target]
        : goal === 'debt'
          ? ['Debt paid off', GOALS.debt.paid / GOALS.debt.total]
          : ['Spent today', GOALS.spending.spentToday / GOALS.spending.dailyBudget];
    return (
      <Section title={section.title ?? 'Your goal'}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T bold>{label}</T>
            <T bold>{Math.round(pct * 100)}%</T>
          </View>
          <Bar value={pct} style={{ marginTop: 10 }} />
        </Card>
      </Section>
    );
  }

  // hero
  return (
    <Section title={section.title}>
      {goal === 'spending' ? <SpendingGaugeCard /> : <Main />}
    </Section>
  );
}
