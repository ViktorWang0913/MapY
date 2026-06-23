import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../model/document';
import { previewAiMapPlan } from './executeCommand';
import { mockGenerateMapPlan } from './mockAi';

describe('mockGenerateMapPlan', () => {
  it('creates two scenes, one key, two bosses, structures, connections, and a note', () => {
    const plan = mockGenerateMapPlan('生成 city，2 zones，linear 和 S-like', createEmptyDocument());
    const document = previewAiMapPlan(plan, createEmptyDocument()).document;

    expect(plan.intent).toBe('create_document');
    expect(document.scenes).toHaveLength(2);
    expect(document.structures).toHaveLength(1);
    expect(document.identifierInstances.filter((node) => node.name.includes('钥匙'))).toHaveLength(1);
    expect(document.identifierInstances.filter((node) => node.name.includes('Boss'))).toHaveLength(2);
    expect(document.stitching.edges).toHaveLength(1);
    expect(document.annotations).toHaveLength(1);
  });

  it('moves an existing key to the second scene', () => {
    const initial = previewAiMapPlan(mockGenerateMapPlan('city', createEmptyDocument()), createEmptyDocument()).document;
    const plan = mockGenerateMapPlan('Move the key to the second zone.', initial);
    const next = previewAiMapPlan(plan, initial).document;
    const key = next.identifierInstances.find((node) => node.name.includes('钥匙'))!;

    expect(plan.intent).toBe('patch_document');
    expect(key.parentSceneId).toBe(next.scenes[1].id);
  });
});
