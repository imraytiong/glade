import { useEffect, useState } from 'react';
import { globalIndexer, LinkData } from '../utils/indexer';
import { useSettings } from '../utils/settings';

interface BacklinksPaneProps {
  activeFilePath: string;
  activeFileContent: string;
  onNavigate: (path: string) => void;
}

export default function BacklinksPane({ activeFilePath, activeFileContent, onNavigate }: BacklinksPaneProps) {
  const { settings } = useSettings();
  const [backlinks, setBacklinks] = useState<LinkData[]>([]);
  const [unlinkedMentions, setUnlinkedMentions] = useState<{ label: string, targetPath: string }[]>([]);

  useEffect(() => {
    if (!settings.showBacklinks) return;

    const update = () => {
      setBacklinks(globalIndexer.getBacklinks(activeFilePath));
      setUnlinkedMentions(globalIndexer.getUnlinkedMentions(activeFilePath, activeFileContent));
    };

    update();
    const unsubscribe = globalIndexer.subscribe(update);
    return unsubscribe;
  }, [activeFilePath, activeFileContent, settings.showBacklinks]);

  if (!settings.showBacklinks) return null;

  return (
    <div className="backlinks-pane" style={{ borderTop: '1px solid var(--border)', padding: '1rem', marginTop: 'auto', backgroundColor: 'var(--bg-secondary)', overflowY: 'auto', maxHeight: '30vh' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Backlinks</h3>
      {backlinks.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No backlinks found.</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
          {backlinks.map((link, i) => (
            <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <button 
                onClick={() => onNavigate(link.sourcePath)}
                style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                {link.sourcePath.split(/[/\\]/).pop()}
              </button>
              <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>"{link.originalText}"</span>
            </li>
          ))}
        </ul>
      )}

      {unlinkedMentions.length > 0 && (
        <>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', marginTop: '1rem', color: 'var(--text-primary)' }}>Unlinked Mentions</h3>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
            {unlinkedMentions.map((mention, i) => (
              <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <button 
                  onClick={() => onNavigate(mention.targetPath)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  {mention.targetPath.split(/[/\\]/).pop()}
                </button>
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Mentioned as "{mention.label}"</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
