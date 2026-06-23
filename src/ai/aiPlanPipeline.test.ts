import { describe, expect, it } from 'vitest';
import { addNode, createDefaultNode, createEmptyDocument } from '../model/document';
import { getSlashCommand } from './commandRegistry';
import { processAiPlan } from './aiPlanPipeline';

describe('processAiPlan', () => {
  it('repairs missing scene names, ids, positions, and identifier definitions', () => {
    const result = processAiPlan({
      intent: 'create_document',
      document_name: '城市地图',
      operations: [
        { type: 'create_scene', layout_pattern: 'linear' },
        { type: 'create_scene', layout_pattern: 's_like' },
        { type: 'place_identifier', identifier_type: 'key', scene_id: 'scene_linear_01' },
        { type: 'place_identifier', identifier_type: 'boss', scene_id: 'scene_s_curve_01' },
        { type: 'place_identifier', identifier_type: 'boss', scene_id: 'scene_s_curve_01' },
        { type: 'create_connection' }
      ]
    }, createEmptyDocument());

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.repairs.length).toBeGreaterThan(5);
    expect(result.plan.operations.filter((operation) => operation.op === 'create_scene')).toHaveLength(2);
    expect(result.plan.operations.filter((operation) => operation.op === 'place_identifier')).toHaveLength(3);
    expect(result.plan.operations.filter((operation) => operation.op === 'create_identifier_definition')).toHaveLength(2);
    expect(result.plan.operations.filter((operation) => operation.op === 'create_connection')).toHaveLength(1);
  });

  it('allows /generate multi-operation plans but rejects /scene scope violations', () => {
    const raw = {
      intent: 'patch_document',
      operations: [
        { type: 'create_scene', scene_id: 'scene_new', name: '新区域', position: { x: 0, y: 0 } },
        { type: 'add_annotation', annotation_id: 'note_1', text: '入口', position: { x: 10, y: 10 } }
      ]
    };
    expect(processAiPlan(raw, createEmptyDocument(), getSlashCommand('/generate test')).status).toBe('ready');
    const restricted = processAiPlan(raw, createEmptyDocument(), getSlashCommand('/scene test'));
    expect(restricted.status).toBe('error');
    if (restricted.status === 'error') {
      expect(restricted.issues.some((issue) => issue.code === 'command_scope_violation')).toBe(true);
    }
  });

  it('rejects document creation intent for patch-only commands', () => {
    const result = processAiPlan({
      intent: 'create_document',
      operations: [
        { type: 'create_scene', scene_id: 'scene_new', name: 'New scene', position: { x: 0, y: 0 } }
      ]
    }, createEmptyDocument(), getSlashCommand('/scene add one scene'));

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.issues.some((issue) => issue.code === 'command_intent_violation')).toBe(true);
    }
  });

  it('resolves a unique entity name before validating an update', () => {
    const scene = createDefaultNode(
      'scene',
      1,
      { x: 0, y: 0, width: 320, height: 200, rotation: 0 },
      { name: 'Entrance' }
    );
    const document = addNode(createEmptyDocument(), scene);
    const result = processAiPlan({
      intent: 'patch_document',
      operations: [
        { type: 'update_entity', entity_id: 'Entrance', patch: { name: 'Main Entrance' } }
      ]
    }, document, getSlashCommand('/update rename Entrance'));

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.plan.operations[0]).toMatchObject({ op: 'update_entity', id: scene.id });
    expect(result.repairs.some((repair) => repair.code === 'entity_reference')).toBe(true);
  });

  it('asks for clarification when an update target name is not unique', () => {
    let document = createEmptyDocument();
    for (let index = 0; index < 2; index += 1) {
      document = addNode(document, createDefaultNode(
        'scene',
        index + 1,
        { x: index * 400, y: 0, width: 320, height: 200, rotation: 0 },
        { name: 'Repeated' }
      ));
    }
    const result = processAiPlan({
      intent: 'patch_document',
      operations: [
        { type: 'update_entity', entity_id: 'Repeated', patch: { name: 'Renamed' } }
      ]
    }, document, getSlashCommand('/update rename Repeated'));

    expect(result.status).toBe('clarification');
    if (result.status === 'clarification') {
      expect(result.issues.some((issue) => issue.code === 'ambiguous_entity_target')).toBe(true);
    }
  });

  it('rejects duplicate explicit temporary ids instead of silently renaming them', () => {
    const result = processAiPlan({
      intent: 'create_document',
      operations: [
        { type: 'create_scene', scene_id: 'duplicate', name: 'A', position: { x: 0, y: 0 } },
        { type: 'create_scene', scene_id: 'duplicate', name: 'B', position: { x: 400, y: 0 } }
      ]
    }, createEmptyDocument());

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.issues.some((issue) => issue.code === 'duplicate_operation_id')).toBe(true);
    }
  });

  it('rejects invalid geometry after repairing only missing fields', () => {
    const result = processAiPlan({
      intent: 'create_document',
      operations: [
        {
          type: 'create_scene',
          scene_id: 'bad_scene',
          name: 'Bad scene',
          position: { x: 'not-a-number', y: 0 },
          width: -10,
          height: 100
        }
      ]
    }, createEmptyDocument());

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.issues.some((issue) => issue.code === 'missing_scene_position')).toBe(true);
      expect(result.issues.some((issue) => issue.code === 'invalid_scene_size')).toBe(true);
    }
  });

  it('repairs references independently of model operation order', () => {
    const result = processAiPlan({
      intent: 'create_document',
      operations: [
        { type: 'create_connection' },
        { type: 'create_scene', scene_id: 'first', name: 'First', position: { x: 0, y: 0 } },
        { type: 'create_scene', scene_id: 'second', name: 'Second', position: { x: 400, y: 0 } }
      ]
    }, createEmptyDocument());

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.plan.operations.at(-1)).toMatchObject({
      op: 'create_connection',
      fromSceneRef: 'first',
      toSceneRef: 'second'
    });
  });

  it('accepts common provider operation field variants', () => {
    const variants = [
      {
        operation_type: 'create_scene',
        scene_id: 'scene_operation_type',
        name: 'Operation type',
        position: { x: 0, y: 0 }
      },
      {
        operation: 'createScene',
        scene_id: 'scene_operation',
        name: 'Operation',
        position: { x: 400, y: 0 }
      },
      {
        action: 'create',
        entity_type: 'scene',
        scene_id: 'scene_action',
        name: 'Action entity',
        position: { x: 800, y: 0 }
      },
      {
        create_scene: {
          scene_id: 'scene_wrapped',
          name: 'Wrapped',
          position: { x: 1200, y: 0 }
        }
      }
    ];
    const result = processAiPlan({
      intent: 'create_document',
      operations: variants
    }, createEmptyDocument());

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.plan.operations.filter((operation) => operation.op === 'create_scene')).toHaveLength(4);
  });

  it('accepts function-call style operations and embedded JSON arguments', () => {
    const result = processAiPlan({
      intent: 'create_document',
      steps: [
        {
          function: {
            name: 'CreateSceneOperation',
            arguments: JSON.stringify({
              scene_id: 'function_scene',
              name: 'Function scene',
              position: { x: 0, y: 0 }
            })
          }
        }
      ]
    }, createEmptyDocument());

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.plan.operations[0]).toMatchObject({
      op: 'create_scene',
      tempId: 'function_scene',
      name: 'Function scene'
    });
  });

  it('reports the operation index and received unknown type', () => {
    const result = processAiPlan({
      intent: 'patch_document',
      operations: [
        { operation_type: 'teleport_everything' }
      ]
    }, createEmptyDocument());

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.issues[0]).toMatchObject({
      code: 'unknown_operation',
      operationIndex: 0
    });
    expect(result.issues[0].message).toContain('teleport_everything');
  });

  it('asks for clarification instead of guessing an ambiguous connection', () => {
    let document = createEmptyDocument();
    for (let index = 0; index < 3; index += 1) {
      document = addNode(document, createDefaultNode(
        'scene',
        index + 1,
        { x: index * 400, y: 0, width: 320, height: 200, rotation: 0 },
        { name: `场景 ${index + 1}` }
      ));
    }
    const result = processAiPlan({
      intent: 'patch_document',
      operations: [{ type: 'create_connection' }]
    }, document, getSlashCommand('/connect 连接这两个区域'));

    expect(result.status).toBe('clarification');
  });
});
