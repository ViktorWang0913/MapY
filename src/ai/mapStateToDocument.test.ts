import { describe, expect, it } from 'vitest';
import { createEmptyDocument, normalizeDocument, serializeDocument } from '../model/document';
import { previewAiMapPlan } from './executeCommand';
import { mockGenerateMapPlan } from './mockAi';

describe('AI document compatibility', () => {
  it('round-trips generated documents through the normal MapY serializer', () => {
    const generated = previewAiMapPlan(mockGenerateMapPlan('city', createEmptyDocument()), createEmptyDocument()).document;
    const restored = normalizeDocument(JSON.parse(serializeDocument(generated)));

    expect(restored.scenes).toHaveLength(generated.scenes.length);
    expect(restored.structures).toHaveLength(generated.structures.length);
    expect(restored.identifierInstances).toHaveLength(generated.identifierInstances.length);
    expect(restored.stitching.edges).toHaveLength(generated.stitching.edges.length);
  });
});
