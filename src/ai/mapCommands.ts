// ── AI Map Command system: shared types ─────────────────────────────────────
// A deliberately SIMPLE, self-contained map model for the first AI test version.
// This is intentionally separate from the main editor's MapYDocument model so the
// whole feature can be inspected — or removed — without touching the core editor.

export type ZoneTopology = 'linear' | 's_like' | 'grid' | 'hub' | 'free';

export type MapObjectType = 'key' | 'boss' | 'enemy' | 'item' | 'npc';

export interface MapZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  topology: ZoneTopology;
}

export interface MapObject {
  id: string;
  type: MapObjectType;
  zoneId?: string;
  x: number;
  y: number;
}

export interface MapState {
  width: number;
  height: number;
  zones: MapZone[];
  objects: MapObject[];
}

export type MapYCommand =
  | { type: 'CREATE_MAP'; payload: MapState }
  | { type: 'ADD_ZONE'; payload: MapZone }
  | { type: 'ADD_OBJECT'; payload: MapObject }
  | { type: 'UPDATE_OBJECT'; payload: { id: string; patch: Partial<MapObject & MapZone> } }
  | { type: 'DELETE_OBJECT'; payload: { id: string } };

export const COMMAND_TYPES: MapYCommand['type'][] = [
  'CREATE_MAP',
  'ADD_ZONE',
  'ADD_OBJECT',
  'UPDATE_OBJECT',
  'DELETE_OBJECT'
];

export const ZONE_TOPOLOGIES: ZoneTopology[] = ['linear', 's_like', 'grid', 'hub', 'free'];

export const OBJECT_TYPES: MapObjectType[] = ['key', 'boss', 'enemy', 'item', 'npc'];

export function createEmptyMap(width = 1200, height = 800): MapState {
  return { width, height, zones: [], objects: [] };
}
