import { useState, useEffect } from 'react';
import { Trash2, Save, Brain, Code } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import yaml from 'yaml';
import { GladeEditor } from '../Editor';

interface SkillInfo {
    id: string;
    name: string;
    description: string;
}

export default function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [prompt, setPrompt] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const parseSkillContent = (content: string, isNew: boolean = false) => {
      const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (match) {
          try {
              const fm = yaml.parse(match[1]);
              const newName = fm.name || '';
              setEditName(newName);
              setEditDescription(fm.description || '');
              setEditBody(match[2].trimStart());
              if (isNew && newName) {
                  const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                  setEditId(`agents/skills/${slug}`);
              }
          } catch (e) {
              setEditName('');
              setEditDescription('');
              setEditBody(content);
          }
      } else {
          setEditName('');
          setEditDescription('');
          setEditBody(content);
      }
      setEditorKey(prev => prev + 1);
  };

  const loadSkills = async () => {
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;
    setIsLoading(true);
    try {
        const loadedSkills = await invoke<SkillInfo[]>('get_available_skills', { vaultPath });
        setSkills(loadedSkills);
    } catch (e) {
        console.error("Failed to load skills", e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleSelectSkill = async (id: string) => {
    setSelectedSkill(id);
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;

    if (id.startsWith('new_skill_')) {
        setEditId(id);
        setEditName('New Skill');
        setEditDescription('A description of what this skill does');
        setEditBody('# Instructions\n\nDefine your standard operating procedure here.');
        setEditorKey(prev => prev + 1);
        return;
    }

    try {
        const { readTextFile } = await import('../../utils/fs');
        const skillDirName = id.replace('agents/skills/', '');
        const skillMd = `${vaultPath}/.glade/agents/skills/${skillDirName}/SKILL.md`;
        const content = await readTextFile(skillMd);
        setEditId(id);
        parseSkillContent(content, false);
    } catch (e) {
        console.error("Failed to read SKILL.md", e);
    }
  };

  const handleAddSkill = () => {
    const newId = `new_skill_${Date.now()}`;
    const newSkill: SkillInfo = {
        id: newId,
        name: 'New Skill',
        description: 'New skill template'
    };
    setSkills([...skills, newSkill]);
    handleSelectSkill(newId);
  };

  const handleDeleteSkill = async (id: string) => {
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;

    if (confirm(`Are you sure you want to delete ${id}?`)) {
        if (!id.startsWith('new_skill_')) {
            try {
                await invoke('delete_skill', { vaultPath, skillId: id });
            } catch (e) {
                console.error("Failed to delete skill", e);
                alert("Failed to delete skill: " + e);
                return;
            }
        }
        
        await loadSkills();
        if (selectedSkill === id) {
            setSelectedSkill(null);
            setEditId('');
            setEditName('');
            setEditDescription('');
            setEditBody('');
        }
    }
  };

  const handleSaveForm = async () => {
    if (!selectedSkill) return;
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;

    let targetId = editId;
    if (selectedSkill.startsWith('new_skill_') && targetId.startsWith('new_skill_')) {
        targetId = `agents/skills/skill_${Date.now()}`; 
    }

    try {
        const serializedFrontmatter = yaml.stringify({
            name: editName,
            description: editDescription
        });
        const finalContent = `---\n${serializedFrontmatter}---\n\n${editBody}`;
        
        await invoke('save_skill', { 
            vaultPath, 
            skillId: targetId, 
            content: finalContent 
        });
        
        if (selectedSkill !== targetId && !selectedSkill.startsWith('new_skill_')) {
            await invoke('delete_skill', { vaultPath, skillId: selectedSkill });
        }
        
        await loadSkills();
        setSelectedSkill(targetId);
        alert("Skill saved successfully!");
    } catch (e) {
        console.error("Failed to save skill", e);
        alert("Failed to save skill: " + e);
    }
  };

  const handleBuildSkill = async () => {
    if (!prompt.trim()) return;
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;

    setIsBuilding(true);
    try {
        const generatedContent = await invoke<string>('build_skill', { prompt, vaultPath });
        
        parseSkillContent(generatedContent, true);
        setPrompt('');
    } catch (e) {
        console.error("Failed to build skill", e);
        alert("Failed to build skill: " + e);
    } finally {
        setIsBuilding(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", color: "var(--text-normal)" }}>
            Skills
          </h1>
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ 
            width: '280px', 
            borderRight: '1px solid var(--background-modifier-border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--background-secondary)'
        }}>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {isLoading ? (
                    <div style={{ padding: '16px', color: 'var(--text-muted)' }}>Loading...</div>
                ) : skills.map(skill => (
                    <div 
                        key={skill.id}
                        onClick={() => handleSelectSkill(skill.id)}
                        style={{
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            background: selectedSkill === skill.id ? 'var(--background-modifier-active)' : 'transparent',
                            borderBottom: '1px solid var(--background-modifier-border)'
                        }}
                    >
                        <Brain size={16} color="var(--text-accent)" />
                        <span style={{ 
                            color: 'var(--text-normal)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>{skill.name}</span>
                    </div>
                ))}
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--background-modifier-border)' }}>
                <button 
                    className="btn"
                    onClick={handleAddSkill}
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    + Create New Skill
                </button>
            </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--background-primary)', overflowY: 'auto' }}>
            {!selectedSkill ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Select a skill from the sidebar or create a new one.
                </div>
            ) : (
                <div style={{ padding: '32px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
                    {selectedSkill.startsWith('new_skill_') && (
                        <div style={{ marginBottom: '32px', padding: '24px', background: 'var(--background-secondary)', borderRadius: '8px', border: '1px solid var(--background-modifier-border)' }}>
                            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-normal)' }}>Build with AI</h3>
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the skill you want to create..."
                                style={{
                                    width: '100%', height: '80px', padding: '12px', background: 'var(--background-primary)',
                                    border: '1px solid var(--background-modifier-border)', borderRadius: '6px',
                                    color: 'var(--text-normal)', fontSize: '14px', resize: 'vertical', marginBottom: '16px'
                                }}
                            />
                            <button 
                                className="btn"
                                onClick={handleBuildSkill}
                                disabled={isBuilding || !prompt.trim()}
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                {isBuilding ? 'Building...' : 'Build with AI'}
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skill Name</label>
                            <input 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-primary)', color: 'var(--text-normal)', fontSize: '16px', fontWeight: 'bold' }} 
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skill ID (Folder Name)</label>
                            <input 
                                value={editId} 
                                onChange={e => setEditId(e.target.value)} 
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-primary)', color: 'var(--text-normal)', fontSize: '16px' }} 
                            />
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Standard format: `agents/skills/[name]`</p>
                        </div>
                    </div>
                    
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                        <textarea 
                            value={editDescription} 
                            onChange={e => setEditDescription(e.target.value)} 
                            style={{ width: '100%', height: '60px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-primary)', color: 'var(--text-normal)', fontSize: '14px', resize: 'vertical' }} 
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '32px' }}>
                        <button 
                            onClick={() => handleDeleteSkill(selectedSkill)} 
                            style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-error)', border: '1px solid var(--text-error)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        >
                            <Trash2 size={16} />Delete
                        </button>
                        <button 
                            onClick={handleSaveForm} 
                            style={{ padding: '8px 16px', background: 'var(--interactive-accent)', color: 'white', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        >
                            <Save size={16} />Save
                        </button>
                    </div>

                    <div>
                        <label style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Code size={14} /> Instructions Body
                        </label>
                        <div style={{ border: '1px solid var(--background-modifier-border)', borderRadius: '8px', background: 'var(--background-primary)', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                            <GladeEditor 
                                key={editorKey}
                                initialContent={editBody} 
                                onSave={setEditBody} 
                                fileName="SKILL.md" 
                                filePath="" 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
