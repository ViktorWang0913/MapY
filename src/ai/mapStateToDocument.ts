// ── AI Map Command system → main editor bridge ──────────────────────────────
// Converts the AI feature's simple MapState into the editor's MapYDocument so the
// generated map is drawn on the REAL MapY Konva canvas:
//   zone   → scene
//   object → identifier instance (key/boss/enemy/item/npc), with a definition per type
// MapState ids are reused as node ids, so object.zoneId maps straight to parentSceneId.

import { createEmptyDocument } from '../model/document';
import type { IdentifierDefinition, MapYDocument, MapYNode, ShapeKind } from '../model/types';
import type { MapObjectType, MapState } from './mapCommands';

const OBJECT_DEF: Record<MapObjectType, { name: string; color: string; shape: ShapeKind }> = {
  key: { name: '钥匙', color: '#f3b33f', shape: 'diamond' },
  boss: { name: 'Boss', color: '#e85d75', shape: 'star' },
  enemy: { name: '敌人', color: '#c97bff', shape: 'triangle' },
  item: { name: '道具', color: '#63c7b2', shape: 'circle' },
  npc: { name: 'NPC', color: '#72d6ff', shape: 'circle' }
};

const MARKER_SIZE = 16;

export function mapStateToDocument(map: MapState): MapYDocument {
  const base = createEmptyDocument('AI 生成地图');
  const regionId = base.regions[0]?.id;

  // zone → scene (absolute transform)
  const scenes: MapYNode[] = map.zones.map((zone) => ({
    id: zone.id,
    type: 'scene',
    name: `${zone.name} · ${zone.topology}`,
    transform: { x: zone.x, y: zone.y, width: zone.width, height: zone.height, rotation: 0 },
    color: '#2d7dd2',
    opacity: 0.24,
    shape: 'rect',
    hasCollision: false,
    regionId
  }));

  // one identifier definition per object type actually used
  const usedTypes = [...new Set(map.objects.map((object) => object.type))];
  const identifiers: IdentifierDefinition[] = usedTypes.map((type) => ({
    id: `idef-${type}`,
    name: OBJECT_DEF[type].name,
    kind: type,
    color: OBJECT_DEF[type].color,
    shape: OBJECT_DEF[type].shape,
    visibleInWorld: true
  }));

  // object → identifier instance (transform is relative to its parent scene)
  const firstZone = map.zones[0];
  const identifierInstances: MapYNode[] = map.objects.map((object) => {
    const zone = map.zones.find((z) => z.id === object.zoneId) ?? firstZone;
    const def = OBJECT_DEF[object.type];
    const originX = zone ? zone.x : 0;
    const originY = zone ? zone.y : 0;
    return {
      id: object.id,
      type: 'identifier',
      name: object.id,
      transform: { x: object.x - originX, y: object.y - originY, width: MARKER_SIZE, height: MARKER_SIZE, rotation: 0 },
      color: def.color,
      shape: def.shape,
      hasCollision: false,
      parentSceneId: zone ? zone.id : undefined,
      identifierDefinitionId: `idef-${object.type}`
    };
  });

  return { ...base, name: 'AI 生成地图', scenes, identifiers, identifierInstances };
}
