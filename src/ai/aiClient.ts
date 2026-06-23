import { invoke, isTauri } from '@tauri-apps/api/core';
import type { MapYDocument } from '../model/types';
import {
  documentToAiContext,
  type TextAiConfig
} from './mapCommands';
import { mockGenerateMapPlan } from './mockAi';
import { expandSlashCommand, getSlashCommand } from './commandRegistry';
import { buildMapYPlannerPrompt } from './aiPromptBuilder';
import { processAiPlan, type AiPlanPipelineResult } from './aiPlanPipeline';
import type { ClarificationContext } from './aiTypes';

const CONFIG_KEY = 'mapy:ai-config:v1';

export interface AiConfigState {
  text: TextAiConfig;
}

const defaults: AiConfigState = {
  text: {
    mode: 'mock',
    baseUrl: '',
    model: '',
    apiKey: '',
    timeoutMs: 60000
  }
};

export function isDesktopAiRuntime(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

export function loadAiConfig(): AiConfigState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CONFIG_KEY) || '{}') as Partial<AiConfigState>;
    return {
      text: { ...defaults.text, ...stored.text, apiKey: '' }
    };
  } catch {
    return structuredClone(defaults);
  }
}

export function saveAiConfig(config: AiConfigState): void {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({
    text: { ...config.text, apiKey: '' }
  }));
}

export async function configureAi(config: AiConfigState): Promise<void> {
  saveAiConfig(config);
  if (!isDesktopAiRuntime()) return;
  await invoke('configure_text_ai', { config: config.text });
}

export async function generateMapPlan(
  message: string,
  document: MapYDocument,
  config: TextAiConfig,
  signal?: AbortSignal,
  clarification?: ClarificationContext
): Promise<AiPlanPipelineResult> {
  const expanded = expandSlashCommand(message);
  const command = clarification ? getSlashCommand(clarification.originalRequest) : expanded.command;
  const naturalRequest = clarification
    ? message
    : command
      ? message.trim().replace(/^\/[^\s]+\s*/, '').trim()
      : message;
  const context = documentToAiContext(document);
  const systemPrompt = buildMapYPlannerPrompt(naturalRequest, command, clarification);
  if (config.mode === 'mock') {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    return processAiPlan(
      {
        plan: mockGenerateMapPlan(expanded.message, document),
        text: '已生成可预览的地图修改计划。'
      },
      document,
      command
    );
  }

  const request = {
    message: naturalRequest,
    documentContext: context,
    systemPrompt
  };
  if (isDesktopAiRuntime()) {
    const rawContent = await invoke<string>('generate_ai_map_plan', { request });
    return processAiPlan(rawContent, document, command);
  }
  throw new Error('浏览器开发模式没有配置 AI 后端代理。请使用 npm run tauri:dev 运行桌面版，或部署同源 /api/ai-map-command 代理。');
}

export async function testAiConnection(kind: 'text'): Promise<void> {
  if (!isDesktopAiRuntime()) {
    throw new Error('浏览器模式不会直接使用 API Key。请通过 npm run tauri:dev 测试桌面 API，或部署 /api/ai-map-command 代理。');
  }
  await invoke('test_text_ai');
}
