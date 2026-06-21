import { describe, expect, it } from 'vitest';
import { createEmptyMap, type MapState } from './mapCommands';
import { validateCommand } from './validateCommand';

const empty = createEmptyMap();

const validCreate = {
  type: 'CREATE_MAP',
  payload: {
    width: 1200,
    height: 800,
    zones: [{ id: 'zone_1', name: 'Z1', x: 0, y: 0, width: 400, height: 400, topology: 'linear' }],
    objects: [{ id: 'key_1', type: 'key', zoneId: 'zone_1', x: 100, y: 100 }]
  }
};

describe('validateCommand', () => {
  it('accepts a valid CREATE_MAP', () => {
    expect(validateCommand(validCreate, empty)).toEqual({ ok: true });
  });

  it('rejects unknown command type', () => {
    const result = validateCommand({ type: 'NUKE_MAP', payload: {} }, empty);
    expect(result.ok).toBe(false);
  });

  it('rejects negative dimensions', () => {
    const bad = { type: 'CREATE_MAP', payload: { ...validCreate.payload, width: -5 } };
    expect(validateCommand(bad, empty).ok).toBe(false);
  });

  it('rejects non-numeric coordinates', () => {
    const bad = {
      type: 'CREATE_MAP',
      payload: { ...validCreate.payload, objects: [{ id: 'o', type: 'key', x: 'NaN', y: 0 }] }
    };
    expect(validateCommand(bad, empty).ok).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const bad = {
      type: 'CREATE_MAP',
      payload: {
        width: 100,
        height: 100,
        zones: [{ id: 'dup', name: 'Z', x: 0, y: 0, width: 10, height: 10, topology: 'free' }],
        objects: [{ id: 'dup', type: 'key', x: 1, y: 1 }]
      }
    };
    const result = validateCommand(bad, empty);
    expect(result.ok).toBe(false);
  });

  it('rejects UPDATE_OBJECT for a missing id', () => {
    const map: MapState = { ...empty, objects: [{ id: 'key_1', type: 'key', x: 0, y: 0 }] };
    expect(validateCommand({ type: 'UPDATE_OBJECT', payload: { id: 'ghost', patch: {} } }, map).ok).toBe(false);
    expect(validateCommand({ type: 'UPDATE_OBJECT', payload: { id: 'key_1', patch: { x: 10 } } }, map).ok).toBe(true);
  });
});
