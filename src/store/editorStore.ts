import { create } from 'zustand';
import {
  addNode,
  clampGridSize,
  cloneDocument,
  createDefaultNode,
  createEmptyDocument,
  createId,
  createRectTiles,
  defaultColors,
  defaultShape,
  defaultTransform,
  findNode,
  getAllNodes,
  getCollection,
  getIdentifierDefinition,
  normalizeDocument,
  removeNodeCascade,
  serializeDocument,
  updateNode
} from '../model/document';
import {
  clamp,
  findSceneAtPoint,
  findStructureAtPoint,
  getClosestSceneAnchor,
  getDoorRelativeTransform,
  getObjectAbsoluteTransform,
  getRelativeTransformForWorldPoint,
  snapPoint,
  snapTransform
} from '../model/geometry';
import type {
  ArtAsset,
  CreateNodeOptions,
  DoorSide,
  ElementType,
  IdentifierDefinition,
  MapYDocument,
  MapYNode,
  Point,
  RegionDefinition,
  ShapeKind,
  Transform,
  WorkspaceMode
} from '../model/types';

interface Viewport {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

interface HistoryState {
  past: MapYDocument[];
  future: MapYDocument[];
}

interface DocumentTab {
  id: string;
  document: MapYDocument;
}

type TilePaintTarget = 'structure';
type TilePaintMode = 'paint' | 'erase';
const UNTITLED_DOCUMENT_NAME = 'Untitled';
const AUTOSAVE_STORAGE_KEY = 'mapy:auto-save:v1';

interface TileStrokeState {
  document: MapYDocument;
  mode: TilePaintMode;
  selectedId?: string;
  startDocument: MapYDocument;
  target: TilePaintTarget;
  visited: Set<string>;
}

interface EditorStore {
  document: MapYDocument;
  documentTabs: DocumentTab[];
  activeDocumentTabId: string;
  selectedId?: string;
  inspectorNodeId?: string;
  creationType?: ElementType;
  creationEditId?: string;
  clipboard?: MapYNode;
  searchQuery: string;
  viewport: Viewport;
  workspaceMode: WorkspaceMode;
  connectionMode: boolean;
  worldVisibility: {
    structures: boolean;
    identifiers: boolean;
    connections: boolean;
  };
  connectionStartDoorId?: string;
  tileStroke?: TileStrokeState;
  history: HistoryState;
  notice?: string;
  setViewport: (viewport: Partial<Viewport>) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setConnectionMode: (enabled: boolean) => void;
  setWorldVisibility: (patch: Partial<EditorStore['worldVisibility']>) => void;
  fitToContent: () => void;
  setConnectionStartDoor: (id?: string) => void;
  selectNode: (id?: string) => void;
  openNodeInspector: (id: string) => void;
  closeNodeInspector: () => void;
  openCreation: (type: ElementType, editId?: string) => void;
  closeCreation: () => void;
  createNode: (type: ElementType, worldPoint: Point, options?: CreateNodeOptions) => boolean;
  createIdentifierDefinition: (definition: Omit<IdentifierDefinition, 'id'>) => string;
  updateIdentifierDefinition: (id: string, patch: Partial<IdentifierDefinition>) => void;
  deleteIdentifierDefinition: (id: string) => void;
  createConnection: (fromDoorId: string, toDoorId: string) => void;
  disconnectDoor: (doorId: string) => void;
  updateDoorAnchor: (doorId: string, side: DoorSide, offset: number) => void;
  updateSceneRegion: (sceneId: string, regionId: string) => void;
  updateNodeTransform: (id: string, transform: Transform) => void;
  updateSelectedTransform: (transform: Transform) => void;
  updateNode: (id: string, patch: Partial<MapYNode>) => void;
  paintTile: (target: TilePaintTarget, worldPoint: Point, mode: TilePaintMode) => void;
  beginTileStroke: (target: TilePaintTarget, worldPoint: Point, mode: TilePaintMode) => void;
  updateTileStroke: (target: TilePaintTarget, worldPoint: Point, mode: TilePaintMode) => void;
  endTileStroke: () => void;
  deleteSelected: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: () => void;
  addAnnotation: () => void;
  undo: () => void;
  redo: () => void;
  newDocument: () => void;
  switchDocumentTab: (tabId: string) => void;
  renameDocumentTab: (tabId: string, name: string) => void;
  closeDocumentTab: (tabId?: string) => void;
  importDocument: (value: unknown) => void;
  exportDocument: () => string;
  clearNotice: () => void;
  setSearchQuery: (query: string) => void;
  setGridSize: (size: number) => void;
  focusNode: (id: string) => void;
  addRegion: () => void;
  updateRegion: (regionId: string, patch: Partial<RegionDefinition>) => void;
  deleteRegion: (regionId: string) => void;
  addAsset: (asset: Omit<ArtAsset, 'id' | 'createdAt'>) => string;
  deleteAsset: (assetId: string) => void;
  setNodeAsset: (nodeId: string, assetId?: string) => void;
  setIdentifierAsset: (identifierId: string, assetId?: string) => void;
}

function pushHistory(history: HistoryState, document: MapYDocument): HistoryState {
  return {
    past: [...history.past, cloneDocument(document)].slice(-100),
    future: []
  };
}

function createGraphId(prefix: 'anchor' | 'edge'): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomId}`;
}

function createLocalId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomId}`;
}

function createDocumentTab(document = createEmptyDocument(UNTITLED_DOCUMENT_NAME)): DocumentTab {
  return {
    id: createLocalId('doc'),
    document
  };
}

function normalizeDocumentTab(value: unknown): DocumentTab | undefined {
  const candidate = value as Partial<DocumentTab> | undefined;
  if (!candidate?.id || !candidate.document) {
    return undefined;
  }

  try {
    return {
      id: String(candidate.id),
      document: normalizeDocument(candidate.document)
    };
  } catch {
    return undefined;
  }
}

