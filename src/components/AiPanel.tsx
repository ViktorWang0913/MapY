import { Settings2, Sparkles, Square, WandSparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  configureAi,
  generateMapPlan,
  isDesktopAiRuntime,
  loadAiConfig,
  testAiConnection,
  type AiConfigState
} from '../ai/aiClient';
import {
  AI_SLASH_COMMANDS,
  getSlashCommand,
  searchSlashCommands,
  type AiSlashCommand
} from '../ai/commandRegistry';
import type {
  AiMapPlan,
  AiPlanPreview
} from '../ai/mapCommands';
import type { AiRepair, ClarificationContext, ValidationIssue } from '../ai/aiTypes';
import { useEditorStore } from '../store/editorStore';
import type { MapYDocument } from '../model/types';

type ChatRole = 'user' | 'assistant' | 'error';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface PendingPlan {
  plan: AiMapPlan;
  preview: AiPlanPreview;
  sourceDocument: MapYDocument;
  text: string;
  repairs: AiRepair[];
  issues: ValidationIssue[];
}

const MAP_EXAMPLE = '生成一张城市地图：两个区域，第一个线性推进，第二个是 S 型；加入 1 把钥匙、2 个 Boss，并连接两个区域。';

export function AiPanel() {
  const document = useEditorStore((state) => state.document);
  const previewAiPlan = useEditorStore((state) => state.previewAiPlan);
  const applyAiPlan = useEditorStore((state) => state.applyAiPlan);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<AiConfigState>(() => loadAiConfig());
  const [mapInput, setMapInput] = useState('');
  const [commandSelection, setCommandSelection] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [clarification, setClarification] = useState<ClarificationContext>();
  const [pendingPlan, setPendingPlan] = useState<PendingPlan>();
  const [mapLoading, setMapLoading] = useState(false);
  const [status, setStatus] = useState('');
  const desktopRuntime = useMemo(() => isDesktopAiRuntime(), []);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const requestIdRef = useRef(0);

  const commandSuggestions = useMemo(
    () => mapInput.startsWith('/') && !/\s/.test(mapInput) ? searchSlashCommands(mapInput) : [],
    [mapInput]
  );

  function stopRequest() {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    setMapLoading(false);
    setStatus('已停止当前请求。');
  }

  async function handleMapSend() {
    const message = mapInput.trim();
    if (!message || mapLoading) return;
    const clarificationContext = clarification;
    if (message.startsWith('/')) {
      const command = getSlashCommand(message);
      if (!command) {
        setMessages((current) => [...current, { role: 'error', text: `未知命令：${message.split(/\s/, 1)[0]}。输入 / 查看可用命令。` }]);
        return;
      }
      if (command.name === 'help') {
        setMessages((current) => [
          ...current,
          { role: 'user', text: message },
          {
            role: 'assistant',
            text: AI_SLASH_COMMANDS.filter((item) => item.name !== 'help')
              .map((item) => `/${item.name}  ${item.label}：${item.description}`)
              .join('\n')
          }
        ]);
        setMapInput('');
        return;
      }
    }
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((current) => [...current, { role: 'user', text: message }]);
    setMapInput('');
    setPendingPlan(undefined);
    setMapLoading(true);
    setStatus('');

    try {
      const response = await generateMapPlan(message, document, config.text, controller.signal, clarificationContext);
      if (requestId !== requestIdRef.current) return;
      if (response.status === 'clarification') {
        if (clarificationContext) {
          setClarification(undefined);
          setMessages((current) => [...current, {
            role: 'error',
            text: `仍无法确定需求：${response.question}。请重新完整描述。`
          }]);
        } else {
          setClarification({ originalRequest: message, question: response.question });
          setMessages((current) => [...current, { role: 'assistant', text: response.question }]);
        }
        return;
      }
      if (clarificationContext) setClarification(undefined);
      if (response.status === 'error') {
        const details = response.issues
          .filter((issue) => issue.level === 'error')
          .slice(0, 4)
          .map((issue) => issue.message)
          .join('\n');
        setMessages((current) => [...current, {
          role: 'error',
          text: details ? `${response.error}\n${details}` : response.error
        }]);
        return;
      }
      const preview = previewAiPlan(response.plan);
      setClarification(undefined);
      setPendingPlan({
        plan: response.plan,
        preview,
        sourceDocument: document,
        text: response.text,
        repairs: response.repairs,
        issues: response.issues
      });
      setMessages((current) => [...current, { role: 'assistant', text: response.text }]);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (clarificationContext) setClarification(undefined);
      setMessages((current) => [...current, {
        role: 'error',
        text: error instanceof Error ? error.message : '地图计划生成失败。'
      }]);
    } finally {
      if (requestId === requestIdRef.current) setMapLoading(false);
    }
  }

  function chooseCommand(command: AiSlashCommand) {
    setMapInput(`/${command.name} `);
    setCommandSelection(0);
  }

  function confirmPlan() {
    if (!pendingPlan) return;
    try {
      applyAiPlan(pendingPlan.plan, pendingPlan.sourceDocument);
      setStatus(pendingPlan.plan.intent === 'create_document' ? '已创建新地图标签。' : '地图修改已应用。');
      setPendingPlan(undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '计划应用失败。');
    }
  }

  async function saveConfig() {
    try {
      await configureAi(config);
      setConfig((current) => ({
        text: { ...current.text, apiKey: '' }
      }));
      setStatus('AI 配置已保存；API Key 仅保留在当前桌面进程。');
      setConfigOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI 配置保存失败。');
    }
  }

  async function testConnection() {
    try {
      await configureAi(config);
      await testAiConnection('text');
      setStatus('文本服务连接成功。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '连接测试失败。');
    }
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-toolbar">
        <span className="ai-panel-label"><Sparkles size={14} />地图 AI</span>
        <button className="icon-button mini" onClick={() => setConfigOpen((open) => !open)} title="AI 设置" type="button">
          <Settings2 size={14} />
        </button>
      </div>

      {configOpen && (
        <AiSettings
          config={config}
          desktopRuntime={desktopRuntime}
          onChange={setConfig}
          onSave={() => void saveConfig()}
          onTest={() => void testConnection()}
        />
      )}

      <div className="ai-workspace">
        <div className="ai-message-list" aria-live="polite">
          {messages.length === 0 && <div className="ai-empty">描述需要创建或修改的地图。所有变更会先生成预览。</div>}
          {messages.map((message, index) => (
            <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>
          ))}
          {mapLoading && <div className="ai-loading"><span /><span /><span /> 正在生成计划</div>}
        </div>

        {clarification && (
          <div className="ai-clarification">
            <div>
              <strong>需要补充</strong>
              <span>{clarification.question}</span>
            </div>
            <button className="secondary-button compact" onClick={() => setClarification(undefined)} type="button">
              取消澄清
            </button>
          </div>
        )}

        {pendingPlan && <PlanPreview pending={pendingPlan} onCancel={() => setPendingPlan(undefined)} onConfirm={confirmPlan} />}

        <div className="ai-input-area">
          <div className="ai-command-input">
            {commandSuggestions.length > 0 && (
              <div className="ai-command-menu" role="listbox" aria-label="AI 命令">
                {commandSuggestions.map((command, index) => (
                  <button
                    aria-selected={index === commandSelection}
                    className={index === commandSelection ? 'active' : ''}
                    key={command.name}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      chooseCommand(command);
                    }}
                    role="option"
                    type="button"
                  >
                    <strong>/{command.name}</strong>
                    <span>{command.label}</span>
                    <em>{command.description}</em>
                  </button>
                ))}
              </div>
            )}
            <textarea
            aria-label="地图 AI 指令"
            onChange={(event) => {
              setMapInput(event.target.value);
              setCommandSelection(0);
            }}
            onKeyDown={(event) => {
              if (commandSuggestions.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setCommandSelection((current) => (current + 1) % commandSuggestions.length);
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setCommandSelection((current) => (current - 1 + commandSuggestions.length) % commandSuggestions.length);
                  return;
                }
                if (event.key === 'Tab' || (event.key === 'Enter' && !event.ctrlKey && !event.metaKey)) {
                  event.preventDefault();
                  chooseCommand(commandSuggestions[Math.min(commandSelection, commandSuggestions.length - 1)]);
                  return;
                }
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleMapSend();
              }
            }}
            placeholder={clarification ? '回答上方问题，系统会重新生成计划' : '例如：生成两个区域并用连接点串联'}
            rows={4}
            value={mapInput}
          />
          </div>
          <div className="ai-action-row">
            <button className="secondary-button compact" disabled={mapLoading} onClick={() => setMapInput(MAP_EXAMPLE)} type="button">
              示例
            </button>
            {mapLoading ? (
              <button className="secondary-button compact danger" onClick={stopRequest} type="button">
                <Square size={13} />停止
              </button>
            ) : (
              <button className="primary-button compact" disabled={!mapInput.trim()} onClick={() => void handleMapSend()} type="button">
                <WandSparkles size={14} />生成计划
              </button>
            )}
          </div>
        </div>
      </div>
      {status && <button className="ai-status" onClick={() => setStatus('')} type="button">{status}</button>}
    </div>
  );
}

