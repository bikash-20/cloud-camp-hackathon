/**
 * Typed localStorage wrapper.
 *
 * Every key is namespaced under `nv_` (NutriVision) to avoid collisions.
 * Values are JSON-serialized. Reads return `null` when the key is missing
 * or the stored JSON is corrupt.
 */

const PREFIX = 'nv_';

function key(k: string): string {
  return `${PREFIX}${k}`;
}

export function load<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(key(k));
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function save<T>(k: string, value: T): void {
  try {
    localStorage.setItem(key(k), JSON.stringify(value));
  } catch {
    // Storage full or blocked — silently ignore in demo.
  }
}

export function remove(k: string): void {
  localStorage.removeItem(key(k));
}

/**
 * Convenience: load or return a default, then always save the default back
 * so the next read is guaranteed to have a value.
 */
export function loadOrDefault<T>(k: string, fallback: T): T {
  return load<T>(k) ?? fallback;
}
