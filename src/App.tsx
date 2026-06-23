import { useEffect } from 'react';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { CreationDialog } from './components/CreationDialog';
import { LeftPalette } from './components/LeftPalette';
import { NodePropertyDialog } from './components/NodePropertyDialog';
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
  return <EditorApp />;
}
