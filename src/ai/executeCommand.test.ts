import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../model/document';
import { previewAiMapPlan } from './executeCommand';
import type { AiMapPlan } from './mapCommands';

function cityPlan(): AiMapPlan {
  return {
    intent: 'create_document',
    documentName: '城市',
    operations: [
      {
        op: 'create_scene',
        tempId: 'scene-a',
        name: 'A',
        transform: { x: 0, y: 0, width: 320, height: 200, rotation: 0 }
      },
      {
        op: 'create_scene',
        tempId: 'scene-b',
        name: 'B',
        transform: { x: 400, y: 0, width: 320, height: 200, rotation: 0 }
      },
      {
        op: 'create_identifier_definition',
        tempId: 'key-type',
        name: '钥匙',
        color: '#ffcc00',
        shape: 'diamond'
      },
      {
        op: 'place_identifier',
        tempId: 'key',
        definitionRef: 'key-type',
        sceneRef: 'scene-a',
        name: '钥匙 1',
        transform: { x: 100, y: 100, width: 4, height: 4, rotation: 0 }
      },
      {
        op: 'create_connection',
        tempId: 'link',
        fromSceneRef: 'scene-a',
        toSceneRef: 'scene-b',
        name: '出口'
      }
    ]
  };
}

describe('previewAiMapPlan', () => {
  it('builds a complete MapY document without mutating the source', () => {
    const source = createEmptyDocument('原文档');
    const snapshot = structuredClone(source);
    const preview = previewAiMapPlan(cityPlan(), source);

    expect(source).toEqual(snapshot);
    expect(preview.document.name).toBe('城市');
    expect(preview.document.scenes).toHaveLength(2);
    expect(preview.document.identifierInstances).toHaveLength(1);
    expect(preview.document.doors).toHaveLength(2);
    expect(preview.document.stitching.edges).toHaveLength(1);
    expect(preview.summary.created).toContain('钥匙 1');
  });

  it('updates and deletes existing entities in a patch preview', () => {
    const created = previewAiMapPlan(cityPlan(), createEmptyDocument()).document;
    const scene = created.scenes[0];
    const preview = previewAiMapPlan({
      intent: 'patch_document',
      operations: [
        { op: 'update_entity', id: scene.id, patch: { name: '新名称', transform: { x: 40 } } },
        { op: 'delete_entity', id: created.identifierInstances[0].id }
      ]
    }, created);

    expect(preview.document.scenes[0]).toMatchObject({ name: '新名称', transform: { x: 40 } });
    expect(preview.document.identifierInstances).toHaveLength(0);
    expect(preview.summary.updated).toEqual(['A']);
    expect(preview.summary.deleted).toEqual(['钥匙 1']);
  });

  it('rejects the whole plan when a reference is invalid', () => {
    expect(() => previewAiMapPlan({
      intent: 'create_document',
      operations: [{
        op: 'create_structure',
        tempId: 'structure',
        sceneRef: 'missing',
        name: '无父级结构',
        transform: { x: 0, y: 0, width: 32, height: 32, rotation: 0 }
      }]
    }, createEmptyDocument())).toThrow('找不到结构所属地图');
  });
});
