import { Plus, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { findNode, getIdentifierDefinition, typeLabels } from '../model/document';
import type { DoorSide, MapYDocument, MapYNode, Transform } from '../model/types';
import { openAssetFile } from '../platformFiles';
import { useEditorStore } from '../store/editorStore';

const doorSideLabels: Record<DoorSide, string> = {
  top: '上',
  right: '右',
  bottom: '下',
  left: '左'
};

function DialogAssetEditor({ document, selected }: { document: MapYDocument; selected: MapYNode }) {
  const addAsset = useEditorStore((state) => state.addAsset);
  const deleteAsset = useEditorStore((state) => state.deleteAsset);
  const setNodeAsset = useEditorStore((state) => state.setNodeAsset);

  if (selected.type !== 'structure') {
    return null;
  }

  const selectedAsset = selected.assetId ? document.assets.find((asset) => asset.id === selected.assetId) : undefined;

  async function handleImportAsset() {
    const asset = await openAssetFile();
    if (!asset) {
      return;
    }

    const assetId = addAsset(asset);
    setNodeAsset(selected.id, assetId);
  }

  return (
    <section className="property-section">
      <div className="section-heading">
        <span>美术资产</span>
        <button className="icon-button mini" onClick={() => void handleImportAsset()} title="导入并绑定图片" type="button">
          <Plus size={14} />
        </button>
      </div>
      <label>
        替代图形
        <select onChange={(event) => setNodeAsset(selected.id, event.target.value || undefined)} value={selected.assetId || ''}>
          <option value="">使用默认图形</option>
          {document.assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
      </label>
      {selectedAsset ? (
        <div className="asset-preview">
          <img alt="" src={selectedAsset.dataUrl} />
          <div>
            <strong>{selectedAsset.name}</strong>
            <span>{selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} x ${selectedAsset.height}` : selectedAsset.mimeType}</span>
          </div>
        </div>
      ) : (
        <div className="empty-inline">当前使用默认图形</div>
      )}
      {selectedAsset && (
        <button className="secondary-button compact" onClick={() => deleteAsset(selectedAsset.id)} type="button">
          删除当前资产
        </button>
      )}
    </section>
  );
}

export function NodePropertyDialog() {
  const document = useEditorStore((state) => state.document);
  const inspectorNodeId = useEditorStore((state) => state.inspectorNodeId);
  const closeNodeInspector = useEditorStore((state) => state.closeNodeInspector);
  const updateNode = useEditorStore((state) => state.updateNode);
  const updateDoorAnchor = useEditorStore((state) => state.updateDoorAnchor);
  const updateSceneRegion = useEditorStore((state) => state.updateSceneRegion);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const selected = findNode(document, inspectorNodeId);

  if (!selected) {
    return null;
  }

  const fallbackRegionId = document.regions[0]?.id;

  function updateTransform(field: keyof Transform, value: number) {
    updateNode(selected!.id, {
      transform: {
        ...selected!.transform,
        [field]: Number.isFinite(value) ? value : 0
      }
    });
  }

  const dialog = (
    <div className="dialog-backdrop" onMouseDown={closeNodeInspector} role="presentation">
      <section className="node-property-dialog" aria-label="对象属性窗口" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <div className="dialog-kicker">对象属性</div>
            <h2>{selected.name}</h2>
          </div>
          <button className="icon-button" onClick={closeNodeInspector} title="关闭" type="button">
            <X size={16} />
          </button>
        </div>

        <div className="node-property-dialog-body">
          <section className="property-section primary-property-section">
            <div className="section-heading">
              <span>{typeLabels[selected.type]}</span>
              <button className="icon-button danger" onClick={deleteSelected} title="删除对象" type="button">
                <Trash2 size={16} />
              </button>
            </div>
            <label>
              名称
              <input onChange={(event) => updateNode(selected.id, { name: event.target.value })} value={selected.name} />
            </label>
            {selected.type !== 'scene' && selected.type !== 'identifier' && (
              <label>
                颜色
                <input onChange={(event) => updateNode(selected.id, { color: event.target.value })} type="color" value={selected.color} />
              </label>
            )}
            {selected.type === 'scene' && (
              <label>
                区域
                <select onChange={(event) => updateSceneRegion(selected.id, event.target.value)} value={selected.regionId || fallbackRegionId || ''}>
                  {document.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selected.type === 'identifier' && (
              <>
                <label>
                  标识类型
                  <select
                    onChange={(event) => {
                      const definition = getIdentifierDefinition(document, event.target.value);
                      updateNode(selected.id, {
                        identifierDefinitionId: event.target.value,
                        color: definition?.color || selected.color,
                        shape: definition?.shape || selected.shape,
                        assetId: definition?.assetId
                      });
                    }}
                    value={selected.identifierDefinitionId || ''}
                  >
                    {document.identifiers.map((definition) => (
                      <option key={definition.id} value={definition.id}>
                        {definition.kind || definition.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {selected.type !== 'connection' && selected.type !== 'identifier' && (
              <label className="checkbox-line">
                <input checked={selected.hasCollision} onChange={(event) => updateNode(selected.id, { hasCollision: event.target.checked })} type="checkbox" />
                具有物理碰撞
              </label>
            )}
          </section>

          <DialogAssetEditor document={document} selected={selected} />

          {selected.type !== 'connection' && (
            <section className="property-section">
              <div className="section-heading">
                <span>Transform</span>
              </div>
              <div className="property-grid">
                <label>
                  X
                  <input onChange={(event) => updateTransform('x', Number(event.target.value))} type="number" value={selected.transform.x} />
                </label>
                <label>
                  Y
                  <input onChange={(event) => updateTransform('y', Number(event.target.value))} type="number" value={selected.transform.y} />
                </label>
                <label>
                  W
                  <input min={8} onChange={(event) => updateTransform('width', Number(event.target.value))} type="number" value={selected.transform.width} />
                </label>
                <label>
                  H
                  <input min={8} onChange={(event) => updateTransform('height', Number(event.target.value))} type="number" value={selected.transform.height} />
                </label>
                <label>
                  R
                  <input onChange={(event) => updateTransform('rotation', Number(event.target.value))} type="number" value={selected.transform.rotation} />
                </label>
              </div>
            </section>
          )}

          {selected.type === 'connection' && (
            <section className="property-section">
              <div className="section-heading">
                <span>连接属性</span>
              </div>
              <label>
                父地图
                <input readOnly value={findNode(document, selected.parentSceneId)?.name || '-'} />
              </label>
              <div className="property-grid">
                <label>
                  方向
                  <select onChange={(event) => updateDoorAnchor(selected.id, event.target.value as DoorSide, selected.doorOffset || 0)} value={selected.doorSide || 'top'}>
                    {Object.entries(doorSideLabels).map(([side, label]) => (
                      <option key={side} value={side}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  偏移
                  <input min={0} onChange={(event) => updateDoorAnchor(selected.id, selected.doorSide || 'top', Number(event.target.value))} step={document.settings.gridSize} type="number" value={selected.doorOffset || 0} />
                </label>
              </div>
            </section>
          )}

          {selected.type === 'annotation' && (
            <section className="property-section">
              <div className="section-heading">
                <span>注释</span>
              </div>
              <textarea onChange={(event) => updateNode(selected.id, { text: event.target.value })} rows={4} value={selected.text || ''} />
            </section>
          )}
        </div>
      </section>
    </div>
  );

  return createPortal(dialog, window.document.body);
}
