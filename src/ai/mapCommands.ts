import type {
  DoorSide,
  MapYDocument,
  Point,
  ShapeKind,
  Transform
} from '../model/types';

export type AiPlanIntent = 'create_document' | 'patch_document';

export interface AiCreateSceneOperation {
  op: 'create_scene';
  tempId: string;
  name: string;
  transform: Transform;
  regionId?: string;
  color?: string;
  opacity?: number;
}

export interface AiCreateStructureOperation {
  op: 'create_structure';
  tempId: string;
  sceneRef: string;
  name: string;
  transform: Transform;
  tiles?: Point[];
  color?: string;
  opacity?: number;
  hasCollision?: boolean;
}

export interface AiCreateIdentifierDefinitionOperation {
  op: 'create_identifier_definition';
  tempId: string;
  name: string;
  kind?: string;
  color: string;
  shape: ShapeKind;
}

export interface AiPlaceIdentifierOperation {
  op: 'place_identifier';
  tempId: string;
  definitionRef: string;
  sceneRef: string;
  structureRef?: string;
  name: string;
  transform: Transform;
}

export interface AiCreateConnectionOperation {
  op: 'create_connection';
  tempId: string;
  fromSceneRef: string;
  toSceneRef: string;
  fromSide?: DoorSide;
  toSide?: DoorSide;
  name?: string;
}

export interface AiAddAnnotationOperation {
  op: 'add_annotation';
  tempId: string;
  name?: string;
  text: string;
  transform: Transform;
  sceneRef?: string;
  structureRef?: string;
}

export interface AiUpdateEntityOperation {
  op: 'update_entity';
  id: string;
  patch: {
    name?: string;
    color?: string;
    opacity?: number;
    transform?: Partial<Transform>;
    text?: string;
    note?: string;
    regionId?: string;
    parentSceneId?: string;
    parentStructureId?: string;
    identifierDefinitionId?: string;
    kind?: string;
    shape?: ShapeKind;
    visibleInWorld?: boolean;
  };
}

export interface AiDeleteEntityOperation {
  op: 'delete_entity';
  id: string;
}

export type AiMapOperation =
  | AiCreateSceneOperation
  | AiCreateStructureOperation
  | AiCreateIdentifierDefinitionOperation
  | AiPlaceIdentifierOperation
  | AiCreateConnectionOperation
  | AiAddAnnotationOperation
  | AiUpdateEntityOperation
  | AiDeleteEntityOperation;

export interface AiMapPlan {
  intent: AiPlanIntent;
  documentName?: string;
  operations: AiMapOperation[];
}

// Per-collection cap for the LLM context. Trimming keeps prompt size (and cost)
// bounded on large maps; reference resolution still runs against the full
// document in the repair/validation pipeline, not against this context.
export const MAX_CONTEXT_ITEMS = 60;

interface AiContextEntry {
  id: string;
  name: string;
}

interface AiSceneContextEntry extends AiContextEntry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AiStructureContextEntry extends AiContextEntry {
  sceneId?: string;
}

interface AiIdentifierContextEntry extends AiContextEntry {
  kind?: string;
}

export interface AiDocumentContext {
  version: number;
  name: string;
  gridSize: number;
  counts: {
    scenes: number;
    structures: number;
    identifiers: number;
    identifierInstances: number;
    doors: number;
    annotations: number;
  };
  regions: AiContextEntry[];
  scenes: AiSceneContextEntry[];
  structures: AiStructureContextEntry[];
  identifiers: AiIdentifierContextEntry[];
  identifierInstances: AiContextEntry[];
  truncated: boolean;
}

export interface AiPlanSummary {
  created: string[];
  updated: string[];
  deleted: string[];
}

export interface AiPlanPreview {
  document: MapYDocument;
  summary: AiPlanSummary;
}

export interface TextAiConfig {
  mode: 'mock' | 'api';
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export function documentToAiContext(document: MapYDocument): AiDocumentContext {
  const counts = {
    scenes: document.scenes.length,
    structures: document.structures.length,
    identifiers: document.identifiers.length,
    identifierInstances: document.identifierInstances.length,
    doors: document.doors.length,
    annotations: document.annotations.length
  };
  const truncated =
    counts.scenes > MAX_CONTEXT_ITEMS ||
    counts.structures > MAX_CONTEXT_ITEMS ||
    counts.identifiers > MAX_CONTEXT_ITEMS ||
    counts.identifierInstances > MAX_CONTEXT_ITEMS;

  return {
    version: document.version,
    name: document.name,
    gridSize: document.settings.gridSize,
    counts,
    regions: document.regions.slice(0, MAX_CONTEXT_ITEMS).map((region) => ({
      id: region.id,
      name: region.name
    })),
    scenes: document.scenes.slice(0, MAX_CONTEXT_ITEMS).map((scene) => ({
      id: scene.id,
      name: scene.name,
      x: scene.transform.x,
      y: scene.transform.y,
      width: scene.transform.width,
      height: scene.transform.height
    })),
    structures: document.structures.slice(0, MAX_CONTEXT_ITEMS).map((structure) => ({
      id: structure.id,
      name: structure.name,
      sceneId: structure.parentSceneId
    })),
    identifiers: document.identifiers.slice(0, MAX_CONTEXT_ITEMS).map((definition) => ({
      id: definition.id,
      name: definition.name,
      kind: definition.kind
    })),
    identifierInstances: document.identifierInstances.slice(0, MAX_CONTEXT_ITEMS).map((instance) => ({
      id: instance.id,
      name: instance.name
    })),
    truncated
  };
}
