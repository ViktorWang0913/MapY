import { describe, expect, it } from 'vitest';
import { parseAiPlanResponse } from './aiResponseParser';

describe('parseAiPlanResponse', () => {
  it('parses plain JSON, fenced JSON, and wrapped responses', () => {
    expect(parseAiPlanResponse('{"intent":"create_document","operations":[]}').plan.intent).toBe('create_document');
    expect(parseAiPlanResponse('```json\n{"intent":"patch_document","operations":[]}\n```').plan.intent).toBe('patch_document');
    expect(parseAiPlanResponse({
      plan: { intent: 'ask_clarification', operations: [] },
      text: '需要确认'
    })).toMatchObject({ text: '需要确认', plan: { intent: 'ask_clarification' } });
  });

  it('reports invalid model text clearly', () => {
    expect(() => parseAiPlanResponse('not json')).toThrow('不是有效 JSON');
  });
});
