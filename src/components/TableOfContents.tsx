import React, { useMemo } from 'react';
import './TableOfContents.css';

interface TableOfContentsProps {
  content: string;
  activeHeadingId?: string;
  onNavigateHeader: (hash: string) => void;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content, activeHeadingId, onNavigateHeader }) => {
  const headings = useMemo(() => {
    // Only match markdown headings at the start of a line
    const regex = /^(#{1,6})\s+(.*)$/gm;
    let match;
    const items = [];
    while ((match = regex.exec(content)) !== null) {
      items.push({
        level: match[1].length,
        text: match[2],
        id: match[2].toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
      });
    }
    return items;
  }, [content]);

  if (headings.length === 0) {
    return (
      <div className="table-of-contents empty">
        <div className="toc-header">
          <h3 className="toc-title">Outline</h3>
        </div>
        <div className="toc-content" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          No headings found in document.
        </div>
      </div>
    );
  }

  return (
    <div className="table-of-contents">
      <div className="toc-header">
        <h3 className="toc-title">Outline</h3>
      </div>
      <div className="toc-content">
        <ul className="toc-list">
          {headings.map((heading, i) => (
            <li 
              key={i} 
              className={`toc-item toc-level-${heading.level} ${heading.id === activeHeadingId ? 'active' : ''}`} 
              onClick={() => onNavigateHeader(heading.id)}
              title={heading.text}
            >
              {heading.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TableOfContents;
