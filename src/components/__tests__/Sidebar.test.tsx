import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import Sidebar from '../layout/Sidebar';
import { FileNode } from '../../utils/fs';

// Mock the child components to simplify testing
vi.mock('../FileExplorer', () => ({
  default: ({ nodes, onFileSelect }: any) => (
    <div data-testid="file-explorer">
      {nodes.map((node: any) => (
        <div key={node.path} onClick={() => onFileSelect(node)}>
          {node.name}
        </div>
      ))}
    </div>
  )
}));

vi.mock('../FrontmatterEditor', () => ({
  FrontmatterEditor: ({ value, onChange }: any) => (
    <div data-testid="frontmatter-editor">
      <input 
        data-testid="fm-input" 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
      />
    </div>
  )
}));

vi.mock('../TableOfContents', () => ({
  default: ({ content }: any) => (
    <div data-testid="toc">
      {content ? 'Has Content' : 'No Content'}
    </div>
  )
}));

describe('Sidebar', () => {
  const mockFileTree: FileNode[] = [
    { name: 'file1.md', path: '/file1.md', isDirectory: false },
    { name: 'file2.md', path: '/file2.md', isDirectory: false },
  ];

  const defaultProps = {
    vaultPath: '/mock/vault',
    fileTree: mockFileTree,
    activeFile: null,
    activeFileContent: null,
    activeHeading: '',
    editorRef: { current: null },
    onOpenFile: vi.fn(),
    onRenameFile: vi.fn(),
    onRequestDelete: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onMoveFile: vi.fn(),
    onDuplicateFile: vi.fn(),
    onFrontmatterChange: vi.fn(),
    onOpenVault: vi.fn(),
  };

  test('renders explorer view correctly', () => {
    render(<Sidebar {...defaultProps} sidebarView="explorer" />);
    
    expect(screen.getByTestId('file-explorer')).toBeTruthy();
    expect(screen.getByText('file1.md')).toBeTruthy();
    expect(screen.getByText('file2.md')).toBeTruthy();
    
    // Check if footer action buttons exist when vault is open and in explorer view
    expect(screen.getByTitle('Open Vault')).toBeTruthy();
    expect(screen.getByTitle('New File')).toBeTruthy();
    expect(screen.getByTitle('New Folder')).toBeTruthy();
  });

  test('calls onOpenFile when file is selected in explorer', () => {
    const onOpenFile = vi.fn();
    render(<Sidebar {...defaultProps} sidebarView="explorer" onOpenFile={onOpenFile} />);
    
    fireEvent.click(screen.getByText('file1.md'));
    expect(onOpenFile).toHaveBeenCalledWith(mockFileTree[0]);
  });

  test('renders outline view correctly with active file', () => {
    const activeFileContent = {
      path: '/file1.md',
      content: '# Hello',
      frontmatter: 'title: Hello'
    };
    
    render(<Sidebar {...defaultProps} sidebarView="outline" activeFileContent={activeFileContent} />);
    
    expect(screen.getByTestId('frontmatter-editor')).toBeTruthy();
    expect(screen.getByTestId('toc')).toBeTruthy();
    expect(screen.getByText('Has Content')).toBeTruthy();
    
    // Outline view should not show footer buttons
    expect(screen.queryByTitle('Open Vault')).toBeNull();
  });

  test('renders empty state when no vault path', () => {
    render(<Sidebar {...defaultProps} vaultPath={null} sidebarView="explorer" />);
    
    expect(screen.getByText('No vault opened.')).toBeTruthy();
    expect(screen.queryByTestId('file-explorer')).toBeNull();
  });

  test('calls action handlers from footer', () => {
    const onOpenVault = vi.fn();
    const onCreateFile = vi.fn();
    const onCreateFolder = vi.fn();
    
    render(
      <Sidebar 
        {...defaultProps} 
        sidebarView="explorer" 
        onOpenVault={onOpenVault}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
      />
    );
    
    fireEvent.click(screen.getByTitle('Open Vault'));
    expect(onOpenVault).toHaveBeenCalled();
    
    fireEvent.click(screen.getByTitle('New File'));
    expect(onCreateFile).toHaveBeenCalledWith('/mock/vault');
    
    fireEvent.click(screen.getByTitle('New Folder'));
    expect(onCreateFolder).toHaveBeenCalledWith('/mock/vault');
  });
});
