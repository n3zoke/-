import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GeneratedStory } from '../types';
import { Image as ImageIcon, ArrowRight, Sparkles, Wand2, Save, Type, Bookmark, Volume2, Square, Share2, Check, Settings2, Palette, Monitor, BookOpen, Maximize, Minimize, Mic, Wifi, Smartphone, Pause, AlertCircle, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateSpeech } from '../services/geminiService';

interface StoryViewerProps {
  story: GeneratedStory;
  imageSrc: string | null;
  onGenerateImage: () => void;
  isGeneratingImage: boolean;
  onReset: () => void;
  onSave: () => void;
  bookmarks: number[];
  onToggleBookmark: (index: number) => void;
  isSaved: boolean;
}

type ReadingTheme = 'light' | 'sepia' | 'dark';

// AI Voices Configuration
const AI_VOICES = [
    { name: 'Puck', label: 'حكواتي (ولد - ذكي)', gender: 'Male' },
    { name: 'Fenrir', label: 'راوي عميق (ولد - ذكي)', gender: 'Male' },
    { name: 'Kore', label: 'راوية (بنت - ذكية)', gender: 'Female' },
    { name: 'Aoede', label: 'هادئة (بنت - ذكية)', gender: 'Female' },
];

const PARAGRAPHS_PER_PAGE = 4; // Adjust number of paragraphs per page

