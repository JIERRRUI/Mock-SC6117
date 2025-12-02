import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Note, SearchMode, SearchResult, ProcessingStatus, ClusterNode } from './types';
import { MOCK_NOTES } from './constants';
import { clusterNotesWithGemini, semanticSearchWithGemini, correctTextWithGemini } from './services/geminiService';
import { SearchIcon, FileTextIcon, NetworkIcon, ZapIcon, LayersIcon, ChevronRightIcon, ChevronDownIcon, FolderIcon, WifiOffIcon, UploadCloudIcon, XIcon, PlusIcon, WandIcon, TrashIcon } from './components/Icons';
import ClusterGraph from './components/ClusterGraph';

// --- Helper Component: Search Result Item ---

interface SearchResultItemProps { 
  result: SearchResult; 
  onClick: () => void; 
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({ 
  result, 
  onClick 
}) => (
  <div 
    onClick={onClick}
    className="p-3 mb-2 rounded bg-surface border border-border hover:border-primary cursor-pointer transition-colors group"
  >
    <div className="flex justify-between items-start">
      <h4 className="font-semibold text-text group-hover:text-primary transition-colors">{result.note.title}</h4>
      <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-muted">
        {Math.round(result.score)}{result.reason ? '/100' : ''}
      </span>
    </div>
    <div className="text-sm text-muted mt-1 line-clamp-2">
      {result.note.content.substring(0, 150)}...
    </div>
    {result.reason && (
      <div className="mt-2 text-xs text-secondary bg-secondary/10 p-2 rounded border border-secondary/20">
        <span className="font-bold">AI Reason:</span> {result.reason}
      </div>
    )}
    <div className="mt-2 flex gap-2">
      {result.note.tags.map(tag => (
        <span key={tag} className="text-[10px] uppercase font-bold tracking-wider text-muted bg-border/50 px-1.5 py-0.5 rounded">
          {tag}
        </span>
      ))}
    </div>
  </div>
);

// --- Helper Component: File Tree Node ---

interface FileTreeNodeProps { 
  node: ClusterNode; 
  depth?: number; 
  activeId?: string; 
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  node, 
  depth = 0, 
  activeId, 
  onSelect,
  onDelete
}) => {
  const [expanded, setExpanded] = useState(true);
  
  if (node.type === 'note') {
    return (
      <div 
        onClick={() => node.noteId && onSelect(node.noteId)}
        className={`group flex items-center gap-2 py-1 px-2 cursor-pointer text-sm transition-colors ${activeId === node.noteId ? 'bg-primary/20 text-primary' : 'text-muted hover:text-text hover:bg-white/5'}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <FileTextIcon className="w-4 h-4 opacity-70" />
        <span className="truncate flex-1">{node.name}</span>
        {node.noteId && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete(node.noteId!);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 text-muted transition-all rounded"
                title="Delete note"
            >
                <TrashIcon className="w-3 h-3" />
            </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 py-1 px-2 cursor-pointer text-sm text-text hover:bg-white/5 transition-colors font-medium select-none"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {expanded ? <ChevronDownIcon className="w-4 h-4 text-muted" /> : <ChevronRightIcon className="w-4 h-4 text-muted" />}
        <FolderIcon className="w-4 h-4 text-primary" />
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode 
              key={child.id} 
              node={child} 
              depth={depth + 1} 
              activeId={activeId} 
              onSelect={onSelect} 
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Helper Component: Upload Modal ---

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: FileList) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>
        
        <div className="p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
            <UploadCloudIcon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-text mb-2">Import Notes</h2>
          <p className="text-muted text-sm mb-8">
            Upload .md or .txt files to add them to your knowledge base.
          </p>

          <div 
            className={`border-2 border-dashed rounded-lg p-10 transition-colors cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-white/5'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              multiple 
              accept=".md,.txt,.markdown"
              onChange={(e) => {
                if (e.target.files) onUpload(e.target.files);
              }}
            />
            <p className="text-sm font-medium text-text">Click to browse or drag files here</p>
            <p className="text-xs text-muted mt-2">Supports Markdown & Text</p>
          </div>
        </div>
        <div className="bg-black/20 p-4 text-center text-xs text-muted border-t border-border">
          Processed locally in your browser
        </div>
      </div>
    </div>
  );
};


const App = () => {
  // State
  const [notes, setNotes] = useState<Note[]>(MOCK_NOTES);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>(SearchMode.EXACT);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, message: '' });
  const [viewMode, setViewMode] = useState<'editor' | 'graph'>('editor');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // Clustering State
  const [clusters, setClusters] = useState<ClusterNode[]>([]);
  const [hasClustered, setHasClustered] = useState(false);

  // Derived State
  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [activeNoteId, notes]);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      // Auto-switch to exact search if offline
      if (searchMode !== SearchMode.EXACT) {
        setSearchMode(SearchMode.EXACT);
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [searchMode]);

  // Handlers
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (!isOnline && searchMode !== SearchMode.EXACT) {
      setSearchMode(SearchMode.EXACT);
      // Fallthrough to exact search
    }

    setStatus({ isProcessing: true, message: 'Searching...' });
    
    try {
      let results: SearchResult[] = [];

      if (searchMode === SearchMode.EXACT) {
        // Grep-style local search
        const lowerQ = searchQuery.toLowerCase();
        results = notes
          .filter(n => n.title.toLowerCase().includes(lowerQ) || n.content.toLowerCase().includes(lowerQ))
          .map(n => ({ note: n, score: 100 }));
      } else {
        // Semantic Search via Gemini
        setStatus({ isProcessing: true, message: 'Consulting Gemini for semantic matches...' });
        results = await semanticSearchWithGemini(searchQuery, notes);
      }

      setSearchResults(results);
    } catch (e) {
      console.error(e);
      alert('Search failed. Check console.');
    } finally {
      setStatus({ isProcessing: false, message: '' });
    }
  }, [searchQuery, searchMode, notes, isOnline]);

  // Debounce simple search
  useEffect(() => {
    if (searchMode === SearchMode.EXACT) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchMode, handleSearch]);

  // Trigger Semantic Search on Enter or Button
  const triggerSemanticSearch = () => {
    if (searchMode !== SearchMode.EXACT && isOnline) {
      handleSearch();
    }
  };

  const handleCluster = async () => {
    if (!isOnline) return;
    setStatus({ isProcessing: true, message: 'AI is organizing your knowledge base...' });
    try {
      const clusterData = await clusterNotesWithGemini(notes);
      setClusters(clusterData);
      setHasClustered(true);
      setViewMode('graph');
    } catch (e) {
      console.error(e);
      alert('Clustering failed');
    } finally {
      setStatus({ isProcessing: false, message: '' });
    }
  };

  const processFiles = async (files: FileList) => {
    setIsUploadModalOpen(false);
    setStatus({ isProcessing: true, message: 'Importing notes...' });
    
    const newNotes: Note[] = [];
    const dateStr = new Date().toISOString().split('T')[0];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          const text = await file.text();
          // Extract title from first line if it starts with #
          const firstLine = text.split('\n')[0].trim();
          let title = file.name.replace(/\.(md|txt)$/, '');
          if (firstLine.startsWith('# ')) {
            title = firstLine.substring(2);
          }
          
          newNotes.push({
            id: `imported-${Date.now()}-${i}`,
            title,
            content: text,
            tags: ['imported'],
            createdAt: dateStr,
            folder: '/uploads'
          });
        }
      }
      
      if (newNotes.length > 0) {
        setNotes(prev => [...prev, ...newNotes]);
        // Reset clustering if data changed
        if (hasClustered) {
          setHasClustered(false);
          setClusters([]); // Optional: clear clusters to force re-cluster
        }
      }
    } catch (error) {
      console.error("Error reading files", error);
      alert("Failed to import some files.");
    } finally {
      setStatus({ isProcessing: false, message: '' });
    }
  };

  // --- CRUD & AI Operations ---

  const handleCreateNote = () => {
    const newNote: Note = {
      id: `new-${Date.now()}`,
      title: 'Untitled Note',
      content: '# New Note\n\nStart typing here...',
      tags: [],
      createdAt: new Date().toISOString().split('T')[0],
      folder: '/drafts'
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setViewMode('editor');
    // Invalidate clustering since we added a node
    if (hasClustered) {
        setHasClustered(false);
        setClusters([]);
    }
  };

  const handleUpdateNote = (id: string, field: 'title' | 'content', value: string) => {
    setNotes(prev => prev.map(note => 
      note.id === id ? { ...note, [field]: value } : note
    ));
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
        setNotes(prev => prev.filter(n => n.id !== id));
        if (activeNoteId === id) {
            setActiveNoteId(null);
        }
        // Invalidate clusters as the data has changed
        if (hasClustered) {
            setHasClustered(false);
            setClusters([]);
        }
    }
  };

  const handleAICorrect = async () => {
    if (!activeNote || !isOnline) return;
    setStatus({ isProcessing: true, message: 'Fixing grammar and spelling...' });
    try {
      const correctedText = await correctTextWithGemini(activeNote.content);
      handleUpdateNote(activeNote.id, 'content', correctedText);
    } catch (e) {
      console.error("Correction failed", e);
      alert("AI Correction failed.");
    } finally {
      setStatus({ isProcessing: false, message: '' });
    }
  };

  // --- Rendering ---

  const renderContent = () => {
    if (status.isProcessing && viewMode === 'graph' && !clusters.length) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p>{status.message}</p>
        </div>
      );
    }

    if (viewMode === 'graph' && clusters.length > 0) {
      return (
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <NetworkIcon className="text-primary" /> Knowledge Graph
            </h2>
            <button 
              onClick={() => setViewMode('editor')}
              className="text-sm text-muted hover:text-text"
            >
              Close Graph
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ClusterGraph 
              clusters={clusters} 
              onNoteSelect={(id) => {
                setActiveNoteId(id);
                setViewMode('editor');
              }} 
            />
          </div>
        </div>
      );
    }

    if (activeNote) {
      return (
        <div className="h-full flex flex-col max-w-3xl mx-auto w-full p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-muted">
                    <span>{activeNote.folder}</span>
                    <span>/</span>
                    <span>{activeNote.createdAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isOnline && (
                      <button 
                          onClick={handleAICorrect}
                          disabled={status.isProcessing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors text-xs font-medium border border-secondary/20"
                          title="Fix grammar, spelling and punctuation"
                      >
                        <WandIcon className="w-3 h-3" />
                        {status.isProcessing && status.message.includes('Fixing') ? 'Polishing...' : 'AI Fix Grammar'}
                      </button>
                  )}
                  <button 
                    onClick={() => handleDeleteNote(activeNote.id)}
                    className="p-1.5 rounded-full hover:bg-red-500/10 hover:text-red-400 text-muted transition-colors"
                    title="Delete Note"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
            </div>
            
            <input 
              className="w-full bg-transparent text-4xl font-bold text-text mb-4 focus:outline-none placeholder-gray-600"
              value={activeNote.title}
              onChange={(e) => handleUpdateNote(activeNote.id, 'title', e.target.value)}
              placeholder="Note Title"
            />

            <div className="flex gap-2 mb-6">
              {activeNote.tags.map(tag => (
                <span key={tag} className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary uppercase tracking-wide">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 h-full">
            <textarea 
              className="w-full h-full bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-300"
              value={activeNote.content}
              onChange={(e) => handleUpdateNote(activeNote.id, 'content', e.target.value)}
              placeholder="Write your note here..."
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-muted opacity-50">
        <LayersIcon className="w-16 h-16 mb-4" />
        <p>Select a note or search to begin</p>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-background text-text overflow-hidden">
      
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUpload={processFiles} 
      />

      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white mb-1">
              <ZapIcon className="text-yellow-400 fill-current" /> Synapse
            </div>
            {!isOnline && (
              <div className="group relative">
                <WifiOffIcon className="w-4 h-4 text-red-500" />
                <div className="absolute left-full ml-2 top-0 bg-black text-xs p-1 rounded whitespace-nowrap hidden group-hover:block z-50">
                  Offline Mode
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted">Intelligent Knowledge Base</p>
        </div>

        {/* Action Bar */}
        <div className="p-2 border-b border-border grid grid-cols-2 gap-2">
           <button 
             onClick={handleCreateNote}
             className="col-span-2 flex items-center justify-center gap-2 p-2 rounded text-xs font-bold transition-all bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-900/20"
          >
            <PlusIcon className="w-3 h-3" />
            New Note
          </button>
          <button 
             onClick={() => setIsUploadModalOpen(true)}
             className="flex items-center justify-center gap-2 p-2 rounded text-xs font-bold transition-all bg-white/5 hover:bg-white/10 text-muted hover:text-white"
          >
            <UploadCloudIcon className="w-3 h-3" />
            Import
          </button>
          <button 
            onClick={handleCluster}
            disabled={status.isProcessing || !isOnline}
            className={`flex items-center justify-center gap-2 p-2 rounded text-xs font-bold transition-all ${
              viewMode === 'graph' ? 'bg-secondary text-white' : 
              !isOnline ? 'bg-white/5 text-muted cursor-not-allowed opacity-50' :
              'bg-white/5 hover:bg-white/10 text-muted'
            }`}
            title={!isOnline ? "Unavailable offline" : "Cluster AI"}
          >
            <NetworkIcon className="w-3 h-3" />
            {status.isProcessing && !hasClustered ? 'Thinking...' : !isOnline ? 'Offline' : 'Cluster AI'}
          </button>
        </div>

        {/* File Explorer (Auto-generated from clusters or flat list) */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 pl-2">
            {clusters.length > 0 ? 'AI Clusters' : 'Files'}
          </div>
          
          {clusters.length > 0 ? (
            <div className="space-y-1">
              {clusters.map(cluster => (
                <FileTreeNode 
                  key={cluster.id} 
                  node={cluster} 
                  activeId={activeNoteId || ''} 
                  onSelect={(id) => {
                    setActiveNoteId(id);
                    setViewMode('editor');
                  }} 
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          ) : (
             // Fallback flat list grouped manually by folder just for display
             <div className="space-y-1 pl-2">
               {notes.map(note => (
                 <div 
                   key={note.id}
                   onClick={() => { setActiveNoteId(note.id); setViewMode('editor'); }}
                   className={`group flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm ${activeNoteId === note.id ? 'bg-primary/20 text-primary' : 'text-muted hover:text-text'}`}
                 >
                   <FileTextIcon className="w-4 h-4 opacity-70" />
                   <span className="truncate flex-1">{note.title}</span>
                   <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteNote(note.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 text-muted transition-all rounded z-10"
                        title="Delete note"
                    >
                        <TrashIcon className="w-3 h-3" />
                    </button>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Search Bar */}
        <div className="h-16 border-b border-border flex items-center px-6 gap-4 bg-background/50 backdrop-blur-sm z-20 sticky top-0">
          <div className="relative flex-1 max-w-2xl group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className={`w-5 h-5 transition-colors ${status.isProcessing ? 'text-primary animate-pulse' : 'text-muted group-focus-within:text-text'}`} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && triggerSemanticSearch()}
              placeholder={searchMode === SearchMode.EXACT ? "Grep search..." : "Ask your knowledge base..."}
              className="block w-full pl-10 pr-3 py-2 bg-surface border border-border rounded-lg leading-5 text-text placeholder-gray-500 focus:outline-none focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm transition-all"
            />
            {searchQuery && (
              <div className="absolute right-2 top-2">
                <span className="text-xs bg-border px-1.5 py-0.5 rounded text-muted">Enter</span>
              </div>
            )}
          </div>

          <div className="flex bg-surface rounded-lg p-1 border border-border">
            <button
              onClick={() => setSearchMode(SearchMode.EXACT)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${searchMode === SearchMode.EXACT ? 'bg-border text-white shadow-sm' : 'text-muted hover:text-text'}`}
            >
              Exact
            </button>
            <button
              onClick={() => isOnline && setSearchMode(SearchMode.HYBRID)}
              disabled={!isOnline}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                searchMode === SearchMode.HYBRID ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-sm' : 
                !isOnline ? 'text-muted/50 cursor-not-allowed' : 'text-muted hover:text-text'
              }`}
              title={!isOnline ? "Unavailable offline" : "Enable Semantic AI Search"}
            >
              <ZapIcon className="w-3 h-3" /> AI Hybrid
            </button>
          </div>
        </div>

        {/* Search Results Dropdown / Overlay */}
        {searchQuery && searchResults.length > 0 && (
          <div className="bg-background/95 backdrop-blur border-b border-border p-4 max-h-64 overflow-y-auto shadow-2xl z-10">
            <div className="text-xs uppercase font-bold text-muted mb-2 tracking-wider">Top Results</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map(result => (
                <SearchResultItem 
                  key={result.note.id} 
                  result={result} 
                  onClick={() => {
                    setActiveNoteId(result.note.id);
                    setSearchQuery(''); // Clear search on select to show content
                    setSearchResults([]);
                    setViewMode('editor');
                  }} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto relative">
           {renderContent()}
        </div>

      </div>
    </div>
  );
};

export default App;