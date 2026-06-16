import { describe, expect, it } from 'vitest';
import { addNode, createDefaultNode, createEmptyDocument, normalizeDocument, serializeDocument } from './document';

describe('document serialization', () => {
  it('exports and imports a v1 MapY document', () => {
    const scene = createDefaultNode('scene', 1, { x: 0, y: 0, width: 384, height: 256, rotation: 0 });
    const original = addNode(createEmptyDocument('测试地图'), scene);
    const imported = normalizeDocument(JSON.parse(serializeDocument(original)));

    expect(imported.version).toBe(8);
    expect(imported.name).toBe('测试地图');
    expect(imported.settings.gridSize).toBe(32);
    expect(imported.scenes).toHaveLength(1);
    expect(imported.scenes[0].tiles).toBeUndefined();
    expect(imported.structures).toEqual([]);
    expect(imported.identifiers).toEqual([]);
    expect(imported.identifierInstances).toEqual([]);
    expect(imported.doors).toEqual([]);
    expect(imported.assets).toEqual([]);
    expect(imported.regions.length).toBeGreaterThan(0);
    expect(imported.stitching).toEqual({ anchors: [], edges: [] });
  });

  it('normalizes missing optional arrays', () => {
    const imported = normalizeDocument({ name: '旧文件', scenes: [] });

    expect(imported.structures).toEqual([]);
    expect(imported.identifiers).toEqual([]);
    expect(imported.identifierInstances).toEqual([]);
    expect(imported.doors).toEqual([]);
    expect(imported.annotations).toEqual([]);
    expect(imported.assets).toEqual([]);
    expect(imported.regions.length).toBeGreaterThan(0);
  });

  it('migrates legacy scene tiles and legacy item collections', () => {
    const imported = normalizeDocument({
      name: 'Legacy',
      settings: { gridSize: 32 },
      scenes: [
        {
          id: 'scene-a',
          type: 'scene',
          name: '旧地图',
          transform: { x: 0, y: 0, width: 32, height: 32, rotation: 0 },
          tiles: [
            { x: 2, y: 1 },
            { x: 3, y: 2 }
          ]
        }
      ],
      items: [
        {
          id: 'item-a',
          type: 'item',
          name: '旧道具',
          transform: { x: 32, y: 32, width: 32, height: 32, rotation: 0 },
          parentSceneId: 'scene-a'
        }
      ],
      savePoints: [],
      markers: []
    });

    expect(imported.scenes[0].transform).toMatchObject({ x: 64, y: 32, width: 64, height: 64 });
    expect(imported.scenes[0].tiles).toBeUndefined();
    expect(imported.identifiers.some((definition) => definition.id === 'identifier-item')).toBe(true);
    expect(imported.identifierInstances).toHaveLength(1);
    expect(imported.identifierInstances[0]).toMatchObject({
      type: 'identifier',
      identifierDefinitionId: 'identifier-item',
      name: '旧道具'
    });

    const serialized = JSON.parse(serializeDocument(imported));
    expect(serialized.items).toBeUndefined();
    expect(serialized.savePoints).toBeUndefined();
    expect(serialized.markers).toBeUndefined();
  });
});
