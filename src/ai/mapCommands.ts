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

export interface AiDocumentContext {
  version: number;
  name: string;
  gridSize: number;
  regions: MapYDocument['regions'];
  scenes: MapYDocument['scenes'];
  structures: MapYDocument['structures'];
  identifiers: MapYDocument['identifiers'];
  identifierInstances: MapYDocument['identifierInstances'];
  doors: MapYDocument['doors'];
  annotations: MapYDocument['annotations'];
  assets: Array<Pick<MapYDocument['assets'][number], 'id' | 'name' | 'mimeType' | 'width' | 'height'>>;
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

export interface ImageAiConfig {
  mode: 'mock' | 'api';
  baseUrl: string;
  endpoint: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export interface GenerateImageRequest {
  prompt: string;
  width: number;
  height: number;
  transparentBackground: boolean;
}

export interface GenerateImageResponse {
  mimeType: string;
  data: string;
  revisedPrompt?: string;
}

export function documentToAiContext(document: MapYDocument): AiDocumentContext {
  return {
    version: document.version,
    name: document.name,
    gridSize: document.settings.gridSize,
    regions: document.regions,
    scenes: document.scenes,
    structures: document.structures,
    identifiers: document.identifiers,
    identifierInstances: document.identifierInstances,
    doors: document.doors,
    annotations: document.annotations,
    assets: document.assets.map(({ id, name, mimeType, width, height }) => ({
      id,
      name,
      mimeType,
      width,
      height
    }))
  };
}
