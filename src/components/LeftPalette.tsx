import { Box, ChevronDown, ChevronRight, Diamond, Eye, EyeOff, GitBranch, Map as MapIcon, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { defaultColors } from '../model/document';
import { type ElementType, type IdentifierDefinition, type MapYNode } from '../model/types';
import { useEditorStore } from '../store/editorStore';
import { beginPaletteDrag } from '../utils/paletteDrag';

interface CreatorItem {
  type: ElementType;
  label: string;
  icon: typeof MapIcon;
}

// "+" creation menu (unchanged): icon + label.
const creatorItems: CreatorItem[] = [
  { type: 'scene', label: '地图', icon: MapIcon },
  { type: 'structure', label: '结构', icon: Box },
  { type: 'connection', label: '连接', icon: GitBranch }
];

// Node-tree row icon — same lucide icon set as the "+" creation menu (Godot-style type icon).
const TYPE_ICON: Record<ElementType, typeof MapIcon> = {
  scene: MapIcon,
  structure: Box,
  connection: GitBranch,
  identifier: Diamond,
  annotation: MessageSquare
};

function TypeGlyph({ type }: { type: ElementType }) {
  const Icon = TYPE_ICON[type];
  return <Icon aria-hidden="true" color={defaultColors[type]} size={16} />;
}

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
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const openCreation = useEditorStore((state) => state.openCreation);
  const openNodeInspector = useEditorStore((state) => state.openNodeInspector);
  const updateIdentifierDefinition = useEditorStore((state) => state.updateIdentifierDefinition);
  const deleteIdentifierDefinition = useEditorStore((state) => state.deleteIdentifierDefinition);

  const [creatorOpen, setCreatorOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Double-click opens the same editor as the canvas does.
  function openEditor(node: MapYNode) {
    if (node.type === 'scene' || node.type === 'structure' || node.type === 'identifier' || node.type === 'connection') {
      openCreation(node.type, node.id);
    } else {
      openNodeInspector(node.id);
    }
  }

  function sceneChildren(sceneId: string): MapYNode[] {
    return [
      ...document.structures.filter((node) => node.parentSceneId === sceneId),
      ...document.doors.filter((node) => node.parentSceneId === sceneId),
      ...document.identifierInstances.filter((node) => node.parentSceneId === sceneId),
      ...document.annotations.filter((node) => node.parentSceneId === sceneId)
    ];
  }

  const sceneIds = new Set(document.scenes.map((scene) => scene.id));
  const orphanNodes = [
    ...document.structures,
    ...document.doors,
    ...document.identifierInstances,
    ...document.annotations
  ].filter((node) => !node.parentSceneId || !sceneIds.has(node.parentSceneId));
  const hasParts = document.scenes.length > 0 || orphanNodes.length > 0;

  function renderRow(node: MapYNode) {
    return (
      <button
        className={`node-row${selectedId === node.id ? ' active' : ''}`}
        key={node.id}
        onClick={() => selectNode(node.id)}
        onDoubleClick={() => openEditor(node)}
        title={node.name}
        type="button"
      >
        <span className="node-row-icon">
          <TypeGlyph type={node.type} />
        </span>
        <span className="node-row-name">{node.name}</span>
      </button>
    );
  }

  return (
    <aside className="left-palette" aria-label="部件栏">
      <div className="panel-title palette-title">
        <div className={`palette-add${creatorOpen ? ' open' : ''}`}>
          <button className="icon-button mini" onClick={() => setCreatorOpen((open) => !open)} title="新建部件" type="button">
            <Plus size={14} />
          </button>
          {creatorOpen && (
            <div className="palette-add-menu">
              {creatorItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className="palette-add-item"
                    draggable
                    key={item.type}
                    onClick={() => {
                      openCreation(item.type);
                      setCreatorOpen(false);
                    }}
                    onDragStart={(event) => dragComponent(event, item.type)}
                    title={`新建${item.label}（可拖入画布）`}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span>部件栏</span>
      </div>
      <div className="palette-main">
        <div className="palette-section-label">部件</div>
        <div className="node-tree">
          {!hasParts ? (
            <div className="empty-inline">暂无部件，点击左上角 + 创建</div>
          ) : (
            <>
              {document.scenes.map((scene) => {
                const children = sceneChildren(scene.id);
                const isCollapsed = collapsed.has(scene.id);

                return (
                  <div className="node-tree-group" key={scene.id}>
                    <div className={`node-row node-row-scene${selectedId === scene.id ? ' active' : ''}`}>
                      <button
                        className="node-caret"
                        onClick={() => toggleCollapsed(scene.id)}
                        title={isCollapsed ? '展开' : '折叠'}
                        type="button"
                      >
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      </button>
                      <button
                        className="node-row-main"
                        onClick={() => selectNode(scene.id)}
                        onDoubleClick={() => openEditor(scene)}
                        title={scene.name}
                        type="button"
                      >
                        <span className="node-row-icon">
                          <TypeGlyph type="scene" />
                        </span>
                        <span className="node-row-name">{scene.name}</span>
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="node-tree-children">
                        {children.length === 0 ? (
                          <span className="identifier-instance-empty">空</span>
                        ) : (
                          children.map((child) => renderRow(child))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {orphanNodes.length > 0 && (
                <div className="node-tree-group">
                  <div className="node-row node-row-scene">
                    <span className="node-caret" />
                    <span className="node-row-main">
                      <span className="node-row-name">未归属</span>
                    </span>
                  </div>
                  <div className="node-tree-children">{orphanNodes.map((node) => renderRow(node))}</div>
                </div>
              )}
            </>
          )}
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
