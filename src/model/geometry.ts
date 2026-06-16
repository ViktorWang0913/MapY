import { findNode } from './document';
import type { DoorSide, ElementType, MapYDocument, MapYNode, Point, StitchAnchor, Transform } from './types';

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(point: Point, gridSize: number): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize)
  };
}

export function snapTransform(transform: Transform, gridSize: number): Transform {
  return {
    x: snapToGrid(transform.x, gridSize),
    y: snapToGrid(transform.y, gridSize),
    width: Math.max(gridSize, snapToGrid(transform.width, gridSize)),
    height: Math.max(gridSize, snapToGrid(transform.height, gridSize)),
    rotation: transform.rotation
  };
}

export function pointInTransform(point: Point, transform: Transform): boolean {
  return (
    point.x >= transform.x &&
    point.x <= transform.x + transform.width &&
    point.y >= transform.y &&
    point.y <= transform.y + transform.height
  );
}

export function getObjectAbsoluteTransform(document: MapYDocument, node: MapYNode): Transform {
  if (node.type === 'scene' || node.type === 'annotation') {
    return node.transform;
  }

  if (node.type === 'structure') {
    const scene = findNode(document, node.parentSceneId);
    if (!scene) {
      return node.transform;
    }

    return {
      ...node.transform,
      x: scene.transform.x + node.transform.x,
      y: scene.transform.y + node.transform.y
    };
  }

  const structure = findNode(document, node.parentStructureId);
  if (structure) {
    const structureTransform = getObjectAbsoluteTransform(document, structure);
    return {
      ...node.transform,
      x: structureTransform.x + node.transform.x,
      y: structureTransform.y + node.transform.y
    };
  }

  const scene = findNode(document, node.parentSceneId);
  if (scene) {
    return {
      ...node.transform,
      x: scene.transform.x + node.transform.x,
      y: scene.transform.y + node.transform.y
    };
  }

  return node.transform;
}

export function pointInNodeTiles(document: MapYDocument, node: MapYNode, point: Point): boolean {
  if (node.type !== 'structure' || !node.tiles || node.tiles.length === 0) {
    return pointInTransform(point, getObjectAbsoluteTransform(document, node));
  }

  const transform = getObjectAbsoluteTransform(document, node);
  const gridSize = document.settings.gridSize;
  const tileX = Math.floor((point.x - transform.x) / gridSize);
  const tileY = Math.floor((point.y - transform.y) / gridSize);

  return node.tiles.some((tile) => tile.x === tileX && tile.y === tileY);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getClosestSceneAnchor(scene: MapYNode, worldPoint: Point, gridSize: number): Pick<StitchAnchor, 'side' | 'offset'> {
  const sceneTransform = scene.transform;
  const distances: Record<DoorSide, number> = {
    top: Math.abs(worldPoint.y - sceneTransform.y),
    right: Math.abs(worldPoint.x - (sceneTransform.x + sceneTransform.width)),
    bottom: Math.abs(worldPoint.y - (sceneTransform.y + sceneTransform.height)),
    left: Math.abs(worldPoint.x - sceneTransform.x)
  };
  const side = (Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0] || 'top') as DoorSide;
  const rawOffset =
    side === 'top' || side === 'bottom'
      ? worldPoint.x - sceneTransform.x
      : worldPoint.y - sceneTransform.y;
  const maxOffset = side === 'top' || side === 'bottom' ? sceneTransform.width : sceneTransform.height;

  return {
    side,
    offset: clamp(snapToGrid(rawOffset, gridSize), 0, maxOffset)
  };
}

export function getDoorRelativeTransform(
  scene: MapYNode,
  side: DoorSide,
  offset: number,
  gridSize: number
): Transform {
  const size = gridSize;
  const half = size / 2;

  if (side === 'top') {
    return { x: offset - half, y: -half, width: size, height: size, rotation: 0 };
  }

  if (side === 'right') {
    return { x: scene.transform.width - half, y: offset - half, width: size, height: size, rotation: 0 };
  }

  if (side === 'bottom') {
    return { x: offset - half, y: scene.transform.height - half, width: size, height: size, rotation: 0 };
  }

  return { x: -half, y: offset - half, width: size, height: size, rotation: 0 };
}

export function getAnchorWorldPoint(document: MapYDocument, anchor: StitchAnchor): Point | undefined {
  const scene = findNode(document, anchor.sceneId);
  if (!scene || scene.type !== 'scene') {
    return undefined;
  }

  const sceneTransform = getObjectAbsoluteTransform(document, scene);
  if (anchor.side === 'top') {
    return { x: sceneTransform.x + anchor.offset, y: sceneTransform.y };
  }

  if (anchor.side === 'right') {
    return { x: sceneTransform.x + sceneTransform.width, y: sceneTransform.y + anchor.offset };
  }

  if (anchor.side === 'bottom') {
    return { x: sceneTransform.x + anchor.offset, y: sceneTransform.y + sceneTransform.height };
  }

  return { x: sceneTransform.x, y: sceneTransform.y + anchor.offset };
}

export function getDoorAnchorWorldPoint(document: MapYDocument, door: MapYNode): Point | undefined {
  if (!door.anchorId) {
    return undefined;
  }

  const anchor = document.stitching.anchors.find((item) => item.id === door.anchorId);
  return anchor ? getAnchorWorldPoint(document, anchor) : undefined;
}

export function getRelativeTransformForWorldPoint(
  document: MapYDocument,
  node: MapYNode,
  worldPoint: Point
): Transform {
  const next = { ...node.transform, x: worldPoint.x, y: worldPoint.y };

  if (node.type === 'scene' || node.type === 'annotation') {
    return next;
  }

  if (node.type === 'structure') {
    const scene = findNode(document, node.parentSceneId);
    return scene ? { ...next, x: worldPoint.x - scene.transform.x, y: worldPoint.y - scene.transform.y } : next;
  }

  const structure = findNode(document, node.parentStructureId);
  if (structure) {
    const structureTransform = getObjectAbsoluteTransform(document, structure);
    return {
      ...next,
      x: worldPoint.x - structureTransform.x,
      y: worldPoint.y - structureTransform.y
    };
  }

  const scene = findNode(document, node.parentSceneId);
  return scene ? { ...next, x: worldPoint.x - scene.transform.x, y: worldPoint.y - scene.transform.y } : next;
}

export function findSceneAtPoint(document: MapYDocument, point: Point): MapYNode | undefined {
  return [...document.scenes]
    .reverse()
    .find((scene) => pointInTransform(point, getObjectAbsoluteTransform(document, scene)));
}

export function findStructureAtPoint(document: MapYDocument, point: Point): MapYNode | undefined {
  return [...document.structures]
    .reverse()
    .find((structure) => pointInNodeTiles(document, structure, point));
}

export function getParentWorldOrigin(
  document: MapYDocument,
  type: ElementType,
  parentSceneId?: string,
  parentStructureId?: string
): Point {
  if (type === 'scene' || type === 'annotation') {
    return { x: 0, y: 0 };
  }

  if (type === 'structure' || type === 'connection') {
    const scene = findNode(document, parentSceneId);
    return scene ? { x: scene.transform.x, y: scene.transform.y } : { x: 0, y: 0 };
  }

  const structure = findNode(document, parentStructureId);
  if (structure) {
    const transform = getObjectAbsoluteTransform(document, structure);
    return { x: transform.x, y: transform.y };
  }

  const scene = findNode(document, parentSceneId);
  return scene ? { x: scene.transform.x, y: scene.transform.y } : { x: 0, y: 0 };
}
