import type {
  ArtAsset,
  CollectionKey,
  CreateNodeOptions,
  DoorSide,
  ElementType,
  IdentifierDefinition,
  MapYDocument,
  MapYNode,
  Point,
  RegionDefinition,
  ShapeKind,
  StitchAnchor,
  StitchEdge,
  Transform
} from './types';

export const DOCUMENT_VERSION = 8;
export const DEFAULT_GRID_SIZE = 32;

export const DEFAULT_REGIONS: RegionDefinition[] = [
  { id: 'region-unassigned', name: '未分区', color: '#2d7dd2' }
];

export const collectionByType: Record<ElementType, CollectionKey> = {
  scene: 'scenes',
  structure: 'structures',
  identifier: 'identifierInstances',
  connection: 'doors',
  annotation: 'annotations'
};

export const typeLabels: Record<ElementType, string> = {
  scene: '地图',
  structure: '结构',
  identifier: '标识',
  connection: '连接',
  annotation: '注释'
};

export const shapeLabels: Record<ShapeKind, string> = {
  rect: '矩形',
  circle: '圆形',
  diamond: '菱形',
  triangle: '三角形',
  star: '五角星',
  door: '连接',
  note: '注释'
};

export const defaultColors: Record<ElementType, string> = {
  scene: '#2d7dd2',
  structure: '#48a868',
  identifier: '#f3b33f',
  connection: '#72d6ff',
  annotation: '#b889ff'
};

export const LEGACY_IDENTIFIER_DEFINITIONS: IdentifierDefinition[] = [
  { id: 'identifier-item', name: '道具', kind: 'item', color: '#f3b33f', shape: 'diamond', visibleInWorld: true },
  { id: 'identifier-save-point', name: '存档点', kind: 'savePoint', color: '#e85d75', shape: 'circle', visibleInWorld: true },
  { id: 'identifier-marker', name: '标记', kind: 'marker', color: '#72d6ff', shape: 'diamond', visibleInWorld: true }
];

export function createEmptyDocument(name = 'Untitled'): MapYDocument {
  return {
    version: DOCUMENT_VERSION,
    name,
    settings: {
      gridSize: DEFAULT_GRID_SIZE
    },
    scenes: [],
    structures: [],
    identifiers: [],
    identifierInstances: [],
    doors: [],
    annotations: [],
    assets: [],
    regions: structuredClone(DEFAULT_REGIONS),
    stitching: {
      anchors: [],
      edges: []
    }
  };
}

