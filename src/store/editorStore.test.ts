import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../model/document';
import { useEditorStore } from './editorStore';

function resetStore() {
  const document = createEmptyDocument();
  useEditorStore.setState({
    document,
    documentTabs: [{ id: 'doc-test', document }],
    activeDocumentTabId: 'doc-test',
    selectedId: undefined,
    inspectorNodeId: undefined,
    creationType: undefined,
    creationEditId: undefined,
    clipboard: undefined,
    searchQuery: '',
    viewport: { x: 240, y: 120, scale: 1, width: 800, height: 600 },
    workspaceMode: 'edit',
    connectionMode: false,
    worldVisibility: { structures: true, identifiers: true, connections: true },
    connectionStartDoorId: undefined,
    tileStroke: undefined,
    history: { past: [], future: [] },
    notice: undefined
  });
}

describe('editor store', () => {
  beforeEach(resetStore);

  it('validates parent hierarchy while creating scene, structure, and identifiers', () => {
    expect(useEditorStore.getState().createNode('structure', { x: 32, y: 32 })).toBe(false);
    expect(useEditorStore.getState().notice).toContain('请先创建地图');

    expect(useEditorStore.getState().createNode('scene', { x: 0, y: 0 })).toBe(true);
    const scene = useEditorStore.getState().document.scenes[0];

    expect(useEditorStore.getState().createNode('structure', { x: 32, y: 32 }, { parentSceneId: scene.id })).toBe(true);
    const structure = useEditorStore.getState().document.structures[0];

    expect(structure.parentSceneId).toBe(scene.id);
    expect(structure.transform).toMatchObject({ x: 32, y: 32 });
    expect(useEditorStore.getState().workspaceMode).toBe('structure');

    const definitionId = useEditorStore.getState().createIdentifierDefinition({
      name: '道具',
      kind: 'item',
      color: '#ffcc00',
      shape: 'diamond'
    });

    expect(
      useEditorStore.getState().createNode('identifier', { x: 64, y: 64 }, { parentStructureId: structure.id, identifierDefinitionId: definitionId })
    ).toBe(true);

    expect(useEditorStore.getState().document.identifierInstances[0]).toMatchObject({
      parentSceneId: scene.id,
      parentStructureId: structure.id,
      identifierDefinitionId: definitionId
    });
  });

  it('supports copy, paste, undo, and redo', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 }, { name: 'A' });
    const first = useEditorStore.getState().document.scenes[0];
    useEditorStore.getState().selectNode(first.id);
    useEditorStore.getState().copySelected();
    useEditorStore.getState().pasteClipboard();

    expect(useEditorStore.getState().document.scenes).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.scenes).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.scenes).toHaveLength(2);
  });

  it('switches workspace modes and creates scene-bound connection points', () => {
    useEditorStore.getState().setWorkspaceMode('world');
    expect(useEditorStore.getState().workspaceMode).toBe('world');

    expect(useEditorStore.getState().createNode('connection', { x: 0, y: 0 })).toBe(false);

    useEditorStore.getState().createNode('scene', { x: 0, y: 0 });
    expect(useEditorStore.getState().createNode('connection', { x: 64, y: -8 })).toBe(true);

    const state = useEditorStore.getState();
    expect(state.document.doors).toHaveLength(1);
    expect(state.document.stitching.anchors).toHaveLength(1);
    expect(state.document.doors[0]).toMatchObject({ type: 'connection', doorSide: 'top', doorOffset: 64 });
  });

  it('connects connection points without duplicates and clears edges when deleting one', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 }, { name: 'A' });
    useEditorStore.getState().createNode('scene', { x: 512, y: 0 }, { name: 'B' });
    const [firstScene, secondScene] = useEditorStore.getState().document.scenes;

    useEditorStore.getState().createNode('connection', { x: 384, y: 64 }, { parentSceneId: firstScene.id, name: 'A连接' });
    useEditorStore.getState().createNode('connection', { x: 512, y: 64 }, { parentSceneId: secondScene.id, name: 'B连接' });
    const [firstDoor, secondDoor] = useEditorStore.getState().document.doors;

    useEditorStore.getState().createConnection(firstDoor.id, secondDoor.id);
    useEditorStore.getState().createConnection(firstDoor.id, secondDoor.id);

    expect(useEditorStore.getState().document.stitching.edges).toHaveLength(1);
    expect(useEditorStore.getState().document.doors[0].targetDoorId).toBe(secondDoor.id);

    useEditorStore.getState().selectNode(firstDoor.id);
    useEditorStore.getState().deleteSelected();

    expect(useEditorStore.getState().document.doors).toHaveLength(1);
    expect(useEditorStore.getState().document.stitching.edges).toHaveLength(0);
    expect(useEditorStore.getState().document.doors[0].targetDoorId).toBeUndefined();
  });

  it('manages custom regions', () => {
    const initialRegionId = useEditorStore.getState().document.regions[0].id;
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 }, { regionId: initialRegionId });
    useEditorStore.getState().addRegion();

    const customRegion = useEditorStore.getState().document.regions.at(-1)!;
    useEditorStore.getState().updateRegion(customRegion.id, { name: '蜂巢区', color: '#ffcc00' });

    expect(useEditorStore.getState().document.regions.at(-1)).toMatchObject({
      name: '蜂巢区',
      color: '#ffcc00'
    });

    useEditorStore.getState().updateSceneRegion(useEditorStore.getState().document.scenes[0].id, customRegion.id);
    expect(useEditorStore.getState().document.scenes[0].color).toBe('#ffcc00');

    useEditorStore.getState().updateRegion(customRegion.id, { color: '#00aaff' });
    expect(useEditorStore.getState().document.scenes[0].color).toBe('#00aaff');

    useEditorStore.getState().deleteRegion(customRegion.id);

    expect(useEditorStore.getState().document.regions.some((region) => region.id === customRegion.id)).toBe(false);
    expect(useEditorStore.getState().document.scenes[0].regionId).toBe(initialRegionId);
    expect(useEditorStore.getState().document.scenes[0].color).toBe(useEditorStore.getState().document.regions[0].color);
  });

  it('paints structure pixels on the canvas grid as one undo step', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 });
    useEditorStore.getState().beginTileStroke('structure', { x: 12, y: 18 }, 'paint');
    useEditorStore.getState().updateTileStroke('structure', { x: 70, y: 18 }, 'paint');
    useEditorStore.getState().updateTileStroke('structure', { x: 102, y: 18 }, 'paint');

    expect(useEditorStore.getState().history.past).toHaveLength(1);
    expect(useEditorStore.getState().document.structures[0].tiles).toHaveLength(3);

    useEditorStore.getState().endTileStroke();
    expect(useEditorStore.getState().history.past).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.structures).toHaveLength(0);
  });

  it('binds imported art assets to structures and identifiers', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 });
    const scene = useEditorStore.getState().document.scenes[0];
    useEditorStore.getState().createNode('structure', { x: 32, y: 32 }, { parentSceneId: scene.id });
    const structure = useEditorStore.getState().document.structures[0];
    const definitionId = useEditorStore.getState().createIdentifierDefinition({
      name: '存档点',
      kind: 'save',
      color: '#e85d75',
      shape: 'circle'
    });

    useEditorStore.getState().addAsset({
      name: 'platform.png',
      dataUrl: 'data:image/png;base64,AAAA',
      mimeType: 'image/png',
      width: 16,
      height: 16
    });
    const asset = useEditorStore.getState().document.assets[0];

    useEditorStore.getState().setNodeAsset(structure.id, asset.id);
    expect(useEditorStore.getState().document.structures[0].assetId).toBe(asset.id);

    useEditorStore.getState().setIdentifierAsset(definitionId, asset.id);
    expect(useEditorStore.getState().document.identifiers[0].assetId).toBe(asset.id);

    useEditorStore.getState().createNode('identifier', { x: 64, y: 64 }, {
      parentSceneId: scene.id,
      identifierDefinitionId: definitionId
    });
    const instance = useEditorStore.getState().document.identifierInstances[0];
    useEditorStore.getState().setNodeAsset(instance.id, asset.id);
    expect(useEditorStore.getState().document.identifierInstances[0].assetId).toBe(asset.id);

    useEditorStore.getState().deleteAsset(asset.id);
    expect(useEditorStore.getState().document.assets).toEqual([]);
    expect(useEditorStore.getState().document.structures[0].assetId).toBeUndefined();
    expect(useEditorStore.getState().document.identifiers[0].assetId).toBeUndefined();
    expect(useEditorStore.getState().document.identifierInstances[0].assetId).toBeUndefined();
  });

  it('scales child structures when resizing a scene', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 }, { width: 320, height: 160 });
    const scene = useEditorStore.getState().document.scenes[0];
    useEditorStore.getState().createNode('structure', { x: 32, y: 32 }, { parentSceneId: scene.id, width: 64, height: 32 });
    const structure = useEditorStore.getState().document.structures[0];

    useEditorStore.getState().updateNodeTransform(scene.id, { ...scene.transform, width: 640, height: 320 });

    expect(useEditorStore.getState().document.structures[0].transform).toMatchObject({
      x: structure.transform.x * 2,
      y: structure.transform.y * 2,
      width: structure.transform.width * 2,
      height: structure.transform.height * 2
    });
  });

  it('resamples structure tiles when resizing a structure', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 });
    const scene = useEditorStore.getState().document.scenes[0];
    useEditorStore.getState().createNode('structure', { x: 32, y: 32 }, { parentSceneId: scene.id, width: 32, height: 32 });
    const structure = useEditorStore.getState().document.structures[0];

    useEditorStore.getState().updateNodeTransform(structure.id, { x: 32, y: 32, width: 64, height: 64, rotation: 0 });

    expect(useEditorStore.getState().document.structures[0].tiles).toHaveLength(256);
  });

  it('deletes identifier definitions and placed instances', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 });
    const scene = useEditorStore.getState().document.scenes[0];
    const definitionId = useEditorStore.getState().createIdentifierDefinition({
      name: '钥匙',
      color: '#ffcc00',
      shape: 'diamond'
    });
    useEditorStore.getState().createNode('identifier', { x: 32, y: 32 }, { parentSceneId: scene.id, identifierDefinitionId: definitionId });

    useEditorStore.getState().deleteIdentifierDefinition(definitionId);

    expect(useEditorStore.getState().document.identifiers).toEqual([]);
    expect(useEditorStore.getState().document.identifierInstances).toEqual([]);
  });

  it('uses one identifier definition for multiple placed identifier instances', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 });
    const scene = useEditorStore.getState().document.scenes[0];
    const definitionId = useEditorStore.getState().createIdentifierDefinition({
      name: '钥匙',
      color: '#ffcc00',
      shape: 'diamond'
    });

    useEditorStore.getState().createNode('identifier', { x: 32, y: 32 }, { parentSceneId: scene.id, identifierDefinitionId: definitionId });
    useEditorStore.getState().createNode('identifier', { x: 64, y: 32 }, { parentSceneId: scene.id, identifierDefinitionId: definitionId });

    expect(useEditorStore.getState().document.identifierInstances).toHaveLength(2);
    expect(useEditorStore.getState().document.identifierInstances.every((node) => node.identifierDefinitionId === definitionId)).toBe(true);
    expect(useEditorStore.getState().document.identifierInstances.map((node) => node.name)).toEqual(['1', '2']);

    useEditorStore.getState().updateIdentifierDefinition(definitionId, {
      color: '#00aaff',
      shape: 'circle',
      visibleInWorld: false
    });

    expect(useEditorStore.getState().document.identifiers[0].visibleInWorld).toBe(false);
    expect(useEditorStore.getState().document.identifierInstances.every((node) => node.color === '#00aaff' && node.shape === 'circle')).toBe(true);
  });

  it('keeps identifier instance names when changing their type', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 });
    const scene = useEditorStore.getState().document.scenes[0];
    const firstDefinitionId = useEditorStore.getState().createIdentifierDefinition({
      name: '标识1',
      kind: 'Save',
      color: '#ffcc00',
      shape: 'diamond'
    });
    const secondDefinitionId = useEditorStore.getState().createIdentifierDefinition({
      name: '标识2',
      kind: 'Item',
      color: '#00aaff',
      shape: 'circle'
    });

    useEditorStore.getState().createNode('identifier', { x: 32, y: 32 }, { parentSceneId: scene.id, identifierDefinitionId: firstDefinitionId });
    const instance = useEditorStore.getState().document.identifierInstances[0];
    useEditorStore.getState().updateNode(instance.id, { name: '存档点 A' });
    useEditorStore.getState().updateNode(instance.id, { identifierDefinitionId: secondDefinitionId, color: '#00aaff', shape: 'circle' });

    expect(useEditorStore.getState().document.identifierInstances[0]).toMatchObject({
      name: '存档点 A',
      identifierDefinitionId: secondDefinitionId,
      color: '#00aaff',
      shape: 'circle'
    });
  });

  it('stores world visibility switches', () => {
    useEditorStore.getState().setWorldVisibility({ structures: false, connections: false });

    expect(useEditorStore.getState().worldVisibility).toEqual({
      structures: false,
      identifiers: true,
      connections: false
    });
  });

  it('creates AI documents in a new tab without replacing the source tab', () => {
    const sourceDocument = useEditorStore.getState().document;
    const plan = {
      intent: 'create_document' as const,
      documentName: 'AI 新地图',
      operations: [{
        op: 'create_scene' as const,
        tempId: 'scene',
        name: 'AI 场景',
        transform: { x: 0, y: 0, width: 320, height: 200, rotation: 0 }
      }]
    };

    const preview = useEditorStore.getState().previewAiPlan(plan);
    expect(preview.document.scenes).toHaveLength(1);
    expect(useEditorStore.getState().document).toBe(sourceDocument);

    useEditorStore.getState().applyAiPlan(plan, sourceDocument);
    expect(useEditorStore.getState().documentTabs).toHaveLength(2);
    expect(useEditorStore.getState().document.name).toBe('AI 新地图');
    expect(useEditorStore.getState().documentTabs[0].document).toBe(sourceDocument);
  });

  it('applies an AI patch as one undo step and rejects stale previews', () => {
    useEditorStore.getState().createNode('scene', { x: 0, y: 0 }, { name: '原名称' });
    const sourceDocument = useEditorStore.getState().document;
    const scene = sourceDocument.scenes[0];
    const plan = {
      intent: 'patch_document' as const,
      operations: [{ op: 'update_entity' as const, id: scene.id, patch: { name: 'AI 名称' } }]
    };

    useEditorStore.getState().applyAiPlan(plan, sourceDocument);
    expect(useEditorStore.getState().document.scenes[0].name).toBe('AI 名称');
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.scenes[0].name).toBe('原名称');

    const staleDocument = useEditorStore.getState().document;
    useEditorStore.getState().updateNode(scene.id, { name: '手工修改' });
    expect(() => useEditorStore.getState().applyAiPlan(plan, staleDocument)).toThrow('发生变化');
  });
});
