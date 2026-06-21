// ── AI Map Command system: executor ─────────────────────────────────────────
// Pure, immutable application of a MapYCommand onto a MapState.
// Never mutates the input; always returns a new MapState.

import type { MapState, MapYCommand } from './mapCommands';

export function executeMapYCommand(command: MapYCommand, currentMap: MapState): MapState {
  switch (command.type) {
    case 'CREATE_MAP': {
      // Replace the whole map (deep-ish copy of arrays so callers can't alias).
      const next = command.payload;
      return {
        width: next.width,
        height: next.height,
        zones: next.zones.map((zone) => ({ ...zone })),
        objects: next.objects.map((object) => ({ ...object }))
      };
    }

    case 'ADD_ZONE':
      return { ...currentMap, zones: [...currentMap.zones, { ...command.payload }] };

    case 'ADD_OBJECT':
      return { ...currentMap, objects: [...currentMap.objects, { ...command.payload }] };

    case 'UPDATE_OBJECT': {
      const { id, patch } = command.payload;
      return {
        ...currentMap,
        zones: currentMap.zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)),
        objects: currentMap.objects.map((object) => (object.id === id ? { ...object, ...patch } : object))
      };
    }

    case 'DELETE_OBJECT': {
      const { id } = command.payload;
      return {
        ...currentMap,
        zones: currentMap.zones.filter((zone) => zone.id !== id),
        objects: currentMap.objects.filter((object) => object.id !== id)
      };
    }

    default: {
      // Exhaustiveness guard: unknown command types leave the map untouched.
      return currentMap;
    }
  }
}
