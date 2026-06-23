export type AiIntent = 'create_document' | 'patch_document' | 'ask_clarification';

export type SceneLayoutPattern = 'linear' | 's_curve' | 'hub' | 'arena' | 'branch' | 'free';

export interface Position2D {
  x: number;
  y: number;
}

export interface AiPlan {
  intent?: AiIntent | string;
  document_name?: string;
  documentName?: string;
  clarification?: string;
  question?: string;
  operations?: unknown[];
  commands?: unknown[];
  actions?: unknown[];
  steps?: unknown[];
  tasks?: unknown[];
}

export interface CreateSceneOperation {
  type?: 'create_scene' | string;
  op?: string;
  scene_id?: string;
  tempId?: string;
  name?: string;
  layout_pattern?: SceneLayoutPattern | string;
  position?: Partial<Position2D>;
  transform?: Record<string, unknown>;
}

export interface CreateStructureOperation {
  type?: 'create_structure' | string;
  op?: string;
  structure_id?: string;
  tempId?: string;
  scene_id?: string;
  sceneRef?: string;
  name?: string;
  structure_type?: string;
  position?: Partial<Position2D>;
  transform?: Record<string, unknown>;
}

export interface CreateIdentifierDefinitionOperation {
  type?: 'create_identifier_definition' | string;
  op?: string;
  identifier_type?: string;
  tempId?: string;
  name?: string;
  color?: string;
  shape?: string;
}

export interface PlaceIdentifierOperation {
  type?: 'place_identifier' | string;
  op?: string;
  identifier_id?: string;
  tempId?: string;
  identifier_type?: string;
  definitionRef?: string;
  name?: string;
  scene_id?: string;
  sceneRef?: string;
  structure_id?: string;
  structureRef?: string;
  position?: Partial<Position2D>;
  transform?: Record<string, unknown>;
}

export interface CreateConnectionOperation {
  type?: 'create_connection' | string;
  op?: string;
  connection_id?: string;
  tempId?: string;
  name?: string;
  from_scene_id?: string;
  fromSceneRef?: string;
  to_scene_id?: string;
  toSceneRef?: string;
}

export interface AddAnnotationOperation {
  type?: 'add_annotation' | string;
  op?: string;
  annotation_id?: string;
  tempId?: string;
  scene_id?: string;
  sceneRef?: string;
  structure_id?: string;
  structureRef?: string;
  text?: string;
  position?: Partial<Position2D>;
  transform?: Record<string, unknown>;
}

export interface UpdateEntityOperation {
  type?: 'update_entity' | string;
  op?: string;
  entity_id?: string;
  id?: string;
  patch?: Record<string, unknown>;
}

export interface DeleteEntityOperation {
  type?: 'delete_entity' | string;
  op?: string;
  entity_id?: string;
  id?: string;
}

export type MapYOperation =
  | CreateSceneOperation
  | CreateStructureOperation
  | CreateIdentifierDefinitionOperation
  | PlaceIdentifierOperation
  | CreateConnectionOperation
  | AddAnnotationOperation
  | UpdateEntityOperation
  | DeleteEntityOperation;

export interface ParsedAiPlanResponse {
  plan: AiPlan;
  text?: string;
}

export interface AiRepair {
  code: string;
  message: string;
  operationIndex?: number;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  operationIndex?: number;
  operationType?: string;
}

export interface ClarificationContext {
  originalRequest: string;
  question: string;
}
