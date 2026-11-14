/*
 * LocalStorage helpers. Every read and write is wrapped in try/catch because
 * storage can be full, disabled (private mode) or contain corrupt data.
 * Functions return { ok, value, error } instead of throwing.
 */

const KEYS = {
  workload: 'disklab.workload',
  history: 'disklab.history',
  savedWorkloads: 'disklab.savedWorkloads',
};
const MAX_HISTORY = 100;

function readJson(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    if (text === null) return { ok: true, value: fallback };
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, value: fallback, error: `Could not read saved data (${error.name}).` };
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    const reason = error.name === 'QuotaExceededError' ? 'browser storage is full' : 'browser storage is not available';
    return { ok: false, error: `Could not save: ${reason}.` };
  }
}

/* Current workload shared between pages */
export const loadCurrentWorkload = () => readJson(KEYS.workload, null);
export const saveCurrentWorkload = (workload) => writeJson(KEYS.workload, workload);

/* Simulation history */
export function listHistory() {
  const result = readJson(KEYS.history, []);
  if (!Array.isArray(result.value)) return { ok: false, value: [], error: 'Saved history was not in the expected format.' };
  return result;
}

export function addHistory(entry) {
  const { value: list } = listHistory();
  const id = `h${Date.now()}`;
  const record = { id, date: new Date().toISOString(), ...entry };
  const saved = writeJson(KEYS.history, [record, ...list].slice(0, MAX_HISTORY));
  return saved.ok ? { ok: true, value: record } : saved;
}

export function getHistory(id) {
  return listHistory().value.find((item) => item.id === id) || null;
}

export function deleteHistory(id) {
  const { value: list } = listHistory();
  return writeJson(KEYS.history, list.filter((item) => item.id !== id));
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEYS.history);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Could not clear history.' };
  }
}

/* Named workloads saved from the Workload Studio */
export const listSavedWorkloads = () => readJson(KEYS.savedWorkloads, []);

export function saveNamedWorkload(name, workload) {
  const { value: list } = listSavedWorkloads();
  const entry = { id: `w${Date.now()}`, name, savedAt: new Date().toISOString(), workload };
  return writeJson(KEYS.savedWorkloads, [entry, ...list].slice(0, 30));
}

export function deleteNamedWorkload(id) {
  const { value: list } = listSavedWorkloads();
  return writeJson(KEYS.savedWorkloads, list.filter((item) => item.id !== id));
}
