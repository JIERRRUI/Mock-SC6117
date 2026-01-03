import { Note, SearchMode, SearchResult } from '../types';
import { semanticSearchWithGemini } from './geminiService';

export interface SearchOptions {
  mode: SearchMode;
  useRegex: boolean;
}

export interface SearchResultWithHighlight extends SearchResult {
  highlight?: string;
}

type IndexedNote = {
  note: Note;
  searchContent: string;
  rawContent: string;
};

type CachedSemanticResult = {
  noteId: string;
  score: number;
  reason?: string;
};

const semanticCache = new Map<string, CachedSemanticResult[]>();

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const generateHighlight = (text: string, matchIndex: number, matchLength: number): string => {
  const safeIndex = Math.max(0, matchIndex);
  const safeLength = Math.max(0, matchLength);
  const window = 30;
  const start = Math.max(0, safeIndex - window);
  const end = Math.min(text.length, safeIndex + safeLength + window);
  const snippet = text.slice(start, end);
  const relativeStart = safeIndex - start;
  const before = escapeHtml(snippet.slice(0, relativeStart));
  const match = escapeHtml(snippet.slice(relativeStart, relativeStart + safeLength));
  const after = escapeHtml(snippet.slice(relativeStart + safeLength));
  return `${before}<mark class="bg-yellow-500/30 text-yellow-200">${match}</mark>${after}`;
};

const indexNotes = (notes: Note[]): IndexedNote[] =>
  notes.map((note) => ({
    note,
    searchContent: `${note.title}\n${note.content}`.toLowerCase(),
    rawContent: `${note.title}\n${note.content}`,
  }));

const parseRegexFromQuery = (query: string, useRegex: boolean): RegExp | null => {
  if (!query) return null;

  if (query.startsWith('/') && query.lastIndexOf('/') > 0) {
    const lastSlash = query.lastIndexOf('/');
    const pattern = query.slice(1, lastSlash);
    const flags = query.slice(lastSlash + 1) || 'i';
    try {
      return new RegExp(pattern, flags);
    } catch (error) {
      console.warn('Invalid regex pattern, falling back to plain search', error);
      return null;
    }
  }

  if (useRegex) {
    try {
      return new RegExp(query, 'i');
    } catch (error) {
      console.warn('Invalid regex pattern, falling back to plain search', error);
      return null;
    }
  }

  return null;
};

const hydrateSemanticResults = (
  cached: CachedSemanticResult[],
  notes: Note[],
): SearchResultWithHighlight[] => {
  const noteMap = new Map(notes.map((n) => [n.id, n] as const));
  return cached
    .map((entry) => {
      const note = noteMap.get(entry.noteId);
      if (!note) return null;
      return {
        note,
        score: entry.score,
        reason: entry.reason,
      } as SearchResultWithHighlight;
    })
    .filter((value): value is SearchResultWithHighlight => Boolean(value));
};

const fetchSemanticResults = async (
  query: string,
  notes: Note[],
): Promise<SearchResultWithHighlight[]> => {
  const cached = semanticCache.get(query);
  if (cached) {
    return hydrateSemanticResults(cached, notes);
  }

  const fresh = await semanticSearchWithGemini(query, notes);
  semanticCache.set(
    query,
    fresh.map((result) => ({
      noteId: result.note.id,
      score: result.score,
      reason: result.reason,
    })),
  );
  return fresh;
};

export const executeExactSearch = (
  rawQuery: string,
  notes: Note[],
  options?: Partial<SearchOptions>,
): SearchResultWithHighlight[] => {
  const query = rawQuery.trim();
  if (!query) return [];

  const start = performance.now();
  const useRegex = options?.useRegex ?? false;
  const regex = parseRegexFromQuery(query, useRegex);
  const indexedNotes = indexNotes(notes);
  const lowerQuery = query.toLowerCase();

  const results: SearchResultWithHighlight[] = [];

  indexedNotes.forEach(({ note, searchContent, rawContent }) => {
    if (regex) {
      const match = rawContent.match(regex);
      if (match?.index !== undefined) {
        results.push({
          note,
          score: 100,
          highlight: generateHighlight(rawContent, match.index, match[0].length),
          reason: 'Regex exact match',
        });
      }
      return;
    }

    const index = searchContent.indexOf(lowerQuery);
    if (index !== -1) {
      results.push({
        note,
        score: 100,
        highlight: generateHighlight(rawContent, index, lowerQuery.length),
        reason: 'Exact match',
      });
    }
  });

  const duration = performance.now() - start;
  console.log(`[search] Exact search in ${duration.toFixed(2)}ms over ${notes.length} notes.`);
  return results;
};

export const executeHybridSearch = async (
  rawQuery: string,
  notes: Note[],
  options?: Partial<SearchOptions>,
): Promise<SearchResultWithHighlight[]> => {
  const query = rawQuery.trim();
  if (!query) return [];

  const mode = options?.mode ?? SearchMode.HYBRID;
  const useRegex = options?.useRegex ?? false;

  if (!navigator.onLine && mode !== SearchMode.SEMANTIC) {
    const offlineResults = executeExactSearch(query, notes, { mode: SearchMode.EXACT, useRegex });
    return offlineResults.map((result) => ({
      ...result,
      reason: result.reason ? `${result.reason} (Offline exact only)` : 'Offline exact only',
    }));
  }

  const start = performance.now();

  const exactPromise =
    mode === SearchMode.SEMANTIC
      ? Promise.resolve<SearchResultWithHighlight[]>([])
      : Promise.resolve(executeExactSearch(query, notes, { mode: SearchMode.EXACT, useRegex }));

  const semanticPromise =
    mode === SearchMode.EXACT ? Promise.resolve<SearchResultWithHighlight[]>([]) : fetchSemanticResults(query, notes);

  const [exactResults, semanticResults] = await Promise.all([exactPromise, semanticPromise]);

  const merged = new Map<string, SearchResultWithHighlight>();

  semanticResults.forEach((result) => {
    merged.set(result.note.id, { ...result });
  });

  exactResults.forEach((result) => {
    const existing = merged.get(result.note.id);
    if (existing) {
      const boostedScore = Math.max(existing.score, Math.max(result.score, 100));
      merged.set(result.note.id, {
        ...existing,
        score: boostedScore,
        reason: existing.reason ? `${existing.reason} | Exact Match` : 'Exact Match',
        highlight: result.highlight ?? existing.highlight,
      });
    } else {
      merged.set(result.note.id, { ...result });
    }
  });

  const combined = Array.from(merged.values()).sort((a, b) => b.score - a.score);
  const duration = performance.now() - start;
  console.log(`[search] Hybrid search (${mode}) in ${duration.toFixed(2)}ms over ${notes.length} notes.`);
  return combined;
};
