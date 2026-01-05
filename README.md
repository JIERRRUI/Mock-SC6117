# Synapse - Intelligent Knowledge Base

An AI-powered note-taking and knowledge management application that automatically organizes your notes into semantic clusters using Google's Gemini AI.

## Features

### 🧠 AI-Powered Clustering

- **Automatic Organization**: Notes are intelligently grouped into domains and subtopics based on content similarity
- **3-Level Hierarchy**: Root → Domains → Subtopics → Notes
- **Incremental Updates**: New notes are clustered efficiently without re-processing everything

### 🔍 Smart Search

- **Semantic Search**: Find notes using natural language queries
- **Exact Search**: Traditional text-based search
- **Hybrid Search**: Combines both approaches for best results

### 📊 Knowledge Graph Visualization

- **Interactive Graph**: Visualize relationships between notes and clusters
- **Zoom & Pan**: Navigate large knowledge bases easily
- **Color-Coded Nodes**: Distinguish domains, subtopics, and notes at a glance

### 📝 Note Management

- **Markdown Editor**: Write and format notes with live preview
- **File Import**: Import notes from various formats (HTML, text, etc.)
- **Offline Support**: Service worker caching for offline access
- **Auto-Save**: Notes are automatically saved as you type

## Tech Stack

- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **AI**: Google Gemini API (gemini-2.5-flash-lite)
- **Embeddings**: text-embedding-004 model
- **Storage**: IndexedDB for notes, LocalStorage for caching
- **Visualization**: D3.js for knowledge graph

## Getting Started

### Prerequisites

- Node.js (v18+)
- Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure API key:**
   Create or edit `.env.local` and add your Gemini API key:

   ```
   API_KEY=your_gemini_api_key_here
   ```

3. **Run the development server:**

   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
├── App.tsx                 # Main application component
├── components/
│   ├── ClusterGraph.tsx    # D3.js knowledge graph visualization
│   └── Icons.tsx           # SVG icon components
├── services/
│   ├── clusteringService.ts  # Note clustering and caching logic
│   ├── embeddingService.ts   # Vector embeddings generation
│   ├── geminiService.ts      # Gemini AI API interactions
│   ├── searchService.ts      # Search functionality
│   └── storageService.ts     # IndexedDB persistence
├── types.ts                # TypeScript type definitions
└── index.tsx               # Application entry point
```

## How It Works

### Clustering Pipeline

1. **Ingestion**: Notes are hashed to detect changes
2. **Embedding Generation**: Content is converted to vectors using Gemini
3. **Similarity Clustering**: Notes are grouped by embedding similarity
4. **LLM Enhancement**: Gemini generates meaningful cluster names
5. **Hierarchical Organization**: Clusters are organized into domains and subtopics

### Incremental Updates

When new notes are added:

1. Only new notes are processed (hash-based change detection)
2. Embeddings are generated for new content only
3. New notes are matched to existing clusters by similarity
4. If no good match, a new cluster is created with an appropriate name

## License

MIT
