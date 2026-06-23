import { describe, expect, it } from 'vitest';
import { expandSlashCommand, getSlashCommand, searchSlashCommands } from './commandRegistry';

describe('AI slash commands', () => {
  it('shows all commands for slash and filters by first letters or aliases', () => {
    expect(searchSlashCommands('/').length).toBeGreaterThan(5);
    expect(searchSlashCommands('/s').map((command) => command.name)).toContain('scene');
    expect(searchSlashCommands('/移').map((command) => command.name)).toContain('update');
  });

  it('keeps command arguments as natural language while adding a precise directive', () => {
    const result = expandSlashCommand('/connect 连接入口区和 Boss 区');
    expect(result.command?.name).toBe('connect');
    expect(result.message).toContain('Use create_connection operations only');
    expect(result.message).toContain('连接入口区和 Boss 区');
    expect(getSlashCommand('/连接 入口区和 Boss 区')?.name).toBe('connect');
  });

  it('provides a multi-operation generate command', () => {
    const command = getSlashCommand('/generate 创建三段地下城');
    expect(command?.aliases).toContain('生成');
    expect(command?.allowedOperations).toBeUndefined();
  });
});
