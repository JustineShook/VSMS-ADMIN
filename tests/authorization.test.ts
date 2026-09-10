import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAdminClaim } from '../src/lib/authorization.ts';

test('only a strict boolean admin claim grants access', () => {
  assert.equal(hasAdminClaim({ admin: true }), true);
  for (const claims of [{}, { admin: false }, { admin: 'true' }, { admin: 1 }, { role: 'admin' }, { admin: null }, { role: 'owner' }]) {
    assert.equal(hasAdminClaim(claims), false);
  }
});
