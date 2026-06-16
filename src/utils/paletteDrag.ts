import type { ElementType } from '../model/types';

export interface PaletteDragPayload {
  type: ElementType;
  identifierDefinitionId?: string;
}

let activePaletteDrag: PaletteDragPayload | undefined;

export function beginPaletteDrag(payload: PaletteDragPayload) {
  activePaletteDrag = payload;
}

export function getPaletteDrag(): PaletteDragPayload | undefined {
  return activePaletteDrag;
}

export function clearPaletteDrag() {
  activePaletteDrag = undefined;
}
