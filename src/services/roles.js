/**
 * Who can do what. One place, so the answer cannot drift between screens.
 *
 * These are UI gates. The real boundary is Postgres RLS + triggers, which key
 * on the server-side user_roles row via auth.uid() and fail closed on an
 * unknown role. These predicates exist so the interface shows only what the
 * database will actually allow — never more.
 *
 * Every predicate is written to FAIL CLOSED: an unrecognised role (null,
 * undefined, a typo, a role added server-side the client hasn't shipped yet)
 * returns false everywhere. Adding a privilege must be a deliberate act of
 * listing a role, never an accident of "not being on the deny list".
 */

// Roles that may edit project contents in the workbook.
const WORKBOOK_ROLES = new Set(['admin', 'manager', 'team_leader', 'designer']);
// Roles that may move a project's lifecycle and its dates.
const MANAGER_ROLES = new Set(['admin', 'manager', 'team_leader']);

/** May open the design workbook and save project contents. */
export const canUseWorkbook = (role) => WORKBOOK_ROLES.has(role);

/** May change status, edit the timeline, delete/restore, edit covers. */
export const isManagerLevel = (role) => MANAGER_ROLES.has(role);

/** Read-only: sees projects, opens nothing, changes nothing. */
export const isReadOnly = (role) => role === 'sales';

/** True only for a role the app actually knows — anything else is "no access". */
export const isKnownRole = (role) => WORKBOOK_ROLES.has(role) || role === 'sales';
