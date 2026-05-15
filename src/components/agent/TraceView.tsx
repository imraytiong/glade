import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export type TraceEvent = 
  | 'StepStarted'
  | 'Completed'
  | { TextGenerated: { text: string } }
  | { ToolRequested: { name: string, args: any } }
  | { ApprovalRequired: { id: string, tool_name: string, args: any } }
  | { ToolResult: { name: string, result: any } };

interface TraceLog {
  id: string;
  type: string;
  content: string;
  pendingApproval?: {
    id: string;
    tool_name: string;
    args: any;
  };
}

export default function TraceView() {
  const [logs, setLogs] = useState<TraceLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    console.log("TraceView useEffect started");
    const unlistenPromise = listen<TraceEvent>('glade://agent-trace', (event) => {
      console.log("TraceView received event:", event);
      const payload = event.payload;
      
      setLogs((prevLogs) => {
        const newLogs = [...prevLogs];
        const newLogId = Date.now().toString() + Math.random();

        if (payload === 'StepStarted') {
          newLogs.push({ id: newLogId, type: 'info', content: 'Agent step started...' });
        } else if (payload === 'Completed') {
          newLogs.push({ id: newLogId, type: 'success', content: 'Agent step completed.' });
        } else if (typeof payload === 'object') {
          if ('TextGenerated' in payload) {
            newLogs.push({ id: newLogId, type: 'text', content: payload.TextGenerated.text });
          } else if ('ToolRequested' in payload) {
            newLogs.push({ 
              id: newLogId, 
              type: 'tool', 
              content: `Requested tool: ${payload.ToolRequested.name} with args: ${JSON.stringify(payload.ToolRequested.args)}` 
            });
          } else if ('ToolResult' in payload) {
            newLogs.push({ 
              id: newLogId, 
              type: 'tool_result', 
              content: `Tool result for ${payload.ToolResult.name}: ${JSON.stringify(payload.ToolResult.result)}` 
            });
          } else if ('ApprovalRequired' in payload) {
            newLogs.push({
              id: newLogId,
              type: 'approval',
              content: `Approval required for tool: ${payload.ApprovalRequired.tool_name}`,
              pendingApproval: payload.ApprovalRequired
            });
          }
        }
        
        return newLogs;
      });
    });

    return () => {
      unlistenPromise.then(f => f()).catch(console.error);
    };
  }, []);



  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--background-primary)', color: 'var(--text-normal)' }}>
      <div
        style={{
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--background-modifier-border)",
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "baseline" }}>
          <h1
            style={{ margin: 0, fontSize: "20px", color: "var(--text-normal)" }}
          >
            Telemetry
          </h1>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontFamily: 'var(--font-monospace)' }}>
        {logs.map(log => (
          <div key={log.id} style={{ 
            color: log.type === 'error' ? 'var(--text-error)' : 
                   log.type === 'success' ? 'var(--text-success)' : 
                   log.type === 'tool' ? 'var(--text-accent)' : 
                   'var(--text-primary)' 
          }}>
            <span style={{ opacity: 0.5, marginRight: '8px' }}>[{new Date().toLocaleTimeString()}]</span>
            {log.content}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
