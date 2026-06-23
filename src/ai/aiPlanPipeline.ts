import type { MapYDocument, ShapeKind } from '../model/types';
import type { AiMapOperation, AiMapPlan, AiUpdateEntityOperation } from './mapCommands';
import type { AiSlashCommand } from './commandRegistry';
import { repairAiPlan } from './aiPlanRepair';
import { validateAiPlan } from './aiPlanValidator';
import { parseAiPlanResponse } from './aiResponseParser';
import type { AiRepair, ValidationIssue } from './aiTypes';

export type AiPlanPipelineResult =
  | {
      status: 'ready';
      plan: AiMapPlan;
      text: string;
      repairs: AiRepair[];
      issues: ValidationIssue[];
    }
  | {
      status: 'clarification';
      question: string;
      text: string;
      repairs: AiRepair[];
      issues: ValidationIssue[];
    }
  | {
      status: 'error';
      error: string;
      text: string;
      repairs: AiRepair[];
      issues: ValidationIssue[];
    };

function pointTransform(
  position: Record<string, unknown> | undefined,
  width: number,
  height: number,
  rotation = 0
) {
  return {
    x: Number(position?.x || 0),
    y: Number(position?.y || 0),
    width,
    height,
    rotation
  };
}

function toInternalOperation(operation: Record<string, unknown>, gridSize: number): AiMapOperation {
  const type = String(operation.type);
  if (type === 'create_scene') {
    return {
      op: type,
      tempId: String(operation.scene_id),
      name: String(operation.name),
      transform: pointTransform(
        operation.position as Record<string, unknown>,
        Number(operation.width),
        Number(operation.height),
        Number(operation.rotation || 0)
      ),
      color: typeof operation.color === 'string' ? operation.color : undefined,
      opacity: typeof operation.opacity === 'number' ? operation.opacity : undefined
    };
  }
  if (type === 'create_structure') {
    return {
      op: type,
      tempId: String(operation.structure_id),
      sceneRef: String(operation.scene_id),
      name: String(operation.name),
      transform: pointTransform(
        operation.position as Record<string, unknown>,
        Number(operation.width),
        Number(operation.height),
        Number(operation.rotation || 0)
      ),
      color: typeof operation.color === 'string' ? operation.color : undefined,
      hasCollision: typeof operation.has_collision === 'boolean' ? operation.has_collision : undefined
    };
  }
  if (type === 'create_identifier_definition') {
    return {
      op: type,
      tempId: String(operation.definition_id),
      name: String(operation.name),
      kind: String(operation.identifier_type),
      color: String(operation.color),
      shape: operation.shape as ShapeKind
    };
  }
  if (type === 'place_identifier') {
    return {
      op: type,
      tempId: String(operation.identifier_id),
      definitionRef: String(operation.definition_ref),
      sceneRef: String(operation.scene_id),
      structureRef: typeof operation.structure_id === 'string' ? operation.structure_id : undefined,
      name: String(operation.name),
      transform: pointTransform(operation.position as Record<string, unknown>, gridSize, gridSize)
    };
  }
  if (type === 'create_connection') {
    return {
      op: type,
      tempId: String(operation.connection_id),
      name: typeof operation.name === 'string' ? operation.name : undefined,
      fromSceneRef: String(operation.from_scene_id),
      toSceneRef: String(operation.to_scene_id)
    };
  }
  if (type === 'add_annotation') {
    return {
      op: type,
      tempId: String(operation.annotation_id),
      text: String(operation.text),
      sceneRef: typeof operation.scene_id === 'string' ? operation.scene_id : undefined,
      structureRef: typeof operation.structure_id === 'string' ? operation.structure_id : undefined,
      transform: pointTransform(operation.position as Record<string, unknown>, 160, 64)
    };
  }
  if (type === 'update_entity') {
    return {
      op: type,
      id: String(operation.entity_id),
      patch: (operation.patch || {}) as AiUpdateEntityOperation['patch']
    };
  }
  return {
    op: 'delete_entity',
    id: String(operation.entity_id)
  };
}

export function processAiPlan(
  rawResponse: unknown,
  document: MapYDocument,
  command?: AiSlashCommand
): AiPlanPipelineResult {
  let parsed;
  try {
    parsed = parseAiPlanResponse(rawResponse);
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'AI 响应解析失败。',
      text: '',
      repairs: [],
      issues: []
    };
  }

  const repaired = repairAiPlan(parsed.plan, document);
  if (repaired.plan.intent === 'ask_clarification') {
    return {
      status: 'clarification',
      question: repaired.plan.clarification || '请补充更明确的地图需求。',
      text: parsed.text || '需要进一步确认。',
      repairs: repaired.repairs,
      issues: repaired.issues
    };
  }

  const clarificationCodes = new Set(['ambiguous_connection', 'ambiguous_entity_target']);
  const ambiguous = repaired.issues.find((issue) => clarificationCodes.has(issue.code));
  if (ambiguous) {
    return {
      status: 'clarification',
      question: ambiguous.message,
      text: parsed.text || '需要明确连接目标。',
      repairs: repaired.repairs,
      issues: repaired.issues
    };
  }

  const validation = validateAiPlan(repaired.plan, document, command, repaired.issues);
  if (!validation.ok) {
    return {
      status: 'error',
      error: 'AI 生成结果无法执行。',
      text: parsed.text || '',
      repairs: repaired.repairs,
      issues: validation.issues
    };
  }

  const plan: AiMapPlan = {
    intent: repaired.plan.intent,
    documentName: repaired.plan.documentName,
    operations: repaired.plan.operations.map((operation) =>
      toInternalOperation(operation, document.settings.gridSize)
    )
  };
  return {
    status: 'ready',
    plan,
    text: parsed.text || '已生成可预览的地图修改计划。',
    repairs: repaired.repairs,
    issues: validation.issues
  };
}
