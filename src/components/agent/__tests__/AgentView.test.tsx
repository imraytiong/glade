import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AgentView from '../AgentView';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { invoke } from '../../../utils/api';
import { ErrorProvider } from '../../../contexts/ErrorContext';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('../Editor', () => ({
  default: () => <div data-testid="glade-editor">Editor Mock</div>,
}));

vi.mock('../../utils/fs', () => ({
  readTextFile: vi.fn().mockResolvedValue(''),
  writeTextFile: vi.fn().mockResolvedValue(''),
  exists: vi.fn().mockResolvedValue(false),
}));

const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <ErrorProvider>
      {ui}
    </ErrorProvider>
  );
};

describe('AgentView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('glade_vaultPath', '/fake/vault/path');
  });

  it('renders "No Vault Opened" if vaultPath is not set', () => {
    localStorage.removeItem('glade_vaultPath');
    renderWithProvider(<AgentView />);
    expect(screen.getByText('No Vault Opened')).toBeInTheDocument();
  });

  it('loads agents and displays them in the sidebar', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === 'get_agents') {
        return [
          { id: 'agent-1', name: 'Test Agent 1', description: 'Agent 1 desc' },
          { id: 'agent-2', name: 'Test Agent 2', description: 'Agent 2 desc' }
        ];
      }
      return [];
    });

    renderWithProvider(<AgentView />);

    await waitFor(() => {
      expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
      expect(screen.getByText('Test Agent 2')).toBeInTheDocument();
    });
  });

  it('selects an agent and displays form', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === 'get_agents') {
        return [
          { id: 'agent-1', name: 'Test Agent 1', description: 'Agent 1 desc' }
        ];
      }
      return [];
    });

    renderWithProvider(<AgentView />);

    await waitFor(() => {
      expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
    });

    // Click on the agent
    fireEvent.click(screen.getByText('Test Agent 1'));

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test Agent 1');
      expect(nameInput).toBeInTheDocument();
    });
  });

  it('creates a new agent form', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === 'get_agents') {
        return [];
      }
      return [];
    });

    renderWithProvider(<AgentView />);

    // Click on create new agent
    fireEvent.click(screen.getByText('+ Create New Agent'));

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('New Agent');
      expect(nameInput).toBeInTheDocument();
      expect(screen.getByText('Agent Builder')).toBeInTheDocument();
    });
  });
});