const StoryViewer: React.FC<StoryViewerProps> = ({ 
  story, 
  imageSrc, 
  onGenerateImage, 
  isGeneratingImage,
  onReset,
  onSave,
  bookmarks,
  onToggleBookmark,
  isSaved
}) => {
  // 0: text-lg, 1: text-xl (default), 2: text-2xl, 3: text-3xl
  const [fontSizeLevel, setFontSizeLevel] = useState(1);
  const fontSizes = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
  const lineHeights = ['leading-loose', 'leading-loose', 'leading-loose', 'leading-loose'];

  // Reading Theme State
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('light');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // TTS State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [arabicVoices, setArabicVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Puck'); 
  const [speechRate, setSpeechRate] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [isSystemFallback, setIsSystemFallback] = useState(false);
  
  // Audio Refs
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  // Share State
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    // Browser TTS Setup
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
        const loadVoices = () => {
            const allVoices = window.speechSynthesis.getVoices();
            const arVoices = allVoices.filter(voice => voice.lang.toLowerCase().includes('ar'));
            setArabicVoices(arVoices);
        };
        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
             window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }
    
    // Web Audio API Setup for AI Voices
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
    
    return () => {
        stopAllAudio();
    };
  }, []);

  const stopAllAudio = () => {
      if (synthRef.current) synthRef.current.cancel();
      if (audioSourceRef.current) {
          try { audioSourceRef.current.stop(); } catch (e) {}
          audioSourceRef.current = null;
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsBuffering(false);
  };

  // Prepare chunks
  const storyChunks = useMemo(() => {
      return [
        { text: story.title, type: 'title', index: -1 },
        { text: story.summary, type: 'summary', index: -1 },
        ...story.content.split(/\n\s*\n/).filter(Boolean).map((p, i) => ({ text: p, type: 'paragraph', index: i }))
    ];
  }, [story]);

  // All paragraphs for rendering
  const allParagraphs = useMemo(() => story.content.split(/\n\s*\n/).filter(Boolean), [story.content]);
  
  // Calculate total pages
  const totalPages = Math.ceil(allParagraphs.length / PARAGRAPHS_PER_PAGE);

  // Auto-flip page when TTS active paragraph changes
  useEffect(() => {
    if (activeParagraphIndex !== null) {
        const pageForParagraph = Math.floor(activeParagraphIndex / PARAGRAPHS_PER_PAGE);
        if (pageForParagraph !== currentPage) {
            setCurrentPage(pageForParagraph);
        }
    }
  }, [activeParagraphIndex]);

  const progress = useMemo(() => {
    if (storyChunks.length <= 1) return 0;
    const percentage = (currentChunkIndex / (storyChunks.length - 1)) * 100;
    return Math.min(100, Math.max(0, percentage));
  }, [currentChunkIndex, storyChunks.length]);

  const decodeAudioData = (base64Data: string): AudioBuffer => {
      if (!audioContextRef.current) throw new Error("AudioContext not supported");
      try {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const sampleRate = 24000;
        const numChannels = 1;
        const dataLength = bytes.length - (bytes.length % 2);
        const dataInt16 = new Int16Array(bytes.buffer.slice(0, dataLength));
        const frameCount = dataInt16.length / numChannels;
        const buffer = audioContextRef.current.createBuffer(numChannels, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0); 
        for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
        return buffer;
      } catch (e) {
          console.error("Decoding error:", e);
          throw new Error("Failed to decode audio data");
      }
  };

  const playSystemVoice = (text: string, startIndex: number) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        let sysVoice = arabicVoices.find(v => v.name === selectedVoiceName);
        if (!sysVoice && arabicVoices.length > 0) sysVoice = arabicVoices[0];
        if (sysVoice) utterance.voice = sysVoice;
        utterance.lang = 'ar-SA';
        utterance.rate = speechRate;

        utterance.onend = () => { if (isPlayingRef.current) playNextChunk(startIndex + 1); };
        utterance.onerror = (e) => {
            if (e.error === 'interrupted' || e.error === 'canceled') return;
            if (isPlayingRef.current) playNextChunk(startIndex + 1);
        };
        setTimeout(() => { if(isPlayingRef.current) synthRef.current?.speak(utterance); }, 10);
  };

  const playNextChunk = async (startIndex: number) => {
      if (!isPlayingRef.current || startIndex >= storyChunks.length) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          setCurrentChunkIndex(0);
          setActiveParagraphIndex(null);
          return;
      }

      setCurrentChunkIndex(startIndex);
      const chunk = storyChunks[startIndex];
      
      if (chunk.type === 'paragraph') setActiveParagraphIndex(chunk.index);
      else setActiveParagraphIndex(null);

      const isAiVoice = !isSystemFallback && AI_VOICES.some(v => v.name === selectedVoiceName);

      if (isAiVoice) {
          try {
              setIsBuffering(true);
              setTtsError(null);
              const base64Audio = await generateSpeech(chunk.text, selectedVoiceName);
              if (!isPlayingRef.current) { setIsBuffering(false); return; }

              const audioBuffer = decodeAudioData(base64Audio);
              setIsBuffering(false);

              if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();

              const source = audioContextRef.current!.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current!.destination);
              if (source.playbackRate) source.playbackRate.value = speechRate;
              
              source.onended = () => { if (isPlayingRef.current) playNextChunk(startIndex + 1); };
              audioSourceRef.current = source;
              source.start(0);

          } catch (error) {
              console.error("AI TTS Failed, switching to system voice:", error);
              setIsBuffering(false);
              setIsSystemFallback(true);
              setTtsError("جاري استخدام صوت الجهاز (تعذر الاتصال بالخادم)");
              playSystemVoice(chunk.text, startIndex);
          }
      } else {
          playSystemVoice(chunk.text, startIndex);
      }
  };

  const toggleSpeech = () => {
    if (isPlaying) {
        stopAllAudio();
    } else {
        if (AI_VOICES.some(v => v.name === selectedVoiceName)) {
            setIsSystemFallback(false);
            setTtsError(null);
        }
        isPlayingRef.current = true;
        setIsPlaying(true);
        playNextChunk(currentChunkIndex); 
    }
  };

  const handleSettingsChange = (newVoiceName?: string, newRate?: number) => {
      const wasPlaying = isPlaying;
      stopAllAudio();
      if (newVoiceName) {
          setSelectedVoiceName(newVoiceName);
          if (AI_VOICES.some(v => v.name === newVoiceName)) {
              setIsSystemFallback(false);
              setTtsError(null);
          }
      }
      if (newRate) setSpeechRate(newRate);
      if (wasPlaying) {
          setTimeout(() => {
              isPlayingRef.current = true;
              setIsPlaying(true);
              playNextChunk(currentChunkIndex);
          }, 100);
      }
  };

  const handleShare = async () => {
    const appUrl = window.location.href; // Get current App URL
    const textToShare = `${story.title}\n\n${story.summary}\n\n${story.content}\n\n✨ تم تأليف هذه القصة عبر تطبيق حكايات:\n${appUrl}`.trim();
    
    if (navigator.share) {
        try { await navigator.share({ title: story.title, text: textToShare, url: appUrl }); } catch (error) { console.log('Error sharing:', error); }
    } else {
        try {
            await navigator.clipboard.writeText(textToShare);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) { alert("حدث خطأ أثناء نسخ النص"); }
    }
  };

  const themeClasses = {
      light: 'bg-white text-stone-900 border-stone-200',
      sepia: 'bg-[#F4ECD8] text-[#433422] border-[#E6DCC6]',
      dark: 'bg-[#1a1614] text-stone-300 border-stone-800'
  };

  // Pagination Logic
  const visibleParagraphs = allParagraphs.slice(
      currentPage * PARAGRAPHS_PER_PAGE,
      (currentPage + 1) * PARAGRAPHS_PER_PAGE
  );

  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 animate-fade-in pb-12 transition-colors duration-500`}>
      
      {!isFocusMode && (
          <div className="sticky top-20 z-40 mx-auto max-w-3xl">
              <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 transition-all duration-300 relative overflow-hidden flex flex-col">
                <div className="p-2 flex flex-wrap items-center justify-between gap-2">
                    <button onClick={onReset} className="flex items-center gap-2 text-stone-600 dark:text-stone-300 font-bold hover:text-primary dark:hover:text-white px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                        <ArrowRight className="w-5 h-5" />
                        <span className="hidden sm:inline text-sm">عودة</span>
                    </button>
                    <div className="h-6 w-px bg-stone-200 dark:bg-stone-700 mx-1"></div>
                    
                    <div className="flex items-center gap-1">
                        <button onClick={toggleSpeech} disabled={isBuffering} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 min-w-[100px] justify-center ${isPlaying ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-stone-100 dark:bg-stone-800'}`}>
                            {isBuffering ? <Wand2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            <span className="hidden sm:inline text-sm">{isBuffering ? "تحميل" : isPlaying ? "إيقاف" : "استماع"}</span>
                        </button>
                        <button onClick={() => setShowSettings(!showSettings)} className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-300">
                            <Settings2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-stone-200 dark:bg-stone-700 mx-1"></div>

                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsFocusMode(true)} className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-300"><Maximize className="w-5 h-5" /></button>
                        <button onClick={handleShare} className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-300">
                            {isCopied ? <Check className="w-5 h-5 text-green-500" /> : <Share2 className="w-5 h-5" />}
                        </button>
                        <button onClick={onSave} className={`p-2.5 rounded-xl ${isSaved ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-primary dark:text-accent hover:bg-primary/5'}`}>
                            {isSaved ? <Check className="w-5 h-5" strokeWidth={3} /> : <Save className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {(currentChunkIndex > 0 || isPlaying) && (
                    <div className="w-full h-1 bg-stone-100 dark:bg-stone-800/50">
                        <div className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-linear" style={{ width: `${progress}%` }} />
                    </div>
                )}
              </div>

              {ttsError && (
                 <div className="mt-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-fade-in shadow-lg">
                    <VolumeX className="w-4 h-4 shrink-0" />
                    <span>{ttsError}</span>
                 </div>
              )}

              {showSettings && (
                 <div className="mt-2 bg-white/90 dark:bg-[#2D2420]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 p-6 animate-fade-in grid gap-6 relative overflow-hidden">
                    <div className="space-y-3">
                        <label className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Type className="w-4 h-4" /> حجم النص</label>
                        <div className="flex items-center gap-4 bg-stone-100 dark:bg-stone-800/50 p-2 rounded-xl">
                            <span className="text-xs text-stone-400">صغير</span>
                            <input type="range" min="0" max={fontSizes.length - 1} step="1" value={fontSizeLevel} onChange={(e) => setFontSizeLevel(parseInt(e.target.value))} className="w-full h-1.5 bg-stone-300 dark:bg-stone-600 rounded-lg appearance-none cursor-pointer accent-primary" />
                            <span className="text-xl text-stone-400">كبير</span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Palette className="w-4 h-4" /> لون الورق</label>
                        <div className="flex gap-3">
                            {['light', 'sepia', 'dark'].map((t) => (
                                <button key={t} onClick={() => setReadingTheme(t as ReadingTheme)} className={`flex-1 h-12 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${readingTheme === t ? 'border-primary ring-2 ring-primary/20' : 'border-stone-200 dark:border-stone-700'}`}>
                                    <span className="text-sm font-bold capitalize">{t === 'light' ? 'أبيض' : t === 'sepia' ? 'ورق' : 'ليلي'}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                     <div className="space-y-3 pt-4 border-t border-stone-100 dark:border-stone-700/50">
                        <label className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Volume2 className="w-4 h-4" /> إعدادات الراوي</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <select value={selectedVoiceName} onChange={(e) => handleSettingsChange(e.target.value, undefined)} className="w-full p-2.5 bg-stone-100 dark:bg-stone-800 border-none rounded-xl text-sm text-stone-700 dark:text-stone-300 focus:ring-2 focus:ring-primary appearance-none">
                                <optgroup label="أصوات ذكية"><option value="Puck">حكواتي (ولد)</option><option value="Fenrir">راوي (عميق)</option><option value="Kore">راوية (بنت)</option><option value="Aoede">هادئة (بنت)</option></optgroup>
                                {arabicVoices.length > 0 && <optgroup label="أصوات الجهاز">{arabicVoices.map((v) => (<option key={v.name} value={v.name}>{v.name.replace(/Google|Microsoft|Arabic/g, '')}</option>))}</optgroup>}
                            </select>
                            <div className="flex items-center gap-3 bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-2">
                                <span className="text-xs text-stone-400 whitespace-nowrap">السرعة: {speechRate}x</span>
                                <input type="range" min="0.5" max="2" step="0.1" value={speechRate} onChange={(e) => handleSettingsChange(undefined, parseFloat(e.target.value))} className="w-full h-1 bg-stone-300 dark:bg-stone-600 rounded-lg appearance-none cursor-pointer accent-primary" />
                            </div>
                        </div>
                    </div>
                 </div>
              )}
          </div>
      )}

      <div className={`${themeClasses[readingTheme]} transition-all duration-500 ${isFocusMode ? 'fixed inset-0 z-50 h-screen w-screen overflow-y-auto rounded-none m-0 max-w-none border-0' : 'rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-none border relative overflow-hidden min-h-[600px] mb-12 flex flex-col'}`}>
         
         {isFocusMode && (
             <button onClick={() => setIsFocusMode(false)} className={`fixed top-6 right-6 z-[60] p-3 rounded-full shadow-lg transition-all hover:scale-110 ${readingTheme === 'dark' ? 'bg-stone-800 text-stone-200' : 'bg-white text-stone-800'}`}>
                <Minimize className="w-6 h-6" />
             </button>
         )}

        <div className={`relative z-10 mx-auto w-full flex-1 flex flex-col ${isFocusMode ? 'max-w-4xl py-16 px-6' : 'max-w-[95%] p-8 md:p-12'}`}>
          
          {/* Header Section - Always visible on top of page 1, or compact on others */}
          {currentPage === 0 && (
              <div className="mb-12 border-b border-black/5 pb-8 animate-fade-in">
                <div className="text-center mb-8 relative">
                    <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 leading-tight drop-shadow-sm">{story.title}</h1>
                    <div className={`h-1 w-24 mx-auto rounded-full opacity-60 ${readingTheme === 'sepia' ? 'bg-[#8B5E3C]' : 'bg-primary'}`}></div>
                    <p className={`mt-6 text-lg md:text-xl max-w-2xl mx-auto italic font-medium leading-relaxed opacity-80`}>{story.summary}</p>
                </div>
                <div className="mb-8">
                    {imageSrc ? (
                    <div className={`relative group mx-auto max-w-xl transition-all duration-500 ease-out hover:-translate-y-1
                        ${readingTheme === 'sepia' 
                            ? 'p-3 bg-[#EAE0C9] shadow-[0_15px_30px_rgba(67,52,34,0.2)] ring-1 ring-[#8B5E3C]/20' 
                            : 'p-3 bg-white dark:bg-stone-800 shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:shadow-black/50 ring-1 ring-stone-900/5 dark:ring-white/10'
                        } rounded-xl`}>
                        <div className="relative overflow-hidden rounded-lg">
                             <img 
                                src={imageSrc} 
                                alt={story.title} 
                                className="w-full h-auto object-cover transform transition-transform duration-1000 ease-in-out group-hover:scale-105" 
                            />
                             {/* Subtle inner shadow overlay and sheen */}
                             <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] pointer-events-none rounded-lg"></div>
                             <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                        </div>
                    </div>
                    ) : (
                    <div className="w-full max-w-md mx-auto aspect-video rounded-3xl border-2 border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/30 flex flex-col items-center justify-center p-8 gap-5 text-center transition-colors group">
                        <div className={`p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform duration-300 ${readingTheme === 'sepia' ? 'bg-[#EAE0C9]' : 'bg-white dark:bg-stone-800'}`}>
                            <ImageIcon className={`w-10 h-10 ${readingTheme === 'sepia' ? 'text-[#8B5E3C]/50' : 'text-stone-300 dark:text-stone-600'}`} />
                        </div>
                        <button onClick={onGenerateImage} disabled={isGeneratingImage} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all duration-300 transform active:scale-95 shadow-lg ${isGeneratingImage ? 'bg-stone-200 cursor-not-allowed' : 'bg-gradient-to-r from-accent to-accent-dark text-white hover:-translate-y-1'}`}>
                            {isGeneratingImage ? <><Wand2 className="w-5 h-5 animate-spin" /> جاري الرسم...</> : <><Wand2 className="w-5 h-5" /> <span>تخيل المشهد</span></>}
                        </button>
                    </div>
                    )}
                </div>
              </div>
          )}

          {/* Story Content - Paginated */}
          <div className={`prose prose-lg dark:prose-invert max-w-none ${fontSizes[fontSizeLevel]} ${lineHeights[fontSizeLevel]} font-serif flex-1`}>
            {visibleParagraphs.map((paragraph, idx) => {
               const globalIndex = (currentPage * PARAGRAPHS_PER_PAGE) + idx;
               return (
               <div key={globalIndex} className={`group relative mb-8 p-4 rounded-2xl transition-all duration-500 -mx-4 ${activeParagraphIndex === globalIndex ? (readingTheme === 'dark' ? 'bg-white/10' : 'bg-primary/5') : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  <div className="text-justify whitespace-pre-wrap">{paragraph}</div>
                  <button onClick={() => onToggleBookmark(globalIndex)} className={`absolute left-0 top-1 p-2 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 ${bookmarks.includes(globalIndex) ? 'opacity-100 text-accent fill-accent' : 'text-stone-400 hover:text-accent'}`}>
                     <Bookmark className={`w-5 h-5 ${bookmarks.includes(globalIndex) ? 'fill-current' : ''}`} />
                  </button>
               </div>
               );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="mt-8 pt-8 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
              <button 
                onClick={() => {
                    setCurrentPage(prev => Math.max(0, prev - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${currentPage === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                  <ChevronRight className="w-5 h-5" />
                  السابق
              </button>
              
              <span className="font-serif text-lg opacity-60">
                  صفحة {currentPage + 1} من {totalPages}
              </span>

              <button 
                onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages - 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${currentPage === totalPages - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                  التالي
                  <ChevronLeft className="w-5 h-5" />
              </button>
          </div>

          {/* Moral Section (Only on last page) */}
          {story.moral && currentPage === totalPages - 1 && (
            <div className={`mt-16 p-8 rounded-3xl border relative ${readingTheme === 'sepia' ? 'bg-[#EAE0C9] border-[#D7C9A8]' : 'bg-stone-50 dark:bg-[#0f0c0b] border-stone-100 dark:border-stone-800'}`}>
               <Sparkles className="absolute -top-3 -right-3 w-8 h-8 text-accent fill-current" />
               <h3 className={`text-xl font-bold mb-3 font-serif ${readingTheme === 'sepia' ? 'text-[#8B5E3C]' : 'text-primary dark:text-primary-light'}`}>العبرة من الحكاية</h3>
               <p className="italic text-lg opacity-80">{story.moral}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryViewer;