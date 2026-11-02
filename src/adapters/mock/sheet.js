// Mock spreadsheet adapter.
// Stands in for Google Sheets. Rows are kept in memory.

const state = { rows: [] };

export async function appendRow(row) {
  if (!row || typeof row !== 'object') return { error: 'row must be an object' };
  state.rows.push({ ...row, loggedAt: new Date().toISOString() });
  console.log(`[ADAPTER:sheet] appendRow (${state.rows.length} total)`);
  return { appended: true, count: state.rows.length };
}

export async function listRows() {
  return { rows: state.rows };
}

export function __reset() {
  state.rows = [];
}
