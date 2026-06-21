import { describe, expect, it } from 'vitest';
import { executeMapYCommand } from './executeCommand';
import { createEmptyMap, type MapState } from './mapCommands';

function sampleMap(): MapState {
  return {
    width: 1200,
    height: 800,
    zones: [{ id: 'zone_1', name: 'Z1', x: 0, y: 0, width: 400, height: 400, topology: 'linear' }],
    objects: [{ id: 'key_1', type: 'key', zoneId: 'zone_1', x: 100, y: 100 }]
  };
}

describe('executeMapYCommand', () => {
  it('CREATE_MAP replaces the whole map', () => {
    const next = executeMapYCommand(
      { type: 'CREATE_MAP', payload: sampleMap() },
      createEmptyMap()
    );
    expect(next.zones).toHaveLength(1);
    expect(next.objects[0].id).toBe('key_1');
  });

  it('does not mutate the original state', () => {
    const original = sampleMap();
    const snapshot = JSON.stringify(original);
    executeMapYCommand({ type: 'ADD_OBJECT', payload: { id: 'boss_1', type: 'boss', x: 10, y: 10 } }, original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('ADD_ZONE and ADD_OBJECT append', () => {
    let map = sampleMap();
    map = executeMapYCommand({ type: 'ADD_ZONE', payload: { id: 'zone_2', name: 'Z2', x: 500, y: 0, width: 400, height: 400, topology: 's_like' } }, map);
    map = executeMapYCommand({ type: 'ADD_OBJECT', payload: { id: 'boss_1', type: 'boss', zoneId: 'zone_2', x: 600, y: 100 } }, map);
    expect(map.zones).toHaveLength(2);
    expect(map.objects.map((o) => o.id)).toContain('boss_1');
  });

  it('UPDATE_OBJECT patches an object by id', () => {
    const next = executeMapYCommand({ type: 'UPDATE_OBJECT', payload: { id: 'key_1', patch: { zoneId: 'zone_2', x: 700 } } }, sampleMap());
    expect(next.objects[0].zoneId).toBe('zone_2');
    expect(next.objects[0].x).toBe(700);
  });

  it('DELETE_OBJECT removes by id', () => {
    const next = executeMapYCommand({ type: 'DELETE_OBJECT', payload: { id: 'key_1' } }, sampleMap());
    expect(next.objects).toHaveLength(0);
  });
});
