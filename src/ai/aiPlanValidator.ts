import { findNode } from '../model/document';
import type { MapYDocument, ShapeKind } from '../model/types';
import type { AiSlashCommand } from './commandRegistry';
import type { RepairedAiPlan } from './aiPlanRepair';
import type { ValidationIssue } from './aiTypes';

export interface AiPlanValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const validShapes: ShapeKind[] = ['rect', 'circle', 'diamond', 'triangle', 'star', 'door', 'note'];

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validPosition(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const position = value as Record<string, unknown>;
  return finite(position.x) && finite(position.y);
}

function issue(
  issues: ValidationIssue[],
  code: string,
  message: string,
  index?: number,
  operationType?: string,
  level: ValidationIssue['level'] = 'error'
) {
  issues.push({ level, code, message, operationIndex: index, operationType });
}

export function validateAiPlan(
  plan: RepairedAiPlan,
  document: MapYDocument,
  command?: AiSlashCommand,
  repairIssues: ValidationIssue[] = []
): AiPlanValidationResult {
  const issues = [...repairIssues];

  if (plan.intent === 'ask_clarification') {
    if (!text(plan.clarification)) issue(issues, 'missing_clarification', '澄清计划缺少问题。');
    return { ok: issues.every((item) => item.level !== 'error'), issues };
  }
  if (command?.allowedIntents && !command.allowedIntents.includes(plan.intent)) {
    issue(issues, 'command_intent_violation', `/${command.name} 不允许使用 ${plan.intent}。`);
  }

  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    issue(issues, 'missing_operations', 'AI Plan 缺少可执行 operations。');
    return { ok: false, issues };
  }

  const createdIds = new Set<string>();
  const sceneRefs = new Set(document.scenes.map((scene) => scene.id));
  const definitionRefs = new Set(document.identifiers.map((definition) => definition.id));
  const structureScenes = new Map(
    document.structures.map((structure) => [structure.id, structure.parentSceneId])
  );

  plan.operations.forEach((operation, index) => {
    const type = String(operation.type || '');
    if (!type) {
      issue(issues, 'missing_operation_type', 'operation 缺少 type。', index);
      return;
    }
    if (command?.allowedOperations && !command.allowedOperations.includes(type)) {
      issue(
        issues,
        'command_scope_violation',
        `/${command.name} 不允许执行 ${type}。`,
        index,
        type
      );
    }

    const stableId = type === 'create_scene' ? operation.scene_id :
      type === 'create_structure' ? operation.structure_id :
      type === 'create_identifier_definition' ? operation.definition_id :
      type === 'place_identifier' ? operation.identifier_id :
      type === 'create_connection' ? operation.connection_id :
      type === 'add_annotation' ? operation.annotation_id :
      undefined;
    if (typeof stableId === 'string') {
      if (createdIds.has(stableId)) {
        issue(issues, 'duplicate_operation_id', `计划中存在重复 ID：${stableId}`, index, type);
      }
      createdIds.add(stableId);
    }

    if (type === 'create_scene') {
      if (!text(operation.scene_id)) issue(issues, 'missing_scene_id', 'create_scene 缺少 scene_id。', index, type);
      if (!text(operation.name)) issue(issues, 'missing_scene_name', 'create_scene 缺少 name。', index, type);
      const position = operation.position as Record<string, unknown> | undefined;
      if (!validPosition(position)) {
        issue(issues, 'missing_scene_position', 'create_scene 缺少有效 position。', index, type);
      }
      if (!finite(operation.width) || Number(operation.width) <= 0 ||
          !finite(operation.height) || Number(operation.height) <= 0) {
        issue(issues, 'invalid_scene_size', 'create_scene 宽高必须为正数。', index, type);
      }
      if (!finite(operation.rotation)) {
        issue(issues, 'invalid_scene_rotation', 'create_scene rotation 必须为有效数字。', index, type);
      }
      if (text(operation.scene_id)) sceneRefs.add(operation.scene_id);
      return;
    }

    if (type === 'create_structure') {
      if (!text(operation.structure_id)) issue(issues, 'missing_structure_id', 'create_structure 缺少 structure_id。', index, type);
      if (!text(operation.scene_id) || !sceneRefs.has(operation.scene_id)) {
        issue(issues, 'invalid_structure_scene', 'create_structure 缺少有效 scene_id。', index, type);
      }
      if (!text(operation.name)) issue(issues, 'missing_structure_name', 'create_structure 缺少 name。', index, type);
      if (!validPosition(operation.position)) {
        issue(issues, 'missing_structure_position', 'create_structure 缺少有效 position。', index, type);
      }
      if (!finite(operation.width) || Number(operation.width) <= 0 ||
          !finite(operation.height) || Number(operation.height) <= 0) {
        issue(issues, 'invalid_structure_size', 'create_structure 宽高必须为正数。', index, type);
      }
      if (!finite(operation.rotation)) {
        issue(issues, 'invalid_structure_rotation', 'create_structure rotation 必须为有效数字。', index, type);
      }
      if (text(operation.structure_id) && text(operation.scene_id)) {
        structureScenes.set(operation.structure_id, operation.scene_id);
      }
      return;
    }

    if (type === 'create_identifier_definition') {
      if (!text(operation.definition_id)) issue(issues, 'missing_definition_id', '标识类型缺少 definition_id。', index, type);
      if (!text(operation.identifier_type)) issue(issues, 'missing_identifier_type', '标识类型缺少 identifier_type。', index, type);
      if (!text(operation.name)) issue(issues, 'missing_definition_name', '标识类型缺少 name。', index, type);
      if (!validShapes.includes(operation.shape as ShapeKind)) {
        issue(issues, 'invalid_identifier_shape', '标识类型 shape 不受支持。', index, type);
      }
      if (text(operation.definition_id)) definitionRefs.add(operation.definition_id);
      return;
    }

    if (type === 'place_identifier') {
      if (!text(operation.identifier_id)) issue(issues, 'missing_identifier_id', 'place_identifier 缺少 identifier_id。', index, type);
      if (!text(operation.identifier_type)) issue(issues, 'missing_identifier_type', 'place_identifier 缺少 identifier_type。', index, type);
      if (!text(operation.name)) issue(issues, 'missing_identifier_name', 'place_identifier 缺少 name。', index, type);
      if (!text(operation.definition_ref) || !definitionRefs.has(operation.definition_ref)) {
        issue(issues, 'invalid_definition_ref', 'place_identifier 缺少有效标识类型引用。', index, type);
      }
      if (!text(operation.scene_id) || !sceneRefs.has(operation.scene_id)) {
        issue(issues, 'invalid_identifier_scene', 'place_identifier 缺少有效 scene_id。', index, type);
      }
      if (!validPosition(operation.position)) {
        issue(issues, 'missing_identifier_position', 'place_identifier 缺少有效 position。', index, type);
      }
      if (text(operation.structure_id)) {
        const parentSceneId = structureScenes.get(operation.structure_id);
        if (!parentSceneId) {
          issue(issues, 'invalid_identifier_structure', 'place_identifier 引用了不存在的结构。', index, type);
        } else if (text(operation.scene_id) && parentSceneId !== operation.scene_id) {
          issue(issues, 'invalid_identifier_parent', '标识的 scene_id 与父结构所属场景不一致。', index, type);
        }
      }
      return;
    }

    if (type === 'create_connection') {
      if (!text(operation.connection_id)) {
        issue(issues, 'missing_connection_id', 'create_connection 缺少 connection_id。', index, type);
      }
      if (!text(operation.name)) {
        issue(issues, 'missing_connection_name', 'create_connection 缺少 name。', index, type);
      }
      if (!text(operation.from_scene_id) || !text(operation.to_scene_id)) {
        issue(issues, 'missing_connection_scenes', 'create_connection 缺少起点或终点地图。', index, type);
      } else if (!sceneRefs.has(operation.from_scene_id) || !sceneRefs.has(operation.to_scene_id)) {
        issue(issues, 'invalid_connection_scenes', 'create_connection 引用了不存在的地图。', index, type);
      } else if (operation.from_scene_id === operation.to_scene_id) {
        issue(issues, 'same_connection_scene', '连接起点和终点不能是同一地图。', index, type);
      }
      return;
    }

    if (type === 'add_annotation') {
      if (!text(operation.annotation_id)) issue(issues, 'missing_annotation_id', 'add_annotation 缺少 annotation_id。', index, type);
      if (!text(operation.text)) issue(issues, 'missing_annotation_text', 'add_annotation 缺少 text。', index, type);
      if (!validPosition(operation.position)) {
        issue(issues, 'missing_annotation_position', 'add_annotation 缺少有效 position。', index, type);
      }
      if (text(operation.scene_id) && !sceneRefs.has(operation.scene_id)) {
        issue(issues, 'invalid_annotation_scene', 'add_annotation 引用了不存在的场景。', index, type);
      }
      if (text(operation.structure_id)) {
        const parentSceneId = structureScenes.get(operation.structure_id);
        if (!parentSceneId) {
          issue(issues, 'invalid_annotation_structure', 'add_annotation 引用了不存在的结构。', index, type);
        } else if (text(operation.scene_id) && parentSceneId !== operation.scene_id) {
          issue(issues, 'invalid_annotation_parent', '注释的 scene_id 与父结构所属场景不一致。', index, type);
        }
      }
      return;
    }

    if (type === 'update_entity' || type === 'delete_entity') {
      if (!text(operation.entity_id)) {
        issue(issues, 'missing_entity_id', `${type} 缺少 entity_id。`, index, type);
      } else if (!findNode(document, operation.entity_id) &&
                 !document.identifiers.some((definition) => definition.id === operation.entity_id)) {
        issue(issues, 'missing_entity_target', `${type} 找不到目标 ${operation.entity_id}。`, index, type);
      }
      if (type === 'update_entity') {
        const patch = operation.patch as Record<string, unknown> | undefined;
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
          issue(issues, 'invalid_update_patch', 'update_entity patch 必须为对象。', index, type);
          return;
        }
        const transform = patch.transform;
        if (transform !== undefined) {
          if (!transform || typeof transform !== 'object' || Array.isArray(transform)) {
            issue(issues, 'invalid_update_transform', 'update_entity transform 必须为对象。', index, type);
          } else {
            const values = transform as Record<string, unknown>;
            for (const key of ['x', 'y', 'rotation']) {
              if (values[key] !== undefined && !finite(values[key])) {
                issue(issues, 'invalid_update_transform', `update_entity transform.${key} 必须为有效数字。`, index, type);
              }
            }
            for (const key of ['width', 'height']) {
              if (values[key] !== undefined && (!finite(values[key]) || Number(values[key]) <= 0)) {
                issue(issues, 'invalid_update_size', `update_entity transform.${key} 必须为正数。`, index, type);
              }
            }
          }
        }
        const parentSceneId = typeof patch.parentSceneId === 'string' ? patch.parentSceneId : undefined;
        const parentStructureId = typeof patch.parentStructureId === 'string' ? patch.parentStructureId : undefined;
        if (parentSceneId && !sceneRefs.has(parentSceneId)) {
          issue(issues, 'invalid_update_parent_scene', 'update_entity 引用了不存在的父场景。', index, type);
        }
        if (parentStructureId) {
          const structureSceneId = structureScenes.get(parentStructureId);
          if (!structureSceneId) {
            issue(issues, 'invalid_update_parent_structure', 'update_entity 引用了不存在的父结构。', index, type);
          } else if (parentSceneId && structureSceneId !== parentSceneId) {
            issue(issues, 'invalid_update_parent', 'update_entity 的父场景与父结构不一致。', index, type);
          }
        }
      }
    }
  });

  return {
    ok: issues.every((item) => item.level !== 'error'),
    issues
  };
}
