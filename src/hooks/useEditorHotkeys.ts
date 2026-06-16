import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function useEditorHotkeys() {
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const copySelected = useEditorStore((state) => state.copySelected);
  const cutSelected = useEditorStore((state) => state.cutSelected);
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const addAnnotation = useEditorStore((state) => state.addAnnotation);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditingText(event.target)) {
        return;
      }

      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (command && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (command && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (command && key === 'c') {
        event.preventDefault();
        copySelected();
        return;
      }

      if (command && key === 'x') {
        event.preventDefault();
        cutSelected();
        return;
      }

      if (command && key === 'v') {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        deleteSelected();
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        addAnnotation();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addAnnotation, copySelected, cutSelected, deleteSelected, pasteClipboard, redo, undo]);
}
