import { defaultTransform, getAllNodes } from '../model/document';
import type { MapYDocument } from '../model/types';
import type {
  AiPlan,
  AiRepair,
  SceneLayoutPattern,
  ValidationIssue
} from './aiTypes';

export interface RepairedAiPlan {
  intent: 'create_document' | 'patch_document' | 'ask_clarification';
  documentName?: string;
  clarification?: string;
  operations: Record<string, unknown>[];
}

export interface RepairAiPlanResult {
  plan: RepairedAiPlan;
  repairs: AiRepair[];
  issues: ValidationIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(...values: unknown[]): string | undefined {
  const value = values.find((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function geometryValue(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  return Number(value);
}

function canonicalIntent(value: unknown): RepairedAiPlan['intent'] | undefined {
  const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['create_document', 'create', 'new', 'new_document', 'create_map'].includes(normalized)) return 'create_document';
  if (['patch_document', 'patch', 'edit', 'update', 'modify'].includes(normalized)) return 'patch_document';
  if (['ask_clarification', 'clarification', 'clarify', 'ask'].includes(normalized)) return 'ask_clarification';
  return undefined;
}

function canonicalOperation(value: unknown): string | undefined {
  const normalized = String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/^\/|[^a-z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^operation_/, '')
    .replace(/_operation$/, '');
  const aliases: Record<string, string> = {
    create_scene: 'create_scene',
    scene_create: 'create_scene',
    add_scene: 'create_scene',
    new_scene: 'create_scene',
    scene: 'create_scene',
    zone: 'create_scene',
    area: 'create_scene',
    level: 'create_scene',
    add_zone: 'create_scene',
    create_zone: 'create_scene',
    add_area: 'create_scene',
    create_area: 'create_scene',
    create_region: 'create_scene',
    创建场景: 'create_scene',
    创建区域: 'create_scene',
    create_structure: 'create_structure',
    structure_create: 'create_structure',
    add_structure: 'create_structure',
    structure: 'create_structure',
    platform: 'create_structure',
    创建结构: 'create_structure',
    create_identifier_definition: 'create_identifier_definition',
    identifier_definition_create: 'create_identifier_definition',
    create_marker_type: 'create_identifier_definition',
    identifier_definition: 'create_identifier_definition',
    marker_type: 'create_identifier_definition',
    创建标识类型: 'create_identifier_definition',
    place_identifier: 'place_identifier',
    identifier_place: 'place_identifier',
    add_identifier: 'place_identifier',
    add_marker: 'place_identifier',
    create_identifier: 'place_identifier',
    place_marker: 'place_identifier',
    identifier: 'place_identifier',
    marker: 'place_identifier',
    放置标识: 'place_identifier',
    创建标识: 'place_identifier',
    create_connection: 'create_connection',
    connection_create: 'create_connection',
    add_connection: 'create_connection',
    connect: 'create_connection',
    connection: 'create_connection',
    link: 'create_connection',
    创建连接: 'create_connection',
    连接场景: 'create_connection',
    add_annotation: 'add_annotation',
    create_annotation: 'add_annotation',
    annotation_add: 'add_annotation',
    annotation: 'add_annotation',
    note: 'add_annotation',
    add_note: 'add_annotation',
    添加注释: 'add_annotation',
    update_entity: 'update_entity',
    entity_update: 'update_entity',
    update: 'update_entity',
    move: 'update_entity',
    edit: 'update_entity',
    更新对象: 'update_entity',
    修改对象: 'update_entity',
    delete_entity: 'delete_entity',
    entity_delete: 'delete_entity',
    delete: 'delete_entity',
    remove: 'delete_entity',
    删除对象: 'delete_entity'
  };
  return aliases[normalized];
}

interface NormalizedRawOperation {
  raw: Record<string, unknown>;
  type?: string;
  receivedType?: string;
}

function payloadFrom(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const key of ['arguments', 'parameters', 'params', 'payload', 'data', 'input']) {
    if (isRecord(raw[key])) return raw[key] as Record<string, unknown>;
    if (typeof raw[key] === 'string') {
      try {
        const parsed = JSON.parse(raw[key]);
        if (isRecord(parsed)) return parsed;
      } catch {
        // Invalid embedded JSON is handled later as a missing or invalid field.
      }
    }
  }
  return undefined;
}

function normalizeRawOperation(raw: Record<string, unknown>): NormalizedRawOperation {
  const keys = Object.keys(raw);
  if (keys.length === 1) {
    const wrappedType = canonicalOperation(keys[0]);
    const wrappedValue = raw[keys[0]];
    if (wrappedType && isRecord(wrappedValue)) {
      return {
        raw: { ...wrappedValue, type: wrappedType },
        type: wrappedType,
        receivedType: keys[0]
      };
    }
  }

  for (const key of ['operation', 'function', 'tool_call', 'toolCall']) {
    if (isRecord(raw[key])) {
      const nested = normalizeRawOperation(raw[key] as Record<string, unknown>);
      if (nested.type) {
        return {
          raw: { ...raw, ...nested.raw },
          type: nested.type,
          receivedType: nested.receivedType
        };
      }
    }
  }

  const payload = payloadFrom(raw);
  const merged = payload ? { ...raw, ...payload } : raw;
  const candidates = [
    raw.type,
    raw.op,
    raw.command,
    typeof raw.operation === 'string' ? raw.operation : undefined,
    raw.operation_type,
    raw.operationType,
    raw.action_type,
    raw.actionType,
    raw.action,
    raw.function,
    raw.tool,
    payload ? raw.name : undefined
  ];

  for (const candidate of candidates) {
    const type = canonicalOperation(candidate);
    if (type) {
      return {
        raw: { ...merged, type },
        type,
        receivedType: String(candidate)
      };
    }
  }

  const action = stringValue(
    raw.action,
    raw.verb,
    raw.mode,
    typeof raw.operation === 'string' ? raw.operation : undefined,
    raw.type
  );
  const entity = stringValue(
    raw.entity,
    raw.entity_type,
    raw.entityType,
    raw.object_type,
    raw.objectType,
    raw.target_type,
    raw.targetType,
    raw.resource,
    raw.subject
  );
  if (action && entity) {
    const type = canonicalOperation(`${action}_${entity}`) || canonicalOperation(`${entity}_${action}`);
    if (type) {
      return {
        raw: { ...merged, type },
        type,
        receivedType: `${action} ${entity}`
      };
    }
  }

  const receivedType = candidates.find((candidate) =>
    typeof candidate === 'string' && candidate.trim()
  );
  return {
    raw: merged,
    receivedType: typeof receivedType === 'string' ? receivedType : undefined
  };
}

function canonicalLayout(value: unknown): SceneLayoutPattern {
  const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['linear', 'line'].includes(normalized)) return 'linear';
  if (['s_curve', 's_like', 's', 's型'].includes(normalized)) return 's_curve';
  if (['hub', 'center'].includes(normalized)) return 'hub';
  if (['arena', 'battle'].includes(normalized)) return 'arena';
  if (['branch', 'branching'].includes(normalized)) return 'branch';
  return 'free';
}

function layoutName(layout: SceneLayoutPattern, index: number): string {
  const names: Record<SceneLayoutPattern, string> = {
    linear: '线性推进区',
    s_curve: 'S 型回环区',
    hub: '中心枢纽区',
    arena: '战斗区域',
    branch: '分支探索区',
    free: `区域 ${index + 1}`
  };
  return names[layout];
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'item';
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function planId(provided: string | undefined, fallback: string, used: Set<string>): string {
  if (provided) {
    used.add(provided);
    return provided;
  }
  return uniqueId(fallback, used);
}

function positionFrom(value: Record<string, unknown>, fallbackX: number, fallbackY: number, grid: number) {
  const source = isRecord(value.transform) ? value.transform : isRecord(value.position) ? value.position : {};
  const x = geometryValue(source.x, fallbackX);
  const y = geometryValue(source.y, fallbackY);
  return {
    x: Number.isFinite(x) ? Math.round(x / grid) * grid : x,
    y: Number.isFinite(y) ? Math.round(y / grid) * grid : y
  };
}

function repairNote(repairs: AiRepair[], code: string, message: string, operationIndex: number) {
  repairs.push({ code, message, operationIndex });
}

function findByExactId(document: MapYDocument, target: string): string | undefined {
  if (getAllNodes(document).some((node) => node.id === target)) return target;
  if (document.identifiers.some((definition) => definition.id === target)) return target;
  return undefined;
}

function resolveSceneReference(
  document: MapYDocument,
  createdScenes: Array<{ id: string; name: string }>,
  target: string
): string | undefined {
  const normalized = target.toLowerCase();
  const exactId = createdScenes.find((scene) => scene.id === target)?.id ||
    document.scenes.find((scene) => scene.id === target)?.id;
  if (exactId) return exactId;

  const nameMatches = [
    ...createdScenes.filter((scene) => scene.name.toLowerCase() === normalized),
    ...document.scenes.filter((scene) => scene.name.toLowerCase() === normalized)
  ];
  if (nameMatches.length === 1) return nameMatches[0].id;
  if (nameMatches.length > 1) return undefined;
  return target;
}

function resolveEntityReference(document: MapYDocument, target?: string): string | undefined {
  if (!target) return undefined;
  const exactId = findByExactId(document, target);
  if (exactId) return exactId;
  const normalized = target.toLowerCase();
  const matches = [
    ...getAllNodes(document).filter((node) => node.name.toLowerCase() === normalized),
    ...document.identifiers.filter((definition) => definition.name.toLowerCase() === normalized)
  ];
  return matches.length === 1 ? matches[0].id : undefined;
}

const operationOrder: Record<string, number> = {
  create_identifier_definition: 0,
  create_scene: 1,
  create_structure: 2,
  place_identifier: 3,
  create_connection: 4,
  add_annotation: 5,
  update_entity: 6,
  delete_entity: 7
};

export function repairAiPlan(plan: AiPlan, document: MapYDocument): RepairAiPlanResult {
  const repairs: AiRepair[] = [];
  const issues: ValidationIssue[] = [];
  const intent = canonicalIntent(plan.intent);
  const rawOperations = Array.isArray(plan.operations)
    ? plan.operations
    : Array.isArray(plan.commands)
      ? plan.commands
      : Array.isArray(plan.actions)
        ? plan.actions
        : Array.isArray(plan.steps)
          ? plan.steps
          : Array.isArray(plan.tasks)
            ? plan.tasks
            : [];
  const usedIds = new Set<string>();
  const operations: Record<string, unknown>[] = [];
  const createdSceneIds: string[] = [];
  const createdScenes: Array<{ id: string; name: string }> = [];
  const definitionRefs = new Map<string, string>();
  const identifierCounts = new Map<string, number>();
  const grid = Math.max(1, document.settings.gridSize);
  const sceneDefaults = defaultTransform('scene', grid);
  const structureDefaults = defaultTransform('structure', grid);

  if (!intent) {
    issues.push({ level: 'error', code: 'missing_intent', message: 'AI Plan 缺少可识别的 intent。' });
  }

  if (intent === 'ask_clarification') {
    return {
      plan: {
        intent,
        clarification: stringValue(plan.clarification, plan.question) || '请补充更明确的地图需求。',
        operations: []
      },
      repairs,
      issues
    };
  }

  const orderedOperations = rawOperations
    .map((raw, index) => {
      const normalized = isRecord(raw) ? normalizeRawOperation(raw) : undefined;
      return {
        raw: normalized?.raw ?? raw,
        index,
        type: normalized?.type,
        receivedType: normalized?.receivedType
      };
    })
    .sort((a, b) => (operationOrder[a.type || ''] ?? 99) - (operationOrder[b.type || ''] ?? 99));

  orderedOperations.forEach(({ raw, index, type, receivedType }) => {
    if (!isRecord(raw)) {
      issues.push({ level: 'error', code: 'invalid_operation', message: '操作不是对象。', operationIndex: index });
      return;
    }
    if (!type) {
      const fields = Object.keys(raw).slice(0, 6).join(', ');
      issues.push({
        level: 'error',
        code: 'unknown_operation',
        message: receivedType
          ? `第 ${index + 1} 项 operation 类型“${receivedType}”无法识别。`
          : `第 ${index + 1} 项 operation 缺少可识别的类型字段${fields ? `（现有字段：${fields}）` : ''}。`,
        operationIndex: index
      });
      return;
    }

    if (type === 'create_scene') {
      const rawLayout = raw.layout_pattern ?? raw.layoutPattern ?? raw.topology;
      const layout = canonicalLayout(rawLayout);
      if (rawLayout === undefined || rawLayout === null || rawLayout === '') {
        repairNote(repairs, 'scene_layout', '已使用自由布局。', index);
      }
      let sceneId = stringValue(raw.scene_id, raw.sceneId, raw.tempId, raw.id);
      if (!sceneId) {
        sceneId = uniqueId(`scene_${layout === 'free' ? index + 1 : layout}_01`, usedIds);
        repairNote(repairs, 'scene_id', `已为场景生成 ID：${sceneId}`, index);
      } else {
        sceneId = planId(sceneId, sceneId, usedIds);
      }
      let name = stringValue(raw.name, raw.label);
      if (!name) {
        name = layoutName(layout, index);
        repairNote(repairs, 'scene_name', `已命名场景：${name}`, index);
      }
      const position = positionFrom(raw, index * 900, 0, grid);
      if (!isRecord(raw.position) && !isRecord(raw.transform)) {
        repairNote(repairs, 'scene_position', `已排列场景：${name}`, index);
      }
      const transform = isRecord(raw.transform) ? raw.transform : {};
      if (transform.width === undefined && raw.width === undefined) {
        repairNote(repairs, 'scene_width', `已使用默认场景宽度：${sceneDefaults.width}`, index);
      }
      if (transform.height === undefined && raw.height === undefined) {
        repairNote(repairs, 'scene_height', `已使用默认场景高度：${sceneDefaults.height}`, index);
      }
      if (transform.rotation === undefined && raw.rotation === undefined) {
        repairNote(repairs, 'scene_rotation', '已使用默认旋转角度：0', index);
      }
      operations.push({
        type,
        scene_id: sceneId,
        name,
        layout_pattern: layout,
        position,
        width: geometryValue(transform.width ?? raw.width, sceneDefaults.width),
        height: geometryValue(transform.height ?? raw.height, sceneDefaults.height),
        rotation: geometryValue(transform.rotation ?? raw.rotation, sceneDefaults.rotation),
        color: stringValue(raw.color),
        opacity: numberValue(raw.opacity)
      });
      createdSceneIds.push(sceneId);
      createdScenes.push({ id: sceneId, name });
      return;
    }

    if (type === 'create_identifier_definition') {
      const identifierType = stringValue(raw.identifier_type, raw.kind, raw.name, raw.tempId) || `identifier_${index + 1}`;
      const providedId = stringValue(raw.definition_id, raw.definitionId, raw.tempId, raw.id);
      const id = planId(providedId, `identifier_definition_${slug(identifierType)}`, usedIds);
      if (!providedId) {
        repairNote(repairs, 'definition_id', `已为标识类型生成 ID：${id}`, index);
      }
      definitionRefs.set(identifierType.toLowerCase(), id);
      operations.push({
        type,
        identifier_type: identifierType,
        definition_id: id,
        name: stringValue(raw.name) || identifierType,
        color: stringValue(raw.color) || '#f3b33f',
        shape: stringValue(raw.shape) || 'diamond'
      });
      return;
    }

    if (type === 'place_identifier') {
      const identifierType = stringValue(raw.identifier_type, raw.kind, raw.definitionRef) || 'marker';
      let definitionRef = stringValue(raw.definitionRef, raw.definition_ref, raw.identifierDefinitionId);
      if (!definitionRef) {
        definitionRef = definitionRefs.get(identifierType.toLowerCase());
      }
      if (!definitionRef) {
        const existing = document.identifiers.find((item) =>
          item.kind?.toLowerCase() === identifierType.toLowerCase() ||
          item.name.toLowerCase() === identifierType.toLowerCase()
        );
        definitionRef = existing?.id;
      }
      if (!definitionRef) {
        definitionRef = uniqueId(`identifier_definition_${slug(identifierType)}`, usedIds);
        definitionRefs.set(identifierType.toLowerCase(), definitionRef);
        operations.push({
          type: 'create_identifier_definition',
          identifier_type: identifierType,
          definition_id: definitionRef,
          name: identifierType === 'key' ? '钥匙' : identifierType,
          color: identifierType === 'boss' ? '#e85d75' : '#f3b33f',
          shape: identifierType === 'boss' ? 'star' : 'diamond'
        });
        repairNote(repairs, 'identifier_definition', `已创建标识类型：${identifierType}`, index);
      }
      const count = (identifierCounts.get(identifierType) || 0) + 1;
      identifierCounts.set(identifierType, count);
      let identifierId = stringValue(raw.identifier_id, raw.identifierId, raw.tempId, raw.id);
      if (!identifierId) {
        identifierId = uniqueId(`${slug(identifierType)}_${String(count).padStart(2, '0')}`, usedIds);
        repairNote(repairs, 'identifier_id', `已为 ${identifierType} 生成 ID`, index);
      } else {
        identifierId = planId(identifierId, identifierId, usedIds);
      }
      let name = stringValue(raw.name, raw.label);
      if (!name) {
        name = identifierType === 'key' ? `钥匙 ${count}` : identifierType.toLowerCase() === 'boss' ? `Boss ${count}` : `${identifierType} ${count}`;
        repairNote(repairs, 'identifier_name', `已命名标识：${name}`, index);
      }
      const requestedScene = stringValue(raw.scene_id, raw.sceneId, raw.sceneRef);
      const sceneRef = requestedScene
        ? resolveSceneReference(document, createdScenes, requestedScene)
        :
        (createdSceneIds.length === 1 ? createdSceneIds[0] : document.scenes.length === 1 ? document.scenes[0].id : undefined);
      const position = positionFrom(raw, 240 + index * 80, 160, grid);
      if (!isRecord(raw.position) && !isRecord(raw.transform)) {
        repairNote(repairs, 'identifier_position', `已放置标识：${name}`, index);
      }
      operations.push({
        type,
        identifier_id: identifierId,
        identifier_type: identifierType,
        definition_ref: definitionRef,
        name,
        scene_id: sceneRef,
        structure_id: stringValue(raw.structure_id, raw.structureId, raw.structureRef),
        position
      });
      return;
    }

    if (type === 'create_connection') {
      const candidateScenes = createdSceneIds.length === 2
        ? createdSceneIds
        : intent === 'patch_document' && document.scenes.length === 2
          ? document.scenes.map((scene) => scene.id)
          : [];
      const requestedFrom = stringValue(raw.from_scene_id, raw.fromSceneId, raw.fromSceneRef, raw.from);
      const requestedTo = stringValue(raw.to_scene_id, raw.toSceneId, raw.toSceneRef, raw.to);
      const from = requestedFrom
        ? resolveSceneReference(document, createdScenes, requestedFrom)
        : candidateScenes[0];
      const to = requestedTo
        ? resolveSceneReference(document, createdScenes, requestedTo)
        : candidateScenes[1];
      if (!from || !to) {
        issues.push({
          level: 'error',
          code: 'ambiguous_connection',
          message: '无法确定要连接的两个地图，请明确名称。',
          operationIndex: index,
          operationType: type
        });
      }
      const providedId = stringValue(raw.connection_id, raw.connectionId, raw.tempId, raw.id);
      const connectionId = planId(providedId, `connection_${index + 1}`, usedIds);
      if (!providedId) {
        repairNote(repairs, 'connection_id', `已为连接生成 ID：${connectionId}`, index);
      }
      let name = stringValue(raw.name);
      if (!name && from && to) {
        name = `${from} → ${to}`;
        repairNote(repairs, 'connection_name', `已命名连接：${name}`, index);
      }
      operations.push({ type, connection_id: connectionId, name, from_scene_id: from, to_scene_id: to });
      return;
    }

    if (type === 'create_structure') {
      const providedId = stringValue(raw.structure_id, raw.structureId, raw.tempId, raw.id);
      const structureId = planId(providedId, `structure_${index + 1}`, usedIds);
      if (!providedId) {
        repairNote(repairs, 'structure_id', `已为结构生成 ID：${structureId}`, index);
      }
      const requestedScene = stringValue(raw.scene_id, raw.sceneId, raw.sceneRef);
      const sceneRef = requestedScene
        ? resolveSceneReference(document, createdScenes, requestedScene)
        :
        (createdSceneIds.length === 1 ? createdSceneIds[0] : document.scenes.length === 1 ? document.scenes[0].id : undefined);
      const position = positionFrom(raw, 64, 64, grid);
      const name = stringValue(raw.name) || `结构 ${index + 1}`;
      if (!stringValue(raw.name)) repairNote(repairs, 'structure_name', `已命名结构：${name}`, index);
      if (!isRecord(raw.position) && !isRecord(raw.transform)) {
        repairNote(repairs, 'structure_position', `已放置结构：${name}`, index);
      }
      const transform = isRecord(raw.transform) ? raw.transform : {};
      if (transform.width === undefined && raw.width === undefined) {
        repairNote(repairs, 'structure_width', `已使用默认结构宽度：${structureDefaults.width}`, index);
      }
      if (transform.height === undefined && raw.height === undefined) {
        repairNote(repairs, 'structure_height', `已使用默认结构高度：${structureDefaults.height}`, index);
      }
      if (transform.rotation === undefined && raw.rotation === undefined) {
        repairNote(repairs, 'structure_rotation', '已使用默认旋转角度：0', index);
      }
      operations.push({
        type,
        structure_id: structureId,
        scene_id: sceneRef,
        name,
        position,
        width: geometryValue(transform.width ?? raw.width, structureDefaults.width),
        height: geometryValue(transform.height ?? raw.height, structureDefaults.height),
        rotation: geometryValue(transform.rotation ?? raw.rotation, structureDefaults.rotation),
        color: stringValue(raw.color),
        has_collision: typeof raw.hasCollision === 'boolean' ? raw.hasCollision : undefined
      });
      return;
    }

    if (type === 'add_annotation') {
      const providedId = stringValue(raw.annotation_id, raw.annotationId, raw.tempId, raw.id);
      const annotationId = planId(providedId, `annotation_${index + 1}`, usedIds);
      if (!providedId) {
        repairNote(repairs, 'annotation_id', `已为注释生成 ID：${annotationId}`, index);
      }
      const requestedScene = stringValue(raw.scene_id, raw.sceneId, raw.sceneRef);
      if (!isRecord(raw.position) && !isRecord(raw.transform)) {
        repairNote(repairs, 'annotation_position', '已为注释补充默认位置。', index);
      }
      operations.push({
        type,
        annotation_id: annotationId,
        scene_id: requestedScene
          ? resolveSceneReference(document, createdScenes, requestedScene)
          : undefined,
        structure_id: stringValue(raw.structure_id, raw.structureId, raw.structureRef),
        text: stringValue(raw.text, raw.content, raw.note),
        position: positionFrom(raw, 0, 0, grid)
      });
      return;
    }

    if (type === 'update_entity') {
      const requestedTarget = stringValue(raw.entity_id, raw.entityId, raw.id, raw.targetId, raw.ref);
      const entityId = resolveEntityReference(document, requestedTarget);
      if (!entityId) {
        issues.push({
          level: 'error',
          code: 'ambiguous_entity_target',
          message: '无法唯一确定要修改的对象，请提供准确名称。',
          operationIndex: index,
          operationType: type
        });
      } else if (requestedTarget !== entityId) {
        repairNote(repairs, 'entity_reference', `已解析修改目标：${requestedTarget}`, index);
      }
      operations.push({
        type,
        entity_id: entityId,
        patch: isRecord(raw.patch ?? raw.changes) ? raw.patch ?? raw.changes : {}
      });
      return;
    }

    const requestedTarget = stringValue(raw.entity_id, raw.entityId, raw.id, raw.targetId, raw.ref);
    const entityId = resolveEntityReference(document, requestedTarget);
    if (!entityId) {
      issues.push({
        level: 'error',
        code: 'ambiguous_entity_target',
        message: '无法唯一确定要删除的对象，请提供准确名称。',
        operationIndex: index,
        operationType: type
      });
    } else if (requestedTarget !== entityId) {
      repairNote(repairs, 'entity_reference', `已解析删除目标：${requestedTarget}`, index);
    }
    operations.push({
      type,
      entity_id: entityId
    });
  });

  operations.sort((a, b) =>
    (operationOrder[String(a.type)] ?? 99) - (operationOrder[String(b.type)] ?? 99)
  );

  return {
    plan: {
      intent: intent || 'ask_clarification',
      documentName: stringValue(plan.document_name, plan.documentName),
      clarification: stringValue(plan.clarification, plan.question),
      operations
    },
    repairs,
    issues
  };
}
