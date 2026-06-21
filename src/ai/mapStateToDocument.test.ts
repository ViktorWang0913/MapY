import { describe, expect, it } from 'vitest';
import { executeMapYCommand } from './executeCommand';
import { createEmptyMap } from './mapCommands';
import { mapStateToDocument } from './mapStateToDocument';
import { mockGenerateMapCommand } from './mockAi';

const CITY = 'Generate a city map with 2 zones. linear and S-like. Add 1 key and 2 bosses.';

describe('mapStateToDocument', () => {
  it('maps zones → scenes and objects → identifier instances', () => {
    const map = executeMapYCommand(mockGenerateMapCommand(CITY, createEmptyMap()), createEmptyMap());
    const doc = mapStateToDocument(map);

    expect(doc.scenes).toHaveLength(2);
    expect(doc.identifierInstances).toHaveLength(3); // 1 key + 2 bosses
    // a definition exists per used object type
    expect(doc.identifiers.some((d) => d.id === 'idef-key')).toBe(true);
    expect(doc.identifiers.some((d) => d.id === 'idef-boss')).toBe(true);
  });

  it('converts object coords to parent-scene-relative transforms', () => {
    const map = executeMapYCommand(mockGenerateMapCommand(CITY, createEmptyMap()), createEmptyMap());
    const doc = mapStateToDocument(map);

    const key = map.objects.find((o) => o.type === 'key')!;
    const zone = map.zones.find((z) => z.id === key.zoneId)!;
    const sceneNode = doc.scenes.find((s) => s.id === zone.id)!;
    const keyNode = doc.identifierInstances.find((n) => n.id === key.id)!;

    expect(keyNode.parentSceneId).toBe(sceneNode.id);
    expect(keyNode.transform.x).toBe(key.x - zone.x);
    expect(keyNode.transform.y).toBe(key.y - zone.y);
  });
});
