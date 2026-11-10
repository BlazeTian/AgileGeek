/** A JSON value, as the protocol carries it. */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/** Reads `value` as an object, or an empty one. */
export function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

/** Reads `value` as an array, or an empty one. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Reads `value` as a string, or null. */
export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Reads `value` as a number, or null. The protocol sometimes sends numbers as strings. */
export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
