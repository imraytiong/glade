import { useState, useEffect } from "react";
import { invoke } from "../../utils/api";
import { listen } from "../../utils/api";
import GladeEditor from "../Editor";
import FileSelector from "./FileSelector";

interface Agent {
  id: string;
  name: string;
  description?: string;
  system_prompt: string;
  model_class?: string;
  tools_allowed?: string[];
  skills_allowed?: string[];
  tools_requiring_approval?: string[];
  context_bank?: string[];
  allowed_zones?: { path: string; permission: string }[];
  allow_internal_knowledge_fallback?: boolean;
}

export default function AgentView({ isActive }: { isActive?: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Agent>>({});
  const [prompt, setPrompt] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawViewType, setRawViewType] = useState<"source" | "rich">("source");
  const [rawMarkdown, setRawMarkdown] = useState("");

  const splitRawMarkdown = (md: string) => {
    const match = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      return { frontmatter: match[1], body: match[2] };
    }
    return { frontmatter: "", body: md };
  };

  const combineRawMarkdown = (frontmatter: string, body: string) => {
    if (frontmatter.trim() === "") return body;
    return `---\n${frontmatter}\n---\n${body}`;
  };

  const vaultPath = localStorage.getItem("glade_vaultPath") || "";

  const loadAgents = async () => {
    if (!vaultPath) return;
    try {
      const loadedAgents = await invoke<Agent[]>("get_agents", { vaultPath });
      if (loadedAgents && loadedAgents.length > 0) {
        setAgents(loadedAgents);
      } else {
        setAgents([]);
      }

      // If we have a selected agent, update its form data in case it changed externally
      if (selectedAgentId && selectedAgentId !== "new") {
        const agent = loadedAgents.find((a) => a.id === selectedAgentId);
        if (agent) {
          setFormData(agent);
        } else {
          setSelectedAgentId(null);
        }
      }
    } catch (err) {
      console.error("Failed to load agents", err);
    }
  };

  useEffect(() => {
    loadAgents();

    const unlisten = listen("glade://vault-updated", () => {
      loadAgents();
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [vaultPath]);

  useEffect(() => {
    if (isRawMode && selectedAgentId && selectedAgentId !== "new") {
      import("../../utils/fs").then(({ readTextFile }) => {
        readTextFile(`${vaultPath}/.glade/agents/${selectedAgentId}.agent.md`)
          .then(setRawMarkdown)
          .catch(console.error);
      });
    }
  }, [isRawMode, selectedAgentId, vaultPath]);

  useEffect(() => {
    if (!selectedAgentId) {
      setIsDirty(false);
      return;
    }
    if (selectedAgentId === "new") {
      setIsDirty(true);
      return;
    }
    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    const isChanged =
      agent.name !== formData.name ||
      agent.description !== formData.description ||
      agent.system_prompt !== formData.system_prompt ||
      agent.model_class !== formData.model_class ||
      JSON.stringify((agent.tools_allowed || []).slice().sort()) !==
        JSON.stringify((formData.tools_allowed || []).slice().sort()) ||
      JSON.stringify((agent.skills_allowed || []).slice().sort()) !==
        JSON.stringify((formData.skills_allowed || []).slice().sort()) ||
      JSON.stringify((agent.tools_requiring_approval || []).slice().sort()) !==
        JSON.stringify((formData.tools_requiring_approval || []).slice().sort()) ||
      JSON.stringify((agent.context_bank || []).slice().sort()) !==
        JSON.stringify((formData.context_bank || []).slice().sort()) ||
      JSON.stringify((agent.allowed_zones || []).slice().sort()) !==
        JSON.stringify((formData.allowed_zones || []).slice().sort()) ||
      (agent.allow_internal_knowledge_fallback ?? true) !== (formData.allow_internal_knowledge_fallback ?? true);

    setIsDirty(isChanged);
  }, [formData, selectedAgentId, agents]);

  // Handle agent selection
  const selectAgent = (id: string | null) => {
    setSelectedAgentId(id);
    setError(null);
    setPrompt("");
    setIsRawMode(false);
    setRawViewType("source");

    if (id === "new") {
      setFormData({
        id: `agent_${Date.now()}`,
        name: "New Agent",
        system_prompt: "",
        model_class: "fast",
        tools_allowed: [...availableTools],
        skills_allowed: [],
        tools_requiring_approval: [],
        context_bank: [],
        allowed_zones: [],
      });
    } else if (id) {
      const agent = agents.find((a) => a.id === id);
      if (agent) {
        setFormData(agent);
      }
    }
  };

  const handleSaveRaw = async () => {
    if (!selectedAgentId || selectedAgentId === "new") return;
    try {
      setIsSaving(true);
      const { writeTextFile } = await import("../../utils/fs");
      await writeTextFile(`${vaultPath}/.glade/agents/${selectedAgentId}.agent.md`, rawMarkdown);
      await loadAgents();
      selectAgent(selectedAgentId);
    } catch (e) {
      alert("Failed to save: " + e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBuildAgent = async () => {
    if (!prompt.trim() || !vaultPath) return;
    setIsBuilding(true);
    setError(null);
    try {
      // build_agent now just returns the generated config without saving
      const newAgentConfig = await invoke<Agent>("build_agent", {
        prompt,
        vaultPath,
      });
      setFormData(newAgentConfig);
      setPrompt("");
    } catch (err: any) {
      setError(err.toString());
      console.error("Failed to build agent", err);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleSaveAgent = async () => {
    if (!vaultPath || !formData.id) return;
    setIsSaving(true);
    setError(null);
    try {
      console.log("=== handleSaveAgent ===");
      console.log("formData keys:", Object.keys(formData));
      console.log("formData.name:", formData.name);
      console.log("formData.description:", formData.description);
      console.log("formData.system_prompt:", formData.system_prompt);
      console.log("Full agent:", formData);
      await invoke("save_agent", { vaultPath, agent: formData });
      if (selectedAgentId === "new") {
        setSelectedAgentId(formData.id);
      }
      await loadAgents();
      window.dispatchEvent(new Event('agents-updated'));
    } catch (err: any) {
      setError(err.toString());
      console.error("Failed to save agent", err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateFormArray = (
    field: "tools_allowed" | "skills_allowed" | "tools_requiring_approval",
    value: string,
  ) => {
    const arr = formData[field] || [];
    setFormData({
      ...formData,
      [field]: arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value],
    });
  };

  const [availableTools, setAvailableTools] = useState<string[]>([
    "read_file",
    "write_file",
    "list_directory",
    "search_files",
    "run_command",
    "agent_log",
    "semantic_search",
  ]);

  const [availableSkills, setAvailableSkills] = useState<string[]>([]);

  useEffect(() => {
    if (vaultPath && (isActive === undefined || isActive === true)) {
        import('../../utils/fs').then(({ readTextFile, exists }) => {
            const baseTools = [
                "read_file",
                "write_file",
                "list_directory",
                "search_files",
                "run_command",
                "agent_log",
                "semantic_search",
            ];
            
            let mcpTools: string[] = [];
            let localToolsList: string[] = [];

            const mcpPath = `${vaultPath}/.glade/mcp_servers.json`;
            const mcpPromise = exists(mcpPath).then((doesExist: boolean) => {
                if (doesExist) {
                    return readTextFile(mcpPath).then((content: string) => {
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed.mcpServers) mcpTools = Object.keys(parsed.mcpServers);
                        } catch (e) {
                            console.error("Failed to parse mcp_servers.json", e);
                        }
                    }).catch(console.error);
                }
            });

            const localPath = `${vaultPath}/.glade/local_tools.json`;
            const localPromise = exists(localPath).then((doesExist: boolean) => {
                if (doesExist) {
                    return readTextFile(localPath).then((content: string) => {
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed.localTools) localToolsList = Object.keys(parsed.localTools);
                        } catch (e) {
                            console.error("Failed to parse local_tools.json", e);
                        }
                    }).catch(console.error);
                }
            });

            let skillsList: string[] = [];
            const skillsPromise = invoke<{ id: string, name: string }[]>('get_available_skills', { vaultPath })
                .then(skills => {
                    skillsList = skills.map(s => s.id);
                })
                .catch(console.error);
            
            Promise.all([mcpPromise, localPromise, skillsPromise]).then(() => {
                const combined = new Set([...baseTools, ...mcpTools, ...localToolsList]);
                setAvailableTools(Array.from(combined));
                setAvailableSkills(skillsList);
            });
        });
    }
  }, [vaultPath, isActive]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
            Agents
          </h1>
        </div>
        {selectedAgentId && selectedAgentId !== "new" && (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button
                    className="btn ghost"
                    onClick={async () => {
                        try {
                            const logs = await invoke<string>("get_agent_logs", {
                                vaultPath,
                                agentId: formData.id
                            });
                            if (logs.trim()) {
                                alert(logs);
                            } else {
                                alert("No execution logs found for this agent.");
                            }
                        } catch (e) {
                            console.error(e);
                            alert("Failed to load logs: " + e);
                        }
                    }}
                >
                    View Logs
                </button>
                <button className="btn ghost" onClick={() => setIsRawMode(!isRawMode)}>
                    {isRawMode ? "View Form" : "View Raw Markdown"}
                </button>
            </div>
        )}
      </div>

      {!vaultPath ? (
        <div
          className="empty-state"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h2 style={{ color: "var(--text-normal)", marginBottom: "8px" }}>
              No Vault Opened
            </h2>
            <p style={{ color: "var(--text-muted)" }}>
              Open a vault to manage your agents.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Sidebar - Master List */}
          <div
            style={{
              width: "280px",
              borderRight: "1px solid var(--background-modifier-border)",
              display: "flex",
              flexDirection: "column",
              background: "var(--background-secondary)",
            }}
          >
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Fleet Overview
              </div>

              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="sidebar-item"
                  onClick={() => selectAgent(agent.id)}
                  style={{
                    padding: "12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background:
                      selectedAgentId === agent.id
                        ? "var(--background-modifier-active)"
                        : "transparent",
                    border:
                      selectedAgentId === agent.id
                        ? "1px solid var(--background-modifier-border)"
                        : "1px solid transparent",
                    transition: "background 0.2s",
                    color: "var(--text-normal)",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    {agent.name}
                  </div>
                  {agent.description && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {agent.description}
                      </div>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                padding: "16px",
                borderTop: "1px solid var(--background-modifier-border)",
              }}
            >
              <button
                className="btn"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => selectAgent("new")}
              >
                + Create New Agent
              </button>
            </div>
          </div>

          {/* Right Pane - Detail View */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "var(--background-primary)",
            }}
          >
            {!selectedAgentId ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                }}
              >
                Select an agent from the fleet, or create a new one.
              </div>
            ) : (
              <>
                {/* Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column" }}>
                    <div
                      style={{
                        maxWidth: isRawMode ? "100%" : "600px",
                        width: "100%",
                        flex: isRawMode ? 1 : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px",
                      }}
                    >
                      {/* Auto-Fill Builder (Only for new agents) */}
                      {selectedAgentId === "new" && (
                        <div
                          style={{
                            padding: "16px",
                            background: "var(--background-secondary)",
                            borderRadius: "8px",
                            border:
                              "1px solid var(--background-modifier-border)",
                          }}
                        >
                          <h3
                            style={{
                              margin: "0 0 12px 0",
                              color: "var(--text-normal)",
                            }}
                          >
                            Agent Builder
                          </h3>
                          <p
                            style={{
                              margin: "0 0 16px 0",
                              fontSize: "14px",
                              color: "var(--text-muted)",
                            }}
                          >
                            Describe the agent and let AI auto-fill the
                            configuration below.
                          </p>
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. 'Create a rust developer agent that can run tests...'"
                            style={{
                              width: "100%",
                              height: "80px",
                              padding: "12px",
                              borderRadius: "6px",
                              border:
                                "1px solid var(--background-modifier-border)",
                              background:
                                "var(--background-primary, transparent)",
                              color: "var(--text-normal)",
                              resize: "vertical",
                              fontFamily: "inherit",
                              marginBottom: "12px",
                            }}
                            disabled={isBuilding}
                          />
                          <button
                            className="btn primary"
                            onClick={handleBuildAgent}
                            disabled={isBuilding || !prompt.trim()}
                          >
                            {isBuilding
                              ? "Auto-filling..."
                              : "✨ Auto-Fill with AI"}
                          </button>
                        </div>
                      )}

                      {error && (
                        <div
                          style={{
                            color: "#f05050",
                            padding: "12px",
                            border: "1px solid #f05050",
                            borderRadius: "6px",
                            background: "var(--background-secondary)",
                          }}
                        >
                          {error}
                        </div>
                      )}

                      {/* Configuration Form or Raw Editor */}
                      {isRawMode && selectedAgentId !== "new" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <div style={{ display: "flex", background: "var(--background-secondary)", borderRadius: "6px", padding: "4px" }}>
                                    <button
                                        className={`btn ${rawViewType === "source" ? "primary" : "ghost"}`}
                                        onClick={() => setRawViewType("source")}
                                        style={{ padding: "4px 12px", fontSize: "12px", background: rawViewType === "source" ? "var(--interactive-accent)" : "transparent" }}
                                    >
                                        Source
                                    </button>
                                    <button
                                        className={`btn ${rawViewType === "rich" ? "primary" : "ghost"}`}
                                        onClick={() => setRawViewType("rich")}
                                        style={{ padding: "4px 12px", fontSize: "12px", background: rawViewType === "rich" ? "var(--interactive-accent)" : "transparent" }}
                                    >
                                        Rich
                                    </button>
                                </div>
                            </div>
                            {rawViewType === "source" ? (
                                <textarea
                                    value={rawMarkdown}
                                    onChange={(e) => setRawMarkdown(e.target.value)}
                                    style={{
                                        width: "100%",
                                        flex: 1,
                                        padding: "16px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--background-modifier-border)",
                                        background: "#1e1e1e",
                                        color: "#d4d4d4",
                                        fontFamily: "monospace",
                                        fontSize: "14px",
                                        resize: "none"
                                    }}
                                />
                            ) : (
                                (() => {
                                    const { frontmatter, body } = splitRawMarkdown(rawMarkdown);
                                    return (
                                        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "16px" }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold" }}>YAML Frontmatter</label>
                                                <textarea 
                                                    value={frontmatter}
                                                    onChange={(e) => setRawMarkdown(combineRawMarkdown(e.target.value, body))}
                                                    rows={Math.max(5, frontmatter.split('\n').length)}
                                                    style={{
                                                        width: "100%",
                                                        padding: "12px",
                                                        borderRadius: "6px",
                                                        border: "1px solid var(--background-modifier-border)",
                                                        background: "#1e1e1e",
                                                        color: "#d4d4d4",
                                                        fontFamily: "monospace",
                                                        fontSize: "13px",
                                                        resize: "vertical",
                                                        overflow: "hidden"
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold" }}>Agent Instructions</label>
                                                <div style={{ flex: 1, border: "1px solid var(--background-modifier-border)", borderRadius: "6px", background: "var(--background-primary)", display: "flex", flexDirection: "column", minHeight: "300px" }}>
                                                    <GladeEditor
                                                        key={`rich-${selectedAgentId}`}
                                                        initialContent={body}
                                                        onSave={(newBody) => setRawMarkdown(combineRawMarkdown(frontmatter, newBody))}
                                                        fileName={`${selectedAgentId}.agent.md`}
                                                        filePath=""
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                    className="btn primary"
                                    onClick={handleSaveRaw}
                                    disabled={isSaving}
                                    style={{ padding: "6px 16px", background: "var(--interactive-accent)" }}
                                >
                                    {isSaving ? "Saving..." : "Save Raw Markdown"}
                                </button>
                            </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <label
                            style={{
                              fontWeight: "bold",
                              whiteSpace: "nowrap",
                              width: "100px",
                            }}
                          >
                            Name
                          </label>
                          <input
                            type="text"
                            value={formData.name || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            style={{
                              width: "250px",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              border:
                                "1px solid var(--background-modifier-border)",
                              background: "var(--background-primary)",
                              color: "var(--text-normal)",
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <label
                            style={{
                              fontWeight: "bold",
                              whiteSpace: "nowrap",
                              width: "100px",
                            }}
                          >
                            Description
                          </label>
                          <input
                            type="text"
                            value={formData.description || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, description: e.target.value })
                            }
                            style={{
                              width: "250px",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              border:
                                "1px solid var(--background-modifier-border)",
                              background: "var(--background-primary)",
                              color: "var(--text-normal)",
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <label
                            style={{
                              fontWeight: "bold",
                              whiteSpace: "nowrap",
                              width: "100px",
                            }}
                          >
                            Model Class
                          </label>
                          <select
                            value={formData.model_class || "fast"}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                model_class: e.target.value,
                              })
                            }
                            style={{
                              width: "250px",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              border:
                                "1px solid var(--background-modifier-border)",
                              background: "var(--background-primary)",
                              color: "var(--text-normal)",
                            }}
                          >
                            <option value="lite">Lite</option>
                            <option value="fast">Fast</option>
                            <option value="thinking">Thinking</option>
                          </select>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "bold" }}>
                            <input
                              type="checkbox"
                              checked={formData.allow_internal_knowledge_fallback ?? true}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  allow_internal_knowledge_fallback: e.target.checked,
                                })
                              }
                            />
                            Allow Internal Knowledge Fallback
                          </label>
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            System Prompt
                          </label>
                          <div style={{ height: "300px", border: "1px solid var(--background-modifier-border)", borderRadius: "6px", overflow: "hidden", display: "flex", background: "var(--background-primary)" }}>
                            <GladeEditor
                              key={formData.id}
                              initialContent={formData.system_prompt || ""}
                              onSave={(content) => setFormData({ ...formData, system_prompt: content })}
                              fileName={`agent-${formData.id}.md`}
                              filePath={`agent-${formData.id}.md`}
                              workspaceRoot={vaultPath}
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            Allowed Tools
                          </label>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            {availableTools.map((tool) => {
                              const isAllowed = (formData.tools_allowed || []).includes(tool);
                              const requiresApproval = (formData.tools_requiring_approval || []).includes(tool);
                              
                              return (
                                <div
                                  key={tool}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    background: "var(--background-secondary)",
                                    padding: "6px 12px",
                                    borderRadius: "16px",
                                    fontSize: "13px",
                                    border: "1px solid var(--background-modifier-border)",
                                  }}
                                >
                                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginRight: isAllowed ? "12px" : "0" }}>
                                    <input
                                      type="checkbox"
                                      checked={isAllowed}
                                      onChange={() => updateFormArray("tools_allowed", tool)}
                                    />
                                    {tool}
                                  </label>
                                  {isAllowed && (
                                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-muted)", cursor: "pointer", borderLeft: "1px solid var(--background-modifier-border)", paddingLeft: "12px" }}>
                                      <input 
                                        type="checkbox"
                                        checked={requiresApproval}
                                        onChange={() => updateFormArray("tools_requiring_approval", tool)}
                                      />
                                      Require Approval
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ marginTop: "24px" }}>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            Allowed Skills
                          </label>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            {availableSkills.length === 0 ? (
                              <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No skills defined in vault.</div>
                            ) : availableSkills.map((skill) => {
                              const isAllowed = (formData.skills_allowed || []).includes(skill);
                              
                              return (
                                <div
                                  key={skill}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    background: "var(--background-secondary)",
                                    padding: "6px 12px",
                                    borderRadius: "16px",
                                    fontSize: "13px",
                                    border: "1px solid var(--background-modifier-border)",
                                  }}
                                >
                                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={isAllowed}
                                      onChange={() => updateFormArray("skills_allowed", skill)}
                                    />
                                    {skill}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ marginTop: "24px" }}>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            Memory (Context Bank)
                          </label>
                          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                            Specify files to inject into the agent's memory (e.g., `knowledge/rules.md`).
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {(formData.context_bank || []).map((path, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ flex: 1, padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "6px", border: "1px solid var(--background-modifier-border)", fontSize: "13px" }}>
                                  {path}
                                </div>
                                <button
                                  className="btn"
                                  onClick={() => {
                                    const newBank = [...(formData.context_bank || [])];
                                    newBank.splice(idx, 1);
                                    setFormData({ ...formData, context_bank: newBank });
                                  }}
                                  style={{ color: "#f05050" }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                              <FileSelector
                                vaultPath={vaultPath}
                                selectedFiles={formData.context_bank || []}
                                onChange={(paths) => {
                                  setFormData({ ...formData, context_bank: paths });
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: "24px" }}>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            Allowed Zones (RBAC)
                          </label>
                          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                            Restrict the agent's file system access to specific folders. If empty, the agent has unrestricted access. Note: <code style={{ fontSize: '12px' }}>run_command</code> will be disabled if zones are specified.
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {(formData.allowed_zones || []).map((zone, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ flex: 1, padding: "8px 12px", background: "var(--background-secondary)", borderRadius: "6px", border: "1px solid var(--background-modifier-border)", fontSize: "13px" }}>
                                  {zone.path}
                                </div>
                                <select 
                                    value={zone.permission}
                                    onChange={(e) => {
                                        const newZones = [...(formData.allowed_zones || [])];
                                        newZones[idx].permission = e.target.value;
                                        setFormData({ ...formData, allowed_zones: newZones });
                                    }}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--background-modifier-border)",
                                        background: "var(--background-secondary)",
                                        color: "var(--text-normal)",
                                        fontSize: "13px"
                                    }}
                                >
                                    <option value="read">Read</option>
                                    <option value="write">Write</option>
                                    <option value="read_preferred">Read Preferred</option>
                                    <option value="deny">Deny</option>
                                    <option value="append_only">Append Only</option>
                                </select>
                                <button
                                  className="btn"
                                  onClick={() => {
                                    const newZones = [...(formData.allowed_zones || [])];
                                    newZones.splice(idx, 1);
                                    setFormData({ ...formData, allowed_zones: newZones });
                                  }}
                                  style={{ color: "#f05050" }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                              <FileSelector
                                vaultPath={vaultPath}
                                selectedFiles={(formData.allowed_zones || []).map(z => z.path)}
                                directoriesOnly={true}
                                onChange={(paths) => {
                                  // Map new paths to default 'read' permission, preserve existing
                                  const existingZones = formData.allowed_zones || [];
                                  const newZones = paths.map(p => {
                                      const existing = existingZones.find(z => z.path === p);
                                      return existing ? existing : { path: p, permission: "read" };
                                  });
                                  setFormData({ ...formData, allowed_zones: newZones });
                                }}
                              />
                            </div>
                          </div>
                        </div>


                        <div style={{ marginTop: "16px" }}>
                          <button
                            className="btn primary"
                            onClick={handleSaveAgent}
                            disabled={
                              isSaving ||
                              !isDirty ||
                              !formData.name ||
                              !formData.system_prompt
                            }
                            style={{
                              background: (!isDirty || isSaving || !formData.name || !formData.system_prompt) ? "var(--background-modifier-hover)" : "var(--interactive-accent)",
                              color: (!isDirty || isSaving || !formData.name || !formData.system_prompt) ? "var(--text-muted)" : "white",
                              padding: "10px 24px",
                              transition: "all 0.2s ease-in-out",
                              cursor: (!isDirty || isSaving || !formData.name || !formData.system_prompt) ? "not-allowed" : "pointer",
                              opacity: (!isDirty || isSaving || !formData.name || !formData.system_prompt) ? 0.6 : 1,
                              transform: (isDirty && !isSaving && formData.name && formData.system_prompt) ? "scale(1.02)" : "scale(1)",
                              boxShadow: (isDirty && !isSaving && formData.name && formData.system_prompt) ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
                              fontWeight: "bold",
                            }}
                          >
                            {isSaving ? "Saving..." : "Save Agent"}
                          </button>
                        </div>
                      </div>
                      )}
                    </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
