import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { addNode, createDefaultNode, createEmptyDocument } from '../model/document';
import { useEditorStore } from '../store/editorStore';
import { PropertiesPanel } from './PropertiesPanel';

function resetWithScene() {
  const scene = createDefaultNode('scene', 1, { x: 0, y: 0, width: 384, height: 256, rotation: 0 }, { name: '初始地图' });
  const document = addNode(createEmptyDocument(), scene);
  useEditorStore.setState({
    document,
    documentTabs: [{ id: 'doc-test', document }],
    activeDocumentTabId: 'doc-test',
    selectedId: scene.id,
    inspectorNodeId: undefined,
    creationType: undefined,
    creationEditId: undefined,
    clipboard: undefined,
    searchQuery: '',
    viewport: { x: 240, y: 120, scale: 1, width: 800, height: 600 },
    workspaceMode: 'edit',
    connectionMode: false,
    worldVisibility: { structures: true, identifiers: true, connections: true },
    connectionStartDoorId: undefined,
    history: { past: [], future: [] },
    notice: undefined
  });
}

describe('PropertiesPanel', () => {
  beforeEach(resetWithScene);

  it('updates the selected node name', () => {
    render(<PropertiesPanel />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'Boss 房间' } });

    expect(useEditorStore.getState().document.scenes[0].name).toBe('Boss 房间');
  });

  it('opens AI as a peer tab beside properties and regions', () => {
    render(<PropertiesPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));

    expect(screen.getByRole('button', { name: '地图' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '图片' })).toBeInTheDocument();
    expect(screen.queryByText('未选择对象')).not.toBeInTheDocument();
  });

  it('searches and completes slash commands from the chat input', () => {
    render(<PropertiesPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));

    const input = screen.getByLabelText('地图 AI 指令');
    fireEvent.change(input, { target: { value: '/s' } });

    expect(screen.getByRole('option', { name: /scene/i })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveValue('/scene ');

    fireEvent.change(input, { target: { value: '/g' } });
    expect(screen.getByRole('option', { name: /generate/i })).toBeInTheDocument();
  });
});
