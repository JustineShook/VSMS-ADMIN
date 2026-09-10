import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCredentials } from '../src/lib/validation.ts';

test('registration rejects missing fields, weak passwords and mismatches', () => {
  const errors = validateCredentials({ name: '', email: 'invalid', password: 'short', confirmPassword: 'different' }, true);
  assert.deepEqual(Object.keys(errors), ['name', 'email', 'password', 'confirmPassword']);
});
test('valid registration trims names/email but preserves password whitespace', () => {
  assert.deepEqual(validateCredentials({ name: ' Staff Member ', email: ' staff@example.com ', password: ' example123 ', confirmPassword: ' example123 ' }, true), {});
  assert.ok(validateCredentials({ name: 'Staff Member', email: 'staff@example.com', password: ' example123 ', confirmPassword: 'example123' }, true).confirmPassword);
});
test('login accepts existing mobile passwords shorter than the new signup minimum', () => {
  assert.deepEqual(validateCredentials({ name: '', email: 'staff@example.com', password: '123456', confirmPassword: '' }, false), {});
});
