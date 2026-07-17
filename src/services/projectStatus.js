/**
 * Project lifecycle status.
 *
 * 'trashed' is deliberately not in this list: it is not a lifecycle state
 * someone picks, it is what trashProject() sets, and the trash view is the
 * only place it is ever shown. Keeping it out means a status <select> can
 * never be used to bin a project by accident, or to resurrect one without
 * going through restoreFromTrash().
 *
 * There is no 'draft' — a project is 'active' the moment it is created (see
 * createProjectRecord in supabaseDb.js) and restoreFromTrash() returns it
 * to 'active' too. The database's project_status enum still contains the
 * legacy 'draft' / 'pending_approval' / 'approved' values from an earlier
 * workflow (Postgres cannot drop enum values), so statusLabel() below still
 * knows how to display them if an old row is ever seen — they are just not
 * offered as something to pick going forward.
 */
export const PROJECT_STATUSES = ['active', 'completed', 'archive'];

export const STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  archive: 'Archived',
  trashed: 'Trashed',
  // Legacy enum values, kept only so an old row never renders blank.
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
};

export const statusLabel = (status) => STATUS_LABELS[status] || status || 'Active';

/**
 * Who may move a project through its lifecycle.
 *
 * This is the UI gate only. The database is the real boundary — a Postgres
 * trigger has to refuse a status write from anyone else (RLS cannot see the
 * old row, so it cannot express "this column did not change" — see
 * supabase/migrations/20260717_project_status_rbac.sql), or a designer can
 * still change it by calling Supabase directly from the console.
 */
export function canChangeProjectStatus(role) {
  return role === 'admin' || role === 'manager' || role === 'team_leader';
}
