/**
 * Project lifecycle status.
 *
 * 'trashed' is deliberately not in this list: it is not a lifecycle state
 * someone picks, it is what trashProject() sets, and the trash view is the
 * only place it is ever shown. Keeping it out means a status <select> can
 * never be used to bin a project by accident, or to resurrect one without
 * going through restoreFromTrash().
 */
export const PROJECT_STATUSES = ['draft', 'active', 'completed'];

export const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  trashed: 'Trashed',
};

export const statusLabel = (status) => STATUS_LABELS[status] || status || 'Draft';

/**
 * Who may move a project through its lifecycle.
 *
 * This is the UI gate only. The database is the real boundary — a Postgres
 * RLS policy has to refuse a status write from anyone else, or a designer
 * can still change it by calling Supabase directly from the console.
 */
export function canChangeProjectStatus(role) {
  return role === 'admin' || role === 'manager' || role === 'team_leader';
}
