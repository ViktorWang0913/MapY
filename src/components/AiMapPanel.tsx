// ── AI Map Command system: chat panel UI ────────────────────────────────────
// A docked chat window (bottom-right) that draws onto the MAIN MapY canvas.
// Pipeline: natural language → AI command → validate → apply to MapState →
// convert to MapYDocument → push into the editor store → main Konva canvas redraws.
//
// To remove the whole feature: delete src/ai/* and this file, and drop
// <AiMapPanel /> from App.tsx. Styling is inline so no shared CSS is touched.

import { useState } from 'react';
import { generateMapCommand } from '../ai/aiClient';
import { executeMapYCommand } from '../ai/executeCommand';
import { createEmptyMap, type MapState } from '../ai/mapCommands';
import { mapStateToDocument } from '../ai/mapStateToDocument';
import { validateCommand } from '../ai/validateCommand';
import { useEditorStore } from '../store/editorStore';

interface ChatMessage {
  role: 'user' | 'ai' | 'error';
  text: string;
}

const EXAMPLE = 'Generate a city map with 2 zones. The first zone is linear. The second zone is S-like. Add 1 key and 2 bosses.';

export function AiMapPanel() {
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState<MapState>(() => createEmptyMap());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // The bridge to the real canvas: importDocument replaces the editor document,
  // and the existing Konva CanvasWorkspace redraws from it.
  const importDocument = useEditorStore((state) => state.importDocument);

  async function handleSend() {
    const message = input.trim();
    if (!message || loading) {
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setInput('');
    setLoading(true);

    try {
      // 1) Ask the AI (mock for now) for a structured command.
      const { command, text } = await generateMapCommand(message, map);

      // 2) Validate BEFORE touching anything.
      const result = validateCommand(command, map);
      if (!result.ok) {
        setMessages((prev) => [...prev, { role: 'error', text: `命令无效：${result.error}` }]);
        return;
      }

      // 3) Apply to our MapState (immutable), then draw onto the MAIN canvas.
      const nextMap = executeMapYCommand(command, map);
      setMap(nextMap);
      importDocument(mapStateToDocument(nextMap)); // ← AI commands drive the real canvas

      setMessages((prev) => [...prev, { role: 'ai', text }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: error instanceof Error ? error.message : '生成失败，请重试。' }
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={styles.fab} title="AI 地图生成">
        ✨ AI 地图
      </button>
    );
  }

  return (
    <div style={styles.window} role="dialog" aria-label="AI 地图生成">
      <header style={styles.header}>
        <strong>AI 地图生成（测试版）</strong>
        <button type="button" onClick={() => setOpen(false)} style={styles.closeBtn} title="收起">
          ✕
        </button>
      </header>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <p style={styles.hint}>
            生成结果会直接画到主画布。试试：
            <br />“{EXAMPLE}”
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} style={{ ...styles.bubble, ...bubbleStyle(message.role) }}>
            {message.text}
          </div>
        ))}
        {loading && <div style={{ ...styles.bubble, ...styles.aiBubble }}>生成中…</div>}
      </div>

      <div style={styles.inputRow}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="用自然语言描述地图，Ctrl/⌘+Enter 发送"
          rows={2}
          style={styles.textarea}
        />
        <div style={styles.actions}>
          <button type="button" onClick={() => setInput(EXAMPLE)} style={styles.secondaryBtn} disabled={loading}>
            填入示例
          </button>
          <button type="button" onClick={() => void handleSend()} style={styles.primaryBtn} disabled={loading || !input.trim()}>
            {loading ? '生成中…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

function bubbleStyle(role: ChatMessage['role']) {
  if (role === 'user') return styles.userBubble;
  if (role === 'error') return styles.errorBubble;
  return styles.aiBubble;
}

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    right: 18,
    bottom: 18,
    zIndex: 1000,
    padding: '10px 16px',
    border: '1px solid #2f4562',
    borderRadius: 999,
    background: '#172235',
    color: '#dce7f6',
    fontSize: 14,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
  },
  window: {
    position: 'fixed',
    right: 18,
    bottom: 18,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    width: 380,
    height: 'min(520px, 80vh)',
    border: '1px solid #2f4562',
    borderRadius: 12,
    background: '#101928',
    color: '#dce7f6',
    boxShadow: '0 18px 48px rgba(0,0,0,0.5)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #26364b'
  },
  closeBtn: { border: 0, background: 'transparent', color: '#9fb2c7', fontSize: 16 },
  messages: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  hint: { color: '#7f96b1', fontSize: 13, lineHeight: 1.6 },
  bubble: { padding: '8px 10px', borderRadius: 8, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxWidth: '100%' },
  userBubble: { alignSelf: 'flex-end', background: '#1d3552', color: '#eaf3ff' },
  aiBubble: { alignSelf: 'flex-start', background: '#17251b', color: '#bdf0ae', border: '1px solid #335039' },
  errorBubble: { alignSelf: 'flex-start', background: '#2d2415', color: '#ffd489', border: '1px solid #6f5731' },
  inputRow: { borderTop: '1px solid #26364b', padding: 10, display: 'grid', gap: 8 },
  textarea: {
    width: '100%',
    resize: 'none',
    border: '1px solid #2f4562',
    borderRadius: 8,
    background: '#0d1726',
    color: '#dce8f8',
    padding: 8,
    fontSize: 13
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  primaryBtn: {
    minWidth: 84,
    padding: '8px 14px',
    border: '1px solid #2f6f4a',
    borderRadius: 8,
    background: '#1d4d33',
    color: '#d7ffe6'
  },
  secondaryBtn: {
    padding: '8px 12px',
    border: '1px solid #2f4562',
    borderRadius: 8,
    background: '#16253a',
    color: '#bcd0e8'
  }
};
