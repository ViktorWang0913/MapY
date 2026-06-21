import { MousePointer2, Plus, Trash2 } from 'lucide-react';
import { findNode, getIdentifierDefinition, MAX_GRID_SIZE, MIN_GRID_SIZE, typeLabels } from '../model/document';
import type { DoorSide, MapYDocument, MapYNode, Transform } from '../model/types';
import { openAssetFile } from '../platformFiles';
import { useEditorStore } from '../store/editorStore';

const doorSideLabels: Record<DoorSide, string> = {
  top: '上',
  right: '右',
  bottom: '下',
  left: '左'
};

function RegionPanel({ document }: { document: MapYDocument }) {
  const addRegion = useEditorStore((state) => state.addRegion);
  const updateRegion = useEditorStore((state) => state.updateRegion);
  const deleteRegion = useEditorStore((state) => state.deleteRegion);

  return (
    <section className="property-section">
      <div className="section-heading">
        <span>区域</span>
        <button className="icon-button mini" onClick={addRegion} title="新增区域" type="button">
          <Plus size={14} />
        </button>
      </div>
      <div className="region-editor-list">
        {document.regions.map((region) => (
          <div className="region-editor-row" key={region.id}>
            <input onChange={(event) => updateRegion(region.id, { color: event.target.value })} type="color" value={region.color} />
            <input onChange={(event) => updateRegion(region.id, { name: event.target.value })} value={region.name} />
            <button
              className="icon-button mini danger"
              disabled={document.regions.length <= 1}
              onClick={() => deleteRegion(region.id)}
              title="删除区域"
              type="button"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CanvasSettingsPanel({ document }: { document: MapYDocument }) {
  const setGridSize = useEditorStore((state) => state.setGridSize);

  return (
    <section className="property-section">
      <div className="section-heading">
        <span>画布</span>
      </div>
      <label>
        最小像素单位 (px)
        <input
          max={MAX_GRID_SIZE}
          min={MIN_GRID_SIZE}
          onChange={(event) => setGridSize(Number(event.target.value))}
          step={1}
          type="number"
          value={document.settings.gridSize}
        />
      </label>
    </section>
  );
}

function StatsPanel({ document }: { document: MapYDocument }) {
  const regionStats = document.regions
    .map((region) => ({
      region,
      count: document.scenes.filter((scene) => scene.regionId === region.id).length
    }))
    .filter((item) => item.count > 0);

  return (
    <section className="property-section">
      <div className="section-heading">
        <span>地图统计</span>
      </div>
      <div className="palette-stat-grid">
        <span>地图</span>
        <strong>{document.scenes.length}</strong>
        <span>结构</span>
        <strong>{document.structures.length}</strong>
        <span>标识</span>
        <strong>{document.identifierInstances.length}</strong>
        <span>连接点</span>
        <strong>{document.doors.length}</strong>
        <span>连接线</span>
        <strong>{document.stitching.edges.length}</strong>
        <span>资产</span>
        <strong>{document.assets.length}</strong>
      </div>
      {regionStats.length > 0 && (
        <div className="region-stat-list">
          {regionStats.map(({ region, count }) => (
            <span key={region.id}>
              <i style={{ background: region.color }} />
              {region.name} {count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function NodeAssetPanel({ document, selected }: { document: MapYDocument; selected: MapYNode }) {
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
    <div className="embedded-editor">
      <div className="embedded-heading">
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
    </div>
  );
}

function TransformPanel({ selected }: { selected: MapYNode }) {
  const updateNode = useEditorStore((state) => state.updateNode);

  function updateTransform(field: keyof Transform, value: number) {
    updateNode(selected.id, {
      transform: {
        ...selected.transform,
        [field]: Number.isFinite(value) ? value : 0
      }
    });
  }

  if (selected.type === 'connection') {
    return null;
  }

  return (
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
  );
}

export function PropertiesPanel() {
  const document = useEditorStore((state) => state.document);
  const selectedId = useEditorStore((state) => state.selectedId);
  const updateNode = useEditorStore((state) => state.updateNode);
  const updateDoorAnchor = useEditorStore((state) => state.updateDoorAnchor);
  const updateSceneRegion = useEditorStore((state) => state.updateSceneRegion);
  const createConnection = useEditorStore((state) => state.createConnection);
  const disconnectDoor = useEditorStore((state) => state.disconnectDoor);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const selected = findNode(document, selectedId);
  const fallbackRegionId = document.regions[0]?.id;
  const selectedTargetDoor = selected?.type === 'connection' ? findNode(document, selected.targetDoorId) : undefined;

  return (
    <aside className="properties-panel" aria-label="属性栏">
      <div className="panel-title panel-title-rich">
        <span>属性栏</span>
        <em>{selected ? typeLabels[selected.type] : '项目概览'}</em>
      </div>
      <div className="property-stack compact">
        <CanvasSettingsPanel document={document} />
        <RegionPanel document={document} />
        <StatsPanel document={document} />
      </div>
      {!selected ? (
        <div className="empty-properties">
          <div className="empty-header">
            <span>
              <MousePointer2 size={24} />
            </span>
            <div>
              <h2>未选择对象</h2>
              <p>从画布选择地图、结构、标识、连接或注释以编辑属性。</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="property-stack">
          <section className="property-section primary-property-section">
            <div className="section-heading">
              <span>{typeLabels[selected.type]}</span>
              <button className="icon-button danger" onClick={deleteSelected} title="删除选中项" type="button">
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
                <select
                  onChange={(event) => updateSceneRegion(selected.id, event.target.value)}
                  value={selected.regionId || fallbackRegionId || ''}
                >
                  {document.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selected.type === 'identifier' && (
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
            )}
            {selected.type !== 'connection' && selected.type !== 'identifier' && (
              <label className="checkbox-line">
                <input
                  checked={selected.hasCollision}
                  onChange={(event) => updateNode(selected.id, { hasCollision: event.target.checked })}
                  type="checkbox"
                />
                具有物理碰撞
              </label>
            )}
            {selected.type === 'structure' && (
              <label className="checkbox-line" title="开启：缩放父地图时本结构等比变换；关闭：本结构保持自身尺寸/位置">
                <input
                  checked={selected.scaleWithScene !== false}
                  onChange={(event) => updateNode(selected.id, { scaleWithScene: event.target.checked })}
                  type="checkbox"
                />
                随地图缩放
              </label>
            )}
            <NodeAssetPanel document={document} selected={selected} />
          </section>

          <TransformPanel selected={selected} />

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
                  <select
                    onChange={(event) => updateDoorAnchor(selected.id, event.target.value as DoorSide, selected.doorOffset || 0)}
                    value={selected.doorSide || 'top'}
                  >
                    {Object.entries(doorSideLabels).map(([side, label]) => (
                      <option key={side} value={side}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  偏移
                  <input
                    min={0}
                    onChange={(event) => updateDoorAnchor(selected.id, selected.doorSide || 'top', Number(event.target.value))}
                    step={document.settings.gridSize}
                    type="number"
                    value={selected.doorOffset || 0}
                  />
                </label>
              </div>
              <label>
                目标连接
                <select
                  onChange={(event) => {
                    if (event.target.value) {
                      createConnection(selected.id, event.target.value);
                    } else {
                      disconnectDoor(selected.id);
                    }
                  }}
                  value={selected.targetDoorId || ''}
                >
                  <option value="">未连接</option>
                  {document.doors
                    .filter((door) => door.id !== selected.id)
                    .map((door) => (
                      <option key={door.id} value={door.id}>
                        {door.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="secondary-button" disabled={!selectedTargetDoor} onClick={() => disconnectDoor(selected.id)} type="button">
                断开连接
              </button>
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
      )}
    </aside>
  );
}
