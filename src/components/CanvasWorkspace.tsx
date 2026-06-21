import Konva from 'konva';
import { Monitor } from 'lucide-react';
import { type DragEvent as ReactDragEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, RegularPolygon, Shape, Stage, Text, Transformer } from 'react-konva';
import {
  getIdentifierDefinition,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  nodeMatchesSearch
} from '../model/document';
import { getAnchorWorldPoint, getObjectAbsoluteTransform } from '../model/geometry';
import type { ArtAsset, ElementType, MapYDocument, MapYNode, Point, Transform } from '../model/types';
import { saveImageFile } from '../platformFiles';
import { useEditorStore } from '../store/editorStore';
import { clearPaletteDrag, getPaletteDrag } from '../utils/paletteDrag';

const acceptedTypes: ElementType[] = ['scene', 'structure', 'identifier', 'connection'];
type LegacyTileTool = 'select' | 'scene' | 'structure';
type TilePaintMode = 'paint' | 'erase';

function isElementType(value: string): value is ElementType {
  return acceptedTypes.includes(value as ElementType);
}

function getInitial(value: string): string {
  return value.trim().slice(0, 1).toUpperCase();
}

function getDragPayload(dataTransfer: DataTransfer | null): { type: ElementType; identifierDefinitionId?: string } | undefined {
  if (!dataTransfer) {
    return undefined;
  }

  const type = dataTransfer.getData('application/x-mapy-component') || dataTransfer.getData('text/plain');
  if (!isElementType(type)) {
    return undefined;
  }

  return {
    type,
    identifierDefinitionId: dataTransfer.getData('application/x-mapy-identifier-id') || undefined
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const numeric = Number.parseInt(value, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  scale: number;
}

const imageCache = new Map<string, HTMLImageElement>();

function getViewportBounds(viewport: { x: number; y: number; scale: number; width: number; height: number }): ViewportBounds {
  const padding = 192 / viewport.scale;
  return {
    left: -viewport.x / viewport.scale - padding,
    top: -viewport.y / viewport.scale - padding,
    right: (viewport.width - viewport.x) / viewport.scale + padding,
    bottom: (viewport.height - viewport.y) / viewport.scale + padding,
    scale: viewport.scale
  };
}

function getTileKey(tile: Point): string {
  return `${tile.x}:${tile.y}`;
}

function useCachedImage(dataUrl?: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(() => (dataUrl ? imageCache.get(dataUrl) : undefined));

  useEffect(() => {
    if (!dataUrl) {
      setImage(undefined);
      return;
    }

    const cached = imageCache.get(dataUrl);
    if (cached?.complete) {
      setImage(cached);
      return;
    }

    const nextImage = cached || new window.Image();
    let cancelled = false;
    nextImage.onload = () => {
      imageCache.set(dataUrl, nextImage);
      if (!cancelled) {
        setImage(nextImage);
      }
    };
    nextImage.onerror = () => {
      if (!cancelled) {
        setImage(undefined);
      }
    };

    if (!cached) {
      imageCache.set(dataUrl, nextImage);
      nextImage.src = dataUrl;
    }

    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  return image;
}

function InfiniteGrid({
  height,
  tileEditing,
  viewport,
  width,
  gridSize
}: {
  height: number;
  tileEditing: boolean;
  viewport: { x: number; y: number; scale: number };
  width: number;
  gridSize: number;
}) {
  const worldLeft = -viewport.x / viewport.scale;
  const worldTop = -viewport.y / viewport.scale;
  const worldRight = (width - viewport.x) / viewport.scale;
  const worldBottom = (height - viewport.y) / viewport.scale;
  let gridStep = gridSize;
  const minimumScreenSpacing = tileEditing ? 3 : 8;

  while (gridStep * viewport.scale < minimumScreenSpacing) {
    gridStep *= 2;
  }

  const startX = Math.floor(worldLeft / gridStep) * gridStep;
  const endX = Math.ceil(worldRight / gridStep) * gridStep;
  const startY = Math.floor(worldTop / gridStep) * gridStep;
  const endY = Math.ceil(worldBottom / gridStep) * gridStep;
  const majorStep = gridSize * 8;

  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(context) => {
        context.save();
        context.beginPath();
        context.strokeStyle = tileEditing ? '#22364b' : '#1b2a3a';
        context.lineWidth = 0.65 / viewport.scale;

        for (let x = startX; x <= endX; x += gridStep) {
          if (x === 0 || x % majorStep === 0) {
            continue;
          }
          context.moveTo(x, startY);
          context.lineTo(x, endY);
        }

        for (let y = startY; y <= endY; y += gridStep) {
          if (y === 0 || y % majorStep === 0) {
            continue;
          }
          context.moveTo(startX, y);
          context.lineTo(endX, y);
        }
        context.stroke();

        context.beginPath();
        context.strokeStyle = '#31485f';
        context.lineWidth = 0.9 / viewport.scale;
        for (let x = Math.floor(startX / majorStep) * majorStep; x <= endX; x += majorStep) {
          if (x === 0) {
            continue;
          }
          context.moveTo(x, startY);
          context.lineTo(x, endY);
        }
        for (let y = Math.floor(startY / majorStep) * majorStep; y <= endY; y += majorStep) {
          if (y === 0) {
            continue;
          }
          context.moveTo(startX, y);
          context.lineTo(endX, y);
        }
        context.stroke();

        context.beginPath();
        context.strokeStyle = '#71849a';
        context.lineWidth = 1.25 / viewport.scale;
        if (worldLeft <= 0 && worldRight >= 0) {
          context.moveTo(0, startY);
          context.lineTo(0, endY);
        }
        if (worldTop <= 0 && worldBottom >= 0) {
          context.moveTo(startX, 0);
          context.lineTo(endX, 0);
        }
        context.stroke();
        context.restore();
      }}
    />
  );
}

interface ExportImageDetail {
  filename: string;
  width: number;
  height: number;
  mimeType: 'image/png' | 'image/jpeg';
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('导出图片生成失败。'));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('导出图片失败。'));
        }
      },
      mimeType,
      quality
    );
  });
}

