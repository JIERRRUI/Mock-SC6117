import { GoogleGenAI, Type } from "@google/genai";
import { Note, ClusterNode, SearchResult } from '../types';

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Auto-Clustering Logic ---

export const clusterNotesWithGemini = async (notes: Note[]): Promise<ClusterNode[]> => {
  const ai = getAIClient();
  
  // Prepare a lightweight representation of notes to save tokens
  const notesLite = notes.map(n => ({
    id: n.id,
    title: n.title,
    contentSnippet: n.content.substring(0, 200), // Only send first 200 chars
    tags: n.tags
  }));

  const prompt = `
    You are an expert knowledge manager. 
    Analyze the following list of notes and organize them into a hierarchical cluster structure.
    Create high-level categories based on the content themes (e.g., "Artificial Intelligence", "Cooking", "Web Development").
    Assign each note to the most relevant category.
    
    Notes:
    ${JSON.stringify(notesLite)}
  `;

  // We define a schema for the tree structure
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: "You are a helpful assistant that organizes knowledge.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['cluster'] },
            description: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING }, // Note title
                  type: { type: Type.STRING, enum: ['note'] },
                  noteId: { type: Type.STRING } // Reference to original note ID
                },
                required: ['id', 'name', 'type', 'noteId']
              }
            }
          },
          required: ['id', 'name', 'type', 'children']
        }
      }
    }
  });

  const jsonStr = response.text || "[]";
  try {
    return JSON.parse(jsonStr) as ClusterNode[];
  } catch (e) {
    console.error("Failed to parse clustering result", e);
    return [];
  }
};

// --- Semantic Search Logic ---

export const semanticSearchWithGemini = async (query: string, notes: Note[]): Promise<SearchResult[]> => {
  const ai = getAIClient();

  const notesLite = notes.map(n => ({
    id: n.id,
    title: n.title,
    summary: n.content.substring(0, 300)
  }));

  const prompt = `
    User Query: "${query}"

    Task: Rank the following notes based on their relevance to the user query.
    Return a list of the top relevant notes. 
    For each note, provide a relevance score (0-100) and a brief reasoning.
    If a note is not relevant, do not include it.

    Notes Data:
    ${JSON.stringify(notesLite)}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            noteId: { type: Type.STRING },
            score: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ['noteId', 'score', 'reason']
        }
      }
    }
  });

  const jsonStr = response.text || "[]";
  try {
    const rawResults = JSON.parse(jsonStr) as { noteId: string, score: number, reason: string }[];
    
    // Merge back with full note objects
    const results: SearchResult[] = rawResults
      .map((r): SearchResult | null => {
        const fullNote = notes.find(n => n.id === r.noteId);
        if (!fullNote) return null;
        return {
          note: fullNote,
          score: r.score,
          reason: r.reason
        };
      })
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.score - a.score);

    return results;
  } catch (e) {
    console.error("Semantic search failed", e);
    return [];
  }
};

// --- Content Correction Logic ---

export const correctTextWithGemini = async (text: string): Promise<string> => {
  const ai = getAIClient();
  const prompt = `
    You are a professional editor.
    Please correct the grammar, spelling, and punctuation of the following text.
    Correct any phonetic misspellings (e.g., "pronouciation" -> "pronunciation").
    Maintain the original markdown formatting.
    Do not add any conversational filler, just return the corrected text.
    
    Text to fix:
    ${text}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text?.trim() || text;
};
