import { Box, Eye, EyeOff, GitBranch, Map as MapIcon, Plus, Trash2 } from 'lucide-react';
import { type ElementType, type IdentifierDefinition } from '../model/types';
import { useEditorStore } from '../store/editorStore';
import { beginPaletteDrag } from '../utils/paletteDrag';

interface PaletteItem {
  type: ElementType;
  label: string;
  icon: typeof MapIcon;
  tone: string;
  draggable: boolean;
}

const paletteItems: PaletteItem[] = [
  {
    type: 'scene',
    label: '地图',
    icon: MapIcon,
    tone: 'blue',
    draggable: true
  },
  {
    type: 'structure',
    label: '结构',
    icon: Box,
    tone: 'green',
    draggable: true
  },
  {
    type: 'connection',
    label: '连接',
    icon: GitBranch,
    tone: 'cyan',
    draggable: true
  }
];

function dragComponent(event: React.DragEvent, type: ElementType, identifier?: IdentifierDefinition) {
  beginPaletteDrag({
    type,
    identifierDefinitionId: identifier?.id
  });
  event.dataTransfer.setData('application/x-mapy-component', type);
  event.dataTransfer.setData('text/plain', type);
  if (identifier) {
    event.dataTransfer.setData('application/x-mapy-identifier-id', identifier.id);
  }
  event.dataTransfer.effectAllowed = 'copy';
}

export function LeftPalette() {
  const document = useEditorStore((state) => state.document);
  const identifiers = document.identifiers;
  const workspaceMode = useEditorStore((state) => state.workspaceMode);
  const openCreation = useEditorStore((state) => state.openCreation);
  const updateIdentifierDefinition = useEditorStore((state) => state.updateIdentifierDefinition);
  const deleteIdentifierDefinition = useEditorStore((state) => state.deleteIdentifierDefinition);

  return (
    <aside className="left-palette" aria-label="部件栏">
      <div className="panel-title">
        <span>部件栏</span>
      </div>
      <div className="palette-main">
        <div className="palette-section-label">部件</div>
        <div className="palette-list">
          {paletteItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={`palette-button tone-${item.tone}`}
                draggable={item.draggable}
                key={item.type}
                onClick={() => openCreation(item.type)}
                onDragStart={(event) => item.draggable && dragComponent(event, item.type)}
                title={item.label}
                type="button"
              >
                <span className="palette-icon">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span className="palette-copy">
                  <strong>{item.label}</strong>
                </span>
              </button>
            );
          })}
        </div>

        <div className="palette-section-label">
          <span>标识类型</span>
          <button className="icon-button mini" onClick={() => openCreation('identifier')} title="创建标识类型" type="button">
            <Plus size={13} />
          </button>
        </div>
        <div className="identifier-palette-list">
          {identifiers.length === 0 ? (
            <div className="empty-inline">暂无自定义标识</div>
          ) : (
            identifiers.map((identifier) => {
              const typeName = identifier.kind || identifier.name;
              const instances = document.identifierInstances.filter((node) => node.identifierDefinitionId === identifier.id);

              return (
                <details className="identifier-type-group" key={identifier.id} open>
                  <summary
                    className="identifier-palette-item"
                    draggable
                    onDoubleClick={() => openCreation('identifier', identifier.id)}
                    onDragStart={(event) => dragComponent(event, 'identifier', identifier)}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) {
                        return;
                      }

                      beginPaletteDrag({
                        type: 'identifier',
                        identifierDefinitionId: identifier.id
                      });
                    }}
                    title="拖入 Canvas 创建标识，双击编辑类型"
                  >
                    <span style={{ background: identifier.color }} />
                    <strong>{typeName}</strong>
                    <em>{instances.length}</em>
                    {workspaceMode === 'world' && (
                      <button
                        className="icon-button mini"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          updateIdentifierDefinition(identifier.id, { visibleInWorld: !(identifier.visibleInWorld ?? true) });
                        }}
                        title={(identifier.visibleInWorld ?? true) ? '隐藏该类型标识' : '显示该类型标识'}
                        type="button"
                      >
                        {(identifier.visibleInWorld ?? true) ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                    )}
                    <button
                      className="icon-button mini danger"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        deleteIdentifierDefinition(identifier.id);
                      }}
                      title="删除标识类型"
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </summary>
                  <div className="identifier-instance-list">
                    {instances.length === 0 ? (
                      <span className="identifier-instance-empty">暂无实例</span>
                    ) : (
                      instances.map((instance) => (
                        <button className="identifier-instance-item" key={instance.id} onDoubleClick={() => openCreation('identifier', instance.id)} type="button">
                          {typeName}_{instance.name}
                        </button>
                      ))
                    )}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