// Draws a legend in the bottom-left of an exported image: identifier types ("类")
// plus a "连接" (connection) entry when the map has any connections.
function drawExportLegend(context: CanvasRenderingContext2D, document: MapYDocument, canvasHeight: number): void {
  const items = document.identifiers.map((definition) => ({
    color: definition.color,
    label: definition.kind || definition.name,
    isConnection: false
  }));
  if (document.doors.length > 0) {
    items.push({ color: '#72d6ff', label: '连接', isConnection: true });
  }
  if (items.length === 0) {
    return;
  }

  const pad = 14;
  const rowHeight = 24;
  const swatch = 14;
  const titleHeight = 22;
  const bodyFont = '13px "Inter", "Microsoft YaHei", sans-serif';

  context.save();
  context.textBaseline = 'middle';
  context.font = bodyFont;
  const maxText = items.reduce((max, item) => Math.max(max, context.measureText(item.label).width), 0);
  const boxWidth = pad * 2 + swatch + 10 + Math.ceil(maxText);
  const boxHeight = pad * 2 + titleHeight + items.length * rowHeight;
  const x = 20;
  const y = canvasHeight - boxHeight - 20;

  context.fillStyle = 'rgba(9,17,30,0.85)';
  context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = '#2f4562';
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, boxWidth, boxHeight);

  context.fillStyle = '#9fd0ff';
  context.font = 'bold 13px "Inter", "Microsoft YaHei", sans-serif';
  context.fillText('图例', x + pad, y + pad + 8);

  context.font = bodyFont;
  items.forEach((item, index) => {
    const rowY = y + pad + titleHeight + index * rowHeight + rowHeight / 2;
    const sx = x + pad;

    if (item.isConnection) {
      context.fillStyle = 'rgba(114,214,255,0.28)';
      context.fillRect(sx, rowY - swatch / 2, swatch, swatch);
      context.strokeStyle = item.color;
      context.strokeRect(sx + 0.5, rowY - swatch / 2 + 0.5, swatch - 1, swatch - 1);
      context.beginPath();
      context.moveTo(sx + 2, rowY);
      context.lineTo(sx + swatch - 2, rowY);
      context.strokeStyle = '#e7eef8';
      context.stroke();
    } else {
      context.beginPath();
      context.arc(sx + swatch / 2, rowY, swatch / 2, 0, Math.PI * 2);
      context.fillStyle = item.color;
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = '#0b1220';
      context.stroke();
    }

    context.fillStyle = '#e7eef8';
    context.fillText(item.label, sx + swatch + 10, rowY);
  });

  context.restore();
}

function getExportBounds(document: ReturnType<typeof useEditorStore.getState>['document'], nodes: MapYNode[]) {
  const targetNodes = nodes.length > 0 ? nodes : document.scenes;

  if (targetNodes.length === 0) {
    return { x: -640, y: -360, width: 1280, height: 720 };
  }

  const transforms = targetNodes.map((node) => getObjectAbsoluteTransform(document, node));
  const padding = document.settings.gridSize * 3;
  const minX = Math.min(...transforms.map((transform) => transform.x)) - padding;
  const minY = Math.min(...transforms.map((transform) => transform.y)) - padding;
  const maxX = Math.max(...transforms.map((transform) => transform.x + transform.width)) + padding;
  const maxY = Math.max(...transforms.map((transform) => transform.y + transform.height)) + padding;

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function AssetImage({ asset, height, width, x = 0, y = 0 }: { asset: ArtAsset; height: number; width: number; x?: number; y?: number }) {
  const image = useCachedImage(asset.dataUrl);

  if (!image) {
    return null;
  }

  return <KonvaImage height={height} image={image} width={width} x={x} y={y} />;
}

interface NodeShapeProps {
  node: MapYNode;
  absoluteTransform: Transform;
  selected: boolean;
  connectionStart: boolean;
  regionColor?: string;
  asset?: ArtAsset;
  gridSize: number;
  tileEditing: boolean;
  viewportBounds: ViewportBounds;
  worldMode: boolean;
  locked: boolean;
  dimmed: boolean;
  searchMatch: boolean;
  onSelect: () => void;
  onOpenInspector: () => void;
  onDragEnd: (point: Point) => void;
  onTransformEnd: (transform: Transform) => void;
  setRef: (value: Konva.Group | null) => void;
}

function TileBatchShape({
  absoluteTransform,
  assetImage,
  gridSize,
  node,
  nodeColor,
  selected,
  stroke,
  tileEditing,
  viewportBounds,
  worldMode
}: {
  absoluteTransform: Transform;
  assetImage?: HTMLImageElement;
  gridSize: number;
  node: MapYNode;
  nodeColor: string;
  selected: boolean;
  stroke: string;
  tileEditing: boolean;
  viewportBounds: ViewportBounds;
  worldMode: boolean;
}) {
  const tiles = node.tiles || [];
  const tileKeys = useMemo(() => new Set(tiles.map(getTileKey)), [tiles]);
  const fill = hexToRgba(nodeColor, node.type === 'scene' ? (worldMode ? 0.2 : 0.14) : 0.28);
  const tileStroke = hexToRgba(stroke, selected ? 0.92 : 0.52);
  const drawTileStroke = tileEditing && viewportBounds.scale >= 0.55;

  return (
    <Shape
      height={absoluteTransform.height}
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(context) => {
        if (tiles.length === 0) {
          return;
        }

        const localLeft = Math.max(0, viewportBounds.left - absoluteTransform.x);
        const localTop = Math.max(0, viewportBounds.top - absoluteTransform.y);
        const localRight = Math.min(absoluteTransform.width, viewportBounds.right - absoluteTransform.x);
        const localBottom = Math.min(absoluteTransform.height, viewportBounds.bottom - absoluteTransform.y);

        if (localRight < 0 || localBottom < 0 || localLeft > absoluteTransform.width || localTop > absoluteTransform.height) {
          return;
        }

        const startX = Math.max(0, Math.floor(localLeft / gridSize) - 1);
        const startY = Math.max(0, Math.floor(localTop / gridSize) - 1);
        const endX = Math.ceil(localRight / gridSize) + 1;
        const endY = Math.ceil(localBottom / gridSize) + 1;

        context.save();
        context.lineWidth = selected ? 1.4 : 0.8;
        context.strokeStyle = tileStroke;
        context.fillStyle = fill;

        for (let y = startY; y <= endY; y += 1) {
          for (let x = startX; x <= endX; x += 1) {
            if (!tileKeys.has(`${x}:${y}`)) {
              continue;
            }

            const tileX = x * gridSize;
            const tileY = y * gridSize;

            if (node.type === 'structure' && assetImage?.complete) {
              context.fillStyle = '#0c1624';
              context.fillRect(tileX, tileY, gridSize, gridSize);
              context.drawImage(assetImage, tileX, tileY, gridSize, gridSize);
              context.fillStyle = hexToRgba(nodeColor, 0.18);
              context.fillRect(tileX, tileY, gridSize, gridSize);
            } else {
              context.fillStyle = fill;
              context.fillRect(tileX, tileY, gridSize, gridSize);
            }

            if (drawTileStroke) {
              context.strokeRect(tileX, tileY, gridSize, gridSize);
            }
          }
        }

        context.beginPath();
        context.strokeStyle = stroke;
        context.lineWidth = selected ? 2.5 : node.type === 'scene' ? 2 : 1.5;

        for (let y = startY; y <= endY; y += 1) {
          for (let x = startX; x <= endX; x += 1) {
            if (!tileKeys.has(`${x}:${y}`)) {
              continue;
            }

            const left = x * gridSize;
            const top = y * gridSize;
            const right = left + gridSize;
            const bottom = top + gridSize;

            if (!tileKeys.has(`${x}:${y - 1}`)) {
              context.moveTo(left, top);
              context.lineTo(right, top);
            }
            if (!tileKeys.has(`${x + 1}:${y}`)) {
              context.moveTo(right, top);
              context.lineTo(right, bottom);
            }
            if (!tileKeys.has(`${x}:${y + 1}`)) {
              context.moveTo(right, bottom);
              context.lineTo(left, bottom);
            }
            if (!tileKeys.has(`${x - 1}:${y}`)) {
              context.moveTo(left, bottom);
              context.lineTo(left, top);
            }
          }
        }

        context.stroke();
        context.restore();
      }}
      width={absoluteTransform.width}
    />
  );
}

