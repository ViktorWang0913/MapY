import type { MapYDocument } from '../model/types';
import type { AiMapPlan, GenerateImageRequest, GenerateImageResponse } from './mapCommands';

const colorByPrompt = (prompt: string) => {
  let hash = 0;
  for (const char of prompt) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 58% 52%)`;
};

export function mockGenerateMapPlan(message: string, document: MapYDocument): AiMapPlan {
  const text = message.toLowerCase();
  const key = document.identifierInstances.find((node) => {
    const definition = document.identifiers.find((item) => item.id === node.identifierDefinitionId);
    return `${node.name} ${definition?.name || ''} ${definition?.kind || ''}`.toLowerCase().includes('key') ||
      `${node.name} ${definition?.name || ''}`.includes('钥匙');
  });
  const secondScene = document.scenes[1];

  if (key && secondScene && (text.includes('move') || text.includes('移动')) && (text.includes('key') || text.includes('钥匙'))) {
    return {
      intent: 'patch_document',
      operations: [{
        op: 'update_entity',
        id: key.id,
        patch: {
          parentSceneId: secondScene.id,
          parentStructureId: undefined,
          transform: { x: secondScene.transform.width / 2, y: secondScene.transform.height / 2 }
        }
      }]
    };
  }

  return {
    intent: 'create_document',
    documentName: 'AI 城市地图',
    operations: [
      {
        op: 'create_scene',
        tempId: 'scene-linear',
        name: '线性城区',
        transform: { x: 80, y: 100, width: 448, height: 496, rotation: 0 },
        color: '#2d7dd2',
        opacity: 0.24
      },
      {
        op: 'create_scene',
        tempId: 'scene-s',
        name: 'S 型城区',
        transform: { x: 620, y: 100, width: 500, height: 496, rotation: 0 },
        color: '#63c7b2',
        opacity: 0.24
      },
      {
        op: 'create_structure',
        tempId: 'linear-route',
        sceneRef: 'scene-linear',
        name: '线性主路',
        transform: { x: 128, y: 320, width: 352, height: 32, rotation: 0 },
        color: '#48a868'
      },
      {
        op: 'create_identifier_definition',
        tempId: 'key-type',
        name: '钥匙',
        kind: 'key',
        color: '#f3b33f',
        shape: 'diamond'
      },
      {
        op: 'create_identifier_definition',
        tempId: 'boss-type',
        name: 'Boss',
        kind: 'boss',
        color: '#e85d75',
        shape: 'star'
      },
      {
        op: 'place_identifier',
        tempId: 'key-1',
        definitionRef: 'key-type',
        sceneRef: 'scene-linear',
        name: '钥匙 1',
        transform: { x: 300, y: 300, width: 16, height: 16, rotation: 0 }
      },
      {
        op: 'place_identifier',
        tempId: 'boss-1',
        definitionRef: 'boss-type',
        sceneRef: 'scene-s',
        name: 'Boss 1',
        transform: { x: 760, y: 248, width: 16, height: 16, rotation: 0 }
      },
      {
        op: 'place_identifier',
        tempId: 'boss-2',
        definitionRef: 'boss-type',
        sceneRef: 'scene-s',
        name: 'Boss 2',
        transform: { x: 980, y: 480, width: 16, height: 16, rotation: 0 }
      },
      {
        op: 'create_connection',
        tempId: 'city-link',
        fromSceneRef: 'scene-linear',
        toSceneRef: 'scene-s',
        name: '城区通道'
      },
      {
        op: 'add_annotation',
        tempId: 'note-1',
        text: 'AI 生成：线性区域通往 S 型区域。',
        transform: { x: 420, y: 40, width: 240, height: 64, rotation: 0 }
      }
    ]
  };
}

export function mockGenerateImage(request: GenerateImageRequest): GenerateImageResponse {
  const background = request.transparentBackground ? 'none' : colorByPrompt(request.prompt);
  const initials = request.prompt.trim().slice(0, 2).toUpperCase() || 'AI';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${request.width}" height="${request.height}" viewBox="0 0 ${request.width} ${request.height}"><rect width="100%" height="100%" fill="${background}"/><circle cx="50%" cy="50%" r="32%" fill="${colorByPrompt(`${request.prompt}-mark`)}"/><text x="50%" y="54%" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(Math.min(request.width, request.height) * 0.18)}" font-weight="700" fill="white">${initials}</text></svg>`;
  return {
    mimeType: 'image/svg+xml',
    data: btoa(unescape(encodeURIComponent(svg))),
    revisedPrompt: request.prompt
  };
}
