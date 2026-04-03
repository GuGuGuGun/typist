import React, { useCallback, useEffect, useState } from 'react';
import { api, type SearchMatch } from '../api';
import { useStore } from '../store';
import { ChevronDown, ChevronUp, Replace, Search, X } from 'lucide-react';

export const FindReplacePanel: React.FC = () => {
  const isOpen = useStore(state => state.isFindReplaceOpen);
  const toggleOpen = useStore(state => state.toggleFindReplace);
  const activeTabId = useStore(state => state.activeTabId);
  const activeContent = useStore(state => state.activeContent);
  const setActiveContent = useStore(state => state.setActiveContent);
  const markTabDirty = useStore(state => state.markTabDirty);

  const [query, setQuery] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const buildSearchInput = () => {
    if (wholeWord) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return {
        query: useRegex ? query : `\\b${escaped}\\b`,
        isRegex: true,
      };
    }

    return {
      query,
      isRegex: useRegex,
    };
  };

  const buildSnippet = (content: string, start: number, end: number) => {
    const from = Math.max(0, start - 24);
    const to = Math.min(content.length, end + 24);
    const prefix = content.slice(from, start).replace(/\n/g, ' ');
    const hit = content.slice(start, end).replace(/\n/g, ' ');
    const suffix = content.slice(end, to).replace(/\n/g, ' ');
    return { prefix, hit, suffix };
  };

  const locateMatchInEditor = useCallback((match: SearchMatch) => {
    const editorScrollContainer = document.querySelector('.editor-area') as HTMLElement | null;
    if (editorScrollContainer && activeContent.length > 0) {
      const maxScroll = Math.max(0, editorScrollContainer.scrollHeight - editorScrollContainer.clientHeight);
      const ratio = Math.min(1, match.match_start / Math.max(1, activeContent.length));
      editorScrollContainer.scrollTo({
        top: ratio * maxScroll,
        behavior: 'smooth',
      });
    }

    const proseMirror = document.querySelector('.milkdown .ProseMirror');
    if (!proseMirror || !match.matched_text) return;

    const targetText = match.matched_text;
    const sameTextIndex =
      matches
        .slice(0, currentMatchIndex + 1)
        .filter((item) => item.matched_text === targetText).length - 1;

    const walker = document.createTreeWalker(proseMirror, NodeFilter.SHOW_TEXT);
    let encountered = 0;
    let node = walker.nextNode();

    while (node) {
      const textNode = node as Text;
      const text = textNode.textContent ?? '';
      let searchStart = 0;

      while (searchStart <= text.length) {
        const foundAt = text.indexOf(targetText, searchStart);
        if (foundAt === -1) break;

        if (encountered === sameTextIndex) {
          const range = document.createRange();
          range.setStart(textNode, foundAt);
          range.setEnd(textNode, foundAt + targetText.length);

          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);

          (range.startContainer.parentElement as HTMLElement | null)?.scrollIntoView({
            block: 'center',
            behavior: 'smooth',
          });
          return;
        }

        encountered += 1;
        searchStart = foundAt + Math.max(1, targetText.length);
      }

      node = walker.nextNode();
    }
  }, [activeContent.length, currentMatchIndex, matches]);

  useEffect(() => {
    if (!isOpen) return;
    if (currentMatchIndex < 0) return;

    const item = document.getElementById(`find-match-${currentMatchIndex}`);
    item?.scrollIntoView({ block: 'nearest' });

    const match = matches[currentMatchIndex];
    if (match) {
      locateMatchInEditor(match);
    }
  }, [isOpen, currentMatchIndex, matches, locateMatchInEditor]);

  if (!isOpen) return null;

  const goNextMatch = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const goPrevMatch = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const handleSearch = async () => {
    if (!activeTabId || !query) return;
    try {
      const search = buildSearchInput();
      const res = await api.searchInDocument({
        content: activeContent,
        query: search.query,
        case_sensitive: matchCase,
        is_regex: search.isRegex,
      });
      setMatches(res);
      setCurrentMatchIndex(res.length > 0 ? 0 : -1);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReplaceAll = async () => {
    if (!activeTabId || !query) return;
    try {
      const search = buildSearchInput();
      const res = await api.replaceInDocument({
        content: activeContent,
        query: search.query,
        replacement: replaceWith,
        is_regex: search.isRegex,
        case_sensitive: matchCase,
        replace_all: true,
      });
      setActiveContent(res.content);
      if (activeTabId) {
        await markTabDirty(activeTabId, true);
      }
      console.log(`Replaced ${res.replaced_count} occurrences`);
      setMatches([]);
      setCurrentMatchIndex(-1);
    } catch (e) {
      console.error(e);
    }
  };

  const currentMatch = currentMatchIndex >= 0 ? matches[currentMatchIndex] : null;

  return (
    <div className="find-panel" style={{ boxShadow: 'var(--shadow-float)', border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)', background: 'color-mix(in srgb, var(--bg-secondary) 85%, transparent)', backdropFilter: 'blur(24px)', padding: '16px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Find & Replace</span>
        <div className="modal-close" onClick={toggleOpen}><X size={14} /></div>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <input 
          style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
          placeholder="Find..." 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (e.shiftKey) {
              goPrevMatch();
            } else {
              if (matches.length > 0) {
                goNextMatch();
              } else {
                handleSearch();
              }
            }
          }}
        />
        <button className="default-btn" style={{ padding: '0 10px' }} onClick={handleSearch} title="Find"><Search size={14} /></button>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <input 
          style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
          placeholder="Replace..." 
          value={replaceWith} 
          onChange={e => setReplaceWith(e.target.value)}
        />
        <button className="default-btn" style={{ padding: '0 10px' }} onClick={handleReplaceAll} title="Replace All"><Replace size={14} /></button>
      </div>

      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> Case</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="checkbox" checked={wholeWord} onChange={e => setWholeWord(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> Word</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> Regex</label>
      </div>

      {matches.length > 0 && (
        <>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {currentMatchIndex + 1}/{matches.length}
              {currentMatch ? `  ·  Ln ${currentMatch.line}, Col ${currentMatch.column}` : ''}
            </span>
            <span style={{ display: 'inline-flex', gap: '4px' }}>
              <button className="titlebar-btn" onClick={goPrevMatch} title="Previous (Shift+Enter)">
                <ChevronUp size={14} />
              </button>
              <button className="titlebar-btn" onClick={goNextMatch} title="Next (Enter)">
                <ChevronDown size={14} />
              </button>
            </span>
          </div>

          <div style={{ maxHeight: '180px', overflowY: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {matches.slice(0, 30).map((item, index) => {
              const snippet = buildSnippet(activeContent, item.match_start, item.match_end);
              return (
                <div
                  id={`find-match-${index}`}
                  key={`${item.match_start}-${index}`}
                  onClick={() => setCurrentMatchIndex(index)}
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: index === currentMatchIndex ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    border: index === currentMatchIndex ? '1px solid var(--accent)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>
                    Ln {item.line}, Col {item.column}
                  </div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span>{snippet.prefix}</span>
                    <mark style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)', color: 'var(--text-primary)', padding: '0 2px', borderRadius: '2px' }}>
                      {snippet.hit}
                    </mark>
                    <span>{snippet.suffix}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