function NodeShape({
  node,
  absoluteTransform,
  selected,
  connectionStart,
  regionColor,
  asset,
  gridSize,
  tileEditing,
  viewportBounds,
  worldMode,
  locked,
  dimmed,
  searchMatch,
  onSelect,
  onOpenInspector,
  onDragEnd,
  onTransformEnd,
  setRef
}: NodeShapeProps) {
  const nodeColor = node.type === 'scene' && regionColor ? regionColor : node.color;
  const stroke = searchMatch ? '#f3b33f' : connectionStart ? '#f3b33f' : selected ? '#ffffff' : nodeColor;
  const strokeWidth = searchMatch || selected ? 2.5 : node.type === 'scene' ? 2 : 1.5;
  const usesTileShape = Boolean(node.type === 'structure' && node.tiles && node.tiles.length > 0);
  const usesAssetImage = Boolean(asset && node.type === 'identifier');
  const assetImage = useCachedImage(asset?.dataUrl);
  const identifierDefinition = node.type === 'identifier' ? getIdentifierDefinition(useEditorStore.getState().document, node.identifierDefinitionId) : undefined;
  const identifierTypeName = identifierDefinition?.kind || identifierDefinition?.name || '';
  const label = node.type === 'annotation' ? node.text || node.name : worldMode && node.type === 'identifier' ? identifierTypeName || node.name : node.name;
  const identifierSymbol = getInitial(worldMode ? identifierTypeName || node.name || '标' : node.name || identifierTypeName || '标');
  // Component name labels are hidden on the canvas; annotations still show their text.
  const showLabel = node.type === 'annotation';
  const commonShapeProps = {
    stroke,
    strokeWidth,
    shadowColor: selected ? '#72d6ff' : 'transparent',
    shadowBlur: selected ? 12 : 0
  };

  function handleTransformEnd(event: Konva.KonvaEventObject<Event>) {
    const group = event.target as Konva.Group;
    const scaleX = group.scaleX();
    const scaleY = group.scaleY();
    const nextTransform = {
      x: group.x(),
      y: group.y(),
      width: Math.max(gridSize, absoluteTransform.width * scaleX),
      height: Math.max(gridSize, absoluteTransform.height * scaleY),
      rotation: group.rotation()
    };
    group.scaleX(1);
    group.scaleY(1);
    onTransformEnd(nextTransform);
  }

  return (
    <Group
      draggable={!locked && !tileEditing}
      opacity={dimmed ? 0.34 : 1}
      key={node.id}
      onClick={(event) => {
        event.cancelBubble = true;
        if (tileEditing) {
          return;
        }
        onSelect();
      }}
      onDblClick={(event) => {
        event.cancelBubble = true;
        if (tileEditing) {
          return;
        }
        onOpenInspector();
      }}
      onDragEnd={(event) => {
        const snapped = {
          x: Math.round(event.target.x() / gridSize) * gridSize,
          y: Math.round(event.target.y() / gridSize) * gridSize
        };
        event.target.position(snapped);
        onDragEnd(snapped);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        if (tileEditing) {
          return;
        }
        onSelect();
      }}
      onDblTap={(event) => {
        event.cancelBubble = true;
        if (tileEditing) {
          return;
        }
        onOpenInspector();
      }}
      onTransformEnd={handleTransformEnd}
      ref={setRef}
      rotation={absoluteTransform.rotation}
      x={absoluteTransform.x}
      y={absoluteTransform.y}
    >
      {usesTileShape ? (
        <>
          <Rect fill="rgba(255,255,255,0.001)" height={absoluteTransform.height} width={absoluteTransform.width} />
          <TileBatchShape
            absoluteTransform={absoluteTransform}
            assetImage={node.type === 'structure' ? assetImage : undefined}
            gridSize={gridSize}
            node={node}
            nodeColor={nodeColor}
            selected={selected}
            stroke={stroke}
            tileEditing={tileEditing}
            viewportBounds={viewportBounds}
            worldMode={worldMode}
          />
        </>
      ) : usesAssetImage && asset ? (
        <>
          <Rect
            cornerRadius={2}
            fill="#0c1624"
            height={absoluteTransform.height}
            stroke="#1f334c"
            strokeWidth={1}
            width={absoluteTransform.width}
          />
          <AssetImage asset={asset} height={absoluteTransform.height} width={absoluteTransform.width} />
          <Rect
            {...commonShapeProps}
            cornerRadius={2}
            fill="transparent"
            height={absoluteTransform.height}
            width={absoluteTransform.width}
          />
        </>
      ) : node.type === 'identifier' ? (
        <>
          {node.shape === 'circle' ? (
            <Circle
              {...commonShapeProps}
              fill={hexToRgba(nodeColor, 0.34)}
              radius={Math.min(absoluteTransform.width, absoluteTransform.height) / 2}
              x={absoluteTransform.width / 2}
              y={absoluteTransform.height / 2}
            />
          ) : node.shape === 'triangle' ? (
            <RegularPolygon
              {...commonShapeProps}
              fill={hexToRgba(nodeColor, 0.34)}
              radius={Math.min(absoluteTransform.width, absoluteTransform.height) / 2}
              sides={3}
              x={absoluteTransform.width / 2}
              y={absoluteTransform.height / 2}
            />
          ) : node.shape === 'star' ? (
            <RegularPolygon
              {...commonShapeProps}
              fill={hexToRgba(nodeColor, 0.34)}
              radius={Math.min(absoluteTransform.width, absoluteTransform.height) / 2}
              sides={5}
              x={absoluteTransform.width / 2}
              y={absoluteTransform.height / 2}
            />
          ) : (
            <RegularPolygon
              {...commonShapeProps}
              fill={hexToRgba(nodeColor, 0.34)}
              radius={Math.min(absoluteTransform.width, absoluteTransform.height) / 2}
              sides={4}
              x={absoluteTransform.width / 2}
              y={absoluteTransform.height / 2}
            />
          )}
          <Text
            align="center"
            fill="#ffffff"
            fontFamily="Inter, Microsoft YaHei, sans-serif"
            fontSize={12}
            fontStyle="bold"
            height={absoluteTransform.height}
            listening={false}
            text={identifierSymbol}
            verticalAlign="middle"
            width={absoluteTransform.width}
          />
        </>
      ) : node.type === 'connection' ? (
        <>
          <Rect
            {...commonShapeProps}
            cornerRadius={5}
            fill={hexToRgba(nodeColor, 0.26)}
            height={absoluteTransform.height}
            width={absoluteTransform.width}
          />
          <Line
            listening={false}
            points={
              node.doorSide === 'left' || node.doorSide === 'right'
                ? [
                    absoluteTransform.width / 2,
                    6,
                    absoluteTransform.width / 2,
                    absoluteTransform.height - 6
                  ]
                : [
                    6,
                    absoluteTransform.height / 2,
                    absoluteTransform.width - 6,
                    absoluteTransform.height / 2
                  ]
            }
            stroke="#e7eef8"
            strokeWidth={2}
          />
          <Circle
            fill="#0b1220"
            listening={false}
            radius={4}
            stroke="#e7eef8"
            strokeWidth={1.4}
            x={absoluteTransform.width / 2}
            y={absoluteTransform.height / 2}
          />
        </>
      ) : node.shape === 'circle' ? (
        <Circle
          {...commonShapeProps}
          fill={hexToRgba(nodeColor, 0.22)}
          radius={Math.min(absoluteTransform.width, absoluteTransform.height) / 2}
          x={absoluteTransform.width / 2}
          y={absoluteTransform.height / 2}
        />
      ) : node.shape === 'diamond' ? (
        <RegularPolygon
          {...commonShapeProps}
          fill={hexToRgba(nodeColor, 0.32)}
          radius={Math.min(absoluteTransform.width, absoluteTransform.height) / 2}
          sides={4}
          x={absoluteTransform.width / 2}
          y={absoluteTransform.height / 2}
        />
      ) : (
        <Rect
          {...commonShapeProps}
          cornerRadius={node.type === 'annotation' ? 6 : 2}
          dash={node.type === 'scene' ? [10, 6] : node.type === 'annotation' ? [6, 4] : undefined}
          fill={hexToRgba(nodeColor, node.type === 'scene' ? (worldMode ? 0.2 : 0.12) : node.type === 'annotation' ? 0.18 : 0.22)}
          height={absoluteTransform.height}
          width={absoluteTransform.width}
        />
      )}

      {searchMatch && (
        <Rect
          cornerRadius={4}
          dash={[4, 4]}
          fill="transparent"
          height={absoluteTransform.height + 10}
          listening={false}
          stroke="#f3b33f"
          strokeWidth={1.5}
          width={absoluteTransform.width + 10}
          x={-5}
          y={-5}
        />
      )}

      {showLabel && (
        <Text
          align={node.type === 'annotation' ? 'left' : 'center'}
          fill="#e7eef8"
          fontFamily="Inter, Microsoft YaHei, sans-serif"
          fontSize={node.type === 'annotation' ? 13 : 12}
          height={node.type === 'annotation' ? absoluteTransform.height - 16 : 18}
          listening={false}
          padding={node.type === 'annotation' ? 8 : 0}
          text={label}
          verticalAlign={node.type === 'annotation' ? 'top' : 'middle'}
          width={absoluteTransform.width}
          x={0}
          y={node.type === 'annotation' ? 4 : Math.max(2, absoluteTransform.height - 20)}
        />
      )}
    </Group>
  );
}

