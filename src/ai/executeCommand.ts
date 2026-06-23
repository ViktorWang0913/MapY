import {
  addNode,
  cloneDocument,
  createDefaultNode,
  createEmptyDocument,
  createId,
  createRectTiles,
  findNode,
  getIdentifierDefinition,
  removeNodeCascade,
  updateNode
} from '../model/document';
import { getDoorRelativeTransform, snapTransform } from '../model/geometry';
import type { DoorSide, IdentifierDefinition, MapYDocument, MapYNode, Transform } from '../model/types';
import type { AiMapOperation, AiMapPlan, AiPlanPreview, AiPlanSummary } from './mapCommands';
import { prepareMapPlan } from './validateCommand';

function resolveRef(ref: string | undefined, refs: Map<string, string>): string | undefined {
  return ref ? refs.get(ref) || ref : undefined;
}

function graphId(prefix: 'anchor' | 'edge'): string {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomId}`;
}

function nameForId(document: MapYDocument, id: string): string {
  return findNode(document, id)?.name || document.identifiers.find((item) => item.id === id)?.name || id;
}

function mergeTransform(current: Transform, patch: Partial<Transform>, gridSize: number): Transform {
  return snapTransform({ ...current, ...patch }, gridSize);
}

function createDoor(
  document: MapYDocument,
  sceneId: string,
  side: DoorSide,
  name: string
): { document: MapYDocument; door: MapYNode } {
  const scene = findNode(document, sceneId)!;
  const offset = (side === 'top' || side === 'bottom' ? scene.transform.width : scene.transform.height) / 2;
  const anchorId = graphId('anchor');
  const door = createDefaultNode(
    'connection',
    document.doors.length + 1,
    getDoorRelativeTransform(scene, side, offset, document.settings.gridSize),
    { name, parentSceneId: sceneId, anchorId, doorSide: side, doorOffset: offset, hasCollision: false }
  );
  return {
    door,
    document: {
      ...addNode(document, door),
      stitching: {
        ...document.stitching,
        anchors: [...document.stitching.anchors, { id: anchorId, sceneId, side, offset, doorId: door.id }]
      }
    }
  };
}

function applyOperation(
  document: MapYDocument,
  operation: AiMapOperation,
  refs: Map<string, string>,
  summary: AiPlanSummary
): MapYDocument {
  const gridSize = document.settings.gridSize;

  switch (operation.op) {
    case 'create_scene': {
      const node = createDefaultNode(
        'scene',
        document.scenes.length + 1,
        snapTransform(operation.transform, gridSize),
        operation
      );
      refs.set(operation.tempId, node.id);
      summary.created.push(node.name);
      return addNode(document, node);
    }
    case 'create_structure': {
      const sceneId = resolveRef(operation.sceneRef, refs);
      const scene = findNode(document, sceneId);
      if (!scene || scene.type !== 'scene') throw new Error(`找不到结构所属地图：${operation.sceneRef}`);
      const absolute = snapTransform(operation.transform, gridSize);
      const relative = { ...absolute, x: absolute.x - scene.transform.x, y: absolute.y - scene.transform.y };
      const node = createDefaultNode('structure', document.structures.length + 1, relative, {
        ...operation,
        parentSceneId: scene.id,
        tiles: operation.tiles || createRectTiles(relative.width, relative.height, gridSize)
      });
      refs.set(operation.tempId, node.id);
      summary.created.push(node.name);
      return addNode(document, node);
    }
    case 'create_identifier_definition': {
      const id = createId('identifier-definition');
      const definition: IdentifierDefinition = {
        id,
        name: operation.name,
        kind: operation.kind || operation.name,
        color: operation.color,
        shape: operation.shape,
        visibleInWorld: true
      };
      refs.set(operation.tempId, id);
      summary.created.push(definition.name);
      return { ...document, identifiers: [...document.identifiers, definition] };
    }
    case 'place_identifier': {
      const definitionId = resolveRef(operation.definitionRef, refs);
      const sceneId = resolveRef(operation.sceneRef, refs);
      const structureId = resolveRef(operation.structureRef, refs);
      const definition = getIdentifierDefinition(document, definitionId);
      const scene = findNode(document, sceneId);
      const structure = findNode(document, structureId);
      if (!definition || !scene || scene.type !== 'scene') throw new Error('标识引用的类型或地图不存在。');
      if (structure && (structure.type !== 'structure' || structure.parentSceneId !== scene.id)) {
        throw new Error('标识引用的结构不属于指定地图。');
      }
      const parent = structure?.type === 'structure' ? structure : scene;
      const parentX = parent.type === 'structure' ? scene.transform.x + parent.transform.x : scene.transform.x;
      const parentY = parent.type === 'structure' ? scene.transform.y + parent.transform.y : scene.transform.y;
      const absolute = snapTransform(operation.transform, gridSize);
      const node = createDefaultNode('identifier', document.identifierInstances.length + 1, {
        ...absolute,
        x: absolute.x - parentX,
        y: absolute.y - parentY,
        width: gridSize,
        height: gridSize
      }, {
        name: operation.name,
        color: definition.color,
        shape: definition.shape,
        assetId: definition.assetId,
        hasCollision: false,
        identifierDefinitionId: definition.id,
        parentSceneId: scene.id,
        parentStructureId: parent.type === 'structure' ? parent.id : undefined
      });
      refs.set(operation.tempId, node.id);
      summary.created.push(node.name);
      return addNode(document, node);
    }
    case 'create_connection': {
      const fromSceneId = resolveRef(operation.fromSceneRef, refs);
      const toSceneId = resolveRef(operation.toSceneRef, refs);
      if (!findNode(document, fromSceneId) || !findNode(document, toSceneId)) throw new Error('连接引用的地图不存在。');
      if (fromSceneId === toSceneId) throw new Error('连接的起点和终点不能是同一地图。');
      const first = createDoor(document, fromSceneId!, operation.fromSide || 'right', `${operation.name || '连接'} A`);
      const second = createDoor(first.document, toSceneId!, operation.toSide || 'left', `${operation.name || '连接'} B`);
      const next = {
        ...second.document,
        doors: second.document.doors.map((door) =>
          door.id === first.door.id ? { ...door, targetDoorId: second.door.id } :
          door.id === second.door.id ? { ...door, targetDoorId: first.door.id } : door
        ),
        stitching: {
          ...second.document.stitching,
          edges: [...second.document.stitching.edges, {
            id: graphId('edge'),
            fromAnchorId: first.door.anchorId!,
            toAnchorId: second.door.anchorId!
          }]
        }
      };
      refs.set(operation.tempId, first.door.id);
      summary.created.push(operation.name || '场景连接');
      return next;
    }
    case 'add_annotation': {
      const sceneId = resolveRef(operation.sceneRef, refs);
      const structureId = resolveRef(operation.structureRef, refs);
      const scene = findNode(document, sceneId);
      const structure = findNode(document, structureId);
      if (sceneId && scene?.type !== 'scene') throw new Error('注释引用的地图不存在。');
      if (structureId && (structure?.type !== 'structure' || (sceneId && structure.parentSceneId !== sceneId))) {
        throw new Error('注释引用的结构不存在或不属于指定地图。');
      }
      const node = createDefaultNode('annotation', document.annotations.length + 1, snapTransform(operation.transform, gridSize), {
        name: operation.name,
        text: operation.text,
        parentSceneId: sceneId,
        parentStructureId: structureId
      });
      refs.set(operation.tempId, node.id);
      summary.created.push(node.name);
      return addNode(document, node);
    }
    case 'update_entity': {
      const id = resolveRef(operation.id, refs)!;
      const node = findNode(document, id);
      const definition = document.identifiers.find((item) => item.id === id);
      if (!node && !definition) throw new Error(`找不到要更新的对象：${operation.id}`);
      if (definition) {
        summary.updated.push(definition.name);
        return {
          ...document,
          identifiers: document.identifiers.map((item) => item.id === id ? { ...item, ...operation.patch } : item),
          identifierInstances: document.identifierInstances.map((item) =>
            item.identifierDefinitionId === id
              ? {
                  ...item,
                  color: operation.patch.color || item.color,
                  shape: operation.patch.shape || item.shape
                }
              : item
          )
        };
      }
      const {
        transform,
        kind: _kind,
        visibleInWorld: _visibleInWorld,
        parentSceneId,
        parentStructureId,
        identifierDefinitionId,
        ...nodePatch
      } = operation.patch;
      if ((node!.type === 'scene' || node!.type === 'structure') &&
          (transform?.width !== undefined || transform?.height !== undefined)) {
        throw new Error('AI 首版不调整已有地图或结构的尺寸，请创建新对象或手工缩放。');
      }
      if (node!.type === 'connection' && (transform || parentSceneId || parentStructureId)) {
        throw new Error('连接点的位置和父级不能通过通用更新操作修改。');
      }
      const resolvedParentSceneId = resolveRef(parentSceneId, refs);
      const resolvedParentStructureId = resolveRef(parentStructureId, refs);
      const resolvedDefinitionId = resolveRef(identifierDefinitionId, refs);
      if (resolvedParentSceneId && findNode(document, resolvedParentSceneId)?.type !== 'scene') {
        throw new Error('更新引用的父地图不存在。');
      }
      const resolvedStructure = findNode(document, resolvedParentStructureId);
      if (resolvedParentStructureId && resolvedStructure?.type !== 'structure') {
        throw new Error('更新引用的父结构不存在。');
      }
      if (resolvedDefinitionId && !getIdentifierDefinition(document, resolvedDefinitionId)) {
        throw new Error('更新引用的标识类型不存在。');
      }
      const patch: Partial<MapYNode> = {
        ...nodePatch,
        ...(parentSceneId !== undefined ? { parentSceneId: resolvedParentSceneId } : {}),
        ...(parentStructureId !== undefined ? { parentStructureId: resolvedParentStructureId } : {}),
        ...(identifierDefinitionId !== undefined ? { identifierDefinitionId: resolvedDefinitionId } : {}),
        ...(transform ? { transform: mergeTransform(node!.transform, transform, gridSize) } : {})
      };
      summary.updated.push(node!.name);
      return updateNode(document, id, patch);
    }
    case 'delete_entity': {
      const id = resolveRef(operation.id, refs)!;
      const node = findNode(document, id);
      const definition = document.identifiers.find((item) => item.id === id);
      if (!node && !definition) throw new Error(`找不到要删除的对象：${operation.id}`);
      if (definition) {
        summary.deleted.push(definition.name);
        return {
          ...document,
          identifiers: document.identifiers.filter((item) => item.id !== id),
          identifierInstances: document.identifierInstances.filter((item) => item.identifierDefinitionId !== id)
        };
      }
      summary.deleted.push(nameForId(document, id));
      return removeNodeCascade(document, id);
    }
  }
}

export function previewAiMapPlan(plan: AiMapPlan, currentDocument: MapYDocument): AiPlanPreview {
  const prepared = prepareMapPlan(plan, currentDocument);
  if (!prepared.ok) throw new Error(prepared.error);
  const normalizedPlan = prepared.plan;

  let document = normalizedPlan.intent === 'create_document'
    ? createEmptyDocument(normalizedPlan.documentName?.trim() || 'AI 生成地图')
    : cloneDocument(currentDocument);
  const refs = new Map<string, string>();
  const summary: AiPlanSummary = { created: [], updated: [], deleted: [] };

  for (const operation of normalizedPlan.operations) {
    document = applyOperation(document, operation, refs, summary);
  }

  return { document: { ...document, name: normalizedPlan.documentName?.trim() || document.name }, summary };
}
