import { describe, expect, it } from 'vitest';
import { executeMapYCommand } from './executeCommand';
import { createEmptyMap } from './mapCommands';
import { mockGenerateMapCommand } from './mockAi';

const CITY = 'Generate a city map with 2 zones. The first zone is linear. The second zone is S-like. Add 1 key and 2 bosses.';

describe('mockGenerateMapCommand', () => {
  it('test case 1: city → 2 zones, 1 key, 2 bosses', () => {
    const command = mockGenerateMapCommand(CITY, createEmptyMap());
    expect(command.type).toBe('CREATE_MAP');
    if (command.type !== 'CREATE_MAP') return;

    expect(command.payload.zones).toHaveLength(2);
    expect(command.payload.zones[0].topology).toBe('linear');
    expect(command.payload.zones[1].topology).toBe('s_like');

    const objects = command.payload.objects;
    expect(objects.filter((o) => o.type === 'key')).toHaveLength(1);
    expect(objects.filter((o) => o.type === 'boss')).toHaveLength(2);
  });

  it('test case 2: "move the key to the second zone" → UPDATE_OBJECT into zone_2', () => {
    // Arrange: start from the city map.
    let map = createEmptyMap();
    map = executeMapYCommand(mockGenerateMapCommand(CITY, map), map);
    const key = map.objects.find((o) => o.type === 'key');
    expect(key?.zoneId).toBe('zone_1');

    // Act
    const command = mockGenerateMapCommand('Move the key to the second zone.', map);
    expect(command.type).toBe('UPDATE_OBJECT');
    const next = executeMapYCommand(command, map);

    // Assert: key now belongs to zone_2 and sits inside its bounds.
    const movedKey = next.objects.find((o) => o.type === 'key');
    const zone2 = next.zones.find((z) => z.id === 'zone_2')!;
    expect(movedKey?.zoneId).toBe('zone_2');
    expect(movedKey!.x).toBeGreaterThanOrEqual(zone2.x);
    expect(movedKey!.x).toBeLessThanOrEqual(zone2.x + zone2.width);
  });

  it('falls back to a default CREATE_MAP for unrecognised input', () => {
    const command = mockGenerateMapCommand('hello there', createEmptyMap());
    expect(command.type).toBe('CREATE_MAP');
  });
});
