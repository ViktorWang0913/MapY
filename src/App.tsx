import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { CreationDialog } from './components/CreationDialog';
import { LeftPalette } from './components/LeftPalette';
import { NodePropertyDialog } from './components/NodePropertyDialog';
import { OpenSourcePage } from './components/OpenSourcePage';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TopMenu } from './components/TopMenu';
import { useEditorHotkeys } from './hooks/useEditorHotkeys';
import { startAutoSave } from './store/editorStore';

function EditorApp() {
  useEditorHotkeys();
  useEffect(() => {
    startAutoSave();
  }, []);

  return (
    <div className="app-shell">
      <TopMenu />
      <main className="editor-shell">
        <LeftPalette />
        <CanvasWorkspace />
        <PropertiesPanel />
      </main>
      <CreationDialog />
      <NodePropertyDialog />
    </div>
  );
}

export function App() {
  try {
    if (isTauri()) {
      return <EditorApp />;
    }
  } catch {
    // Browser preview uses the website/editor routes below.
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/editor') {
    return <EditorApp />;
  }

  if (pathname === '/open-source') {
    window.history.replaceState(null, '', '/');
  }

  return <OpenSourcePage />;
}
