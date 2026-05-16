import { render, screen, act } from '@testing-library/react';
import TraceView, { TraceEvent } from '../TraceView';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { listen } from '../../../utils/api';

// Mock Tauri event listener
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

describe('TraceView', () => {
  let triggerEvent: (event: { payload: TraceEvent }) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Capture the callback passed to listen
    (listen as any).mockImplementation((_event: string, callback: any) => {
      triggerEvent = callback;
      return Promise.resolve(vi.fn());
    });
  });

  it('renders correctly', () => {
    render(<TraceView />);
    expect(screen.getByText('Telemetry')).toBeInTheDocument();
  });

  it('handles StepStarted event', async () => {
    render(<TraceView />);
    
    await act(async () => {
      triggerEvent({ payload: 'StepStarted' });
    });
    
    expect(screen.getByText('Agent step started...')).toBeInTheDocument();
  });

  it('handles Completed event', async () => {
    render(<TraceView />);
    
    await act(async () => {
      triggerEvent({ payload: 'Completed' });
    });
    
    expect(screen.getByText('Agent step completed.')).toBeInTheDocument();
  });

  it('handles TextGenerated event', async () => {
    render(<TraceView />);
    
    await act(async () => {
      triggerEvent({ payload: { TextGenerated: { text: 'Hello World' } } });
    });
    
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('handles ToolRequested event', async () => {
    render(<TraceView />);
    
    await act(async () => {
      triggerEvent({ payload: { ToolRequested: { name: 'test_tool', args: { foo: 'bar' } } } });
    });
    
    expect(screen.getByText('Requested tool: test_tool with args: {"foo":"bar"}')).toBeInTheDocument();
  });

  it('handles ToolResult event', async () => {
    render(<TraceView />);
    
    await act(async () => {
      triggerEvent({ payload: { ToolResult: { name: 'test_tool', result: 'Success' } } });
    });
    
    expect(screen.getByText('Tool result for test_tool: "Success"')).toBeInTheDocument();
  });

  it('handles ApprovalRequired event', async () => {
    render(<TraceView />);
    
    await act(async () => {
      triggerEvent({ payload: { ApprovalRequired: { id: '1', tool_name: 'test_tool', args: {} } } });
    });
    
    expect(screen.getByText('Approval required for tool: test_tool')).toBeInTheDocument();
  });
});
