import { useState, useEffect } from 'react';
import { Trash2, Save, Brain, Code } from 'lucide-react';

interface SkillDef {
    code: string;
}

export default function SkillsPanel() {
  const [skills, setSkills] = useState<Record<string, SkillDef>>({});
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  useEffect(() => {
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (vaultPath) {
        import('../../utils/fs').then(({ readTextFile, exists }) => {
            const skillsPath = `${vaultPath}/.glade/skills.json`;
            exists(skillsPath).then((doesExist: boolean) => {
                if (doesExist) {
                    readTextFile(skillsPath).then((content: string) => {
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed.skills) {
                                setSkills(parsed.skills);
                            }
                        } catch (e) {
                            console.error("Failed to parse skills.json", e);
                        }
                    }).catch(console.error);
                }
            });
        });
    }
  }, []);

  const handleSaveSkills = async (newSkillsState: Record<string, SkillDef>) => {
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;
    
    const jsonStr = JSON.stringify({ skills: newSkillsState }, null, 2);
    const { writeTextFile } = await import('../../utils/fs');
    await writeTextFile(`${vaultPath}/.glade/skills.json`, jsonStr);
    
    setSkills(newSkillsState);
  };

  const handleSelectSkill = (id: string) => {
    setSelectedSkill(id);
    setEditName(id);
    setEditCode(skills[id].code);
  };

  const handleAddSkill = () => {
    const newId = `new_skill_${Date.now()}`;
    const newSkills = { ...skills, [newId]: { code: '## New Skill\nDefine your standard operating procedure here.' } };
    handleSaveSkills(newSkills).then(() => {
        handleSelectSkill(newId);
    });
  };

  const handleDeleteSkill = (id: string) => {
    if (confirm(`Are you sure you want to delete ${id}?`)) {
        const newSkills = { ...skills };
        delete newSkills[id];
        handleSaveSkills(newSkills).then(() => {
            if (selectedSkill === id) {
                setSelectedSkill(null);
                setEditName('');
                setEditCode('');
            }
        });
    }
  };

  const handleSaveForm = () => {
    if (!selectedSkill) return;
    
    const newSkills = { ...skills };
    
    if (editName !== selectedSkill) {
        delete newSkills[selectedSkill];
    }
    
    newSkills[editName] = {
        code: editCode
    };
    
    handleSaveSkills(newSkills).then(() => {
        setSelectedSkill(editName);
    });
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
        {/* Left Sidebar - Master List */}
        <div style={{ 
            width: '280px', 
            borderRight: '1px solid var(--background-modifier-border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--background-secondary)'
        }}>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {Object.keys(skills).map(id => (
                    <div 
                        key={id}
                        onClick={() => handleSelectSkill(id)}
                        style={{
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            background: selectedSkill === id ? 'var(--background-modifier-active)' : 'transparent',
                            borderBottom: '1px solid var(--background-modifier-border)'
                        }}
                    >
                        <Brain size={16} color="var(--text-accent)" />
                        <span style={{ 
                            color: 'var(--text-normal)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>{id}</span>
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

        {/* Right Area - Detail View */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--background-primary)', overflowY: 'auto' }}>
            {!selectedSkill ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Select a skill from the sidebar or create a new one.
                </div>
            ) : (
                <div style={{ padding: '32px', maxWidth: '800px', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div style={{ flex: 1, marginRight: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skill Name (ID)</label>
                            <input 
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--background-modifier-border)',
                                    background: 'var(--background-primary)',
                                    color: 'var(--text-normal)',
                                    fontSize: '16px',
                                    fontWeight: 'bold'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button 
                                onClick={() => handleDeleteSkill(selectedSkill)}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    color: 'var(--text-error)',
                                    border: '1px solid var(--text-error)',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                            <button 
                                onClick={handleSaveForm}
                                style={{
                                    padding: '8px 16px',
                                    background: 'var(--interactive-accent)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Save size={16} />
                                Save
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={{ marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Code size={14} />
                            Skill Logic (Markdown / Text)
                        </label>
                        <textarea
                            value={editCode}
                            onChange={e => setEditCode(e.target.value)}
                            style={{
                                width: '100%',
                                minHeight: '400px',
                                padding: '16px',
                                borderRadius: '6px',
                                border: '1px solid var(--background-modifier-border)',
                                background: '#1e1e1e',
                                color: '#d4d4d4',
                                fontFamily: 'monospace',
                                fontSize: '14px',
                                resize: 'vertical'
                            }}
                            placeholder="Write your SOP or skill definition here..."
                        />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
