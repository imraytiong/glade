import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FileSelector from '../FileSelector';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('FileSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<FileSelector vaultPath="/vault" selectedFiles={[]} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search files to add...')).toBeInTheDocument();
    expect(screen.getByTitle('Browse File Explorer')).toBeInTheDocument();
  });

  it('loads files from vault', async () => {
    render(<FileSelector vaultPath="/vault" selectedFiles={[]} onChange={vi.fn()} />);
    
    await waitFor(() => {
      // Open modal to see all files
      fireEvent.click(screen.getByTitle('Browse File Explorer'));
      expect(screen.getByText('file1.md')).toBeInTheDocument();
      expect(screen.getByText('folder1')).toBeInTheDocument();
    });
  });

  it('selects a file when clicking in the search dropdown', async () => {
    const handleChange = vi.fn();
    render(<FileSelector vaultPath="/vault" selectedFiles={[]} onChange={handleChange} />);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Search files to add...');
      fireEvent.change(input, { target: { value: 'file1' } });
    });

    const option = screen.getByText('file1.md');
    expect(option).toBeInTheDocument();

    fireEvent.click(option);
    expect(handleChange).toHaveBeenCalledWith(['file1.md']);
  });

  it('selects a file when clicking in the modal', async () => {
    const handleChange = vi.fn();
    render(<FileSelector vaultPath="/vault" selectedFiles={['file1.md']} onChange={handleChange} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Browse File Explorer'));
    });

    const option = screen.getByText('folder1');
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith(['file1.md', 'folder1']);
  });

  it('deselects a file when clicking in the modal', async () => {
    const handleChange = vi.fn();
    render(<FileSelector vaultPath="/vault" selectedFiles={['file1.md']} onChange={handleChange} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Browse File Explorer'));
    });

    const option = screen.getAllByText('file1.md').find(el => el.parentElement?.parentElement?.style.background !== '');
    if (option) {
      fireEvent.click(option.parentElement!.parentElement!);
    }
    
    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