export function createId(prefix: ElementType | 'asset' | 'region' | 'identifier-definition'): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomId}`;
}

export function defaultTransform(type: ElementType, gridSize = DEFAULT_GRID_SIZE): Transform {
  if (type === 'scene') {
    return { x: 0, y: 0, width: gridSize * 12, height: gridSize * 8, rotation: 0 };
  }

  if (type === 'structure') {
    return { x: gridSize, y: gridSize, width: gridSize * 4, height: gridSize * 3, rotation: 0 };
  }

  if (type === 'annotation') {
    return { x: 0, y: 0, width: gridSize * 5, height: gridSize * 2, rotation: 0 };
  }

  return { x: 0, y: 0, width: gridSize, height: gridSize, rotation: 0 };
}

export function defaultShape(type: ElementType): ShapeKind {
  if (type === 'identifier') {
    return 'diamond';
  }

  if (type === 'connection') {
    return 'door';
  }

  if (type === 'annotation') {
    return 'note';
  }

  return 'rect';
}

export function defaultCollision(type: ElementType): boolean {
  return type === 'structure';
}

export function createRectTiles(width: number, height: number, gridSize = DEFAULT_GRID_SIZE): Point[] {
  const columns = Math.max(1, Math.round(width / gridSize));
  const rows = Math.max(1, Math.round(height / gridSize));
  const tiles: Point[] = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      tiles.push({ x, y });
    }
  }

  return tiles;
}

export function createDefaultNode(
  type: ElementType,
  index: number,
  transform: Transform,
  options: CreateNodeOptions = {}
): MapYNode {
  return {
    id: createId(type),
    type,
    name: options.name?.trim() || `${typeLabels[type]} ${index}`,
    transform,
    tiles: options.tiles || (type === 'structure' ? createRectTiles(transform.width, transform.height) : undefined),
    assetId: options.assetId,
    color: options.color || defaultColors[type],
    opacity: options.opacity,
    shape: options.shape || defaultShape(type),
    hasCollision: options.hasCollision ?? defaultCollision(type),
    parentSceneId: options.parentSceneId,
    parentStructureId: options.parentStructureId,
    regionId: options.regionId,
    anchorId: options.anchorId,
    doorSide: options.doorSide,
    doorOffset: options.doorOffset,
    targetDoorId: options.targetDoorId,
    identifierDefinitionId: options.identifierDefinitionId,
    note: options.note,
    text: type === 'annotation' ? options.text || '新的注释' : options.text
  };
}

export function cloneDocument(document: MapYDocument): MapYDocument {
  return structuredClone(document);
}

export function getAllNodes(document: MapYDocument): MapYNode[] {
  return [
    ...document.scenes,
    ...document.structures,
    ...document.identifierInstances,
    ...document.doors,
    ...document.annotations
  ];
}

export function getCollection(document: MapYDocument, type: ElementType): MapYNode[] {
  return document[collectionByType[type]];
}

export function findNode(document: MapYDocument, id?: string): MapYNode | undefined {
  if (!id) {
    return undefined;
  }

  return getAllNodes(document).find((node) => node.id === id);
}

export function updateNode(document: MapYDocument, id: string, patch: Partial<MapYNode>): MapYDocument {
  const current = findNode(document, id);
  if (!current) {
    return document;
  }

  const key = collectionByType[current.type];
  return {
    ...document,
    [key]: document[key].map((node) => (node.id === id ? { ...node, ...patch } : node))
  };
}

export function addNode(document: MapYDocument, node: MapYNode): MapYDocument {
  const key = collectionByType[node.type];
  return {
    ...document,
    [key]: [...document[key], node]
  };
}

function removeStitchReferences(
  stitching: MapYDocument['stitching'],
  removedAnchorIds: string[]
): MapYDocument['stitching'] {
  return {
    anchors: stitching.anchors.filter((anchor) => !removedAnchorIds.includes(anchor.id)),
    edges: stitching.edges.filter(
      (edge) => !removedAnchorIds.includes(edge.fromAnchorId) && !removedAnchorIds.includes(edge.toAnchorId)
    )
  };
}

export function removeNodeCascade(document: MapYDocument, id: string): MapYDocument {
  const target = findNode(document, id);
  if (!target) {
    return document;
  }

  if (target.type === 'scene') {
    const removedDoorIds = document.doors.filter((node) => node.parentSceneId === id).map((node) => node.id);
    const removedAnchorIds = document.stitching.anchors
      .filter((anchor) => anchor.sceneId === id || (anchor.doorId && removedDoorIds.includes(anchor.doorId)))
      .map((anchor) => anchor.id);

    return {
      ...document,
      scenes: document.scenes.filter((node) => node.id !== id),
      structures: document.structures.filter((node) => node.parentSceneId !== id),
      identifierInstances: document.identifierInstances.filter((node) => node.parentSceneId !== id),
      doors: document.doors.filter((node) => node.parentSceneId !== id),
      annotations: document.annotations.filter((node) => node.parentSceneId !== id),
      stitching: removeStitchReferences(document.stitching, removedAnchorIds)
    };
  }

  if (target.type === 'structure') {
    return {
      ...document,
      structures: document.structures.filter((node) => node.id !== id),
      identifierInstances: document.identifierInstances.filter((node) => node.parentStructureId !== id),
      annotations: document.annotations.filter((node) => node.parentStructureId !== id)
    };
  }

  if (target.type === 'connection') {
    const removedAnchorIds = document.stitching.anchors
      .filter((anchor) => anchor.doorId === id || anchor.id === target.anchorId)
      .map((anchor) => anchor.id);
    const nextStitching = removeStitchReferences(document.stitching, removedAnchorIds);

    return {
      ...document,
      stitching: nextStitching,
      doors: document.doors
        .filter((node) => node.id !== id)
        .map((node) => (node.targetDoorId === id ? { ...node, targetDoorId: undefined } : node))
    };
  }

  const key = collectionByType[target.type];
  return {
    ...document,
    [key]: document[key].filter((node) => node.id !== id)
  };
}

function normalizeTransform(value: unknown, fallback: Transform): Transform {
  const candidate = value as Partial<Transform> | undefined;
  return {
    x: Number(candidate?.x ?? fallback.x),
    y: Number(candidate?.y ?? fallback.y),
    width: Math.max(8, Number(candidate?.width ?? fallback.width)),
    height: Math.max(8, Number(candidate?.height ?? fallback.height)),
    rotation: Number(candidate?.rotation ?? fallback.rotation)
  };
}

function normalizeTiles(value: unknown): Point[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  const tiles = value
    .map((tile) => tile as Partial<Point>)
    .filter((tile) => Number.isFinite(tile.x) && Number.isFinite(tile.y))
    .map((tile) => ({ x: Math.round(Number(tile.x)), y: Math.round(Number(tile.y)) }))
    .filter((tile) => {
      const key = `${tile.x}:${tile.y}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  return tiles.length > 0 ? tiles : undefined;
}

