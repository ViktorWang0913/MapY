import { describe, expect, it } from 'vitest';
import { addNode, createDefaultNode, createEmptyDocument } from '../model/document';
import { MAX_CONTEXT_ITEMS, documentToAiContext } from './mapCommands';

function documentWithScenes(count: number) {
  let document = createEmptyDocument();
  for (let index = 0; index < count; index += 1) {
    const scene = createDefaultNode(
      'scene',
      index + 1,
      { x: index * 100, y: 0, width: 384, height: 256, rotation: 0 },
      { name: `场景 ${index + 1}` }
    );
    document = addNode(document, scene);
  }
  return document;
}

describe('documentToAiContext', () => {
  it('caps each collection at MAX_CONTEXT_ITEMS while reporting full counts', () => {
    const total = MAX_CONTEXT_ITEMS + 5;
    const document = documentWithScenes(total);

    const context = documentToAiContext(document);

    expect(context.scenes).toHaveLength(MAX_CONTEXT_ITEMS);
    expect(context.counts.scenes).toBe(total);
    expect(context.truncated).toBe(true);
  });

  it('keeps the full document when it fits within the cap', () => {
    const document = documentWithScenes(3);

    const context = documentToAiContext(document);

    expect(context.scenes).toHaveLength(3);
    expect(context.truncated).toBe(false);
  });

  it('emits only lightweight scene fields, not the full node', () => {
    const document = documentWithScenes(1);

    const [scene] = documentToAiContext(document).scenes;

    expect(Object.keys(scene).sort()).toEqual(['height', 'id', 'name', 'width', 'x', 'y']);
  });
});
