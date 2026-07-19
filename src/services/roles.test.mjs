/**
 * roles.js — the UI permission predicates. The load-bearing property is that
 * they FAIL CLOSED: any role the app does not explicitly recognise gets
 * nothing. A regression here would hand privileges to an unknown/failed-lookup
 * role, which is exactly the bug this module was created to fix.
 *
 * Run: node --test src/services/roles.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canUseWorkbook, isKnownRole, isManagerLevel, isReadOnly } from './roles.js';

// Everything that is NOT a real role must be denied by every predicate.
const UNKNOWN = [null, undefined, '', 'DESIGNER', 'Admin', 'root', 'superuser', 'guest', 'viewer', 0, false, {}, 'designer '];

test('canUseWorkbook: exactly the writing roles, nothing else', () => {
  for (const r of ['admin', 'manager', 'team_leader', 'designer']) {
    assert.equal(canUseWorkbook(r), true, `${r} may use the workbook`);
  }
  assert.equal(canUseWorkbook('sales'), false, 'sales may not — it is read-only');
  for (const r of UNKNOWN) assert.equal(canUseWorkbook(r), false, `${JSON.stringify(r)} is denied`);
});

test('isManagerLevel: admin/manager/team_leader only', () => {
  for (const r of ['admin', 'manager', 'team_leader']) assert.equal(isManagerLevel(r), true);
  for (const r of ['designer', 'sales', ...UNKNOWN]) assert.equal(isManagerLevel(r), false, `${JSON.stringify(r)} is not manager-level`);
});

test('isReadOnly: sales, and only sales', () => {
  assert.equal(isReadOnly('sales'), true);
  for (const r of ['admin', 'manager', 'team_leader', 'designer', ...UNKNOWN]) {
    assert.equal(isReadOnly(r), false, `${JSON.stringify(r)} is not the read-only role`);
  }
});

test('isKnownRole: true for the five real roles, false for anything else', () => {
  for (const r of ['admin', 'manager', 'team_leader', 'designer', 'sales']) {
    assert.equal(isKnownRole(r), true, `${r} is a known role`);
  }
  for (const r of UNKNOWN) assert.equal(isKnownRole(r), false, `${JSON.stringify(r)} is unknown → no access`);
});

test('the fail-closed contract: a null role (a failed lookup) can do NOTHING', () => {
  // This is the whole point. getUserProfile now returns role:null on any
  // error, and null must reach no privilege anywhere.
  assert.equal(canUseWorkbook(null), false);
  assert.equal(isManagerLevel(null), false);
  assert.equal(isReadOnly(null), false);
  assert.equal(isKnownRole(null), false);
});