function sceneTransformFromLegacyTiles(transform: Transform, tiles: Point[] | undefined, gridSize: number): Transform {
  if (!tiles || tiles.length === 0) {
    return transform;
  }

  const minX = Math.min(...tiles.map((tile) => tile.x));
  const minY = Math.min(...tiles.map((tile) => tile.y));
  const maxX = Math.max(...tiles.map((tile) => tile.x));
  const maxY = Math.max(...tiles.map((tile) => tile.y));

  return {
    ...transform,
    x: transform.x + minX * gridSize,
    y: transform.y + minY * gridSize,
    width: (maxX - minX + 1) * gridSize,
    height: (maxY - minY + 1) * gridSize
  };
}

function normalizeShape(value: unknown, type: ElementType): ShapeKind {
  const shape = String(value || '');
  return ['rect', 'circle', 'diamond', 'triangle', 'star', 'door', 'note'].includes(shape)
    ? (shape as ShapeKind)
    : defaultShape(type);
}

function normalizeNode(value: unknown, type: ElementType, index: number, gridSize: number): MapYNode {
  const candidate = value as Partial<MapYNode> | undefined;
  const fallbackTransform = defaultTransform(type, gridSize);
  const rawTransform = normalizeTransform(candidate?.transform, fallbackTransform);
  const rawTiles = normalizeTiles(candidate?.tiles);
  const transform = type === 'scene' ? sceneTransformFromLegacyTiles(rawTransform, rawTiles, gridSize) : rawTransform;

  return {
    id: String(candidate?.id || createId(type)),
    type,
    name: String(candidate?.name || `${typeLabels[type]} ${index + 1}`),
    transform,
    tiles: type === 'structure' ? rawTiles || createRectTiles(transform.width, transform.height, gridSize) : undefined,
    assetId: candidate?.assetId ? String(candidate.assetId) : undefined,
    color: String(candidate?.color || defaultColors[type]),
    opacity: Number.isFinite(candidate?.opacity) ? Number(candidate?.opacity) : undefined,
    shape: normalizeShape(candidate?.shape, type),
    hasCollision: Boolean(candidate?.hasCollision ?? defaultCollision(type)),
    parentSceneId: candidate?.parentSceneId ? String(candidate.parentSceneId) : undefined,
    parentStructureId: candidate?.parentStructureId ? String(candidate.parentStructureId) : undefined,
    regionId: candidate?.regionId ? String(candidate.regionId) : undefined,
    anchorId: candidate?.anchorId ? String(candidate.anchorId) : undefined,
    doorSide: normalizeDoorSide(candidate?.doorSide),
    doorOffset: Number.isFinite(candidate?.doorOffset) ? Number(candidate?.doorOffset) : undefined,
    targetDoorId: candidate?.targetDoorId ? String(candidate.targetDoorId) : undefined,
    identifierDefinitionId: candidate?.identifierDefinitionId ? String(candidate.identifierDefinitionId) : undefined,
    note: candidate?.note ? String(candidate.note) : undefined,
    text: candidate?.text ? String(candidate.text) : type === 'annotation' ? '新的注释' : undefined
  };
}

