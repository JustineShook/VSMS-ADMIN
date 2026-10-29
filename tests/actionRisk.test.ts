import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/services/bookings.ts', import.meta.url)), 'utf8');
const start = source.indexOf('export function groupActionRiskEvents');
const end = source.indexOf('\nexport async function loadActionRiskQueue', start);
assert.ok(start >= 0 && end > start, 'the production action grouping function is available');
const module = { exports: {} as Record<string, unknown> };
const compiled = ts.transpile(source.slice(start, end), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
new Function('exports', compiled)(module.exports);
const groupActionRiskEvents = module.exports.groupActionRiskEvents as (events: ActionRiskEvent[]) => { id: string; eventType: string; count: number }[];

type ActionRiskEvent = {
  bookingId: string; actorId: string; actorName: string; role: 'owner' | 'onsite-mechanic';
  eventType: 'owner_cancel_after_acceptance' | 'provider_decline'; service: string; status: string; reason: string; eventAt: Date;
};

function event(bookingId: string, actorId: string, eventType: ActionRiskEvent['eventType'], offsetDays = 0): ActionRiskEvent {
  return {
    bookingId, actorId, eventType, actorName: actorId, role: eventType === 'provider_decline' ? 'onsite-mechanic' : 'owner',
    service: 'Onsite mechanic', status: eventType === 'provider_decline' ? 'rejected' : 'cancelled',
    reason: 'Recorded reason', eventAt: new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000),
  };
}

test('action review groups unique bookings by account and action type, and flags at four', () => {
  const rows = [
    event('o1', 'owner-1', 'owner_cancel_after_acceptance'),
    event('o2', 'owner-1', 'owner_cancel_after_acceptance'),
    event('o3', 'owner-1', 'owner_cancel_after_acceptance'),
    event('o4', 'owner-1', 'owner_cancel_after_acceptance'),
    event('o4', 'owner-1', 'owner_cancel_after_acceptance'),
    event('p1', 'provider-1', 'provider_decline'),
    event('p2', 'provider-1', 'provider_decline'),
    event('p3', 'provider-1', 'provider_decline'),
    event('p4', 'provider-1', 'provider_decline'),
    event('o5', 'owner-2', 'owner_cancel_after_acceptance'),
    event('o6', 'owner-2', 'owner_cancel_after_acceptance'),
    event('o7', 'owner-2', 'owner_cancel_after_acceptance'),
  ];
  const cases = groupActionRiskEvents(rows);
  assert.deepEqual(cases.map(item => `${item.id}:${item.eventType}:${item.count}`).sort(), [
    'owner-1:owner_cancel_after_acceptance:4',
    'provider-1:provider_decline:4',
  ]);
});
