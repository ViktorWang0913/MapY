import { describe, expect, it } from 'vitest';
import {
  clampGridSize,
  createEmptyDocument,
  DEFAULT_GRID_SIZE,
  DOCUMENT_VERSION,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  normalizeDocument,
  serializeDocument
} from './document';

describe('clampGridSize', () => {
  it('clamps into [MIN, MAX] and rounds', () => {
    expect(clampGridSize(8)).toBe(8);
    expect(clampGridSize(0)).toBe(MIN_GRID_SIZE);
    expect(clampGridSize(9999)).toBe(MAX_GRID_SIZE);
    expect(clampGridSize(7.6)).toBe(8);
    expect(clampGridSize('nope')).toBe(DEFAULT_GRID_SIZE);
  });
});

describe('normalizeDocument grid size', () => {
  it('preserves a custom grid size for current-version documents (round-trip)', () => {
    const doc = createEmptyDocument('custom');
    const customized = { ...doc, settings: { gridSize: 16 } };
    const serialized = serializeDocument(customized); // includes version + settings
    const reloaded = normalizeDocument(JSON.parse(serialized));
    expect(reloaded.settings.gridSize).toBe(16);
  });

  it('clamps an out-of-range custom grid size', () => {
    const doc = { version: DOCUMENT_VERSION, name: 'x', settings: { gridSize: 999 }, scenes: [], structures: [] };
    expect(normalizeDocument(doc).settings.gridSize).toBe(MAX_GRID_SIZE);
  });

  it('forces default grid size for legacy/unversioned documents', () => {
    const legacy = { name: 'legacy', settings: { gridSize: 16 }, scenes: [] }; // no version field
    expect(normalizeDocument(legacy).settings.gridSize).toBe(DEFAULT_GRID_SIZE);
  });
});
