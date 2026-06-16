export type ElementType = 'scene' | 'structure' | 'identifier' | 'connection' | 'annotation';

export type ShapeKind = 'rect' | 'circle' | 'diamond' | 'triangle' | 'star' | 'door' | 'note';

export type DoorSide = 'top' | 'right' | 'bottom' | 'left';

export type WorkspaceMode = 'edit' | 'world' | 'structure';

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MapYNode {
  id: string;
  type: ElementType;
  name: string;
  transform: Transform;
  tiles?: Point[];
  assetId?: string;
  color: string;
  opacity?: number;
  shape: ShapeKind;
  hasCollision: boolean;
  parentSceneId?: string;
  parentStructureId?: string;
  regionId?: string;
  anchorId?: string;
  doorSide?: DoorSide;
  doorOffset?: number;
  targetDoorId?: string;
  identifierDefinitionId?: string;
  note?: string;
  text?: string;
}

export interface IdentifierDefinition {
  id: string;
  name: string;
  kind?: string;
  color: string;
  shape: ShapeKind;
  assetId?: string;
  visibleInWorld?: boolean;
}

export interface StitchAnchor {
  id: string;
  sceneId: string;
  side: DoorSide;
  offset: number;
  doorId?: string;
}

export interface StitchEdge {
  id: string;
  fromAnchorId: string;
  toAnchorId: string;
}

export interface RegionDefinition {
  id: string;
  name: string;
  color: string;
}

export interface ArtAsset {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt?: string;
}

export interface MapYDocument {
  version: number;
  name: string;
  settings: {
    gridSize: number;
  };
  scenes: MapYNode[];
  structures: MapYNode[];
  identifiers: IdentifierDefinition[];
  identifierInstances: MapYNode[];
  doors: MapYNode[];
  annotations: MapYNode[];
  assets: ArtAsset[];
  regions: RegionDefinition[];
  stitching: {
    anchors: StitchAnchor[];
    edges: StitchEdge[];
  };
}

export type CollectionKey = 'scenes' | 'structures' | 'identifierInstances' | 'doors' | 'annotations';

export interface CreateNodeOptions {
  name?: string;
  color?: string;
  opacity?: number;
  shape?: ShapeKind;
  hasCollision?: boolean;
  width?: number;
  height?: number;
  tiles?: Point[];
  assetId?: string;
  parentSceneId?: string;
  parentStructureId?: string;
  regionId?: string;
  anchorId?: string;
  doorSide?: DoorSide;
  doorOffset?: number;
  targetDoorId?: string;
  identifierDefinitionId?: string;
  note?: string;
  text?: string;
}

export interface CreateNodeResult {
  document: MapYDocument;
  node?: MapYNode;
  message?: string;
}
