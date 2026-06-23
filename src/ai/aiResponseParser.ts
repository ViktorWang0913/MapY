import type { AiPlan, ParsedAiPlanResponse } from './aiTypes';

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseAiPlanResponse(input: unknown): ParsedAiPlanResponse {
  let parsed = input;
  if (typeof input === 'string') {
    const cleaned = stripCodeFence(input);
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('AI 返回内容不是有效 JSON。请重试或更换模型。');
    }
  }

  if (!isRecord(parsed)) {
    throw new Error('AI 返回内容不是 JSON 对象。');
  }

  const wrappedPlan = isRecord(parsed.plan) ? parsed.plan : parsed;
  return {
    plan: wrappedPlan as AiPlan,
    text: typeof parsed.text === 'string' ? parsed.text : undefined
  };
}