function getSavedWorkspace(): Pick<EditorStore, 'activeDocumentTabId' | 'document' | 'documentTabs'> {
  if (typeof window === 'undefined') {
    const tab = createDocumentTab();
    return { activeDocumentTabId: tab.id, document: tab.document, documentTabs: [tab] };
  }

  try {
    const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) {
      throw new Error('No auto-save found.');
    }

    const parsed = JSON.parse(raw) as Partial<{ activeDocumentTabId: string; documentTabs: unknown[] }>;
    const documentTabs = (parsed.documentTabs || []).map(normalizeDocumentTab).filter((tab): tab is DocumentTab => Boolean(tab));
    if (documentTabs.length === 0) {
      throw new Error('Auto-save is empty.');
    }

    const activeDocumentTabId = documentTabs.some((tab) => tab.id === parsed.activeDocumentTabId)
      ? String(parsed.activeDocumentTabId)
      : documentTabs[0].id;
    const activeTab = documentTabs.find((tab) => tab.id === activeDocumentTabId) || documentTabs[0];
    return {
      activeDocumentTabId: activeTab.id,
      document: activeTab.document,
      documentTabs
    };
  } catch {
    const tab = createDocumentTab();
    return { activeDocumentTabId: tab.id, document: tab.document, documentTabs: [tab] };
  }
}

function getSyncedDocumentTabs(
  state: Pick<EditorStore, 'activeDocumentTabId' | 'document' | 'documentTabs'>,
  document = state.document
): DocumentTab[] {
  const tabs = state.documentTabs.length > 0 ? state.documentTabs : [createDocumentTab(document)];
  return tabs.map((tab) => (tab.id === state.activeDocumentTabId ? { ...tab, document } : tab));
}

function getAutoSaveSnapshot(state: EditorStore) {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    activeDocumentTabId: state.activeDocumentTabId,
    documentTabs: getSyncedDocumentTabs(state)
  };
}

function addNodeWithConnectionAnchor(document: MapYDocument, node: MapYNode): MapYDocument {
  const nextDocument = addNode(document, node);

  if (node.type !== 'connection' || !node.anchorId || !node.parentSceneId || !node.doorSide) {
    return nextDocument;
  }

  return {
    ...nextDocument,
    stitching: {
      ...nextDocument.stitching,
      anchors: [
        ...nextDocument.stitching.anchors,
        {
          id: node.anchorId,
          sceneId: node.parentSceneId,
          side: node.doorSide,
          offset: node.doorOffset || 0,
          doorId: node.id
        }
      ]
    }
  };
}

function removeAssetReferences(document: MapYDocument, assetId: string): MapYDocument {
  const cleanNode = (node: MapYNode): MapYNode =>
    node.assetId === assetId ? { ...node, assetId: undefined } : node;

  return {
    ...document,
    assets: document.assets.filter((asset) => asset.id !== assetId),
    structures: document.structures.map(cleanNode),
    identifierInstances: document.identifierInstances.map(cleanNode),
    identifiers: document.identifiers.map((identifier) =>
      identifier.assetId === assetId ? { ...identifier, assetId: undefined } : identifier
    )
  };
}

function canUseArtAsset(node: MapYNode): boolean {
  return node.type === 'structure' || node.type === 'identifier';
}

function getTileOrigin(value: number, gridSize: number): number {
  return Math.floor(value / gridSize) * gridSize;
}

function getTileKey(tile: Point): string {
  return `${tile.x}:${tile.y}`;
}

