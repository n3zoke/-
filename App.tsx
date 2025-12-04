import React, { useState, useEffect } from 'react';
import { generateStory, generateStoryImage } from './services/geminiService';
import { StoryParams, StoryState, SavedStory } from './types';
import StoryForm from './components/StoryForm';
import StoryViewer from './components/StoryViewer';
import SavedStoriesList from './components/SavedStoriesList';
import { Sparkles, Library, Moon, Sun, BookOpenText } from 'lucide-react';

const STORAGE_KEY = 'hakayat_stories';
const THEME_KEY = 'hakayat_theme';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'library'>('home');
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  
  // Track context of the current story
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  const [state, setState] = useState<StoryState>({
    isLoading: false,
    error: null,
    data: null,
    generatedImage: null,
    isGeneratingImage: false,
  });

  // Load saved stories and theme on mount
  useEffect(() => {
    const storedStories = localStorage.getItem(STORAGE_KEY);
    if (storedStories) {
      try {
        setSavedStories(JSON.parse(storedStories));
      } catch (e) {
        console.error("Failed to parse saved stories", e);
      }
    }

    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  };

  const handleCreateStory = async (params: StoryParams) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, data: null, generatedImage: null }));
    setCurrentStoryId(null);
    setBookmarks([]);
    
    try {
      const story = await generateStory(params);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        data: story 
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: err.message || 'حدث خطأ غير متوقع' 
      }));
    }
  };

  const handleGenerateImage = async () => {
    if (!state.data?.imagePrompt) return;

    setState(prev => ({ ...prev, isGeneratingImage: true }));
    try {
      const imageBase64 = await generateStoryImage(state.data.imagePrompt + ", storybook illustration style, high quality, warm lighting, digital art, detailed");
      setState(prev => ({ 
        ...prev, 
        isGeneratingImage: false, 
        generatedImage: imageBase64 
      }));
      
      // If story is already saved, update the image in storage immediately
      if (currentStoryId) {
        const updatedStories = savedStories.map(s => 
            s.id === currentStoryId ? { ...s, imageSrc: imageBase64 } : s
        );
        setSavedStories(updatedStories);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStories));
      }

    } catch (err: any) {
       console.error(err);
       alert("عذراً، تعذر إنشاء الصورة حالياً.");
       setState(prev => ({ ...prev, isGeneratingImage: false }));
    }
  };

  const handleReset = () => {
    setState({
      isLoading: false,
      error: null,
      data: null,
      generatedImage: null,
      isGeneratingImage: false,
    });
    setCurrentStoryId(null);
    setBookmarks([]);
    setView('home');
  };

  const handleSaveStory = () => {
    if (!state.data) return;

    // Check if already saved by ID
    if (currentStoryId) {
        // Update existing
        const updatedStories = savedStories.map(s => 
            s.id === currentStoryId ? { ...s, bookmarks: bookmarks, imageSrc: state.generatedImage } : s
        );
        setSavedStories(updatedStories);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStories));
        alert("تم تحديث القصة المحفوظة!");
        return;
    }

    // Check if duplicate content (fallback check)
    const isDuplicate = savedStories.some(
        s => s.story.title === state.data?.title && s.story.content.length === state.data?.content.length
    );

    if (isDuplicate) {
        alert("هذه القصة محفوظة مسبقاً في مكتبتك.");
        return;
    }

    const newId = Date.now().toString();
    const newStory: SavedStory = {
      id: newId,
      createdAt: Date.now(),
      story: state.data,
      imageSrc: state.generatedImage,
      bookmarks: bookmarks
    };

    const updatedStories = [newStory, ...savedStories];
    setSavedStories(updatedStories);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStories));
    setCurrentStoryId(newId);
    alert("تم حفظ القصة في مكتبتك بنجاح!");
  };

  const handleDeleteStory = (id: string) => {
    if (window.confirm("هل أنت متأكد من حذف هذه القصة؟")) {
        const updatedStories = savedStories.filter(s => s.id !== id);
        setSavedStories(updatedStories);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStories));
        
        if (currentStoryId === id) {
            handleReset();
        }
    }
  };

  const handleSelectStory = (saved: SavedStory) => {
    setState({
        isLoading: false,
        error: null,
        data: saved.story,
        generatedImage: saved.imageSrc,
        isGeneratingImage: false,
    });
    setCurrentStoryId(saved.id);
    setBookmarks(saved.bookmarks || []);
    setView('home');
  };

  const handleToggleBookmark = (index: number) => {
    const newBookmarks = bookmarks.includes(index)
        ? bookmarks.filter(i => i !== index)
        : [...bookmarks, index];
    
    setBookmarks(newBookmarks);

    // Persist immediately if story is already saved
    if (currentStoryId) {
        const updatedStories = savedStories.map(s => 
            s.id === currentStoryId ? { ...s, bookmarks: newBookmarks } : s
        );
        setSavedStories(updatedStories);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStories));
    }
  };

  return (
    <div className={`min-h-screen font-sans pb-10 transition-colors duration-300 overflow-x-hidden ${darkMode ? 'bg-[#1a1614]' : 'bg-[#FAFAFA]'}`}>
      
      {/* Background decorative pattern */}
      <div className="fixed inset-0 bg-pattern pointer-events-none z-0"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 transition-colors duration-300 bg-white/80 dark:bg-[#2D2420]/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-700/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleReset}>
            <div className="bg-gradient-to-br from-primary to-primary-light p-2.5 rounded-xl text-white shadow-lg group-hover:shadow-primary/30 transition-all duration-300 group-hover:scale-105">
              <BookOpenText className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary dark:text-stone-100 tracking-wide drop-shadow-sm">حكايات</h1>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <button
                onClick={toggleDarkMode}
                className="p-2.5 rounded-xl text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
                title={darkMode ? "الوضع النهاري" : "الوضع الليلي"}
            >
                {darkMode ? <Sun className="w-5 h-5 fill-current" /> : <Moon className="w-5 h-5 fill-current" />}
            </button>

            <div className="h-8 w-px bg-stone-200 dark:bg-stone-700 mx-1"></div>

            <button 
                onClick={() => setView('library')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm
                    ${view === 'library' 
                        ? 'bg-primary text-white shadow-md shadow-primary/20' 
                        : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700/50'}
                `}
            >
                <Library className="w-5 h-5" />
                <span className="hidden sm:inline">مكتبتي</span>
                {savedStories.length > 0 && (
                    <span className={`text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold
                        ${view === 'library' ? 'bg-white text-primary' : 'bg-primary text-white'}
                    `}>
                        {savedStories.length}
                    </span>
                )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 relative z-10">
        
        {view === 'library' ? (
            <SavedStoriesList 
                stories={savedStories} 
                onSelect={handleSelectStory}
                onDelete={handleDeleteStory}
                onBack={() => setView('home')}
            />
        ) : (
            <>
                {state.error && (
                <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl flex items-center gap-3 animate-fade-in shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{state.error}</span>
                </div>
                )}

                {!state.data ? (
                <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
                    <div className="text-center mb-10 max-w-3xl px-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-light/20 text-accent-dark dark:text-accent font-bold text-sm mb-6 border border-accent/20">
                            <Sparkles className="w-4 h-4" />
                            <span>ذكاء اصطناعي متطور</span>
                        </div>
                        <h2 className="text-5xl md:text-6xl font-black text-primary dark:text-stone-100 mb-6 font-serif leading-tight">
                            راوي القصص السحري
                        </h2>
                        <p className="text-xl md:text-2xl text-stone-600 dark:text-stone-400 font-light leading-relaxed">
                            أطلق العنان لخيالك. حوّل أفكارك البسيطة إلى حكايات ممتعة ورسومات خلابة بلمسة زر واحدة.
                        </p>
                    </div>
                    <StoryForm onSubmit={handleCreateStory} isLoading={state.isLoading} />
                </div>
                ) : (
                <StoryViewer 
                    story={state.data} 
                    imageSrc={state.generatedImage}
                    onGenerateImage={handleGenerateImage}
                    isGeneratingImage={state.isGeneratingImage}
                    onReset={handleReset}
                    onSave={handleSaveStory}
                    bookmarks={bookmarks}
                    onToggleBookmark={handleToggleBookmark}
                    isSaved={!!currentStoryId}
                />
                )}
            </>
        )}
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-8 text-center border-t border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-black/20 backdrop-blur-sm mt-auto">
        <p className="text-stone-500 dark:text-stone-500 font-serif text-lg">
             &copy; {new Date().getFullYear()} حكايات. جميع الحقوق محفوظة.
        </p>
      </footer>
    </div>
  );
};

export default App;