function MiniMap({
  document,
  viewport,
  setViewport
}: {
  document: ReturnType<typeof useEditorStore.getState>['document'];
  viewport: ReturnType<typeof useEditorStore.getState>['viewport'];
  setViewport: (viewport: Partial<ReturnType<typeof useEditorStore.getState>['viewport']>) => void;
}) {
  const scenes = document.scenes;
  if (scenes.length === 0) {
    return null;
  }

  const padding = 80;
  const minX = Math.min(...scenes.map((scene) => scene.transform.x)) - padding;
  const minY = Math.min(...scenes.map((scene) => scene.transform.y)) - padding;
  const maxX = Math.max(...scenes.map((scene) => scene.transform.x + scene.transform.width)) + padding;
  const maxY = Math.max(...scenes.map((scene) => scene.transform.y + scene.transform.height)) + padding;
  const worldWidth = Math.max(1, maxX - minX);
  const worldHeight = Math.max(1, maxY - minY);
  const width = 190;
  const height = 128;
  const scale = Math.min(width / worldWidth, height / worldHeight);
  const offsetX = (width - worldWidth * scale) / 2;
  const offsetY = (height - worldHeight * scale) / 2;

  function toMiniX(x: number) {
    return offsetX + (x - minX) * scale;
  }

  function toMiniY(y: number) {
    return offsetY + (y - minY) * scale;
  }

  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const miniX = event.clientX - rect.left;
    const miniY = event.clientY - rect.top;
    const worldX = (miniX - offsetX) / scale + minX;
    const worldY = (miniY - offsetY) / scale + minY;

    setViewport({
      x: viewport.width / 2 - worldX * viewport.scale,
      y: viewport.height / 2 - worldY * viewport.scale
    });
  }

  const viewRect = {
    x: toMiniX(-viewport.x / viewport.scale),
    y: toMiniY(-viewport.y / viewport.scale),
    width: (viewport.width / viewport.scale) * scale,
    height: (viewport.height / viewport.scale) * scale
  };

  return (
    <div className="minimap" aria-label="小地图导航">
      <svg onClick={handleClick} role="button" viewBox={`0 0 ${width} ${height}`}>
        {scenes.map((scene) => {
          const region = document.regions.find((item) => item.id === scene.regionId);
          const color = region?.color || scene.color;
          if (scene.tiles && scene.tiles.length > 0) {
            return (
              <g key={scene.id}>
                {scene.tiles.map((tile) => (
                  <rect
                    fill={color}
                    fillOpacity={0.24}
                    height={Math.max(1, document.settings.gridSize * scale)}
                    key={`${scene.id}-${tile.x}-${tile.y}`}
                    width={Math.max(1, document.settings.gridSize * scale)}
                    x={toMiniX(scene.transform.x + tile.x * document.settings.gridSize)}
                    y={toMiniY(scene.transform.y + tile.y * document.settings.gridSize)}
                  />
                ))}
              </g>
            );
          }

          return (
            <rect
              fill={color}
              fillOpacity={0.24}
              height={Math.max(3, scene.transform.height * scale)}
              key={scene.id}
              stroke={color}
              strokeWidth={1}
              width={Math.max(3, scene.transform.width * scale)}
              x={toMiniX(scene.transform.x)}
              y={toMiniY(scene.transform.y)}
            />
          );
        })}
        <rect
          fill="transparent"
          height={viewRect.height}
          stroke="#ffffff"
          strokeWidth={1.2}
          width={viewRect.width}
          x={viewRect.x}
          y={viewRect.y}
        />
      </svg>
    </div>
  );
}

