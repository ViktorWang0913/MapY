import { findNode } from '../model/document';
import type { MapYDocument, ShapeKind, Transform } from '../model/types';
import type { AiMapOperation, AiMapPlan } from './mapCommands';

export type ValidationResult = { ok: true } | { ok: false; error: string };
export type PreparedPlanResult = { ok: true; plan: AiMapPlan } | { ok: false; error: string };

const shapes: ShapeKind[] = ['rect', 'circle', 'diamond', 'triangle', 'star', 'door', 'note'];
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function transformError(transform: Transform | Partial<Transform> | undefined, partial = false): string | undefined {
  if (!transform || typeof transform !== 'object') return 'transform 必须是对象。';
  for (const key of ['x', 'y', 'width', 'height', 'rotation'] as const) {
    if ((!partial || key in transform) && !finite(transform[key])) return `transform.${key} 必须是数字。`;
  }
  if (transform.width !== undefined && transform.width <= 0) return 'transform.width 必须为正数。';
  if (transform.height !== undefined && transform.height <= 0) return 'transform.height 必须为正数。';
  return undefined;
}

function operationError(operation: AiMapOperation): string | undefined {
  switch (operation.op) {
    case 'create_scene':
      if (!text(operation.tempId) || !text(operation.name)) return 'create_scene 缺少 ID 或名称。';
      return transformError(operation.transform);
    case 'create_structure':
      if (!text(operation.tempId) || !text(operation.sceneRef) || !text(operation.name)) {
        return 'create_structure 缺少 ID、场景引用或名称。';
      }
      return transformError(operation.transform);
    case 'create_identifier_definition':
      if (!text(operation.tempId) || !text(operation.name) || !text(operation.color)) {
        return '标识类型缺少 ID、名称或颜色。';
      }
      return shapes.includes(operation.shape) ? undefined : '标识类型 shape 不受支持。';
    case 'place_identifier':
      if (!text(operation.tempId) || !text(operation.definitionRef) ||
          !text(operation.sceneRef) || !text(operation.name)) {
        return 'place_identifier 缺少必要引用或名称。';
      }
      return transformError(operation.transform);
    case 'create_connection':
      if (!text(operation.tempId) || !text(operation.fromSceneRef) || !text(operation.toSceneRef)) {
        return 'create_connection 缺少必要引用。';
      }
      return undefined;
    case 'add_annotation':
      if (!text(operation.tempId) || !text(operation.text)) return 'add_annotation 缺少 ID 或内容。';
      return transformError(operation.transform);
    case 'update_entity':
      if (!text(operation.id) || !operation.patch || typeof operation.patch !== 'object') {
        return 'update_entity 缺少目标或 patch。';
      }
      return operation.patch.transform ? transformError(operation.patch.transform, true) : undefined;
    case 'delete_entity':
      return text(operation.id) ? undefined : 'delete_entity 缺少目标 ID。';
  }
  return '内部 AI 计划包含未知操作。';
}

export function prepareMapPlan(plan: unknown, document: MapYDocument): PreparedPlanResult {
  if (!plan || typeof plan !== 'object') return fail('内部 AI 计划不是对象。');
  const candidate = plan as Partial<AiMapPlan>;
  if (candidate.intent !== 'create_document' && candidate.intent !== 'patch_document') {
    return fail('内部 AI 计划 intent 无效。');
  }
  if (!Array.isArray(candidate.operations) || candidate.operations.length === 0) {
    return fail('内部 AI 计划没有操作。');
  }
  if (candidate.operations.length > 200) return fail('单次 AI 计划最多包含 200 个操作。');

  const ids = new Set<string>();
  for (const operation of candidate.operations) {
    const error = operationError(operation);
    if (error) return fail(error);
    if ('tempId' in operation) {
      if (ids.has(operation.tempId) || findNode(document, operation.tempId)) {
        return fail(`重复的临时 ID：${operation.tempId}`);
      }
      ids.add(operation.tempId);
    }
  }

  return { ok: true, plan: candidate as AiMapPlan };
}

export function validateMapPlan(plan: unknown, document: MapYDocument): ValidationResult {
  const result = prepareMapPlan(plan, document);
  return result.ok ? { ok: true } : result;
}
