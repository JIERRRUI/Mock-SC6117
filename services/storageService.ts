import { Note } from '../types';

const DB_NAME = 'synapse_db';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

// Initial data to seed the database
const INITIAL_DATA: Note[] = [
  {
    id: '1',
    title: 'Transformer Architecture Basics',
    content: '# Transformers\n\nThe Transformer is a deep learning model that adopts the mechanism of self-attention, differentially weighting the significance of each part of the input data. It is used primarily in the fields of natural language processing (NLP) and computer vision (CV).',
    tags: ['ai', 'nlp', 'deep-learning'],
    createdAt: '2023-10-01',
    folder: '/knowledge/ai'
  },
  {
    id: '2',
    title: 'Attention Mechanisms Explained',
    content: '# Attention\n\nAttention is a technique in neural networks that mimics cognitive attention. The effect enhances the important parts of the input data and fades out the rest -- the thought being that the network should devote more computing power on that small but important part of the data.',
    tags: ['ai', 'nlp'],
    createdAt: '2023-10-02',
    folder: '/knowledge/ai'
  },
  {
    id: '3',
    title: 'Perfect Sourdough Bread',
    content: '# Sourdough Recipe\n\n1. Active starter\n2. Flour (Bread flour preferred)\n3. Water (75% hydration)\n4. Salt\n\nMix autolyse for 1 hour. Fold every 30 mins for 2 hours. Bulk ferment until doubled.',
    tags: ['cooking', 'bread'],
    createdAt: '2023-10-05',
    folder: '/personal/recipes'
  },
  {
    id: '4',
    title: 'React useEffect Hooks',
    content: '# useEffect\n\nThe `useEffect` hook allows you to perform side effects in function components. Data fetching, setting up a subscription, and manually changing the DOM in React components are all examples of side effects.',
    tags: ['coding', 'react', 'javascript'],
    createdAt: '2023-11-01',
    folder: '/work/frontend'
  },
  {
    id: '5',
    title: 'BERT vs GPT',
    content: '# Model Comparison\n\nBERT is bidirectional (good for understanding). GPT is autoregressive (good for generation). Both rely heavily on the Transformer architecture.',
    tags: ['ai', 'nlp'],
    createdAt: '2023-10-03',
    folder: '/knowledge/ai'
  },
  {
    id: '6',
    title: 'Optimizing React Rendering',
    content: '# Memoization\n\nUse `React.memo` for components, `useMemo` for expensive calculations, and `useCallback` for functions passed as props to prevent unnecessary re-renders.',
    tags: ['coding', 'react', 'performance'],
    createdAt: '2023-11-02',
    folder: '/work/frontend'
  },
  {
    id: '7',
    title: 'Carbonara Recipe',
    content: '# Authentic Carbonara\n\nIngredients: Guanciale, Pecorino Romano, Eggs, Black Pepper, Pasta.\n\nNO CREAM allowed. Cook pasta al dente. Mix eggs and cheese. Temper with pasta water.',
    tags: ['cooking', 'italian'],
    createdAt: '2023-10-10',
    folder: '/personal/recipes'
  },
  {
    id: '8',
    title: 'Vision Transformers (ViT)',
    content: '# ViT\n\nApplying the Transformer architecture to image classification. Images are split into patches, flattened, and treated as tokens similar to words in NLP.',
    tags: ['ai', 'vision'],
    createdAt: '2023-10-04',
    folder: '/knowledge/ai'
  },
  {
    id: '9',
    title: 'Typescript Generics',
    content: '# Generics\n\nGenerics allow you to create reusable components. \n\n```typescript\nfunction identity<T>(arg: T): T {\n  return arg;\n}\n```',
    tags: ['coding', 'typescript'],
    createdAt: '2023-11-05',
    folder: '/work/frontend'
  },
  {
    id: '10',
    title: 'Pizza Napoletana',
    content: '# Pizza Dough\n\n00 Flour, Water, Salt, Yeast. High heat (900F) for 60-90 seconds. Simple tomato sauce (San Marzano) and Mozzarella di Bufala.',
    tags: ['cooking', 'pizza'],
    createdAt: '2023-10-12',
    folder: '/personal/recipes'
  },
  {
    id: '11',
    title: 'Large Language Models (LLMs)',
    content: '# LLMs\n\nModels with billions of parameters trained on vast amounts of text. Emergent abilities include reasoning, coding, and translation.',
    tags: ['ai', 'nlp'],
    createdAt: '2023-10-06',
    folder: '/knowledge/ai'
  },
  {
    id: '12',
    title: 'Tailwind CSS Grid',
    content: '# Grid Layout\n\n`grid-cols-3` creates a 3 column grid. `gap-4` adds spacing. Great for responsive layouts.',
    tags: ['coding', 'css', 'tailwind'],
    createdAt: '2023-11-10',
    folder: '/work/frontend'
  },
  {
    id: '13',
    title: 'Self-Attention Math',
    content: '# The Math\n\nAttention(Q, K, V) = softmax(QK^T / sqrt(d_k))V. The dot product determines similarity between query and key.',
    tags: ['ai', 'math'],
    createdAt: '2023-10-07',
    folder: '/knowledge/ai'
  },
  {
    id: '14',
    title: 'Sous Vide Steak',
    content: '# Sous Vide\n\n129F for 2 hours for medium rare. Sear in cast iron skillet with butter and rosemary.',
    tags: ['cooking', 'meat'],
    createdAt: '2023-10-15',
    folder: '/personal/recipes'
  },
  {
    id: '15',
    title: 'Kubernetes Pods',
    content: '# Pods\n\nThe smallest deployable units of computing that you can create and manage in Kubernetes. A Pod is a group of one or more containers.',
    tags: ['devops', 'infrastructure'],
    createdAt: '2024-01-01',
    folder: '/work/devops'
  }
];

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Could not open database");
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        
        // Seed with mock data on first creation
        INITIAL_DATA.forEach(note => {
          objectStore.add(note);
        });
      }
    };
  });
};

export const getAllNotes = async (): Promise<Note[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by createdAt descending (newest first) by default
      const notes = request.result as Note[];
      notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(notes);
    };
    
    request.onerror = () => reject(request.error);
  });
};

export const saveNote = async (note: Note): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(note); // put handles both add and update

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteNote = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const bulkSaveNotes = async (notes: Note[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    let processed = 0;
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    notes.forEach(note => {
      store.put(note);
    });
  });
};