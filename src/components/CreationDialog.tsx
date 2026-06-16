import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { defaultColors, defaultShape, findNode, getIdentifierDefinition, shapeLabels, typeLabels } from '../model/document';
import { getParentWorldOrigin } from '../model/geometry';
import type { ElementType, ShapeKind } from '../model/types';
import { openAssetFile } from '../platformFiles';
import { useEditorStore } from '../store/editorStore';

const shapeOptions: ShapeKind[] = ['circle', 'diamond', 'triangle', 'star'];

function isCanvasNodeType(type: ElementType): boolean {
  return type === 'scene' || type === 'structure' || type === 'connection';
}

export function CreationDialog() {
  const creationType = useEditorStore((state) => state.creationType);
  const creationEditId = useEditorStore((state) => state.creationEditId);
  const document = useEditorStore((state) => state.document);
  const closeCreation = useEditorStore((state) => state.closeCreation);
  const createNode = useEditorStore((state) => state.createNode);
  const updateNode = useEditorStore((state) => state.updateNode);
  const updateNodeTransform = useEditorStore((state) => state.updateNodeTransform);
  const createIdentifierDefinition = useEditorStore((state) => state.createIdentifierDefinition);
  const updateIdentifierDefinition = useEditorStore((state) => state.updateIdentifierDefinition);
  const addAsset = useEditorStore((state) => state.addAsset);
  const setWorkspaceMode = useEditorStore((state) => state.setWorkspaceMode);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [shape, setShape] = useState<ShapeKind>('diamond');
  const [color, setColor] = useState('#2d7dd2');
  const [opacity, setOpacity] = useState(100);
  const [x, setX] = useState(32);
  const [y, setY] = useState(32);
  const [width, setWidth] = useState(384);
  const [height, setHeight] = useState(256);
  const [hasCollision, setHasCollision] = useState(false);
  const [parentSceneId, setParentSceneId] = useState('');
  const [identifierDefinitionId, setIdentifierDefinitionId] = useState('');
  const [assetId, setAssetId] = useState('');

  const defaultSceneId = document.scenes[0]?.id || '';
  const editingNode = findNode(document, creationEditId);
  const editingIdentifierDefinition =
    creationType === 'identifier' ? document.identifiers.find((definition) => definition.id === creationEditId) : undefined;
  const isEditing = Boolean(editingNode || editingIdentifierDefinition);
  const isIdentifierDefinitionEditor = creationType === 'identifier' && editingNode?.type !== 'identifier';
  const isIdentifierInstanceEditor = creationType === 'identifier' && editingNode?.type === 'identifier';

  useEffect(() => {
    if (!creationType) {
      return;
    }

    const grid = document.settings.gridSize;
    const editableNode = findNode(document, creationEditId);
    const editableIdentifierDefinition =
      creationType === 'identifier'
        ? editableNode?.type === 'identifier'
          ? document.identifiers.find((definition) => definition.id === editableNode.identifierDefinitionId)
          : document.identifiers.find((definition) => definition.id === creationEditId)
        : undefined;
    setStep(0);
    setName(editableNode?.name || '');
    setKind(editableIdentifierDefinition?.kind || editableIdentifierDefinition?.name || '');
    setShape(
      editableNode?.shape && editableNode.shape !== 'door'
        ? editableNode.shape
        : editableIdentifierDefinition?.shape || (defaultShape(creationType) === 'door' ? 'diamond' : defaultShape(creationType))
    );
    setColor(editableNode?.color || editableIdentifierDefinition?.color || defaultColors[creationType]);
    setOpacity(Math.round((editableNode?.opacity ?? (creationType === 'scene' ? 0.24 : 1)) * 100));
    setX(editableNode?.transform.x ?? (creationType === 'scene' ? 0 : grid));
    setY(editableNode?.transform.y ?? (creationType === 'scene' ? 0 : grid));
    setWidth(editableNode?.transform.width ?? (creationType === 'scene' ? grid * 12 : creationType === 'structure' ? grid * 4 : grid));
    setHeight(editableNode?.transform.height ?? (creationType === 'scene' ? grid * 8 : creationType === 'structure' ? grid * 3 : grid));
    setHasCollision(editableNode?.hasCollision ?? creationType === 'structure');
    setParentSceneId(creationType === 'scene' ? editableNode?.regionId || '' : editableNode?.parentSceneId || defaultSceneId);
    setIdentifierDefinitionId(editableNode?.type === 'identifier' ? editableNode.identifierDefinitionId || editableIdentifierDefinition?.id || '' : '');
    setAssetId(editableNode?.assetId || editableIdentifierDefinition?.assetId || '');
  }, [creationEditId, creationType, defaultSceneId, document, document.settings.gridSize]);

  const canSubmit = useMemo(() => {
    if (!creationType) {
      return false;
    }

    if (creationType === 'identifier' && editingNode?.type !== 'identifier') {
      return Boolean(kind.trim());
    }

    if (creationType === 'structure' || creationType === 'connection') {
      return Boolean(parentSceneId);
    }

    return true;
  }, [creationType, editingNode, kind, parentSceneId]);

  if (!creationType) {
    return null;
  }

  const label = typeLabels[creationType];
  const selectedIdentifierDefinition =
    creationType === 'identifier' && editingNode?.type === 'identifier'
      ? getIdentifierDefinition(document, identifierDefinitionId)
      : undefined;
  const effectiveAssetId = selectedIdentifierDefinition?.assetId || assetId;
  const selectedAsset = effectiveAssetId ? document.assets.find((asset) => asset.id === effectiveAssetId) : undefined;
  const sceneRegionColor = creationType === 'scene' ? document.regions.find((region) => region.id === parentSceneId)?.color : undefined;
  const effectiveColor = sceneRegionColor || selectedIdentifierDefinition?.color || color;
  const effectiveShape = selectedIdentifierDefinition?.shape || shape;

  async function handleImportAsset() {
    const asset = await openAssetFile();
    if (!asset) {
      return;
    }

    setAssetId(addAsset(asset));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!creationType || !canSubmit) {
      return;
    }

    if (creationType === 'identifier' && editingIdentifierDefinition) {
      const typeName = kind.trim();
      updateIdentifierDefinition(editingIdentifierDefinition.id, {
        name: typeName,
        kind: typeName,
        color,
        shape,
        assetId: assetId || undefined
      });
      closeCreation();
      return;
    }

    if (creationType === 'identifier' && editingNode?.type === 'identifier') {
      const definition = getIdentifierDefinition(document, identifierDefinitionId);
      updateNode(editingNode.id, {
        name,
        identifierDefinitionId: definition?.id || editingNode.identifierDefinitionId,
        color: definition?.color || editingNode.color,
        opacity: opacity / 100,
        shape: definition?.shape || editingNode.shape,
        assetId: definition?.assetId
      });
      closeCreation();
      return;
    }

    if (creationType === 'identifier' && !editingNode) {
      const typeName = kind.trim();
      createIdentifierDefinition({
        name: typeName,
        kind: typeName,
        color,
        shape,
        assetId: assetId || undefined
      });
      return;
    }

    if (editingNode && (editingNode.type === 'scene' || editingNode.type === 'structure')) {
      const editOrigin = editingNode.type === 'structure' ? getParentWorldOrigin(document, 'structure', parentSceneId) : { x: 0, y: 0 };
      updateNode(editingNode.id, {
        name,
        color: editingNode.type === 'scene' ? effectiveColor : color,
        opacity: opacity / 100,
        hasCollision,
        assetId: assetId || undefined,
        regionId: editingNode.type === 'scene' ? parentSceneId || undefined : editingNode.regionId,
        parentSceneId: editingNode.type === 'structure' ? parentSceneId || undefined : editingNode.parentSceneId
      });
      updateNodeTransform(editingNode.id, {
        ...editingNode.transform,
        x: editOrigin.x + x,
        y: editOrigin.y + y,
        width,
        height
      });
      closeCreation();
      return;
    }

    const origin = getParentWorldOrigin(document, creationType, parentSceneId);
    const created = createNode(
      creationType,
      {
        x: origin.x + x,
        y: origin.y + y
      },
      {
        name,
        shape: creationType === 'connection' ? 'door' : shape,
        color: creationType === 'scene' ? effectiveColor : color,
        opacity: opacity / 100,
        width,
        height,
        hasCollision,
        regionId: creationType === 'scene' ? parentSceneId || undefined : undefined,
        parentSceneId: creationType === 'scene' ? undefined : parentSceneId || undefined,
        assetId: assetId || undefined
      }
    );

    if (created && creationType === 'structure') {
      setWorkspaceMode('structure');
    }
  }

  const dialog = (
    <div className="dialog-backdrop" role="presentation">
      <form className="creation-dialog" onSubmit={handleSubmit}>
        <header className="dialog-header">
          <div>
            <span className="dialog-kicker">Canvas 创建菜单</span>
            <h2>{isIdentifierDefinitionEditor ? `${isEditing ? '编辑' : '创建'}标识类型` : `${isEditing ? '编辑' : '创建'}${label}`}</h2>
          </div>
          <button className="icon-button" onClick={closeCreation} title="关闭" type="button">
            <X size={18} />
          </button>
        </header>

        <div className="wizard-steps" aria-label="创建步骤">
          <button className={step === 0 ? 'active' : ''} onClick={() => setStep(0)} type="button">
            基础设置
          </button>
          <button className={step === 1 ? 'active' : ''} onClick={() => setStep(1)} type="button">
            美术与参数
          </button>
        </div>

        {step === 0 ? (
          <div className="form-grid">
            {!isIdentifierDefinitionEditor && (
              <label>
                名称
                <input onChange={(event) => setName(event.target.value)} placeholder={`${label}名称`} value={name} />
              </label>
            )}
            {isIdentifierDefinitionEditor && (
              <label>
                类型
                <input onChange={(event) => setKind(event.target.value)} placeholder="例如 Boss / 道具 / 存档" value={kind} />
              </label>
            )}
            {isIdentifierInstanceEditor && (
              <label>
                类型
                <select onChange={(event) => setIdentifierDefinitionId(event.target.value)} value={identifierDefinitionId}>
                  {document.identifiers.map((definition) => (
                    <option key={definition.id} value={definition.id}>
                      {definition.kind || definition.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {creationType === 'scene' && (
              <label>
                区域
                <select
                  onChange={(event) => {
                    setParentSceneId(event.target.value);
                    const regionColor = document.regions.find((region) => region.id === event.target.value)?.color;
                    if (regionColor) {
                      setColor(regionColor);
                    }
                  }}
                  value={parentSceneId}
                >
                  <option value="">不绑定区域</option>
                  {document.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(creationType === 'structure' || creationType === 'connection') && (
              <label>
                父地图
                <select onChange={(event) => setParentSceneId(event.target.value)} value={parentSceneId}>
                  {document.scenes.length === 0 && <option value="">暂无地图</option>}
                  {document.scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ) : (
          <>
            <div className="form-grid">
              {creationType !== 'scene' && !isIdentifierInstanceEditor && (
                <label>
                  颜色
                  <input onChange={(event) => setColor(event.target.value)} type="color" value={color} />
                </label>
              )}
              <label>
                透明度
                <input max={100} min={0} onChange={(event) => setOpacity(Number(event.target.value))} type="number" value={opacity} />
              </label>
              {creationType === 'identifier' && !isIdentifierInstanceEditor && (
                <label>
                  形状
                  <select onChange={(event) => setShape(event.target.value as ShapeKind)} value={shape}>
                    {shapeOptions.map((option) => (
                      <option key={option} value={option}>
                        {shapeLabels[option]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(creationType === 'structure' || (creationType === 'identifier' && !isIdentifierInstanceEditor)) && (
                <label>
                  美术资产
                  <select onChange={(event) => setAssetId(event.target.value)} value={assetId}>
                    <option value="">使用默认图形</option>
                    {document.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(creationType === 'structure' || (creationType === 'identifier' && !isIdentifierInstanceEditor)) && (
                <button className="secondary-button compact asset-import-button" onClick={() => void handleImportAsset()} type="button">
                  <Plus size={14} />
                  导入美术资产
                </button>
              )}
              {isCanvasNodeType(creationType) && creationType !== 'connection' && (
                <label className="checkbox-line">
                  <input checked={hasCollision} onChange={(event) => setHasCollision(event.target.checked)} type="checkbox" />
                  具有物理碰撞
                </label>
              )}
            </div>

            {isCanvasNodeType(creationType) && (
              <div className="form-grid transform-grid">
                <label>
                  X
                  <input onChange={(event) => setX(Number(event.target.value))} step={document.settings.gridSize} type="number" value={x} />
                </label>
                <label>
                  Y
                  <input onChange={(event) => setY(Number(event.target.value))} step={document.settings.gridSize} type="number" value={y} />
                </label>
                <label>
                  宽
                  <input onChange={(event) => setWidth(Number(event.target.value))} step={document.settings.gridSize} type="number" value={width} />
                </label>
                <label>
                  高
                  <input onChange={(event) => setHeight(Number(event.target.value))} step={document.settings.gridSize} type="number" value={height} />
                </label>
              </div>
            )}

            <div className="creation-preview">
              <div
                className={`creation-preview-shape shape-${effectiveShape}`}
                style={{
                  borderColor: effectiveColor,
                  background: selectedAsset ? `center / contain no-repeat url(${selectedAsset.dataUrl})` : effectiveColor,
                  opacity: Math.max(0.12, opacity / 100)
                }}
              />
              <span>{selectedAsset?.name || `${label}预览`}</span>
            </div>
          </>
        )}

        {!canSubmit && <div className="dialog-warning">需要先创建地图；结构和连接都必须绑定到已有地图。</div>}

        <footer className="dialog-actions">
          {step > 0 && (
            <button className="secondary-button" onClick={() => setStep(0)} type="button">
              上一步
            </button>
          )}
          {step === 0 ? (
            <button className="primary-button" onClick={() => setStep(1)} type="button">
              下一步
            </button>
          ) : (
            <button className="primary-button" disabled={!canSubmit} type="submit">
              {isEditing ? '保存' : '创建'}
            </button>
          )}
        </footer>
      </form>
    </div>
  );

  return createPortal(dialog, window.document.body);
}
