// ── AI Map Command system: client (THE SWAP POINT) ──────────────────────────
// Everything AI-related goes through generateMapCommand(). Today it calls the
// local mock. To use a real LLM, replace the body with a backend call (see below)
// — no other file needs to change.

import type { MapState, MapYCommand } from './mapCommands';
import { mockGenerateMapCommand } from './mockAi';

export interface AiMapResponse {
  command: MapYCommand;
  text: string;
}

/**
 * System prompt for a future real LLM call. Kept here so the backend can import
 * or copy it verbatim. NEVER call an LLM directly from the frontend with an API
 * key — the key must live in a backend environment variable only.
 */
export const MAP_SYSTEM_PROMPT = `You are MapY's AI map command generator.
Your task is to convert user natural language instructions into valid MapYCommand JSON.
You must only output valid JSON.
Do not output markdown.
Do not output explanations outside JSON.
The map is a structured 2D editor state, not an image.
You must use only the allowed command types:
CREATE_MAP, ADD_ZONE, ADD_OBJECT, UPDATE_OBJECT, DELETE_OBJECT.

Map design rules:
- Keep all coordinates inside the canvas.
- Use simple rectangular zones.
- For 'linear' topology, arrange objects along a left-to-right or top-to-bottom progression.
- For 's_like' topology, arrange objects in a curved/S-like progression using alternating x/y positions.
- Place keys before bosses when possible.
- Bosses should be placed in later or more difficult areas.
- Do not invent unsupported object types.
- Do not invent unsupported command types.

Return JSON in this format:
{
  "command": { "type": "...", "payload": { ... } },
  "text": "short explanation"
}`;

/** Small artificial delay so the loading state is visible with the mock. */
const MOCK_LATENCY_MS = 350;

export async function generateMapCommand(message: string, currentMap: MapState): Promise<AiMapResponse> {
  // ──────────────────────────────────────────────────────────────────────────
  // MOCK IMPLEMENTATION. To use a real LLM, replace everything below with:
  //
  //   const res = await fetch('/api/ai-map-command', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ message, currentMap })
  //   });
  //   if (!res.ok) throw new Error('AI 请求失败');
  //   return (await res.json()) as AiMapResponse; // { command, text }
  //
  // The backend (Tauri command or Node route) holds the API key, sends
  // MAP_SYSTEM_PROMPT + message + currentMap to the provider, and returns
  // { command, text }. The frontend still validates before applying.
  // ──────────────────────────────────────────────────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  const command = mockGenerateMapCommand(message, currentMap);
  return { command, text: describeCommand(command) };
}

/** Short human-readable explanation shown in the chat panel. */
function describeCommand(command: MapYCommand): string {
  switch (command.type) {
    case 'CREATE_MAP':
      return `已生成新地图：${command.payload.zones.length} 个区域、${command.payload.objects.length} 个对象。`;
    case 'ADD_ZONE':
      return `已添加区域：${command.payload.name}。`;
    case 'ADD_OBJECT':
      return `已添加对象：${command.payload.type}。`;
    case 'UPDATE_OBJECT':
      return `已更新对象 ${command.payload.id}。`;
    case 'DELETE_OBJECT':
      return `已删除对象 ${command.payload.id}。`;
    default:
      return '已处理指令。';
  }
}
