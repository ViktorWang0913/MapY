import { invoke, isTauri } from '@tauri-apps/api/core';
import type { MapYDocument } from '../model/types';
import {
  documentToAiContext,
  type GenerateImageRequest,
  type GenerateImageResponse,
  type ImageAiConfig,
  type TextAiConfig
} from './mapCommands';
import { mockGenerateImage, mockGenerateMapPlan } from './mockAi';
import { expandSlashCommand, getSlashCommand } from './commandRegistry';
import { buildMapYPlannerPrompt } from './aiPromptBuilder';
import { processAiPlan, type AiPlanPipelineResult } from './aiPlanPipeline';
import type { ClarificationContext } from './aiTypes';

const CONFIG_KEY = 'mapy:ai-config:v1';

export interface AiConfigState {
  text: TextAiConfig;
  image: ImageAiConfig;
}

const defaults: AiConfigState = {
  text: {
    mode: 'mock',
    baseUrl: '',
    model: '',
    apiKey: '',
    timeoutMs: 60000
  },
  image: {
    mode: 'mock',
    baseUrl: 'https://api.openai.com/v1',
    endpoint: '/images/generations',
    model: 'gpt-image-1',
    apiKey: '',
    timeoutMs: 120000
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
      text: { ...defaults.text, ...stored.text, apiKey: '' },
      image: { ...defaults.image, ...stored.image, apiKey: '' }
    };
  } catch {
    return structuredClone(defaults);
  }
}

export function saveAiConfig(config: AiConfigState): void {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({
    text: { ...config.text, apiKey: '' },
    image: { ...config.image, apiKey: '' }
  }));
}

export async function configureAi(config: AiConfigState): Promise<void> {
  saveAiConfig(config);
  if (!isDesktopAiRuntime()) return;
  await Promise.all([
    invoke('configure_text_ai', { config: config.text }),
    invoke('configure_image_ai', { config: config.image })
  ]);
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
  const systemPrompt = buildMapYPlannerPrompt(
    naturalRequest,
    JSON.stringify(context),
    command,
    clarification
  );
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

export async function generateImage(
  request: GenerateImageRequest,
  config: ImageAiConfig,
  signal?: AbortSignal
): Promise<GenerateImageResponse> {
  if (config.mode === 'mock') {
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    return mockGenerateImage(request);
  }

  if (isDesktopAiRuntime()) return invoke<GenerateImageResponse>('generate_ai_image', { request });
  throw new Error('浏览器开发模式没有配置图片后端代理。请使用 npm run tauri:dev，或部署同源 /api/ai-image 代理。');
}

export async function testAiConnection(kind: 'text' | 'image'): Promise<void> {
  if (!isDesktopAiRuntime()) {
    const endpoint = kind === 'text' ? '/api/ai-map-command' : '/api/ai-image';
    throw new Error(`浏览器模式不会直接使用 API Key。请通过 npm run tauri:dev 测试桌面 API，或部署 ${endpoint} 代理。`);
  }
  await invoke(kind === 'text' ? 'test_text_ai' : 'test_image_ai');
}