function normalizeNodeArray(value: unknown, type: ElementType, gridSize: number): MapYNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((node, index) => normalizeNode(node, type, index, gridSize));
}

function normalizeLegacyIdentifierInstances(
  value: unknown,
  definition: IdentifierDefinition,
  gridSize: number
): MapYNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((node, index) => {
    const normalized = normalizeNode(node, 'identifier', index, gridSize);
    return {
      ...normalized,
      type: 'identifier',
      color: normalized.color || definition.color,
      shape: normalized.shape || definition.shape,
      identifierDefinitionId: definition.id,
      hasCollision: false
    };
  });
}

function normalizeIdentifierDefinitions(value: unknown): IdentifierDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((definition) => definition as Partial<IdentifierDefinition>)
    .filter((definition) => definition.id && definition.name)
    .map((definition) => ({
      id: String(definition.id),
      name: String(definition.name),
      kind: definition.kind ? String(definition.kind) : undefined,
      color: String(definition.color || defaultColors.identifier),
      shape: normalizeShape(definition.shape, 'identifier'),
      assetId: definition.assetId ? String(definition.assetId) : undefined,
      visibleInWorld: definition.visibleInWorld ?? true
    }));
}

function normalizeRegions(value: unknown): RegionDefinition[] {
  if (!Array.isArray(value)) {
    return structuredClone(DEFAULT_REGIONS);
  }

  const customRegions = value
    .map((region) => region as Partial<RegionDefinition>)
    .filter((region) => region.id && region.name && region.color)
    .map((region) => ({
      id: String(region.id),
      name: String(region.name),
      color: String(region.color)
    }));

  return customRegions.length > 0 ? customRegions : structuredClone(DEFAULT_REGIONS);
}

function normalizeAssets(value: unknown): ArtAsset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((asset) => asset as Partial<ArtAsset>)
    .filter((asset) => asset.id && asset.name && asset.dataUrl && asset.mimeType)
    .map((asset) => ({
      id: String(asset.id),
      name: String(asset.name),
      dataUrl: String(asset.dataUrl),
      mimeType: String(asset.mimeType),
      width: Number.isFinite(asset.width) ? Number(asset.width) : undefined,
      height: Number.isFinite(asset.height) ? Number(asset.height) : undefined,
      createdAt: asset.createdAt ? String(asset.createdAt) : undefined
    }));
}

function normalizeDoorSide(value: unknown): DoorSide | undefined {
  return value === 'top' || value === 'right' || value === 'bottom' || value === 'left'
    ? value
    : undefined;
}

function normalizeAnchors(value: unknown): StitchAnchor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((anchor) => anchor as Partial<StitchAnchor>)
    .filter((anchor) => anchor.id && anchor.sceneId && normalizeDoorSide(anchor.side))
    .map((anchor) => ({
      id: String(anchor.id),
      sceneId: String(anchor.sceneId),
      side: normalizeDoorSide(anchor.side)!,
      offset: Number(anchor.offset || 0),
      doorId: anchor.doorId ? String(anchor.doorId) : undefined
    }));
}

function normalizeEdges(value: unknown): StitchEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((edge) => edge as Partial<StitchEdge>)
    .filter((edge) => edge.id && edge.fromAnchorId && edge.toAnchorId)
    .map((edge) => ({
      id: String(edge.id),
      fromAnchorId: String(edge.fromAnchorId),
      toAnchorId: String(edge.toAnchorId)
    }));
}

function ensureIdentifierDefinitions(
  definitions: IdentifierDefinition[],
  legacyInstances: Record<string, MapYNode[]>,
  identifierInstances: MapYNode[]
): IdentifierDefinition[] {
  const next = [...definitions];
  const addIfNeeded = (definition: IdentifierDefinition, instances: MapYNode[]) => {
    const referenced =
      instances.length > 0 || identifierInstances.some((instance) => instance.identifierDefinitionId === definition.id);
    if (referenced && !next.some((item) => item.id === definition.id)) {
      next.push(definition);
    }
  };

  addIfNeeded(LEGACY_IDENTIFIER_DEFINITIONS[0], legacyInstances.items);
  addIfNeeded(LEGACY_IDENTIFIER_DEFINITIONS[1], legacyInstances.savePoints);
  addIfNeeded(LEGACY_IDENTIFIER_DEFINITIONS[2], legacyInstances.markers);

  return next;
}

