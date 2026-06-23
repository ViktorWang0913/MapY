export interface AiSlashCommand {
  name: string;
  label: string;
  description: string;
  placeholder: string;
  aliases: string[];
  directive?: string;
  allowedOperations?: string[];
  allowedIntents?: Array<'create_document' | 'patch_document'>;
}

export const AI_SLASH_COMMANDS: AiSlashCommand[] = [
  {
    name: 'new',
    label: '新建地图',
    description: '创建新文档，不修改当前地图',
    placeholder: '/new 创建一张包含入口区和 Boss 区的地图',
    aliases: ['create', 'map', '新建', '地图'],
    directive: 'Intent must be create_document. Build a new MapY document from the natural-language request.',
    allowedIntents: ['create_document']
  },
  {
    name: 'generate',
    label: 'AI 生成地图',
    description: '根据自然语言生成包含多个操作的完整地图计划',
    placeholder: '/generate 生成三段式地下城，加入钥匙、Boss 并连接区域',
    aliases: ['gen', 'ai', '生成', '智能生成'],
    directive: 'Intent may be create_document or patch_document. Use multiple operations when needed. Build a complete MapY plan from the natural-language request.',
    allowedIntents: ['create_document', 'patch_document']
  },
  {
    name: 'scene',
    label: '创建地图区域',
    description: '仅新增一个或多个场景',
    placeholder: '/scene 在当前地图右侧新增 Boss 区',
    aliases: ['zone', '区域', '场景'],
    directive: 'Intent must be patch_document. Use create_scene operations only.',
    allowedOperations: ['create_scene'],
    allowedIntents: ['patch_document']
  },
  {
    name: 'structure',
    label: '创建结构',
    description: '在指定地图内新增结构或 Pixel',
    placeholder: '/structure 在入口区创建一条横向主平台',
    aliases: ['platform', '结构', '平台'],
    directive: 'Intent must be patch_document. Use create_structure operations only.',
    allowedOperations: ['create_structure'],
    allowedIntents: ['patch_document']
  },
  {
    name: 'identifier',
    label: '创建标识',
    description: '创建标识类型并放置实例',
    placeholder: '/identifier 在 Boss 区中心放置一个存档点',
    aliases: ['marker', 'mark', '标识', '标记'],
    directive: 'Intent must be patch_document. Use create_identifier_definition when needed, then place_identifier.',
    allowedOperations: ['create_identifier_definition', 'place_identifier'],
    allowedIntents: ['patch_document']
  },
  {
    name: 'connect',
    label: '连接地图',
    description: '在两个地图之间创建连接',
    placeholder: '/connect 连接入口区右侧和 Boss 区左侧',
    aliases: ['link', 'connection', '连接'],
    directive: 'Intent must be patch_document. Use create_connection operations only.',
    allowedOperations: ['create_connection'],
    allowedIntents: ['patch_document']
  },
  {
    name: 'note',
    label: '添加注释',
    description: '在指定位置添加地图注释',
    placeholder: '/note 在 Boss 区添加“二阶段入口”',
    aliases: ['annotation', '注释', '备注'],
    directive: 'Intent must be patch_document. Use add_annotation operations only.',
    allowedOperations: ['add_annotation'],
    allowedIntents: ['patch_document']
  },
  {
    name: 'update',
    label: '精确修改',
    description: '移动、改名或修改已有对象',
    placeholder: '/update 把钥匙 1 移动到 Boss 区中心',
    aliases: ['move', 'edit', '修改', '移动'],
    directive: 'Intent must be patch_document. Use update_entity operations only. Resolve targets from documentContext.',
    allowedOperations: ['update_entity'],
    allowedIntents: ['patch_document']
  },
  {
    name: 'delete',
    label: '删除对象',
    description: '删除明确指定的已有对象',
    placeholder: '/delete 删除 Boss 2',
    aliases: ['remove', 'del', '删除'],
    directive: 'Intent must be patch_document. Use delete_entity operations only. Never infer an unspecified target.',
    allowedOperations: ['delete_entity'],
    allowedIntents: ['patch_document']
  },
  {
    name: 'help',
    label: '命令帮助',
    description: '显示可用命令和输入示例',
    placeholder: '/help',
    aliases: ['?', '帮助']
  }
];

export function getSlashCommand(input: string): AiSlashCommand | undefined {
  const token = input.trim().match(/^\/([^\s]*)/)?.[1]?.toLowerCase();
  if (!token) return undefined;
  return AI_SLASH_COMMANDS.find((command) =>
    command.name === token || command.aliases.some((alias) => alias.toLowerCase() === token)
  );
}

export function searchSlashCommands(input: string): AiSlashCommand[] {
  if (!input.startsWith('/')) return [];
  const query = input.slice(1).split(/\s/, 1)[0].toLowerCase();
  if (!query) return AI_SLASH_COMMANDS;
  return AI_SLASH_COMMANDS.filter((command) =>
    command.name.startsWith(query) ||
    command.label.toLowerCase().includes(query) ||
    command.aliases.some((alias) => alias.toLowerCase().startsWith(query))
  );
}

export function expandSlashCommand(input: string): { message: string; command?: AiSlashCommand } {
  const command = getSlashCommand(input);
  if (!command || !command.directive) return { message: input, command };
  const naturalRequest = input.trim().replace(/^\/[^\s]+\s*/, '').trim();
  return {
    command,
    message: [
      `[MapY command /${command.name}]`,
      command.directive,
      `Natural-language request: ${naturalRequest || command.placeholder.replace(/^\/\S+\s*/, '')}`
    ].join('\n')
  };
}
