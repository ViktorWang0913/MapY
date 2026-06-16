import { describe, expect, it } from 'vitest';
import { addNode, createDefaultNode, createEmptyDocument } from './document';
import { getAnchorWorldPoint, getClosestSceneAnchor, getObjectAbsoluteTransform, snapToGrid } from './geometry';

describe('geometry helpers', () => {
  it('snaps values to the configured grid', () => {
    expect(snapToGrid(47, 32)).toBe(32);
    expect(snapToGrid(49, 32)).toBe(64);
  });

  it('resolves child transforms from parent-relative coordinates', () => {
    let document = createEmptyDocument();
    const scene = createDefaultNode('scene', 1, { x: 64, y: 96, width: 384, height: 256, rotation: 0 });
    const structure = createDefaultNode(
      'structure',
      1,
      { x: 32, y: 64, width: 128, height: 96, rotation: 0 },
      { parentSceneId: scene.id }
    );
    const identifier = createDefaultNode(
      'identifier',
      1,
      { x: 32, y: 32, width: 32, height: 32, rotation: 0 },
      { parentSceneId: scene.id, parentStructureId: structure.id }
    );

    document = addNode(addNode(addNode(document, scene), structure), identifier);

    expect(getObjectAbsoluteTransform(document, structure)).toMatchObject({ x: 96, y: 160 });
    expect(getObjectAbsoluteTransform(document, identifier)).toMatchObject({ x: 128, y: 192 });
  });

  it('snaps doors to the nearest scene edge and resolves anchor world coordinates', () => {
    const scene = createDefaultNode('scene', 1, { x: 64, y: 96, width: 384, height: 256, rotation: 0 });
    const document = addNode(createEmptyDocument(), scene);
    const anchor = getClosestSceneAnchor(scene, { x: 128, y: 90 }, document.settings.gridSize);

    expect(anchor).toEqual({ side: 'top', offset: 64 });
    expect(getAnchorWorldPoint(document, { id: 'anchor-a', sceneId: scene.id, side: anchor.side, offset: anchor.offset })).toEqual({
      x: 128,
      y: 96
    });
  });
});
