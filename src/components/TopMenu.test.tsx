import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../model/document';
import { useEditorStore } from '../store/editorStore';
import { TopMenu } from './TopMenu';

function resetEditor() {
  const document = createEmptyDocument();
  useEditorStore.setState({
    document,
    documentTabs: [{ id: 'doc-test', document }],
    activeDocumentTabId: 'doc-test',
    selectedId: undefined,
    inspectorNodeId: undefined,
    creationType: undefined,
    creationEditId: undefined,
    clipboard: undefined,
    searchQuery: '',
    viewport: { x: 0, y: 0, scale: 1, width: 800, height: 600 },
    workspaceMode: 'edit',
    connectionMode: false,
    worldVisibility: { structures: true, identifiers: true, connections: true },
    connectionStartDoorId: undefined,
    history: { past: [], future: [] },
    notice: undefined
  });
}

describe('TopMenu', () => {
  beforeEach(resetEditor);

  it('opens and closes a dropdown with repeated pointer presses', () => {
    render(<TopMenu />);

    const fileButton = screen.getByRole('button', { name: '文件' });
    const fileGroup = fileButton.closest('.menu-group');

    expect(fileButton).toHaveAttribute('aria-expanded', 'false');
    expect(fileGroup).not.toHaveClass('open');

    fireEvent.pointerDown(fileButton);

    expect(fileButton).toHaveAttribute('aria-expanded', 'true');
    expect(fileGroup).toHaveClass('open');

    fireEvent.pointerDown(fileButton);

    expect(fileButton).toHaveAttribute('aria-expanded', 'false');
    expect(fileGroup).not.toHaveClass('open');
  });

  it('closes an open dropdown with Escape', () => {
    render(<TopMenu />);

    const editButton = screen.getByRole('button', { name: '编辑' });
    const editGroup = editButton.closest('.menu-group');

    fireEvent.pointerDown(editButton);

    expect(editButton).toHaveAttribute('aria-expanded', 'true');
    expect(editGroup).toHaveClass('open');

    fireEvent.keyDown(editButton, { key: 'Escape' });

    expect(editButton).toHaveAttribute('aria-expanded', 'false');
    expect(editGroup).not.toHaveClass('open');
  });
});
