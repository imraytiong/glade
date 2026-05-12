import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import CommandPalette from './components/CommandPalette';

const TestHarness: React.FC = () => {
  const [content, setContent] = useState('# Test Content\nHello World, this is a test paragraph that we can select text from.');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<'files' | 'commands' | 'link'>('commands');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setPaletteMode('commands');
        setIsCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setPaletteMode('files');
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    (window as any).setEditorContent = setContent;
    return () => {
      delete (window as any).setEditorContent;
    };
  }, []);

  return (
    <div className="app-container theme-dark" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="main-content">
        <Editor
          initialContent={content}
          fileName="test.md"
          filePath="/test.md"
          onSave={setContent}
        />
      </main>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        mode={paletteMode}
        commands={[{ id: 'toggle-sidebar', name: 'Toggle Sidebar', action: () => {} }]}
        files={[{ name: 'test.md', path: '/test.md', isDirectory: false }]}
        onSelectCommand={() => {}}
        onSelectFile={() => {}}
      />
    </div>
  );
};

export default TestHarness;
