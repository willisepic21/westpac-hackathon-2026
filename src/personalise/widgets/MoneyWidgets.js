// Account, activity and overview widgets:
//   PinnedSection  (Q3: pinned + joint accounts)  carousel | grid | list
//   TilesSection   two small tiles
//   WeeklySection  (Q4: weekly spend gauge)       card | carousel | bars
//   RecentSection  recent transactions
//   BillsSection   upcoming bills                 hero | list
//   NetWorthSection, TotalSection
// Accounts, transactions, spending and net worth come from the database (useBankData); bills and budgets are
// still mock data (see bankData.js).

import React from 'react';
import { View } from 'react-native';

import { Section, Card, Carousel, Bar, Row, T, formatMoney, useHomeStyle } from '../ui';
import { useBankData } from '../store';

const money = (n) => formatMoney(n, { cents: false });

// ---------- Pinned accounts ----------

function AccountCard({ account, wide }) {
  const { theme } = useHomeStyle();
  return (
    <Card style={wide ? null : { flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <T bold>{account.name}</T>
        {wide ? <T v="big">{formatMoney(account.balance)}</T> : null}
      </View>
      {!wide ? <T v="big" style={{ marginTop: 8 }}>{formatMoney(account.balance)}</T> : null}
      <T v="small" muted style={{ marginTop: 4 }}>
        {[
          account.joint ? 'Joint' : null,
          account.number,
          account.available != null && account.available !== account.balance ? `${money(account.available)} avail` : null,
        ]
          .filter(Boolean)
          .join(' · ') || ' '}
      </T>
      {wide && account.note ? (
        <T v="small" color={theme.muted} style={{ marginTop: 10 }}>{account.note}</T>
      ) : null}
    </Card>
  );
}

export function PinnedSection({ section, home }) {
  const { d } = useHomeStyle();
  const { ACCOUNTS } = useBankData();
  const accounts = home.pinned.map((id) => ACCOUNTS[id]).filter(Boolean);
  const title = section.title ?? 'Pinned accounts';

  if (section.variant === 'carousel' && accounts.length > 1) {
    return (
      <Section title={title} action="Manage" bleed>
        <Carousel widthRatio={0.56}>
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </Carousel>
      </Section>
    );
  }

  if (section.variant === 'grid') {
    return (
      <Section title={title} action="Manage">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: d.gap }}>
          {accounts.map((a) => (
            <View key={a.id} style={{ width: accounts.length === 1 ? '100%' : '48%', flexGrow: 1 }}>
              <AccountCard account={a} />
            </View>
          ))}
        </View>
      </Section>
    );
  }

  // list (also the fallback for a single account)
  return (
    <Section title={title} action="Manage">
      <View style={{ gap: d.gap }}>
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} wide />
        ))}
      </View>
    </Section>
  );
}

// ---------- Two small tiles ----------

export function TilesSection({ home }) {
  const { d } = useHomeStyle();
  const { ACCOUNTS, GOALS } = useBankData();
  const first = ACCOUNTS[home.pinned[0]] ?? ACCOUNTS.everyday ?? Object.values(ACCOUNTS)[0];
  const fact =
    home.goal === 'debt'
      ? { label: 'Next payment', value: money(GOALS.debt.nextPayment), note: `Due ${GOALS.debt.nextDate}` }
      : home.goal === 'house'
        ? { label: 'Next deposit', value: money(GOALS.house.weeklyDeposit), note: 'Friday · automatic' }
        : {
            label: 'Left today',
            value: money(GOALS.spending.dailyBudget - GOALS.spending.spentToday),
            note: `of ${money(GOALS.spending.dailyBudget)}`,
          };
  return (
    <Section>
      <View style={{ flexDirection: 'row', gap: d.gap }}>
        {first ? (
          <Card style={{ flex: 1 }}>
            <T v="small" muted>{first.name}</T>
            <T v="big" style={{ marginTop: 6 }}>{formatMoney(first.balance)}</T>
            <T v="small" muted style={{ marginTop: 4 }}>{first.number ?? 'Pinned account'}</T>
          </Card>
        ) : null}
        <Card style={{ flex: 1 }}>
          <T v="small" muted>{fact.label}</T>
          <T v="big" style={{ marginTop: 6 }}>{fact.value}</T>
          <T v="small" muted style={{ marginTop: 4 }}>{fact.note}</T>
        </Card>
      </View>
    </Section>
  );
}

// ---------- Weekly spend gauge ----------

