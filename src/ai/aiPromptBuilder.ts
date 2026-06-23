import type { AiSlashCommand } from './commandRegistry';
import type { ClarificationContext } from './aiTypes';

export function buildMapYPlannerPrompt(
  userInput: string,
  documentContext: string,
  command?: AiSlashCommand,
  clarification?: ClarificationContext
): string {
  const commandConstraint = command?.directive
    ? `Slash command constraint:\n${command.directive}`
    : 'No slash command constraint. Infer whether this creates a new document or patches the current document.';
  const clarificationBlock = clarification
    ? `Previous request:\n${clarification.originalRequest}\nPrevious clarification question:\n${clarification.question}\nThe current user input is the answer to that question.`
    : '';

  return `You are MapY AI Planner.

Convert the user's natural-language map request into one JSON object. Return JSON only.
Do not return markdown, explanations, or code fences.

Top-level schema:
{
  "intent": "create_document" | "patch_document" | "ask_clarification",
  "document_name": "optional",
  "clarification": "required when intent is ask_clarification",
  "operations": []
}

Supported operation types:
- create_scene: scene_id, name, layout_pattern, position
- create_structure: structure_id, scene_id, name, position
- create_identifier_definition: identifier_type, name
- place_identifier: identifier_id, identifier_type, name, scene_id, position
- create_connection: connection_id, name, from_scene_id, to_scene_id
- add_annotation: annotation_id, scene_id optional, text, position
- update_entity: entity_id, patch
- delete_entity: entity_id

Rules:
1. Every operations item must contain a "type" field exactly matching one supported operation type above.
2. Do not use "operation", "action", "operation_type", function calls, or operation names as object keys.
3. Prefer concise Chinese names when the user does not name an object.
4. Use stable snake_case IDs inside this plan.
5. For a new map, use create_document. For modifications, use patch_document.
6. Use multiple operations when the request needs them.
7. Never invent an existing document ID. Use IDs from document context.
8. If a connection, update, or deletion target is ambiguous, return ask_clarification with no operations.
9. Layout aliases: S-like or S 型 means s_curve.
10. Positions are world coordinates. Default scenes progress horizontally.
11. A key or Boss needs a matching identifier definition unless one already exists.

Minimal valid example:
{
  "intent": "create_document",
  "document_name": "示例地图",
  "operations": [
    {
      "type": "create_scene",
      "scene_id": "scene_01",
      "name": "入口区",
      "layout_pattern": "linear",
      "position": { "x": 0, "y": 0 }
    }
  ]
}

Default names:
- linear: 线性推进区
- s_curve: S 型回环区
- hub: 中心枢纽区
- arena: 战斗区域
- branch: 分支探索区
- key: 钥匙 1, 钥匙 2...
- boss: Boss 1, Boss 2...

${commandConstraint}
${clarificationBlock}

Current document context:
${documentContext}

User request:
${userInput}`;
}
