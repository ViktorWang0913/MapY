// ── AI Map Command system: validation ───────────────────────────────────────
// Lightweight manual validation (the project does not use Zod). Runs BEFORE a
// command touches the map; on failure the chat shows the error and nothing applies.

import {
  COMMAND_TYPES,
  OBJECT_TYPES,
  ZONE_TOPOLOGIES,
  type MapObject,
  type MapState,
  type MapYCommand,
  type MapZone
} from './mapCommands';

export type ValidationResult = { ok: true } | { ok: false; error: string };

const ok: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateZone(zone: unknown): string | undefined {
  const z = zone as Partial<MapZone>;
  if (!isNonEmptyString(z.id)) return '区域缺少有效的 id。';
  if (!isNonEmptyString(z.name)) return `区域 ${z.id} 缺少名称。`;
  if (![z.x, z.y, z.width, z.height].every(isFiniteNumber)) return `区域 ${z.id} 的坐标/尺寸必须是数字。`;
  if ((z.width as number) <= 0 || (z.height as number) <= 0) return `区域 ${z.id} 的宽高必须为正数。`;
  if (!ZONE_TOPOLOGIES.includes(z.topology as never)) return `区域 ${z.id} 的 topology 不受支持。`;
  return undefined;
}

function validateObject(object: unknown): string | undefined {
  const o = object as Partial<MapObject>;
  if (!isNonEmptyString(o.id)) return '对象缺少有效的 id。';
  if (!OBJECT_TYPES.includes(o.type as never)) return `对象 ${o.id} 的 type 不受支持。`;
  if (![o.x, o.y].every(isFiniteNumber)) return `对象 ${o.id} 的坐标必须是数字。`;
  return undefined;
}

/** All ids must be unique across zones AND objects. */
function findDuplicateId(ids: string[]): string | undefined {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return undefined;
}

export function validateCommand(command: unknown, currentMap: MapState): ValidationResult {
  const cmd = command as Partial<MapYCommand>;
  if (!cmd || typeof cmd !== 'object' || !COMMAND_TYPES.includes(cmd.type as never)) {
    return fail('AI 返回了未知的命令类型。');
  }

  const existingIds = [...currentMap.zones.map((z) => z.id), ...currentMap.objects.map((o) => o.id)];

  switch (cmd.type) {
    case 'CREATE_MAP': {
      const map = (cmd as { payload?: Partial<MapState> }).payload;
      if (!map) return fail('CREATE_MAP 缺少 payload。');
      if (!isFiniteNumber(map.width) || !isFiniteNumber(map.height)) return fail('地图宽高必须是数字。');
      if (map.width <= 0 || map.height <= 0) return fail('地图宽高必须为正数。');
      if (!Array.isArray(map.zones) || !Array.isArray(map.objects)) return fail('地图缺少 zones 或 objects 数组。');

      for (const zone of map.zones) {
        const error = validateZone(zone);
        if (error) return fail(error);
      }
      for (const object of map.objects) {
        const error = validateObject(object);
        if (error) return fail(error);
      }
      const dup = findDuplicateId([...map.zones.map((z) => z.id), ...map.objects.map((o) => o.id)]);
      if (dup) return fail(`存在重复的 id：${dup}`);
      return ok;
    }

    case 'ADD_ZONE': {
      const zone = (cmd as { payload?: unknown }).payload;
      const error = validateZone(zone);
      if (error) return fail(error);
      if (existingIds.includes((zone as MapZone).id)) return fail(`id 已存在：${(zone as MapZone).id}`);
      return ok;
    }

    case 'ADD_OBJECT': {
      const object = (cmd as { payload?: unknown }).payload;
      const error = validateObject(object);
      if (error) return fail(error);
      if (existingIds.includes((object as MapObject).id)) return fail(`id 已存在：${(object as MapObject).id}`);
      return ok;
    }

    case 'UPDATE_OBJECT': {
      const payload = (cmd as { payload?: { id?: string; patch?: Record<string, unknown> } }).payload;
      if (!payload || !isNonEmptyString(payload.id)) return fail('UPDATE_OBJECT 缺少目标 id。');
      if (!existingIds.includes(payload.id)) return fail(`找不到要更新的对象：${payload.id}`);
      if (!payload.patch || typeof payload.patch !== 'object') return fail('UPDATE_OBJECT 缺少 patch。');
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        if (key in payload.patch && !isFiniteNumber(payload.patch[key])) return fail(`patch.${key} 必须是数字。`);
      }
      return ok;
    }

    case 'DELETE_OBJECT': {
      const payload = (cmd as { payload?: { id?: string } }).payload;
      if (!payload || !isNonEmptyString(payload.id)) return fail('DELETE_OBJECT 缺少目标 id。');
      if (!existingIds.includes(payload.id)) return fail(`找不到要删除的对象：${payload.id}`);
      return ok;
    }

    default:
      return fail('AI 返回了未知的命令类型。');
  }
}
