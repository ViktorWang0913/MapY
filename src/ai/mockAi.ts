// ── AI Map Command system: MOCK generator ───────────────────────────────────
// A deterministic stand-in for a real LLM. Pattern-matches a few phrases so the
// two required test cases work. Replace via aiClient.generateMapCommand later.

import type { MapObject, MapState, MapYCommand, MapZone } from './mapCommands';

function includesAll(text: string, words: string[]): boolean {
  return words.every((word) => text.includes(word));
}

/** Center point of a zone (fallback to map center). */
function zoneCenter(map: MapState, zoneId: string): { x: number; y: number } {
  const zone = map.zones.find((z) => z.id === zoneId);
  if (!zone) return { x: map.width / 2, y: map.height / 2 };
  return { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
}

/** The canonical "city with 2 zones" map from the spec example. */
function cityMapCommand(): MapYCommand {
  const zones: MapZone[] = [
    { id: 'zone_1', name: 'Linear Zone', x: 80, y: 100, width: 450, height: 500, topology: 'linear' },
    { id: 'zone_2', name: 'S-like Zone', x: 620, y: 100, width: 500, height: 500, topology: 's_like' }
  ];
  const objects: MapObject[] = [
    // Key placed in the linear zone first (keys before bosses).
    { id: 'key_1', type: 'key', zoneId: 'zone_1', x: 300, y: 300 },
    // Two bosses in the S-like zone, alternating x to suggest an S progression.
    { id: 'boss_1', type: 'boss', zoneId: 'zone_2', x: 760, y: 250 },
    { id: 'boss_2', type: 'boss', zoneId: 'zone_2', x: 980, y: 480 }
  ];
  return { type: 'CREATE_MAP', payload: { width: 1200, height: 800, zones, objects } };
}

/** A minimal default map for unrecognised instructions. */
function defaultMapCommand(): MapYCommand {
  return {
    type: 'CREATE_MAP',
    payload: {
      width: 1200,
      height: 800,
      zones: [{ id: 'zone_1', name: 'Zone 1', x: 100, y: 100, width: 600, height: 600, topology: 'free' }],
      objects: [{ id: 'item_1', type: 'item', zoneId: 'zone_1', x: 400, y: 400 }]
    }
  };
}

export function mockGenerateMapCommand(message: string, currentMap: MapState): MapYCommand {
  const text = message.toLowerCase();

  // Edit case: "Move the key to the second zone."
  const wantsMoveKey = text.includes('key') && (text.includes('move') || text.includes('移'));
  const wantsSecondZone =
    text.includes('second zone') || text.includes('zone 2') || text.includes('zone_2') || text.includes('第二');
  if (wantsMoveKey && wantsSecondZone) {
    const key = currentMap.objects.find((object) => object.type === 'key');
    if (key) {
      const center = zoneCenter(currentMap, 'zone_2');
      return { type: 'UPDATE_OBJECT', payload: { id: key.id, patch: { zoneId: 'zone_2', x: center.x, y: center.y } } };
    }
  }

  // Generate case: city / 2 zones / linear / S-like.
  const wantsCity =
    text.includes('city') ||
    text.includes('城市') ||
    includesAll(text, ['2', 'zone']) ||
    (text.includes('linear') && (text.includes('s-like') || text.includes('s_like') || text.includes('s like')));
  if (wantsCity) {
    return cityMapCommand();
  }

  return defaultMapCommand();
}
