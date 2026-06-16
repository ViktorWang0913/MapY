import {
  Clipboard,
  Copy,
  Download,
  FilePlus,
  FileX2,
  FolderOpen,
  HelpCircle,
  Mail,
  Map as MapIcon,
  MessageSquare,
  PenTool,
  Redo2,
  Save,
  Search,
  Scissors,
  Trash2,
  Undo2,
  Workflow
} from 'lucide-react';
import type { ChangeEvent, ComponentType, FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { getAllNodes, nodeMatchesSearch, normalizeDocument, typeLabels } from '../model/document';
import { getAnchorWorldPoint, getObjectAbsoluteTransform } from '../model/geometry';
import type { MapYDocument } from '../model/types';
import { openJsonFile, saveJsonFile } from '../platformFiles';
import { useEditorStore } from '../store/editorStore';
import mapyLogo from '../assets/mapy-logo.png';

function requestImageExport(filename: string, width: number, height: number, mimeType: 'image/png' | 'image/jpeg') {
  window.dispatchEvent(
    new CustomEvent('mapy:export-image', {
      detail: {
        filename,
        width,
        height,
        mimeType
      }
    })
  );
}

interface MenuItemProps {
  children: string;
  icon: ComponentType<{ size?: number }>;
  onClick: () => void;
}

function MenuItem({ children, icon: Icon, onClick }: MenuItemProps) {
  return (
    <button className="menu-item" onClick={onClick} type="button">
      <Icon size={16} />
      <span>{children}</span>
    </button>
  );
}

const exportPresets = [
  { label: '网页预览', width: 1280, height: 720 },
  { label: '标准高清', width: 1920, height: 1080 },
  { label: '2K 画布', width: 2560, height: 1440 },
  { label: '4K 画布', width: 3840, height: 2160 }
];

type ExportMimeType = 'image/png' | 'image/jpeg';

interface WorldVisibility {
  structures: boolean;
  identifiers: boolean;
  connections: boolean;
}

function ExportPreview({ document, visibility }: { document: MapYDocument; visibility: WorldVisibility }) {
  const preview = useMemo(() => {
    const nodes = [
      ...document.scenes,
      ...(visibility.structures ? document.structures : []),
      ...(visibility.identifiers ? document.identifierInstances : []),
      ...(visibility.connections ? document.doors : [])
    ];
    if (nodes.length === 0) {
      return { minX: -160, minY: -90, width: 320, height: 180 };
    }

    const transforms = nodes.map((node) => getObjectAbsoluteTransform(document, node));
    const minX = Math.min(...transforms.map((transform) => transform.x)) - 96;
    const minY = Math.min(...transforms.map((transform) => transform.y)) - 96;
    const maxX = Math.max(...transforms.map((transform) => transform.x + transform.width)) + 96;
    const maxY = Math.max(...transforms.map((transform) => transform.y + transform.height)) + 96;

    return {
      minX,
      minY,
      width: Math.max(320, maxX - minX),
      height: Math.max(180, maxY - minY)
    };
  }, [document, visibility]);

  return (
    <svg className="export-preview-map" viewBox={`${preview.minX} ${preview.minY} ${preview.width} ${preview.height}`}>
      <rect fill="#09111e" height={preview.height} width={preview.width} x={preview.minX} y={preview.minY} />
      {visibility.connections && document.stitching.edges.map((edge) => {
        const fromAnchor = document.stitching.anchors.find((anchor) => anchor.id === edge.fromAnchorId);
        const toAnchor = document.stitching.anchors.find((anchor) => anchor.id === edge.toAnchorId);
        const fromPoint = fromAnchor ? getAnchorWorldPoint(document, fromAnchor) : undefined;
        const toPoint = toAnchor ? getAnchorWorldPoint(document, toAnchor) : undefined;

        if (!fromPoint || !toPoint) {
          return null;
        }

        return (
          <line
            key={edge.id}
            stroke="#72d6ff"
            strokeDasharray="18 12"
            strokeOpacity={0.7}
            strokeWidth={4}
            x1={fromPoint.x}
            x2={toPoint.x}
            y1={fromPoint.y}
            y2={toPoint.y}
          />
        );
      })}
      {document.scenes.map((scene) => {
        const region = document.regions.find((item) => item.id === scene.regionId);
        return (
          <rect
            fill={region?.color || scene.color}
            fillOpacity={scene.opacity ?? 0.24}
            height={scene.transform.height}
            key={scene.id}
            stroke={region?.color || scene.color}
            strokeWidth={4}
            width={scene.transform.width}
            x={scene.transform.x}
            y={scene.transform.y}
          />
        );
      })}
      {visibility.structures && document.structures.map((structure) => {
        const transform = getObjectAbsoluteTransform(document, structure);
        return structure.tiles && structure.tiles.length > 0 ? (
          <g key={structure.id}>
            {structure.tiles.map((tile) => (
              <rect
                fill={structure.color}
                fillOpacity={structure.opacity ?? 0.34}
                height={document.settings.gridSize}
                key={`${structure.id}-${tile.x}-${tile.y}`}
                stroke={structure.color}
                strokeWidth={1.5}
                width={document.settings.gridSize}
                x={transform.x + tile.x * document.settings.gridSize}
                y={transform.y + tile.y * document.settings.gridSize}
              />
            ))}
          </g>
        ) : (
          <rect
            fill={structure.color}
            fillOpacity={structure.opacity ?? 0.34}
            height={transform.height}
            key={structure.id}
            stroke={structure.color}
            strokeWidth={2}
            width={transform.width}
            x={transform.x}
            y={transform.y}
          />
        );
      })}
      {[...(visibility.identifiers ? document.identifierInstances : []), ...(visibility.connections ? document.doors : [])].map((node) => {
        const transform = getObjectAbsoluteTransform(document, node);
        return (
          <circle
            cx={transform.x + transform.width / 2}
            cy={transform.y + transform.height / 2}
            fill={node.color}
            key={node.id}
            r={Math.max(10, Math.min(transform.width, transform.height) / 2)}
            stroke="#f4f8ff"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

function ExportDialog({
  document,
  documentName,
  onClose,
  onExport,
  open,
  visibility
}: {
  document: MapYDocument;
  documentName: string;
  onClose: () => void;
  onExport: (width: number, height: number, mimeType: ExportMimeType) => void;
  open: boolean;
  visibility: WorldVisibility;
}) {
  const [format, setFormat] = useState<ExportMimeType>('image/png');
  const [presetIndex, setPresetIndex] = useState(1);
  const preset = exportPresets[presetIndex];

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="export-dialog" aria-label="导出地图">
        <div className="dialog-header">
          <div>
            <div className="dialog-kicker">导出</div>
            <h2>{documentName || 'MapY'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭" type="button">
            X
          </button>
        </div>
        <div className="export-dialog-body">
          <div className="export-preview-panel">
            <div className="export-preview-title">整体预览</div>
            <ExportPreview document={document} visibility={visibility} />
          </div>
          <div className="export-options-panel">
            <div className="export-option-group">
              <span>导出格式</span>
              <div className="export-format-grid">
                <button className={format === 'image/png' ? 'active' : ''} onClick={() => setFormat('image/png')} type="button">
                  PNG
                  <small>透明度友好，适合继续处理</small>
                </button>
                <button className={format === 'image/jpeg' ? 'active' : ''} onClick={() => setFormat('image/jpeg')} type="button">
                  JPG
                  <small>体积更小，适合预览分享</small>
                </button>
              </div>
            </div>
            <div className="export-option-group">
              <span>图片尺寸</span>
              <div className="export-preset-list">
                {exportPresets.map((item, index) => (
                  <button className={index === presetIndex ? 'active' : ''} key={item.label} onClick={() => setPresetIndex(index)} type="button">
                    <strong>{item.label}</strong>
                    <em>
                      {item.width} x {item.height}
                    </em>
                  </button>
                ))}
              </div>
            </div>
            <div className="export-summary">
              <span>输出</span>
              <strong>
                {format === 'image/png' ? 'PNG' : 'JPG'} · {preset.width} x {preset.height}
              </strong>
            </div>
          </div>
        </div>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            取消
          </button>
          <button className="primary-button" onClick={() => onExport(preset.width, preset.height, format)} type="button">
            导出
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoDialog({ kind, onClose }: { kind?: 'contact' | 'help'; onClose: () => void }) {
  const [feedbackType, setFeedbackType] = useState('使用问题');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');

  if (!kind) {
    return null;
  }

  const isContact = kind === 'contact';

  function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = [
      `反馈类型：${feedbackType}`,
      `联系方式：${contact || '未填写'}`,
      '',
      '反馈内容：',
      message || '请在这里补充你遇到的问题或建议。'
    ].join('\n');
    window.location.href = `mailto:mapy_zstudio@163.com?subject=${encodeURIComponent(`MapY ${feedbackType}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="creation-dialog info-dialog" aria-label={isContact ? '联系我们' : '帮助文档'}>
        <header className="dialog-header">
          <div>
            <span className="dialog-kicker">{isContact ? '反馈' : '帮助'}</span>
            <h2>{isContact ? '联系我们' : 'MapY 帮助文档'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭" type="button">
            X
          </button>
        </header>
        {isContact ? (
          <form className="feedback-form" onSubmit={sendFeedback}>
            <p>反馈会通过你的本地邮件客户端发送到 mapy_zstudio@163.com。请尽量写清操作步骤、期望结果和实际结果。</p>
            <label>
              反馈类型
              <select onChange={(event) => setFeedbackType(event.target.value)} value={feedbackType}>
                <option>使用问题</option>
                <option>功能建议</option>
                <option>导出/文件问题</option>
                <option>性能问题</option>
                <option>其他</option>
              </select>
            </label>
            <label>
              联系方式
              <input onChange={(event) => setContact(event.target.value)} placeholder="可选：邮箱、QQ 或其他联系方式" value={contact} />
            </label>
            <label>
              反馈内容
              <textarea
                onChange={(event) => setMessage(event.target.value)}
                placeholder="请描述你正在做什么、哪里不符合预期，以及是否可以稳定复现。"
                rows={7}
                value={message}
              />
            </label>
            <div className="dialog-actions inline-actions">
              <a className="secondary-button compact help-link" href="mailto:mapy_zstudio@163.com?subject=MapY%20Feedback">
                直接写邮件
              </a>
              <button className="primary-button" type="submit">
                发送反馈
              </button>
            </div>
          </form>
        ) : (
          <div className="help-content help-docs">
            <section>
              <h3>设计逻辑</h3>
              <p>MapY 按“单个场景到场景内部结构到标识点位到世界连接”的顺序组织地图。先把每个场景做清楚，再切到世界模式排列和连接场景。</p>
            </section>
            <section>
              <h3>菜单栏</h3>
              <p>文件菜单负责新建、打开、保存和删除当前标签页。编辑菜单提供撤销、重做、复制、剪切、粘贴、删除和注释。导出菜单用于预览完整地图并输出图片。</p>
            </section>
            <section>
              <h3>部件栏</h3>
              <p>部件栏提供地图、结构和连接。地图是场景范围；结构必须放在地图内，并在结构模式中用 Pixel 绘制；连接用于在世界模式中串联场景。</p>
            </section>
            <section>
              <h3>标识栏</h3>
              <p>标识栏先创建类型，例如 Boss、Save、Item。把类型拖入 Canvas 后才会生成具体实例。一个类型可以有多个实例，列表中会显示为“类型_实例名”。</p>
            </section>
            <section>
              <h3>属性栏</h3>
              <p>属性栏显示当前选中对象。地图可以选择区域；结构可以绑定美术资产；标识实例可以改名称和类型；连接可以调整方向、偏移和目标连接。</p>
            </section>
            <section>
              <h3>模式切换</h3>
              <p>编辑模式用于调整地图、结构、标识和连接的位置。结构模式用于绘制或擦除结构 Pixel。世界模式用于查看区域、连接线和整张地图的布局。</p>
            </section>
            <section>
              <h3>联系我们</h3>
              <p>如果遇到文件、绘制、导出或打包问题，可以在帮助菜单的“联系我们”里填写反馈。反馈邮件会发送到 mapy_zstudio@163.com。</p>
            </section>
            <button className="secondary-button compact" onClick={() => window.print()} type="button">
              下载/打印 PDF
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export function TopMenu() {
  const [exportOpen, setExportOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState<'contact' | 'help'>();
  const document = useEditorStore((state) => state.document);
  const documentName = document.name;
  const newDocument = useEditorStore((state) => state.newDocument);
  const closeDocumentTab = useEditorStore((state) => state.closeDocumentTab);
  const importDocument = useEditorStore((state) => state.importDocument);
  const exportDocument = useEditorStore((state) => state.exportDocument);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const copySelected = useEditorStore((state) => state.copySelected);
  const cutSelected = useEditorStore((state) => state.cutSelected);
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const addAnnotation = useEditorStore((state) => state.addAnnotation);
  const workspaceMode = useEditorStore((state) => state.workspaceMode);
  const setWorkspaceMode = useEditorStore((state) => state.setWorkspaceMode);
  const worldVisibility = useEditorStore((state) => state.worldVisibility);
  const searchQuery = useEditorStore((state) => state.searchQuery);
  const setSearchQuery = useEditorStore((state) => state.setSearchQuery);
  const focusNode = useEditorStore((state) => state.focusNode);
  const notice = useEditorStore((state) => state.notice);
  const clearNotice = useEditorStore((state) => state.clearNotice);
  const searchResults = searchQuery.trim()
    ? getAllNodes(document)
        .filter((node) => nodeMatchesSearch(document, node, searchQuery))
        .slice(0, 8)
    : [];

  async function handleOpen() {
    try {
      const value = await openJsonFile();
      if (value !== undefined) {
        importDocument(value);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '打开文件失败。');
    }
  }

  async function handleSave(filename = `${documentName || 'MapY'}.mapy.json`) {
    try {
      await saveJsonFile(exportDocument(), filename);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '保存文件失败。');
    }
  }

  function handleSaveAs() {
    const filename = window.prompt('请输入文件名', `${documentName || 'MapY'}.mapy.json`);
    if (filename) {
      void handleSave(filename.endsWith('.json') ? filename : `${filename}.json`);
    }
  }

  function handleImageExport(width: number, height: number, mimeType: 'image/png' | 'image/jpeg') {
    const extension = mimeType === 'image/png' ? 'png' : 'jpg';
    const safeName = (documentName || 'MapY').replace(/[\\/:*?"<>|]/g, '-');
    requestImageExport(`${safeName}-${width}x${height}.${extension}`, width, height, mimeType);
    setExportOpen(false);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      importDocument(normalizeDocument(JSON.parse(text)));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '打开文件失败。');
    }
  }

  return (
    <header className="top-menu">
      <div className="brand-block">
        <img alt="MapY" className="brand-logo" src={mapyLogo} />
        <span className="brand-name">MapY</span>
      </div>
      <nav className="menu-bar" aria-label="顶部菜单栏">
        <div className="menu-group">
          <button className="menu-trigger" type="button">
            文件
          </button>
          <div className="menu-dropdown">
            <MenuItem icon={FilePlus} onClick={() => newDocument()}>
              新建文件
            </MenuItem>
            <MenuItem icon={FolderOpen} onClick={() => void handleOpen()}>
              打开文件
            </MenuItem>
            <MenuItem icon={Save} onClick={() => void handleSave()}>
              保存文件
            </MenuItem>
            <MenuItem icon={Download} onClick={handleSaveAs}>
              另存为文件
            </MenuItem>
            <MenuItem icon={FileX2} onClick={() => closeDocumentTab()}>
              删除文件
            </MenuItem>
          </div>
        </div>
        <div className="menu-group">
          <button className="menu-trigger" type="button">
            编辑
          </button>
          <div className="menu-dropdown">
            <MenuItem icon={Undo2} onClick={undo}>
              撤销
            </MenuItem>
            <MenuItem icon={Redo2} onClick={redo}>
              重做
            </MenuItem>
            <MenuItem icon={Copy} onClick={copySelected}>
              复制
            </MenuItem>
            <MenuItem icon={Scissors} onClick={cutSelected}>
              剪切
            </MenuItem>
            <MenuItem icon={Clipboard} onClick={pasteClipboard}>
              粘贴
            </MenuItem>
            <MenuItem icon={Trash2} onClick={deleteSelected}>
              删除
            </MenuItem>
            <MenuItem icon={MessageSquare} onClick={addAnnotation}>
              注释
            </MenuItem>
          </div>
        </div>
        <div className="menu-group">
          <button className="menu-trigger" onClick={() => setExportOpen(true)} type="button">
            导出
          </button>
        </div>
        <div className="menu-group">
          <button className="menu-trigger" type="button">
            帮助
          </button>
          <div className="menu-dropdown">
            <MenuItem icon={Mail} onClick={() => setInfoDialog('contact')}>
              联系我们
            </MenuItem>
            <MenuItem icon={HelpCircle} onClick={() => setInfoDialog('help')}>
              帮助文档
            </MenuItem>
          </div>
        </div>
        <div className="view-segment" aria-label="视图模式">
          <button
            className={workspaceMode === 'edit' ? 'active' : ''}
            onClick={() => setWorkspaceMode('edit')}
            title="编辑模式"
            type="button"
          >
            <MapIcon size={16} />
            <span>编辑模式</span>
          </button>
          <button
            className={workspaceMode === 'world' ? 'active' : ''}
            onClick={() => setWorkspaceMode('world')}
            title="世界模式"
            type="button"
          >
            <Workflow size={16} />
            <span>世界模式</span>
          </button>
          <button
            className={workspaceMode === 'structure' ? 'active' : ''}
            onClick={() => setWorkspaceMode('structure')}
            title="结构模式"
            type="button"
          >
            <PenTool size={16} />
            <span>结构模式</span>
          </button>
        </div>
      </nav>
      <div className="top-status">
        <div className="top-search">
          <Search size={15} />
          <input
            aria-label="搜索地图对象"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索地图、标识、区域"
            value={searchQuery}
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((node) => (
                <button key={node.id} onClick={() => focusNode(node.id)} type="button">
                  <span>{typeLabels[node.type]}</span>
                  <strong>{node.name}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        {notice ? (
          <button className="notice-pill" onClick={clearNotice} type="button">
            {notice}
          </button>
        ) : (
          <span>{documentName}</span>
        )}
      </div>
      <input accept=".json,.mapy.json,application/json" hidden onChange={handleFileChange} type="file" />
      <ExportDialog
        document={document}
        documentName={documentName}
        onClose={() => setExportOpen(false)}
        onExport={handleImageExport}
        open={exportOpen}
        visibility={worldVisibility}
      />
      <InfoDialog kind={infoDialog} onClose={() => setInfoDialog(undefined)} />
    </header>
  );
}
