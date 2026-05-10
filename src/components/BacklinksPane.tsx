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
    <div className="backlinks-card">
      <h3>Backlinks</h3>
      {backlinks.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No backlinks found.</p>
      ) : (
        <ul>
          {backlinks.map((link, i) => (
            <li key={i}>
              <button onClick={() => onNavigate(link.sourcePath)}>
                {link.sourcePath.split(/[/\\]/).pop()}
              </button>
              <span>"{link.originalText}"</span>
            </li>
          ))}
        </ul>
      )}

      {unlinkedMentions.length > 0 && (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Unlinked Mentions</h3>
          <ul>
            {unlinkedMentions.map((mention, i) => (
              <li key={i}>
                <button onClick={() => onNavigate(mention.targetPath)}>
                  {mention.targetPath.split(/[/\\]/).pop()}
                </button>
                <span>Mentioned as "{mention.label}"</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
