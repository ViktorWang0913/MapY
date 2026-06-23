import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../model/document';
import { validateMapPlan } from './validateCommand';

describe('validateMapPlan', () => {
  it('accepts a valid plan', () => {
    expect(validateMapPlan({
      intent: 'create_document',
      operations: [{
        op: 'create_scene',
        tempId: 'scene',
        name: '地图',
        transform: { x: 0, y: 0, width: 320, height: 200, rotation: 0 }
      }]
    }, createEmptyDocument())).toEqual({ ok: true });
  });

  it('rejects unknown operations, duplicate temp ids, and invalid dimensions', () => {
    expect(validateMapPlan({ intent: 'patch_document', operations: [{ op: 'unknown' }] }, createEmptyDocument()).ok).toBe(false);
    expect(validateMapPlan({
      intent: 'create_document',
      operations: [
        { op: 'create_scene', tempId: 'same', name: 'A', transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0 } },
        { op: 'create_scene', tempId: 'same', name: 'B', transform: { x: 20, y: 0, width: 10, height: 10, rotation: 0 } }
      ]
    }, createEmptyDocument()).ok).toBe(false);
    expect(validateMapPlan({
      intent: 'create_document',
      operations: [{
        op: 'create_scene',
        tempId: 'scene',
        name: '地图',
        transform: { x: 0, y: 0, width: -1, height: 10, rotation: 0 }
      }]
    }, createEmptyDocument()).ok).toBe(false);
  });

  it('keeps the internal execution contract strict', () => {
    expect(validateMapPlan({
      mode: 'new',
      commands: [{ type: 'Scene' }]
    }, createEmptyDocument()).ok).toBe(false);
  });
});