async function captureElementAsPng(element: HTMLElement): Promise<Blob> {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const clone = element.cloneNode(true) as HTMLElement;
  const sourceCanvases = Array.from(element.querySelectorAll('canvas'));
  const cloneCanvases = Array.from(clone.querySelectorAll('canvas'));

  sourceCanvases.forEach((canvas, index) => {
    const replacement = window.document.createElement('img');
    replacement.src = canvas.toDataURL('image/png');
    replacement.width = canvas.width;
    replacement.height = canvas.height;
    replacement.style.width = `${canvas.clientWidth}px`;
    replacement.style.height = `${canvas.clientHeight}px`;
    replacement.style.display = 'block';
    cloneCanvases[index]?.replaceWith(replacement);
  });

  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.transform = 'none';

  const styleText = Array.from(window.document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${styleText}</style>
          ${serialized}
        </div>
      </foreignObject>
    </svg>
  `;
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = window.document.createElement('canvas');
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Cannot create screenshot canvas.');
  }

  context.scale(window.devicePixelRatio, window.devicePixelRatio);
  context.fillStyle = '#080d10';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvasToBlob(canvas, 'image/png');
}

function DocumentTabs() {
  const tabs = useEditorStore((state) => state.documentTabs);
  const activeTabId = useEditorStore((state) => state.activeDocumentTabId);
  const activeDocument = useEditorStore((state) => state.document);
  const switchDocumentTab = useEditorStore((state) => state.switchDocumentTab);
  const renameDocumentTab = useEditorStore((state) => state.renameDocumentTab);
  const closeDocumentTab = useEditorStore((state) => state.closeDocumentTab);
  const [editingTabId, setEditingTabId] = useState<string>();
  const [draftName, setDraftName] = useState('');

  function getTabName(tabId: string, fallbackName: string) {
    return (tabId === activeTabId ? activeDocument.name : fallbackName) || 'Untitled';
  }

  function startRename(tabId: string, currentName: string) {
    setEditingTabId(tabId);
    setDraftName(currentName || 'Untitled');
  }

  function finishRename() {
    if (editingTabId) {
      renameDocumentTab(editingTabId, draftName);
    }
    setEditingTabId(undefined);
    setDraftName('');
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      finishRename();
    }

    if (event.key === 'Escape') {
      setEditingTabId(undefined);
      setDraftName('');
    }
  }

  return (
    <div className="document-tabs" aria-label="文档标签页">
      <div className="document-tab-strip">
        {tabs.map((tab) => {
          const name = getTabName(tab.id, tab.document.name);
          const active = tab.id === activeTabId;

          return editingTabId === tab.id ? (
            <input
              autoFocus
              className="document-tab-input"
              key={tab.id}
              onBlur={finishRename}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={handleRenameKeyDown}
              value={draftName}
            />
          ) : (
            <button
              className={active ? 'document-tab active' : 'document-tab'}
              key={tab.id}
              onClick={() => switchDocumentTab(tab.id)}
              onDoubleClick={() => startRename(tab.id, name)}
              title="双击重命名"
              type="button"
            >
              {name}
              <span
                className="document-tab-close"
                onClick={(event) => {
                  event.stopPropagation();
                  closeDocumentTab(tab.id);
                }}
                role="button"
                title="关闭文件"
              >
                ×
              </span>
            </button>
          );
        })}
      </div>
      <span className="autosave-status">自动保存</span>
    </div>
  );
}

// "单元" = minimum pixel unit (grid size). Lives in the canvas HUD next to 原点;
// double-click to edit (same setGridSize + clamp as before).
function GridUnitControl() {
  const gridSize = useEditorStore((state) => state.document.settings.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(gridSize));

  function startEditing() {
    setDraft(String(gridSize));
    setEditing(true);
  }

  function commit() {
    setGridSize(Number(draft));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="hud-unit-input"
        max={MAX_GRID_SIZE}
        min={MIN_GRID_SIZE}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          } else if (event.key === 'Escape') {
            setEditing(false);
          }
        }}
        type="number"
        value={draft}
      />
    );
  }

  return (
    <button className="hud-unit" onDoubleClick={startEditing} title="单元（最小像素单位）· 双击修改" type="button">
      单元 {gridSize}
    </button>
  );
}

export function CanvasWorkspace() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const gridLayerRef = useRef<Konva.Layer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Group | null>>({});
  const paintingRef = useRef(false);
  const pendingPaintPointRef = useRef<Point | undefined>(undefined);
  const paintFrameRef = useRef<number | undefined>(undefined);
  const activePaintModeRef = useRef<TilePaintMode>('paint');
  const canvasPanRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const [tilePaintMode, setTilePaintMode] = useState<TilePaintMode>('paint');
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const document = useEditorStore((state) => state.document);
  const viewport = useEditorStore((state) => state.viewport);
  const selectedId = useEditorStore((state) => state.selectedId);
  const workspaceMode = useEditorStore((state) => state.workspaceMode);
  const tileTool: LegacyTileTool = workspaceMode === 'structure' ? 'structure' : workspaceMode === 'edit' ? 'scene' : 'select';
  const setTileTool = (_value: LegacyTileTool) => undefined;
  const connectionMode = useEditorStore((state) => state.connectionMode);
  const setConnectionMode = useEditorStore((state) => state.setConnectionMode);
  const worldVisibility = useEditorStore((state) => state.worldVisibility);
  const setWorldVisibility = useEditorStore((state) => state.setWorldVisibility);
  const connectionStartDoorId = useEditorStore((state) => state.connectionStartDoorId);
  const searchQuery = useEditorStore((state) => state.searchQuery);
  const setViewport = useEditorStore((state) => state.setViewport);
  const selectNode = useEditorStore((state) => state.selectNode);
  const setConnectionStartDoor = useEditorStore((state) => state.setConnectionStartDoor);
  const openNodeInspector = useEditorStore((state) => state.openNodeInspector);
  const openCreation = useEditorStore((state) => state.openCreation);
  const createConnection = useEditorStore((state) => state.createConnection);
  const createNode = useEditorStore((state) => state.createNode);
  const beginTileStroke = useEditorStore((state) => state.beginTileStroke);
  const updateTileStroke = useEditorStore((state) => state.updateTileStroke);
  const endTileStroke = useEditorStore((state) => state.endTileStroke);
  const updateNodeTransform = useEditorStore((state) => state.updateNodeTransform);
  const tileEditing = workspaceMode === 'structure';
  const viewportBounds = useMemo(() => getViewportBounds(viewport), [viewport]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(240, entry.contentRect.height)
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [setViewport]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    const selected = document.scenes
      .concat(document.structures, document.identifierInstances, document.doors, document.annotations)
      .find((node) => node.id === selectedId);
    const selectedNode = selectedId && selected ? nodeRefs.current[selectedId] : undefined;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [document, selectedId]);

  useEffect(() => {
    if (workspaceMode !== 'structure') {
      finishPaintStroke();
    }
  }, [workspaceMode]);

  const renderableNodes = useMemo(
    () => {
      if (workspaceMode === 'world') {
        const visibleIdentifierInstances = document.identifierInstances.filter((node) => {
          const definition = getIdentifierDefinition(document, node.identifierDefinitionId);
          return definition?.visibleInWorld ?? true;
        });

        return [
          ...document.scenes,
          ...(worldVisibility.structures ? document.structures : []),
          ...(worldVisibility.identifiers ? visibleIdentifierInstances : []),
          ...(worldVisibility.connections ? document.doors : []),
          ...document.annotations
        ];
      }

      return [
        ...document.scenes,
        ...document.structures,
        ...document.identifierInstances,
        ...document.doors
      ];
    },
    [document, worldVisibility, workspaceMode]
  );

  useEffect(() => {
    async function exportImage(detail: ExportImageDetail) {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      const transformer = transformerRef.current;
      const transformerVisible = transformer?.visible();
      const previousStageState = {
        width: stage.width(),
        height: stage.height(),
        x: stage.x(),
        y: stage.y(),
        scaleX: stage.scaleX(),
        scaleY: stage.scaleY()
      };
      transformer?.visible(false);
      transformer?.getLayer()?.batchDraw();

      // The grid is an editing aid only — never bake it into the exported image.
      const gridLayer = gridLayerRef.current;
      const gridWasVisible = gridLayer?.visible();
      gridLayer?.visible(false);

      try {
        const bounds = getExportBounds(document, renderableNodes);
        const fitScale = Math.min(detail.width / bounds.width, detail.height / bounds.height);
        const offsetX = (detail.width - bounds.width * fitScale) / 2;
        const offsetY = (detail.height - bounds.height * fitScale) / 2;

        stage.width(detail.width);
        stage.height(detail.height);
        stage.scale({ x: fitScale, y: fitScale });
        stage.position({
          x: -bounds.x * fitScale + offsetX,
          y: -bounds.y * fitScale + offsetY
        });
        stage.batchDraw();

        const sourceUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
        const image = await loadImage(sourceUrl);
        const canvas = window.document.createElement('canvas');
        canvas.width = detail.width;
        canvas.height = detail.height;

        const context = canvas.getContext('2d');
        if (!context) {
          return;
        }

        context.fillStyle = '#09111e';
        context.fillRect(0, 0, detail.width, detail.height);
        context.drawImage(image, 0, 0, detail.width, detail.height);
        drawExportLegend(context, document, detail.height);
        await saveImageFile(await canvasToBlob(canvas, detail.mimeType, 0.92), detail.filename, detail.mimeType);
      } finally {
        stage.width(previousStageState.width);
        stage.height(previousStageState.height);
        stage.scale({ x: previousStageState.scaleX, y: previousStageState.scaleY });
        stage.position({ x: previousStageState.x, y: previousStageState.y });
        transformer?.visible(transformerVisible ?? true);
        gridLayer?.visible(gridWasVisible ?? true);
        stage.batchDraw();
        transformer?.getLayer()?.batchDraw();
      }
    }

    function handleExport(event: Event) {
      const detail = (event as CustomEvent<ExportImageDetail>).detail;
      if (!detail) {
        return;
      }

      void exportImage(detail);
    }

    window.addEventListener('mapy:export-image', handleExport);
    return () => window.removeEventListener('mapy:export-image', handleExport);
  }, [document, renderableNodes]);

  const connectionLines = useMemo(() => {
    if (workspaceMode !== 'world' || !worldVisibility.connections) {
      return [];
    }

    return document.stitching.edges
      .map((edge) => {
        const fromAnchor = document.stitching.anchors.find((anchor) => anchor.id === edge.fromAnchorId);
        const toAnchor = document.stitching.anchors.find((anchor) => anchor.id === edge.toAnchorId);
        const fromPoint = fromAnchor ? getAnchorWorldPoint(document, fromAnchor) : undefined;
        const toPoint = toAnchor ? getAnchorWorldPoint(document, toAnchor) : undefined;

        if (!fromPoint || !toPoint) {
          return null;
        }

        return (
          <Group key={edge.id} listening={false}>
            <Line
              dash={[12, 8]}
              points={[fromPoint.x, fromPoint.y, toPoint.x, toPoint.y]}
              stroke="#72d6ff"
              strokeWidth={2}
            />
            <Circle fill="#0b1220" radius={5} stroke="#72d6ff" strokeWidth={1.5} x={fromPoint.x} y={fromPoint.y} />
            <Circle fill="#0b1220" radius={5} stroke="#72d6ff" strokeWidth={1.5} x={toPoint.x} y={toPoint.y} />
          </Group>
        );
      })
      .filter(Boolean);
  }, [document, workspaceMode, worldVisibility.connections]);

  function eventToWorld(clientX: number, clientY: number): Point {
    const rect = stageRef.current?.container().getBoundingClientRect() || containerRef.current?.getBoundingClientRect();
    const screenX = clientX - (rect?.left || 0);
    const screenY = clientY - (rect?.top || 0);

    return {
      x: (screenX - viewport.x) / viewport.scale,
      y: (screenY - viewport.y) / viewport.scale
    };
  }

  function pointerToWorld(): Point | undefined {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) {
      return undefined;
    }

    return {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale
    };
  }

  function getPaintPoint(): Point | undefined {
    if (!tileEditing) {
      return;
    }

    return pointerToWorld();
  }

  function beginPaintStroke(mode: TilePaintMode = tilePaintMode) {
    const worldPoint = getPaintPoint();
    if (!worldPoint) {
      return;
    }

    paintingRef.current = true;
    activePaintModeRef.current = mode;
    setTilePaintMode(mode);
    beginTileStroke('structure', worldPoint, mode);
  }

  function beginCanvasPan(event: Konva.KonvaEventObject<MouseEvent>) {
    event.evt.preventDefault();
    canvasPanRef.current = { x: event.evt.clientX, y: event.evt.clientY };
    setIsCanvasPanning(true);
  }

  function updateCanvasPan(event: Konva.KonvaEventObject<MouseEvent>) {
    const previous = canvasPanRef.current;
    if (!previous) {
      return false;
    }

    const next = { x: event.evt.clientX, y: event.evt.clientY };
    const currentViewport = useEditorStore.getState().viewport;
    setViewport({
      x: currentViewport.x + next.x - previous.x,
      y: currentViewport.y + next.y - previous.y
    });
    canvasPanRef.current = next;
    return true;
  }

  function finishCanvasPan() {
    canvasPanRef.current = undefined;
    setIsCanvasPanning(false);
  }

  useEffect(() => {
    function isInsideCanvas(clientX: number, clientY: number) {
      const rect = stageRef.current?.container().getBoundingClientRect() || containerRef.current?.getBoundingClientRect();
      return Boolean(rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom);
    }

    function handleWindowDragOver(event: globalThis.DragEvent) {
      if (!isInsideCanvas(event.clientX, event.clientY) || !getDragPayload(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    }

    function handleWindowDrop(event: globalThis.DragEvent) {
      if (!isInsideCanvas(event.clientX, event.clientY)) {
        return;
      }

      const payload = getDragPayload(event.dataTransfer);
      if (!payload) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      createNode(payload.type, eventToWorld(event.clientX, event.clientY), {
        identifierDefinitionId: payload.identifierDefinitionId
      });
      clearPaletteDrag();
    }

    function handleWindowPointerUp(event: globalThis.PointerEvent) {
      const payload = getPaletteDrag();
      if (!payload) {
        return;
      }

      try {
        if (!isInsideCanvas(event.clientX, event.clientY)) {
          return;
        }

        event.preventDefault();
        createNode(payload.type, eventToWorld(event.clientX, event.clientY), {
          identifierDefinitionId: payload.identifierDefinitionId
        });
      } finally {
        clearPaletteDrag();
      }
    }

    function handleWindowDragEnd(event: globalThis.DragEvent) {
      const payload = getPaletteDrag();
      if (!payload) {
        return;
      }

      try {
        if (!isInsideCanvas(event.clientX, event.clientY)) {
          return;
        }

        createNode(payload.type, eventToWorld(event.clientX, event.clientY), {
          identifierDefinitionId: payload.identifierDefinitionId
        });
      } finally {
        clearPaletteDrag();
      }
    }

    window.addEventListener('dragover', handleWindowDragOver, true);
    window.addEventListener('drop', handleWindowDrop, true);
    window.addEventListener('dragend', handleWindowDragEnd, true);
    window.addEventListener('pointerup', handleWindowPointerUp, true);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver, true);
      window.removeEventListener('drop', handleWindowDrop, true);
      window.removeEventListener('dragend', handleWindowDragEnd, true);
      window.removeEventListener('pointerup', handleWindowPointerUp, true);
    };
  }, [createNode, viewport]);

  function queuePaintStrokeUpdate() {
    const worldPoint = getPaintPoint();
    if (!worldPoint) {
      return;
    }

    pendingPaintPointRef.current = worldPoint;
    if (paintFrameRef.current !== undefined) {
      return;
    }

    paintFrameRef.current = window.requestAnimationFrame(() => {
      paintFrameRef.current = undefined;
      const nextPoint = pendingPaintPointRef.current;
      pendingPaintPointRef.current = undefined;

      if (!nextPoint || !paintingRef.current) {
        return;
      }

      updateTileStroke('structure', nextPoint, activePaintModeRef.current);
    });
  }

  function finishPaintStroke() {
    if (paintFrameRef.current !== undefined) {
      window.cancelAnimationFrame(paintFrameRef.current);
      paintFrameRef.current = undefined;
    }

    const pendingPoint = pendingPaintPointRef.current;
    pendingPaintPointRef.current = undefined;

    if (pendingPoint) {
      updateTileStroke('structure', pendingPoint, activePaintModeRef.current);
    }

    paintingRef.current = false;
    endTileStroke();
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) {
      return;
    }

    const oldScale = viewport.scale;
    const scaleStep = event.evt.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = Math.min(2.5, Math.max(0.35, oldScale * scaleStep));
    const worldPointer = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale
    };

    setViewport({
      scale: nextScale,
      x: pointer.x - worldPointer.x * nextScale,
      y: pointer.y - worldPointer.y * nextScale
    });
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    const payload = getDragPayload(event.dataTransfer);
    if (!payload) {
      return;
    }

    createNode(payload.type, eventToWorld(event.clientX, event.clientY), {
      identifierDefinitionId: payload.identifierDefinitionId
    });
  }

  function handleNodeSelect(node: MapYNode) {
    if (workspaceMode === 'world' && connectionMode && node.type === 'connection') {
      if (connectionStartDoorId && connectionStartDoorId !== node.id) {
        createConnection(connectionStartDoorId, node.id);
        return;
      }

      setConnectionStartDoor(node.id);
      return;
    }

    selectNode(node.id);
  }

  function handleNodeOpenInspector(node: MapYNode) {
    if (
      node.type === 'scene' ||
      node.type === 'structure' ||
      node.type === 'identifier' ||
      node.type === 'connection'
    ) {
      // Connections now open the same creation/edit window as the other components.
      openCreation(node.type, node.id);
      return;
    }

    openNodeInspector(node.id);
  }

  async function handleFullUiScreenshot() {
    const root = window.document.querySelector('.app-shell');
    if (!(root instanceof HTMLElement)) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = await captureElementAsPng(root);
    await saveImageFile(blob, `MapY-ui-${timestamp}.png`, 'image/png');
  }

  return (
    <section
      className={`canvas-panel${tileEditing ? ' is-tile-editing' : ''}${isCanvasPanning ? ' is-panning' : ''}`}
      onContextMenu={(event) => {
        if (tileEditing) {
          event.preventDefault();
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      ref={containerRef}
    >
      <DocumentTabs />
      <Stage
        draggable={!tileEditing}
        height={viewport.height}
        onClick={(event) => {
          if (tileEditing) {
            return;
          }

          if (event.target === event.target.getStage()) {
            selectNode(undefined);
          }
        }}
        onDragEnd={(event) => {
          if (event.target === stageRef.current) {
            setViewport({ x: event.target.x(), y: event.target.y() });
          }
        }}
        onContextMenu={(event) => {
          if (tileEditing) {
            event.evt.preventDefault();
          }
        }}
        onMouseDown={(event) => {
          if (event.evt.button === 1) {
            beginCanvasPan(event);
            return;
          }

          if (!tileEditing) {
            return;
          }

          event.evt.preventDefault();
          if (event.evt.button === 0) {
            beginPaintStroke('paint');
            return;
          }

          if (event.evt.button === 2) {
            beginPaintStroke('erase');
          }
        }}
        onMouseLeave={() => {
          finishCanvasPan();
          finishPaintStroke();
        }}
        onMouseMove={(event) => {
          if (updateCanvasPan(event)) {
            return;
          }

          if (!tileEditing || !paintingRef.current) {
            return;
          }

          event.evt.preventDefault();
          queuePaintStrokeUpdate();
        }}
        onMouseUp={() => {
          finishCanvasPan();
          finishPaintStroke();
        }}
        onTouchEnd={() => {
          finishPaintStroke();
        }}
        onTouchMove={(event) => {
          if (!tileEditing || !paintingRef.current) {
            return;
          }

          event.evt.preventDefault();
          queuePaintStrokeUpdate();
        }}
        onTouchStart={(event) => {
          if (!tileEditing) {
            return;
          }

          event.evt.preventDefault();
          beginPaintStroke();
        }}
        onWheel={handleWheel}
        ref={stageRef}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        width={viewport.width}
        x={viewport.x}
        y={viewport.y}
      >
        {workspaceMode !== 'world' && (
          <Layer listening={false} ref={gridLayerRef}>
            <InfiniteGrid
              gridSize={document.settings.gridSize}
              height={viewport.height}
              tileEditing={tileEditing}
              viewport={viewport}
              width={viewport.width}
            />
          </Layer>
        )}
        {workspaceMode === 'world' && <Layer listening={false}>{connectionLines}</Layer>}
        <Layer>
          {renderableNodes.map((node) => {
            const absoluteTransform = getObjectAbsoluteTransform(document, node);
            const asset = node.assetId ? document.assets.find((item) => item.id === node.assetId) : undefined;
            const region =
              node.type === 'scene'
                ? document.regions.find((item) => item.id === node.regionId)
                : undefined;
            return (
              <NodeShape
                absoluteTransform={absoluteTransform}
                asset={asset}
                connectionStart={node.id === connectionStartDoorId}
                dimmed={false}
                gridSize={document.settings.gridSize}
                key={node.id}
                locked={false}
                node={node}
                onDragEnd={(point) =>
                  updateNodeTransform(node.id, {
                    ...absoluteTransform,
                    x: point.x,
                    y: point.y
                  })
                }
                onSelect={() => handleNodeSelect(node)}
                onOpenInspector={() => handleNodeOpenInspector(node)}
                onTransformEnd={(transform) => updateNodeTransform(node.id, transform)}
                regionColor={region?.color}
                searchMatch={nodeMatchesSearch(document, node, searchQuery)}
                selected={node.id === selectedId}
                setRef={(value) => {
                  nodeRefs.current[node.id] = value;
                }}
                tileEditing={tileEditing}
                viewportBounds={viewportBounds}
                worldMode={workspaceMode === 'world'}
              />
            );
          })}
          <Transformer
            anchorFill="#0f1b2d"
            anchorSize={9}
            anchorStroke="#72d6ff"
            borderDash={[6, 4]}
            borderStroke="#72d6ff"
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
            ref={transformerRef}
            rotateEnabled
          />
        </Layer>
      </Stage>
      <button className="canvas-screenshot-button" type="button" title="截取完整 UI" aria-label="截取完整 UI" onClick={() => void handleFullUiScreenshot()}>
        <Monitor size={18} />
      </button>
      <div className="canvas-edit-bar" aria-label="Pixel 编辑栏">
        <div className="edit-bar-group">
          <button className={tileTool === 'select' ? 'active' : ''} onClick={() => setTileTool('select')} type="button">
            选择
          </button>
          <button
            className={tileTool === 'scene' ? 'active' : ''}
            disabled={workspaceMode !== 'edit'}
            onClick={() => setTileTool('scene')}
            type="button"
          >
            地图
          </button>
          <button
            className={tileTool === 'structure' ? 'active' : ''}
            disabled={workspaceMode !== 'edit'}
            onClick={() => setTileTool('structure')}
            type="button"
          >
            结构
          </button>
        </div>
        <div className="edit-bar-group">
          <button className={tilePaintMode === 'paint' ? 'active' : ''} disabled={!tileEditing} onClick={() => setTilePaintMode('paint')} type="button">
            绘制
          </button>
          <button className={tilePaintMode === 'erase' ? 'active danger' : ''} disabled={!tileEditing} onClick={() => setTilePaintMode('erase')} type="button">
            擦除
          </button>
        </div>
      </div>
      {workspaceMode === 'world' && (
        <div className="world-overlay-controls">
          <label>
            <input
              checked={worldVisibility.structures}
              onChange={(event) => setWorldVisibility({ structures: event.target.checked })}
              type="checkbox"
            />
            结构
          </label>
          <label>
            <input
              checked={worldVisibility.identifiers}
              onChange={(event) => setWorldVisibility({ identifiers: event.target.checked })}
              type="checkbox"
            />
            标识
          </label>
          <label>
            <input
              checked={connectionMode}
              onChange={(event) => {
                setWorldVisibility({ connections: event.target.checked });
                setConnectionMode(event.target.checked);
              }}
              type="checkbox"
            />
            连接
          </label>
        </div>
      )}
      <div className="canvas-hud">
        {workspaceMode === 'world' && <span>世界地图</span>}
        {tileEditing && <span>{tileTool === 'scene' ? '地图 Pixel' : '结构 Pixel'} · {tilePaintMode === 'paint' ? '绘制' : '擦除'}</span>}
        {workspaceMode === 'world' && <span>{connectionMode ? '连接模式' : '普通选择'}</span>}
        <span>缩放 {Math.round(viewport.scale * 100)}%</span>
        <button
          onClick={() => setViewport({ x: viewport.width / 2, y: viewport.height / 2 })}
          title="将世界坐标原点移回 Canvas 中心"
          type="button"
        >
          原点
        </button>
        <GridUnitControl />
      </div>
      {workspaceMode === 'world' && <MiniMap document={document} setViewport={setViewport} viewport={viewport} />}
    </section>
  );
}