export function normalizeDocument(value: unknown): MapYDocument {
  if (!value || typeof value !== 'object') {
    throw new Error('文件内容不是有效的 MapY JSON。');
  }

  const candidate = value as Partial<
    MapYDocument & {
      items?: unknown;
      savePoints?: unknown;
      markers?: unknown;
      doors?: unknown;
    }
  >;
  const gridSize = Number(candidate.settings?.gridSize || DEFAULT_GRID_SIZE);
  const identifierInstances = normalizeNodeArray(candidate.identifierInstances, 'identifier', gridSize);
  const legacyInstances = {
    items: normalizeLegacyIdentifierInstances(candidate.items, LEGACY_IDENTIFIER_DEFINITIONS[0], gridSize),
    savePoints: normalizeLegacyIdentifierInstances(candidate.savePoints, LEGACY_IDENTIFIER_DEFINITIONS[1], gridSize),
    markers: normalizeLegacyIdentifierInstances(candidate.markers, LEGACY_IDENTIFIER_DEFINITIONS[2], gridSize)
  };
  const identifiers = ensureIdentifierDefinitions(
    normalizeIdentifierDefinitions(candidate.identifiers),
    legacyInstances,
    identifierInstances
  );

  return {
    version: DOCUMENT_VERSION,
    name: String(candidate.name || '导入的地图'),
    settings: {
      gridSize
    },
    scenes: normalizeNodeArray(candidate.scenes, 'scene', gridSize),
    structures: normalizeNodeArray(candidate.structures, 'structure', gridSize),
    identifiers,
    identifierInstances: [
      ...identifierInstances,
      ...legacyInstances.items,
      ...legacyInstances.savePoints,
      ...legacyInstances.markers
    ],
    doors: normalizeNodeArray(candidate.doors, 'connection', gridSize),
    annotations: normalizeNodeArray(candidate.annotations, 'annotation', gridSize),
    assets: normalizeAssets(candidate.assets),
    regions: normalizeRegions(candidate.regions),
    stitching: {
      anchors: normalizeAnchors(candidate.stitching?.anchors),
      edges: normalizeEdges(candidate.stitching?.edges)
    }
  };
}

export function serializeDocument(document: MapYDocument): string {
  return JSON.stringify(
    {
      version: DOCUMENT_VERSION,
      name: document.name,
      settings: document.settings,
      scenes: document.scenes.map(({ tiles, ...scene }) => scene),
      structures: document.structures,
      identifiers: document.identifiers,
      identifierInstances: document.identifierInstances,
      doors: document.doors,
      annotations: document.annotations,
      assets: document.assets,
      regions: document.regions,
      stitching: document.stitching
    },
    null,
    2
  );
}

export function getIdentifierDefinition(
  document: MapYDocument,
  identifierDefinitionId?: string
): IdentifierDefinition | undefined {
  return document.identifiers.find((definition) => definition.id === identifierDefinitionId);
}

export function getNodeSearchText(document: MapYDocument, node: MapYNode): string {
  const parentScene = findNode(document, node.parentSceneId)?.name || '';
  const region = node.type === 'scene' ? document.regions.find((item) => item.id === node.regionId)?.name || '' : '';
  const asset = node.assetId ? document.assets.find((item) => item.id === node.assetId)?.name || '' : '';
  const identifier = node.type === 'identifier' ? getIdentifierDefinition(document, node.identifierDefinitionId)?.name || '' : '';
  return [node.name, typeLabels[node.type], identifier, parentScene, region, asset, node.note, node.text]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function nodeMatchesSearch(document: MapYDocument, node: MapYNode, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  return Boolean(trimmed) && getNodeSearchText(document, node).includes(trimmed);
}

export function isNodeVisible(): boolean {
  return true;
}

export function isNodeLocked(): boolean {
  return false;
}

export function getReachableSceneIds(document: MapYDocument): Set<string> {
  return new Set(document.scenes.map((scene) => scene.id));
}
