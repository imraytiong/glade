import React, { useState } from 'react';
import Editor from './components/Editor';

const TestHarness: React.FC = () => {
  const [content, setContent] = useState('# Test Content\nHello World, this is a test paragraph that we can select text from.');

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
    </div>
  );
};

export default TestHarness;