function PlanPreview({ pending, onCancel, onConfirm }: { pending: PendingPlan; onCancel: () => void; onConfirm: () => void }) {
  const { summary } = pending.preview;
  return (
    <section className="ai-plan-preview" aria-label="AI 变更预览">
      <div className="section-heading">
        <span>{pending.plan.intent === 'create_document' ? '新地图预览' : '修改预览'}</span>
        <em>{summary.created.length + summary.updated.length + summary.deleted.length} 项</em>
      </div>
      {summary.created.length > 0 && <ChangeList label="新增" items={summary.created} />}
      {summary.updated.length > 0 && <ChangeList label="修改" items={summary.updated} />}
      {summary.deleted.length > 0 && <ChangeList danger label="删除" items={summary.deleted} />}
      {pending.repairs.length > 0 && (
        <div className="ai-repair-summary">
          已自动补全 {pending.repairs.length} 项
        </div>
      )}
      <div className="ai-action-row">
        <button className="secondary-button compact" onClick={onCancel} type="button">放弃</button>
        <button className="primary-button compact" onClick={onConfirm} type="button">确认应用</button>
      </div>
    </section>
  );
}

function ChangeList({ label, items, danger = false }: { label: string; items: string[]; danger?: boolean }) {
  return (
    <div className={`ai-change-list${danger ? ' danger' : ''}`}>
      <strong>{label} {items.length}</strong>
      <span>{items.slice(0, 5).join('、')}{items.length > 5 ? ` 等 ${items.length} 项` : ''}</span>
    </div>
  );
}