function WeeklyCard() {
  const { spent, budget, resetDay } = useBankData().WEEKLY;
  return (
    <Card tone="soft">
      <T bold>Weekly spending</T>
      <T v="hero" style={{ marginTop: 6 }}>{money(spent)}</T>
      <T v="small" muted>of {money(budget)} weekly budget</T>
      <Bar value={spent / budget} style={{ marginTop: 12 }} />
      <T v="small" bold style={{ marginTop: 8 }}>{money(budget - spent)} left until {resetDay}</T>
    </Card>
  );
}

function BarRow({ label, spent, budget, note }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <T bold>{label}</T>
        <T bold>{money(spent)} / {money(budget)}</T>
      </View>
      <Bar value={spent / budget} />
      <T v="small" muted style={{ marginTop: 4 }}>{note}</T>
    </View>
  );
}

export function WeeklySection({ section }) {
  const { GOALS, WEEKLY } = useBankData();
  if (section.variant === 'bars') {
    const { spentToday, dailyBudget } = GOALS.spending;
    return (
      <Section title={section.title ?? 'Keep spending in check'}>
        <BarRow label="Today" spent={spentToday} budget={dailyBudget} note={`${money(dailyBudget - spentToday)} left today`} />
        <BarRow label="This week" spent={WEEKLY.spent} budget={WEEKLY.budget} note={`${money(WEEKLY.budget - WEEKLY.spent)} left this week`} />
      </Section>
    );
  }

  if (section.variant === 'carousel') {
    return (
      <Section title={section.title ?? 'Your week'} action="Swipe →" bleed>
        <Carousel>
          <WeeklyCard />
          {WEEKLY.categories.map((c) => (
            <Card key={c.name} tone="surface">
              <T v="small" muted>{c.name}</T>
              <T v="big" style={{ marginTop: 6 }}>{money(c.amount)}</T>
              <T v="small" muted style={{ marginTop: 8 }}>{c.note}</T>
            </Card>
          ))}
        </Carousel>
      </Section>
    );
  }

  return (
    <Section title={section.title ?? 'Your week'}>
      <WeeklyCard />
    </Section>
  );
}

// ---------- Recent transactions ----------

export function RecentSection({ section }) {
  const items = useBankData().TRANSACTIONS.slice(0, section.count ?? 3);
  return (
    <Section title={section.title ?? 'Recent transactions'} action="View all">
      {items.map((t, i) => (
        <Row
          key={t.id}
          title={t.name}
          subtitle={`${t.when} · ${t.category}`}
          value={formatMoney(t.amount, { sign: true })}
          divider={i > 0}
        />
      ))}
    </Section>
  );
}

// ---------- Bills ----------

export function BillsSection({ section }) {
  const { BILLS } = useBankData();
  const total = BILLS.items.reduce((sum, b) => sum + b.amount, 0);

  if (section.variant === 'hero') {
    return (
      <Section>
        <Card tone="hero">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T on="hero" bold>Bills still to come</T>
            <T v="big" on="hero">{money(total)}</T>
          </View>
          <T v="small" on="hero" muted style={{ marginBottom: 6 }}>
            {BILLS.items.length} payments · {BILLS.month}
          </T>
          {BILLS.items.map((b, i) => (
            <Row key={b.id} on="hero" title={b.name} subtitle={b.date} value={formatMoney(b.amount)} divider={i > 0} />
          ))}
        </Card>
      </Section>
    );
  }

  return (
    <Section title={section.title ?? 'Upcoming bills'} action={`${money(total)} total`}>
      {BILLS.items.map((b, i) => (
        <Row key={b.id} title={b.name} subtitle={b.date} value={formatMoney(b.amount)} divider={i > 0} />
      ))}
    </Section>
  );
}

// ---------- Net worth + total ----------

export function NetWorthSection() {
  const { theme } = useHomeStyle();
  const { assets, debt, changeThisMonth } = useBankData().NET_WORTH;
  return (
    <Section>
      <T v="small" muted>Your net worth</T>
      <T v="hero" style={{ marginTop: 4 }}>{formatMoney(assets - debt)}</T>
      <T v="small" bold color={theme.link} style={{ marginTop: 2 }}>
        {formatMoney(changeThisMonth, { sign: true })} this month
      </T>
      <View style={{ flexDirection: 'row', gap: 40, marginTop: 12 }}>
        <View>
          <T v="small" muted>Assets</T>
          <T bold>{formatMoney(assets)}</T>
        </View>
        <View>
          <T v="small" muted>Debt</T>
          <T bold>{formatMoney(debt)}</T>
        </View>
      </View>
    </Section>
  );
}

export function TotalSection() {
  const { theme } = useHomeStyle();
  const total = useBankData().TOTAL_AVAILABLE;
  return (
    <Section>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <T v="small" muted>Total available</T>
          <T v="big">{formatMoney(total)}</T>
        </View>
        <T v="small" bold color={theme.link}>Accounts →</T>
      </View>
    </Section>
  );
}
