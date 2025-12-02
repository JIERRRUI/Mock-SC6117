export interface Note {
  id: string;
  title: string;
  content: string; // Markdown content
  tags: string[];
  createdAt: string;
  folder: string; // Virtual folder path
}

export enum SearchMode {
  EXACT = 'EXACT', // Grep-style
  SEMANTIC = 'SEMANTIC', // LLM-based understanding
  HYBRID = 'HYBRID' // Both
}

export interface ClusterNode {
  id: string;
  name: string; // Cluster name or Note title
  type: 'cluster' | 'note';
  children?: ClusterNode[];
  noteId?: string; // If type is note
  description?: string; // Why this cluster exists
}

export interface SearchResult {
  note: Note;
  score: number;
  reason?: string; // Why matched (for semantic search)
  highlight?: string; // Snippet
}

export interface ProcessingStatus {
  isProcessing: boolean;
  message: string;
}