function normalizeStructureTileDocument(document: MapYDocument, node: MapYNode, tiles: Point[]): MapYDocument {
  if (tiles.length === 0) {
    return document;
  }

  const gridSize = document.settings.gridSize;
  const minX = Math.min(...tiles.map((tile) => tile.x));
  const minY = Math.min(...tiles.map((tile) => tile.y));
  const maxX = Math.max(...tiles.map((tile) => tile.x));
  const maxY = Math.max(...tiles.map((tile) => tile.y));
  const normalizedTiles = tiles
    .map((tile) => ({ x: tile.x - minX, y: tile.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const deltaX = minX * gridSize;
  const deltaY = minY * gridSize;
  const nextDocument = updateNode(document, node.id, {
    tiles: normalizedTiles,
    transform: {
      ...node.transform,
      x: node.transform.x + deltaX,
      y: node.transform.y + deltaY,
      width: (maxX - minX + 1) * gridSize,
      height: (maxY - minY + 1) * gridSize
    }
  });

  if (deltaX === 0 && deltaY === 0) {
    return nextDocument;
  }

  const shiftTransform = (item: MapYNode): MapYNode => ({
    ...item,
    transform: {
      ...item.transform,
      x: item.transform.x - deltaX,
      y: item.transform.y - deltaY
    }
  });

  return {
    ...nextDocument,
    identifierInstances: nextDocument.identifierInstances.map((item) =>
      item.parentStructureId === node.id ? shiftTransform(item) : item
    ),
    annotations: nextDocument.annotations.map((item) => (item.parentStructureId === node.id ? shiftTransform(item) : item))
  };
}

function scaleTiles(tiles: Point[] | undefined, scaleX: number, scaleY: number): Point[] | undefined {
  if (!tiles || tiles.length === 0 || (!Number.isFinite(scaleX) && !Number.isFinite(scaleY))) {
    return tiles;
  }

  const nextTiles: Point[] = [];
  const seen = new Set<string>();
  const safeScaleX = Math.max(1 / 32, Number.isFinite(scaleX) ? scaleX : 1);
  const safeScaleY = Math.max(1 / 32, Number.isFinite(scaleY) ? scaleY : 1);

  for (const tile of tiles) {
    const startX = Math.floor(tile.x * safeScaleX);
    const endX = Math.max(startX, Math.ceil((tile.x + 1) * safeScaleX) - 1);
    const startY = Math.floor(tile.y * safeScaleY);
    const endY = Math.max(startY, Math.ceil((tile.y + 1) * safeScaleY) - 1);

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const key = `${x}:${y}`;
        if (!seen.has(key)) {
          seen.add(key);
          nextTiles.push({ x, y });
        }
      }
    }
  }

  return nextTiles.sort((a, b) => a.y - b.y || a.x - b.x);
}

function scaleChildTransform(transform: Transform, scaleX: number, scaleY: number): Transform {
  return {
    ...transform,
    x: Math.round(transform.x * scaleX),
    y: Math.round(transform.y * scaleY),
    width: Math.max(1, Math.round(transform.width * scaleX)),
    height: Math.max(1, Math.round(transform.height * scaleY))
  };
}

function resizeStructureNode(node: MapYNode, nextTransform: Transform): MapYNode {
  const scaleX = node.transform.width > 0 ? nextTransform.width / node.transform.width : 1;
  const scaleY = node.transform.height > 0 ? nextTransform.height / node.transform.height : 1;

  return {
    ...node,
    transform: nextTransform,
    tiles: scaleTiles(node.tiles, scaleX, scaleY)
  };
}

function updateSceneTransformDocument(document: MapYDocument, scene: MapYNode, nextTransform: Transform): MapYDocument {
  const scaleX = scene.transform.width > 0 ? nextTransform.width / scene.transform.width : 1;
  const scaleY = scene.transform.height > 0 ? nextTransform.height / scene.transform.height : 1;
  const sizeChanged = scene.transform.width !== nextTransform.width || scene.transform.height !== nextTransform.height;

  let nextDocument = updateNode(document, scene.id, { transform: nextTransform });
  if (!sizeChanged) {
    return nextDocument;
  }

  nextDocument = {
    ...nextDocument,
    // A structure stays a data-child of the scene either way; its own
    // `scaleWithScene` flag decides if it transforms proportionally on resize.
    structures: nextDocument.structures.map((structure) =>
      structure.parentSceneId === scene.id && structure.scaleWithScene !== false
        ? resizeStructureNode(structure, scaleChildTransform(structure.transform, scaleX, scaleY))
        : structure
    ),
    identifierInstances: nextDocument.identifierInstances.map((identifier) =>
      identifier.parentSceneId === scene.id && !identifier.parentStructureId
        ? { ...identifier, transform: scaleChildTransform(identifier.transform, scaleX, scaleY) }
        : identifier
    ),
    annotations: nextDocument.annotations.map((annotation) =>
      annotation.parentSceneId === scene.id && !annotation.parentStructureId
        ? { ...annotation, transform: scaleChildTransform(annotation.transform, scaleX, scaleY) }
        : annotation
    )
  };

  let withDoors = nextDocument;
  for (const door of nextDocument.doors.filter((item) => item.parentSceneId === scene.id && item.doorSide)) {
    const side = door.doorSide!;
    const offsetScale = side === 'top' || side === 'bottom' ? scaleX : scaleY;
    withDoors = updateConnectionAnchorDocument(withDoors, door.id, side, Math.round((door.doorOffset || 0) * offsetScale));
  }

  return withDoors;
}

function updateTileSet(tiles: Point[] | undefined, tile: Point, mode: TilePaintMode): Point[] {
  const current = tiles && tiles.length > 0 ? tiles : [{ x: 0, y: 0 }];
  const key = getTileKey(tile);

  if (mode === 'paint') {
    return current.some((item) => getTileKey(item) === key) ? current : [...current, tile];
  }

  if (current.length <= 1) {
    return current;
  }

  return current.filter((item) => getTileKey(item) !== key);
}

function paintStructureTileDocument(
  document: MapYDocument,
  selectedId: string | undefined,
  worldPoint: Point,
  mode: TilePaintMode
): { document: MapYDocument; selectedId?: string; message?: string } {
  const gridSize = document.settings.gridSize;
  const selected = findNode(document, selectedId);
  const structure = selected?.type === 'structure' ? selected : findStructureAtPoint(document, worldPoint);

  if (!structure) {
    if (mode === 'erase') {
      return { document };
    }

    const scene = findSceneAtPoint(document, worldPoint);
    if (!scene || scene.type !== 'scene') {
      return { document, message: '结构 Pixel 必须绘制在已有地图内。' };
    }

    const origin = {
      x: getTileOrigin(worldPoint.x, gridSize),
      y: getTileOrigin(worldPoint.y, gridSize)
    };
    const node = createDefaultNode(
      'structure',
      document.structures.length + 1,
      {
        x: origin.x - scene.transform.x,
        y: origin.y - scene.transform.y,
        width: gridSize,
        height: gridSize,
        rotation: 0
      },
      {
        parentSceneId: scene.id,
        hasCollision: true,
        tiles: [{ x: 0, y: 0 }]
      }
    );

    return {
      document: addNode(document, node),
      selectedId: node.id
    };
  }

  const structureTransform = getObjectAbsoluteTransform(document, structure);
  const tile = {
    x: Math.floor((worldPoint.x - structureTransform.x) / gridSize),
    y: Math.floor((worldPoint.y - structureTransform.y) / gridSize)
  };
  const tiles = updateTileSet(
    structure.tiles || createRectTiles(structure.transform.width, structure.transform.height, gridSize),
    tile,
    mode
  );

  return {
    document: normalizeStructureTileDocument(document, structure, tiles),
    selectedId: structure.id
  };
}

function getStrokePointKey(target: TilePaintTarget, worldPoint: Point, gridSize: number): string {
  return `${target}:${Math.floor(worldPoint.x / gridSize)}:${Math.floor(worldPoint.y / gridSize)}`;
}

function updateConnectionAnchorDocument(document: MapYDocument, doorId: string, side: DoorSide, offset: number): MapYDocument {
  const door = findNode(document, doorId);
  const scene = findNode(document, door?.parentSceneId);

  if (!door || door.type !== 'connection' || !scene || scene.type !== 'scene') {
    return document;
  }

  const maxOffset = side === 'top' || side === 'bottom' ? scene.transform.width : scene.transform.height;
  const nextOffset = clamp(offset, 0, maxOffset);
  const anchorId = door.anchorId || createGraphId('anchor');
  const transform = getDoorRelativeTransform(scene, side, nextOffset, document.settings.gridSize);
  const nextDocument = updateNode(document, doorId, {
    anchorId,
    doorSide: side,
    doorOffset: nextOffset,
    transform
  });
  const existingAnchor = nextDocument.stitching.anchors.some((anchor) => anchor.id === anchorId);

  return {
    ...nextDocument,
    stitching: {
      ...nextDocument.stitching,
      anchors: existingAnchor
        ? nextDocument.stitching.anchors.map((anchor) =>
            anchor.id === anchorId
              ? { ...anchor, sceneId: scene.id, side, offset: nextOffset, doorId }
              : anchor
          )
        : [
            ...nextDocument.stitching.anchors,
            {
              id: anchorId,
              sceneId: scene.id,
              side,
              offset: nextOffset,
              doorId
            }
          ]
    }
  };
}

function disconnectDoorDocument(document: MapYDocument, doorId: string): MapYDocument {
  const door = findNode(document, doorId);
  if (!door?.anchorId) {
    return document;
  }

  const relatedEdges = document.stitching.edges.filter(
    (edge) => edge.fromAnchorId === door.anchorId || edge.toAnchorId === door.anchorId
  );
  const relatedAnchorIds = relatedEdges.flatMap((edge) => [edge.fromAnchorId, edge.toAnchorId]);
  const relatedDoorIds = document.stitching.anchors
    .filter((anchor) => relatedAnchorIds.includes(anchor.id) && anchor.doorId)
    .map((anchor) => anchor.doorId!);

  return {
    ...document,
    doors: document.doors.map((node) =>
      node.id === doorId || relatedDoorIds.includes(node.id) ? { ...node, targetDoorId: undefined } : node
    ),
    stitching: {
      ...document.stitching,
      edges: document.stitching.edges.filter(
        (edge) => edge.fromAnchorId !== door.anchorId && edge.toAnchorId !== door.anchorId
      )
    }
  };
}

function createConnectionDocument(document: MapYDocument, fromDoorId: string, toDoorId: string): MapYDocument {
  const fromDoor = findNode(document, fromDoorId);
  const toDoor = findNode(document, toDoorId);

  if (!fromDoor?.anchorId || !toDoor?.anchorId) {
    return document;
  }

  const disconnected = disconnectDoorDocument(disconnectDoorDocument(document, fromDoorId), toDoorId);
  const nextDocument = {
    ...disconnected,
    doors: disconnected.doors.map((door) => {
      if (door.id === fromDoorId) {
        return { ...door, targetDoorId: toDoorId };
      }

      if (door.id === toDoorId) {
        return { ...door, targetDoorId: fromDoorId };
      }

      return door;
    })
  };

  return {
    ...nextDocument,
    stitching: {
      ...nextDocument.stitching,
      edges: [
        ...nextDocument.stitching.edges,
        {
          id: createGraphId('edge'),
          fromAnchorId: fromDoor.anchorId,
          toAnchorId: toDoor.anchorId
        }
      ]
    }
  };
}

function commit(
  set: (partial: Partial<EditorStore>) => void,
  get: () => EditorStore,
  producer: (document: MapYDocument) => MapYDocument,
  extra: Partial<EditorStore> = {}
): void {
  const state = get();
  const nextDocument = producer(state.document);

  if (nextDocument === state.document) {
    set(extra);
    return;
  }

  set({
    document: nextDocument,
    documentTabs: getSyncedDocumentTabs(state, nextDocument),
    history: pushHistory(state.history, state.document),
    notice: undefined,
    ...extra
  });
}

function makeTransform(
  type: ElementType,
  document: MapYDocument,
  worldPoint: Point,
  options: CreateNodeOptions
): Transform {
  const gridSize = document.settings.gridSize;
  const snapped = snapPoint(worldPoint, gridSize);
  const fallbackTransform = defaultTransform(type, gridSize);
  const width = options.width ?? fallbackTransform.width;
  const height = options.height ?? fallbackTransform.height;

  return snapTransform(
    {
      x: snapped.x,
      y: snapped.y,
      width,
      height,
      rotation: 0
    },
    gridSize
  );
}

function distanceToTransform(point: Point, transform: Transform): number {
  const dx = Math.max(transform.x - point.x, 0, point.x - (transform.x + transform.width));
  const dy = Math.max(transform.y - point.y, 0, point.y - (transform.y + transform.height));
  return Math.hypot(dx, dy);
}

function findSceneForConnection(document: MapYDocument, worldPoint: Point): MapYNode | undefined {
  const sceneAtPoint = findSceneAtPoint(document, worldPoint);
  if (sceneAtPoint) {
    return sceneAtPoint;
  }

  return [...document.scenes]
    .reverse()
    .map((scene) => ({
      scene,
      distance: distanceToTransform(worldPoint, getObjectAbsoluteTransform(document, scene))
    }))
    .filter(({ distance }) => distance <= document.settings.gridSize * 2)
    .sort((a, b) => a.distance - b.distance)[0]?.scene;
}

function prepareNode(
  document: MapYDocument,
  type: ElementType,
  worldPoint: Point,
  options: CreateNodeOptions = {}
): { node?: MapYNode; message?: string } {
  const transform = makeTransform(type, document, worldPoint, options);
  const index = getCollection(document, type).length + 1;

  if (type === 'scene') {
    const region = document.regions.find((item) => item.id === options.regionId);
    return {
      node: createDefaultNode(type, index, transform, {
        ...options,
        color: region?.color || options.color
      })
    };
  }

  if (type === 'annotation') {
    return {
      node: createDefaultNode(type, index, transform, options)
    };
  }

  if (type === 'structure') {
    const parentScene = options.parentSceneId ? findNode(document, options.parentSceneId) : findSceneAtPoint(document, worldPoint);
    if (!parentScene || parentScene.type !== 'scene') {
      return { message: '请先创建地图，结构必须放置在一个地图内。' };
    }

    return {
      node: createDefaultNode(type, index, {
        ...transform,
        x: transform.x - parentScene.transform.x,
        y: transform.y - parentScene.transform.y
      }, {
        ...options,
        parentSceneId: parentScene.id,
        parentStructureId: undefined
      })
    };
  }

  if (type === 'connection') {
    const parentScene = options.parentSceneId ? findNode(document, options.parentSceneId) : findSceneForConnection(document, worldPoint);
    if (!parentScene || parentScene.type !== 'scene') {
      return { message: '请先创建地图，连接必须放置在地图边缘。' };
    }

    const anchor = getClosestSceneAnchor(parentScene, worldPoint, document.settings.gridSize);
    return {
      node: createDefaultNode(
        type,
        index,
        getDoorRelativeTransform(parentScene, anchor.side, anchor.offset, document.settings.gridSize),
        {
          ...options,
          anchorId: options.anchorId || createGraphId('anchor'),
          parentSceneId: parentScene.id,
          parentStructureId: undefined,
          doorSide: anchor.side,
          doorOffset: anchor.offset,
          shape: 'door',
          hasCollision: false
        }
      )
    };
  }

  const definitionId = options.identifierDefinitionId || document.identifiers[0]?.id;
  const definition = getIdentifierDefinition(document, definitionId);
  if (!definition) {
    return { message: '请先在标识栏创建标识类型。' };
  }

  const parentStructure = options.parentStructureId
    ? findNode(document, options.parentStructureId)
    : findStructureAtPoint(document, worldPoint);
  const parentScene = options.parentSceneId ? findNode(document, options.parentSceneId) : findSceneAtPoint(document, worldPoint);
  const instanceName =
    options.name ||
    String(document.identifierInstances.filter((node) => node.identifierDefinitionId === definition.id).length + 1);

  if (parentStructure && parentStructure.type === 'structure') {
    const parentTransform = getObjectAbsoluteTransform(document, parentStructure);
    return {
      node: createDefaultNode(type, index, {
        ...transform,
        width: document.settings.gridSize,
        height: document.settings.gridSize,
        x: transform.x - parentTransform.x,
        y: transform.y - parentTransform.y
      }, {
        ...options,
        name: instanceName,
        color: options.color || definition.color,
        shape: options.shape || definition.shape,
        assetId: options.assetId || definition.assetId,
        hasCollision: false,
        identifierDefinitionId: definition.id,
        parentSceneId: parentStructure.parentSceneId,
        parentStructureId: parentStructure.id
      })
    };
  }

  if (parentScene && parentScene.type === 'scene') {
    return {
      node: createDefaultNode(type, index, {
        ...transform,
        width: document.settings.gridSize,
        height: document.settings.gridSize,
        x: transform.x - parentScene.transform.x,
        y: transform.y - parentScene.transform.y
      }, {
        ...options,
        name: instanceName,
        color: options.color || definition.color,
        shape: options.shape || definition.shape,
        assetId: options.assetId || definition.assetId,
        hasCollision: false,
        identifierDefinitionId: definition.id,
        parentSceneId: parentScene.id,
        parentStructureId: undefined
      })
    };
  }

  return { message: '请先创建地图或结构，再放置标识。' };
}

const initialWorkspace = getSavedWorkspace();

export const useEditorStore = create<EditorStore>((set, get) => ({
  document: initialWorkspace.document,
  documentTabs: initialWorkspace.documentTabs,
  activeDocumentTabId: initialWorkspace.activeDocumentTabId,
  searchQuery: '',
  viewport: {
    x: 240,
    y: 120,
    scale: 1,
    width: 800,
    height: 600
  },
  workspaceMode: 'edit',
  connectionMode: false,
  worldVisibility: {
    structures: true,
    identifiers: true,
    connections: true
  },
  tileStroke: undefined,
  history: {
    past: [],
    future: []
  },
  setViewport: (viewport) => set({ viewport: { ...get().viewport, ...viewport } }),
  setWorkspaceMode: (mode) =>
    set({
      workspaceMode: mode,
      connectionMode: mode === 'world' ? get().connectionMode : false,
      connectionStartDoorId: undefined
    }),
  setConnectionMode: (enabled) =>
    set({
      connectionMode: enabled,
      workspaceMode: enabled ? 'world' : get().workspaceMode,
      connectionStartDoorId: undefined,
      notice: enabled ? '连接模式：依次点击两个连接点。' : undefined
    }),
  setWorldVisibility: (patch) => set({ worldVisibility: { ...get().worldVisibility, ...patch } }),
  setConnectionStartDoor: (id) => set({ connectionStartDoorId: id, selectedId: id }),
  selectNode: (id) => set({ selectedId: id }),
  openNodeInspector: (id) => set({ inspectorNodeId: id, selectedId: id }),
  closeNodeInspector: () => set({ inspectorNodeId: undefined }),
  openCreation: (type, editId) => set({ creationType: type, creationEditId: editId }),
  closeCreation: () => set({ creationType: undefined, creationEditId: undefined }),
  createNode: (type, worldPoint, options = {}) => {
    const state = get();
    const prepared = prepareNode(state.document, type, worldPoint, options);

    if (!prepared.node) {
      set({ notice: prepared.message });
      return false;
    }

    commit(set, get, (document) => addNodeWithConnectionAnchor(document, prepared.node!), {
      selectedId: prepared.node.id,
      creationType: undefined,
      creationEditId: undefined,
      workspaceMode: type === 'structure' ? 'structure' : get().workspaceMode
    });
    return true;
  },
  createIdentifierDefinition: (definition) => {
    const id = createId('identifier-definition');
    const nextDefinition: IdentifierDefinition = {
      id,
      name: (definition.kind || definition.name).trim() || `标识类型 ${get().document.identifiers.length + 1}`,
      kind: (definition.kind || definition.name).trim() || `标识类型 ${get().document.identifiers.length + 1}`,
      color: definition.color || defaultColors.identifier,
      shape: definition.shape || defaultShape('identifier'),
      assetId: definition.assetId,
      visibleInWorld: definition.visibleInWorld ?? true
    };

    commit(set, get, (document) => ({
      ...document,
      identifiers: [...document.identifiers, nextDefinition]
    }), {
      creationType: undefined,
      creationEditId: undefined,
      notice: '标识已创建。'
    });
    return id;
  },
  updateIdentifierDefinition: (id, patch) => {
    commit(set, get, (document) => ({
      ...document,
      identifiers: document.identifiers.map((definition) =>
        definition.id === id ? { ...definition, ...patch } : definition
      ),
      identifierInstances: document.identifierInstances.map((instance) =>
        instance.identifierDefinitionId === id
          ? {
              ...instance,
              color: patch.color || instance.color,
              shape: patch.shape || instance.shape,
              assetId: patch.assetId === undefined ? instance.assetId : patch.assetId
            }
          : instance
      )
    }));
  },
  deleteIdentifierDefinition: (id) => {
    commit(set, get, (document) => ({
      ...document,
      identifiers: document.identifiers.filter((definition) => definition.id !== id),
      identifierInstances: document.identifierInstances.filter((instance) => instance.identifierDefinitionId !== id)
    }), {
      selectedId: undefined,
      notice: '标识类型及其实例已删除。'
    });
  },
  createConnection: (fromDoorId, toDoorId) => {
    const state = get();
    const fromDoor = findNode(state.document, fromDoorId);
    const toDoor = findNode(state.document, toDoorId);

    if (!fromDoor || !toDoor || fromDoor.type !== 'connection' || toDoor.type !== 'connection') {
      set({ notice: '请选择两个连接点。', connectionStartDoorId: undefined });
      return;
    }

    if (fromDoorId === toDoorId) {
      set({ notice: '同一个连接点不能连接自身。', connectionStartDoorId: undefined });
      return;
    }

    const duplicate = state.document.stitching.edges.some(
      (edge) =>
        (edge.fromAnchorId === fromDoor.anchorId && edge.toAnchorId === toDoor.anchorId) ||
        (edge.fromAnchorId === toDoor.anchorId && edge.toAnchorId === fromDoor.anchorId)
    );

    if (duplicate) {
      set({ notice: '这两个连接点已经存在连接。', connectionStartDoorId: undefined });
      return;
    }

    commit(set, get, (document) => createConnectionDocument(document, fromDoorId, toDoorId), {
      selectedId: toDoorId,
      connectionStartDoorId: undefined,
      notice: '连接线已创建。'
    });
  },
  disconnectDoor: (doorId) => {
    commit(set, get, (document) => disconnectDoorDocument(document, doorId), {
      notice: '连接线已断开。'
    });
  },
  updateDoorAnchor: (doorId, side, offset) => {
    commit(set, get, (document) => updateConnectionAnchorDocument(document, doorId, side, offset), {
      selectedId: doorId
    });
  },
  updateSceneRegion: (sceneId, regionId) => {
    commit(set, get, (document) => {
      const region = document.regions.find((item) => item.id === regionId);
      return updateNode(document, sceneId, {
        regionId,
        ...(region ? { color: region.color } : {})
      });
    }, {
      selectedId: sceneId
    });
  },
  updateNodeTransform: (id, transform) => {
    const state = get();
    const target = findNode(state.document, id);
    if (!target) {
      return;
    }

    if (target.type === 'connection') {
      const scene = findNode(state.document, target.parentSceneId);
      if (!scene || scene.type !== 'scene') {
        return;
      }

      const anchor = getClosestSceneAnchor(
        scene,
        {
          x: transform.x + transform.width / 2,
          y: transform.y + transform.height / 2
        },
        state.document.settings.gridSize
      );

      commit(set, get, (document) => updateConnectionAnchorDocument(document, id, anchor.side, anchor.offset), {
        selectedId: id
      });
      return;
    }

    const snapped = snapTransform(transform, state.document.settings.gridSize);
    const relativeTransform = getRelativeTransformForWorldPoint(state.document, target, {
      x: snapped.x,
      y: snapped.y
    });

    if (target.type === 'scene') {
      commit(set, get, (document) => updateSceneTransformDocument(document, target, snapped), {
        selectedId: id
      });
      return;
    }

    if (target.type === 'structure') {
      commit(
        set,
        get,
        (document) =>
          updateNode(document, id, resizeStructureNode(target, {
            ...relativeTransform,
            width: snapped.width,
            height: snapped.height,
            rotation: snapped.rotation
          })),
        { selectedId: id }
      );
      return;
    }

    commit(
      set,
      get,
      (document) =>
        updateNode(document, id, {
          transform: {
            ...relativeTransform,
            width: snapped.width,
            height: snapped.height,
            rotation: snapped.rotation
          }
        }),
      { selectedId: id }
    );
  },
  updateSelectedTransform: (transform) => {
    const state = get();
    const selected = findNode(state.document, state.selectedId);
    if (!selected) {
      return;
    }

    get().updateNodeTransform(selected.id, transform);
  },
  updateNode: (id, patch) => {
    commit(set, get, (document) => updateNode(document, id, patch));
  },
  paintTile: (target, worldPoint, mode) => {
    const state = get();
    const result = paintStructureTileDocument(state.document, state.selectedId, worldPoint, mode);

    if (result.message) {
      set({ notice: result.message });
      return;
    }

    commit(set, get, () => result.document, {
      selectedId: result.selectedId || state.selectedId,
      workspaceMode: 'structure',
      notice: undefined
    });
  },
  beginTileStroke: (target, worldPoint, mode) => {
    const state = get();
    const result = paintStructureTileDocument(state.document, state.selectedId, worldPoint, mode);
    if (result.message) {
      set({ notice: result.message });
      return;
    }

    set({
      document: result.document,
      documentTabs: getSyncedDocumentTabs(state, result.document),
      selectedId: result.selectedId || state.selectedId,
      workspaceMode: 'structure',
      tileStroke: {
        document: result.document,
        mode,
        selectedId: result.selectedId || state.selectedId,
        startDocument: state.document,
        target,
        visited: new Set([getStrokePointKey(target, worldPoint, state.document.settings.gridSize)])
      },
      notice: undefined
    });
  },
  updateTileStroke: (target, worldPoint, mode) => {
    const state = get();
    const stroke = state.tileStroke;

    if (!stroke || stroke.target !== target || stroke.mode !== mode) {
      get().beginTileStroke(target, worldPoint, mode);
      return;
    }

    const pointKey = getStrokePointKey(target, worldPoint, stroke.document.settings.gridSize);
    if (stroke.visited.has(pointKey)) {
      return;
    }

    const result = paintStructureTileDocument(stroke.document, stroke.selectedId, worldPoint, mode);
    const visited = new Set(stroke.visited);
    visited.add(pointKey);

    if (result.message) {
      set({
        tileStroke: {
          ...stroke,
          visited
        },
        notice: result.message
      });
      return;
    }

    set({
      document: result.document,
      documentTabs: getSyncedDocumentTabs(state, result.document),
      selectedId: result.selectedId || stroke.selectedId,
      tileStroke: {
        ...stroke,
        document: result.document,
        selectedId: result.selectedId || stroke.selectedId,
        visited
      },
      notice: undefined
    });
  },
  endTileStroke: () => {
    const state = get();
    const stroke = state.tileStroke;
    if (!stroke) {
      return;
    }

    if (stroke.document === stroke.startDocument) {
      set({ tileStroke: undefined });
      return;
    }

    set({
      history: pushHistory(state.history, stroke.startDocument),
      tileStroke: undefined,
      notice: undefined
    });
  },
  deleteSelected: () => {
    const { selectedId } = get();
    if (!selectedId) {
      return;
    }

    commit(set, get, (document) => removeNodeCascade(document, selectedId), {
      selectedId: undefined,
      inspectorNodeId: undefined
    });
  },
  copySelected: () => {
    const selected = findNode(get().document, get().selectedId);
    if (selected) {
      set({ clipboard: structuredClone(selected), notice: '已复制选中对象。' });
    }
  },
  cutSelected: () => {
    const selected = findNode(get().document, get().selectedId);
    if (!selected) {
      return;
    }

    set({ clipboard: structuredClone(selected), notice: '已剪切选中对象。' });
    commit(set, get, (document) => removeNodeCascade(document, selected.id), { selectedId: undefined });
  },
  pasteClipboard: () => {
    const clipboard = get().clipboard;
    if (!clipboard) {
      set({ notice: '剪贴板为空。' });
      return;
    }

    const copy = structuredClone(clipboard);
    copy.id = createId(copy.type);
    copy.name = `${copy.name} 副本`;
    copy.transform = {
      ...copy.transform,
      x: copy.transform.x + get().document.settings.gridSize,
      y: copy.transform.y + get().document.settings.gridSize
    };

    if (copy.type === 'connection') {
      const scene = findNode(get().document, copy.parentSceneId);
      if (!scene || scene.type !== 'scene' || !copy.doorSide) {
        set({ notice: '复制的连接缺少父地图，无法粘贴。' });
        return;
      }

      const maxOffset = copy.doorSide === 'top' || copy.doorSide === 'bottom' ? scene.transform.width : scene.transform.height;
      const nextOffset = clamp((copy.doorOffset || 0) + get().document.settings.gridSize, 0, maxOffset);
      copy.anchorId = createGraphId('anchor');
      copy.targetDoorId = undefined;
      copy.doorOffset = nextOffset;
      copy.transform = getDoorRelativeTransform(scene, copy.doorSide, nextOffset, get().document.settings.gridSize);
      commit(set, get, (document) => addNodeWithConnectionAnchor(document, copy), { selectedId: copy.id });
      return;
    }

    commit(set, get, (document) => addNode(document, copy), { selectedId: copy.id });
  },
  addAnnotation: () => {
    const state = get();
    const selected = findNode(state.document, state.selectedId);
    const selectedTransform = selected ? getObjectAbsoluteTransform(state.document, selected) : undefined;
    const worldPoint = selectedTransform
      ? { x: selectedTransform.x + selectedTransform.width + state.document.settings.gridSize, y: selectedTransform.y }
      : {
          x: (state.viewport.width / 2 - state.viewport.x) / state.viewport.scale,
          y: (state.viewport.height / 2 - state.viewport.y) / state.viewport.scale
        };

    get().createNode('annotation', worldPoint, { text: '新的注释' });
  },
  undo: () => {
    const state = get();
    const previous = state.history.past.at(-1);
    if (!previous) {
      return;
    }

    set({
      document: previous,
      documentTabs: getSyncedDocumentTabs(state, previous),
      selectedId: undefined,
      history: {
        past: state.history.past.slice(0, -1),
        future: [cloneDocument(state.document), ...state.history.future]
      }
    });
  },
  redo: () => {
    const state = get();
    const next = state.history.future[0];
    if (!next) {
      return;
    }

    set({
      document: next,
      documentTabs: getSyncedDocumentTabs(state, next),
      selectedId: undefined,
      history: {
        past: [...state.history.past, cloneDocument(state.document)],
        future: state.history.future.slice(1)
      }
    });
  },
  newDocument: () => {
    const state = get();
    const nextTab = createDocumentTab(createEmptyDocument(UNTITLED_DOCUMENT_NAME));
    set({
      document: nextTab.document,
      documentTabs: [...getSyncedDocumentTabs(state), nextTab],
      activeDocumentTabId: nextTab.id,
      selectedId: undefined,
      inspectorNodeId: undefined,
      history: { past: [], future: [] },
      notice: '已新建文件。'
    });
  },
  switchDocumentTab: (tabId) => {
    const state = get();
    if (tabId === state.activeDocumentTabId) {
      return;
    }

    const syncedTabs = getSyncedDocumentTabs(state);
    const target = syncedTabs.find((tab) => tab.id === tabId);
    if (!target) {
      return;
    }

    set({
      document: target.document,
      documentTabs: syncedTabs,
      activeDocumentTabId: target.id,
      selectedId: undefined,
      inspectorNodeId: undefined,
      tileStroke: undefined,
      history: { past: [], future: [] }
    });
  },
  renameDocumentTab: (tabId, name) => {
    const state = get();
    const nextName = name.trim() || UNTITLED_DOCUMENT_NAME;
    const activeDocument = tabId === state.activeDocumentTabId ? { ...state.document, name: nextName } : state.document;

    set({
      document: activeDocument,
      documentTabs: getSyncedDocumentTabs(state, activeDocument).map((tab) =>
        tab.id === tabId ? { ...tab, document: { ...tab.document, name: nextName } } : tab
      )
    });
  },
  closeDocumentTab: (tabId) => {
    const state = get();
    const targetId = tabId || state.activeDocumentTabId;
    const syncedTabs = getSyncedDocumentTabs(state);
    const remaining = syncedTabs.filter((tab) => tab.id !== targetId);
    const nextTabs = remaining.length > 0 ? remaining : [createDocumentTab(createEmptyDocument(UNTITLED_DOCUMENT_NAME))];
    const nextActive = targetId === state.activeDocumentTabId ? nextTabs[0] : nextTabs.find((tab) => tab.id === state.activeDocumentTabId) || nextTabs[0];

    set({
      document: nextActive.document,
      documentTabs: nextTabs,
      activeDocumentTabId: nextActive.id,
      selectedId: undefined,
      inspectorNodeId: undefined,
      history: { past: [], future: [] },
      notice: '文件标签已关闭。'
    });
  },
  importDocument: (value) => {
    const state = get();
    const nextDocument = normalizeDocument(value);
    set({
      document: nextDocument,
      documentTabs: getSyncedDocumentTabs(state, nextDocument),
      selectedId: undefined,
      inspectorNodeId: undefined,
      history: pushHistory(get().history, state.document),
      notice: '文件已打开。'
    });
    get().fitToContent();
  },
  fitToContent: () => {
    const state = get();
    const nodes = getAllNodes(state.document);
    const { width, height } = state.viewport;

    if (nodes.length === 0) {
      set({ viewport: { ...state.viewport, x: width / 2, y: height / 2, scale: 1 } });
      return;
    }

    const transforms = nodes.map((node) => getObjectAbsoluteTransform(state.document, node));
    const minX = Math.min(...transforms.map((t) => t.x));
    const minY = Math.min(...transforms.map((t) => t.y));
    const maxX = Math.max(...transforms.map((t) => t.x + t.width));
    const maxY = Math.max(...transforms.map((t) => t.y + t.height));

    const padding = 80;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;
    const scale = Math.min(2, Math.max(0.05, Math.min(width / contentWidth, height / contentHeight)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    set({
      viewport: {
        ...state.viewport,
        scale,
        x: width / 2 - centerX * scale,
        y: height / 2 - centerY * scale
      }
    });
  },
  exportDocument: () => serializeDocument(get().document),
  clearNotice: () => set({ notice: undefined }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setGridSize: (size) => {
    const next = clampGridSize(size);
    commit(
      set,
      get,
      (document) =>
        document.settings.gridSize === next
          ? document
          : { ...document, settings: { ...document.settings, gridSize: next } },
      { notice: `最小像素单位已设为 ${next}px` }
    );
  },
  focusNode: (id) => {
    const state = get();
    const node = findNode(state.document, id);
    if (!node) {
      return;
    }

    const transform = getObjectAbsoluteTransform(state.document, node);
    set({
      selectedId: id,
      viewport: {
        ...state.viewport,
        x: state.viewport.width / 2 - (transform.x + transform.width / 2) * state.viewport.scale,
        y: state.viewport.height / 2 - (transform.y + transform.height / 2) * state.viewport.scale
      }
    });
  },
  addRegion: () => {
    const index = get().document.regions.length + 1;
    const colors = ['#2d7dd2', '#63c7b2', '#c59b57', '#8d6ccf', '#4ba3d3', '#e85d75', '#a7c957'];
    const region: RegionDefinition = {
      id: createId('region'),
      name: `自定义区域 ${index}`,
      color: colors[(index - 1) % colors.length]
    };

    commit(set, get, (document) => ({
      ...document,
      regions: [...document.regions, region]
    }));
  },
  updateRegion: (regionId, patch) => {
    commit(set, get, (document) => {
      const nextRegions = document.regions.map((region) => (region.id === regionId ? { ...region, ...patch } : region));
      return {
        ...document,
        regions: nextRegions,
        scenes: patch.color
          ? document.scenes.map((scene) => (scene.regionId === regionId ? { ...scene, color: patch.color! } : scene))
          : document.scenes
      };
    });
  },
  deleteRegion: (regionId) => {
    const state = get();
    if (state.document.regions.length <= 1) {
      set({ notice: '至少需要保留一个区域。' });
      return;
    }

    const fallbackRegionId = state.document.regions.find((region) => region.id !== regionId)?.id;
    commit(set, get, (document) => {
      const fallbackRegion = document.regions.find((region) => region.id === fallbackRegionId);
      return {
        ...document,
        regions: document.regions.filter((region) => region.id !== regionId),
        scenes: document.scenes.map((scene) =>
          scene.regionId === regionId
            ? { ...scene, regionId: fallbackRegionId, color: fallbackRegion?.color || scene.color }
            : scene
        )
      };
    });
  },
  addAsset: (asset) => {
    const normalizedName = asset.name.trim() || `美术资产 ${get().document.assets.length + 1}`;
    const artAsset: ArtAsset = {
      id: createId('asset'),
      name: normalizedName,
      dataUrl: asset.dataUrl,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      createdAt: new Date().toISOString()
    };

    commit(set, get, (document) => ({
      ...document,
      assets: [...document.assets, artAsset]
    }), {
      notice: '美术资产已导入。'
    });
    return artAsset.id;
  },
  deleteAsset: (assetId) => {
    commit(set, get, (document) => removeAssetReferences(document, assetId), {
      notice: '美术资产已删除，相关对象已恢复默认图形。'
    });
  },
  setNodeAsset: (nodeId, assetId) => {
    const node = findNode(get().document, nodeId);
    if (!node || !canUseArtAsset(node)) {
      set({ notice: '美术资产只能绑定到结构或标识。' });
      return;
    }

    const exists = assetId ? get().document.assets.some((asset) => asset.id === assetId) : true;
    if (!exists) {
      set({ notice: '选择的美术资产不存在。' });
      return;
    }

    commit(set, get, (document) => updateNode(document, nodeId, { assetId: assetId || undefined }), {
      selectedId: nodeId
    });
  },
  setIdentifierAsset: (identifierId, assetId) => {
    const exists = assetId ? get().document.assets.some((asset) => asset.id === assetId) : true;
    if (!exists) {
      set({ notice: '选择的美术资产不存在。' });
      return;
    }

    commit(set, get, (document) => ({
      ...document,
      identifiers: document.identifiers.map((identifier) =>
        identifier.id === identifierId ? { ...identifier, assetId: assetId || undefined } : identifier
      )
    }));
  }
}));

let autoSaveStarted = false;
let autoSaveTimer: number | undefined;

export function startAutoSave() {
  if (autoSaveStarted || typeof window === 'undefined') {
    return;
  }

  autoSaveStarted = true;
  useEditorStore.subscribe((state) => {
    if (autoSaveTimer) {
      window.clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(getAutoSaveSnapshot(state)));
      } catch {
        // localStorage can fail when quota is exceeded; editing should continue.
      }
    }, 600);
  });
}