function AiSettings({
  config,
  desktopRuntime,
  onChange,
  onSave,
  onTest
}: {
  config: AiConfigState;
  desktopRuntime: boolean;
  onChange: (config: AiConfigState) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  const update = (patch: Partial<AiConfigState['text']>) =>
    onChange({ ...config, text: { ...config.text, ...patch } });

  return (
    <div className="ai-settings">
      {!desktopRuntime && (
        <div className="ai-runtime-warning">
          当前为浏览器开发模式。供应商 API Key 不会在浏览器中使用；真实 API 请运行桌面版。
        </div>
      )}
      <div className="section-heading"><span>文本模型服务</span></div>
      <label>模式<select value={config.text.mode} onChange={(event) => update({ mode: event.target.value as 'mock' | 'api' })}><option value="mock">Mock</option><option value="api">API</option></select></label>
      <label>
        Base URL
        <input placeholder="https://api.example.com/v1" value={config.text.baseUrl} onChange={(event) => update({ baseUrl: event.target.value })} />
        <small>填写 OpenAI 兼容 API 根地址，或完整的 /chat/completions 地址。</small>
      </label>
      <label>
        模型
        <input placeholder="供应商提供的模型 ID" value={config.text.model} onChange={(event) => update({ model: event.target.value })} />
      </label>
      <label>
        API Key（仅桌面）
        <input autoComplete="off" placeholder="sk-..." type="password" value={config.text.apiKey} onChange={(event) => update({ apiKey: event.target.value })} />
        <small>从所选模型供应商申请；不会写入文档或本地存储。</small>
      </label>
      <div className="ai-action-row">
        <button className="secondary-button compact" onClick={() => onTest()} type="button">测试文本 API</button>
        <button className="primary-button compact" onClick={onSave} type="button">保存设置</button>
      </div>
    </div>
  );
}
