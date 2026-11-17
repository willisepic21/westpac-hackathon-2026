// Tools that let the AI assistant set up, change and delete Actions (money automations).
// Per ai_perms.md the AI only sets the rules: it sees account names and the existing rules, never balances
// or transactions, and nothing is saved until the user approves it on a card in the app.
// Pure JS (the store is passed in), so it can be tested in Node.
//
//   const { tools, context } = createActionTools({ getActions, propose, remove });

import { FREQUENCIES, KINDS, describeSchedule } from './rules.js';

/**
 * getActions()              -> Promise<{ accounts: [{ id, name }], actions: [{ id, description, ... }] }>
 * propose(input, { editId }) -> Promise<{ approved, message }>, resolved when the user taps Approve / Decline
 * remove(id)                -> Promise, deletes an action
 */
// Models send null for fields they don't use; drop them so an edit doesn't wipe the existing value.
const withoutNulls = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));

export function createActionTools({ getActions, propose, remove }) {
  const ruleParams = {
    kind: {
      type: 'string',
      enum: Object.keys(KINDS),
      description:
        'sweep = if the from account is over `threshold`, move the extra to the to account. ' +
        'top_up = if the to account is under `threshold`, top it up from the from account. ' +
        'transfer = move a fixed `amount` every time.',
    },
    from: { type: 'string', description: 'Account name the money comes out of, e.g. "Westpac Choice".' },
    to: { type: 'string', description: 'Account name the money goes into, e.g. "Westpac Life".' },
    // Optional fields allow null: Groq validates strictly, and models often send null for fields they don't use.
    threshold: {
      type: ['number', 'null'],
      description: 'Dollars. For sweep: balance to keep. For top_up: minimum balance. null for transfer.',
    },
    amount: { type: ['number', 'null'], description: 'Dollars, for transfer only. null otherwise.' },
    frequency: {
      type: ['string', 'null'],
      enum: [...FREQUENCIES, null],
      description: 'How often it checks / runs. Default weekly.',
    },
  };

  const outcome = ({ approved, message }, done) =>
    approved
      ? `${done} ${message}`
      : `Not saved: ${message} Nothing was set up or changed; tell the user and don't claim it was.`;

  const tools = [
    {
      name: 'create_action',
      description:
        'Set up a new money automation between the user\'s own accounts. The app shows it to the user to approve; ' +
        'this returns once they approve or decline. Only call this when the user asks for an automation.',
      parameters: { type: 'object', properties: ruleParams, required: ['kind', 'from', 'to'] },
      run: async (args) => outcome(await propose(withoutNulls(args), {}), 'The user approved it and it is saved.'),
    },
    {
      name: 'edit_action',
      description: 'Change an existing action (pass its id and only the fields that change). The user must approve.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer', description: 'Action id from the list.' }, ...ruleParams },
        required: ['id'],
      },
      run: async ({ id, ...changes }) => outcome(await propose(withoutNulls(changes), { editId: id }), 'The user approved the change.'),
    },
    {
      name: 'delete_action',
      description: 'Delete an action. Only call this when the user asks to delete or stop that automation.',
      parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
      run: async ({ id }) => {
        await remove(id);
        return `Action ${id} deleted.`;
      },
    },
  ];

  const context = async () => {
    let data;
    try {
      data = await getActions();
    } catch (e) {
      return `Actions (money automations) are unavailable right now: ${e.message}`;
    }
    const { accounts, actions } = data;
    return [
      'You can set up Actions: automatic transfers between the user\'s own accounts, e.g. "if Choice is over $500, ' +
        'move the extra to savings every week". Use create_action, edit_action and delete_action. You only set the ' +
        "rule; you can't see balances. Every new or changed action is shown to the user to approve, so after calling " +
        "the tool, say what the tool result says (approved or not). If the user's request is missing the accounts or " +
        'the dollar amount, ask for it first. Actions run at 9am; the user is alerted the day before and can skip, ' +
        'edit or delete it.',
      `The user's accounts (names only): ${accounts.map((a) => a.name).join(', ') || 'none'}`,
      actions.length
        ? `Their actions:\n${actions.map((a) => `- id ${a.id}: ${a.description} ${describeSchedule(a)}`).join('\n')}`
        : 'They have no actions yet.',
    ].join('\n');
  };

  return { tools, context };
}
