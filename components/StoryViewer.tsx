import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GeneratedStory } from '../types';
import { Image as ImageIcon, ArrowRight, Sparkles, Wand2, Save, Type, Bookmark, Volume2, Square, Share2, Check, Settings2, Palette, Monitor, BookOpen, Maximize, Minimize, Mic, Wifi, Smartphone, Pause, AlertCircle } from 'lucide-react';
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

  // TTS State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [arabicVoices, setArabicVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Store voice name as string to handle both System and AI voices easily
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Puck'); 
  const [speechRate, setSpeechRate] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  
  // Audio Refs
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  // Share State
  const [isCopied, setIsCopied] = useState(false);

  // Initialize Audio Context and Voices
  useEffect(() => {
    // Browser TTS Setup
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
        const loadVoices = () => {
            const allVoices = window.speechSynthesis.getVoices();
            const arVoices = allVoices.filter(voice => voice.lang.toLowerCase().startsWith('ar'));
            setArabicVoices(arVoices);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
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
      // Stop Browser TTS
      if (synthRef.current) {
          synthRef.current.cancel();
      }
      // Stop Web Audio
      if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch (e) {
            // ignore if already stopped
          }
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

  // Calculate progress percentage
  const progress = useMemo(() => {
    if (storyChunks.length <= 1) return 0;
    const percentage = (currentChunkIndex / (storyChunks.length - 1)) * 100;
    return Math.min(100, Math.max(0, percentage));
  }, [currentChunkIndex, storyChunks.length]);

  // Decode Raw PCM Audio helper (16-bit, 24kHz, Mono)
  const decodeAudioData = (base64Data: string): AudioBuffer => {
      if (!audioContextRef.current) throw new Error("AudioContext not supported");
      
      try {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // PCM Configuration for Gemini
        const sampleRate = 24000;
        const numChannels = 1;
        
        // Handle potential odd byte length (PCM 16-bit must be even)
        const dataLength = bytes.length - (bytes.length % 2);
        const dataInt16 = new Int16Array(bytes.buffer.slice(0, dataLength));
        
        const frameCount = dataInt16.length / numChannels;
        const buffer = audioContextRef.current.createBuffer(numChannels, frameCount, sampleRate);
        
        const channelData = buffer.getChannelData(0); // Mono
        for (let i = 0; i < frameCount; i++) {
            // Convert Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
            channelData[i] = dataInt16[i] / 32768.0;
        }
        
        return buffer;
      } catch (e) {
          console.error("Decoding error:", e);
          throw new Error("Failed to decode audio data");
      }
  };

  const playSystemVoice = (text: string, startIndex: number) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const sysVoice = arabicVoices.find(v => v.name === selectedVoiceName) || arabicVoices[0];
        if (sysVoice) utterance.voice = sysVoice;
        utterance.lang = 'ar-SA';
        utterance.rate = speechRate;

        utterance.onend = () => {
             if (isPlayingRef.current) {
                 playNextChunk(startIndex + 1);
             }
        };

        utterance.onerror = (e) => {
            console.error("Browser TTS Error", e);
            if (e.error !== 'canceled' && e.error !== 'interrupted') {
                // Skip to next if error
                if (isPlayingRef.current) playNextChunk(startIndex + 1);
            }
        };

        synthRef.current?.speak(utterance);
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
      
      if (chunk.type === 'paragraph') {
          setActiveParagraphIndex(chunk.index);
      } else {
          setActiveParagraphIndex(null);
      }

      // Check if selected voice is AI or System
      const isAiVoice = AI_VOICES.some(v => v.name === selectedVoiceName);

      if (isAiVoice) {
          try {
              setIsBuffering(true);
              setTtsError(null);
              
              // Fetch AI Audio
              const base64Audio = await generateSpeech(chunk.text, selectedVoiceName);
              
              if (!isPlayingRef.current) {
                setIsBuffering(false);
                return;
              }

              // Decode manually
              const audioBuffer = decodeAudioData(base64Audio);
              
              setIsBuffering(false);

              if (audioContextRef.current?.state === 'suspended') {
                  await audioContextRef.current.resume();
              }

              const source = audioContextRef.current!.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current!.destination);
              
              // Set playback rate if supported
              if (source.playbackRate) {
                  source.playbackRate.value = speechRate;
              }
              
              source.onended = () => {
                  if (isPlayingRef.current) {
                      playNextChunk(startIndex + 1);
                  }
              };
              
              audioSourceRef.current = source;
              source.start(0);

          } catch (error) {
              console.error("AI TTS Error", error);
              setIsBuffering(false);
              setTtsError("تعذر الاتصال بالصوت الذكي، جاري التحويل لصوت الجهاز...");
              
              // Fallback to System Voice immediately
              setTimeout(() => {
                  setTtsError(null);
                  // Ensure we are still playing before falling back
                  if (isPlayingRef.current) {
                      playSystemVoice(chunk.text, startIndex);
                  }
              }, 1500);
          }

      } else {
          // System Browser TTS
          playSystemVoice(chunk.text, startIndex);
      }
  };

  const toggleSpeech = () => {
    if (isPlaying) {
        stopAllAudio();
    } else {
        isPlayingRef.current = true;
        setIsPlaying(true);
        playNextChunk(currentChunkIndex); 
    }
  };

  const handleSettingsChange = (newVoiceName?: string, newRate?: number) => {
      // If playing, we need to restart from current chunk with new settings
      const wasPlaying = isPlaying;
      stopAllAudio();
      
      // Update State
      if (newVoiceName) setSelectedVoiceName(newVoiceName);
      if (newRate) setSpeechRate(newRate);
      
      // Restart if needed
      if (wasPlaying) {
          // Small delay to ensure clean stop
          setTimeout(() => {
              // Note: using local vars for the restart to avoid state update lag
              isPlayingRef.current = true;
              setIsPlaying(true);
              playNextChunk(currentChunkIndex);
          }, 100);
      }
  };

  const handleShare = async () => {
    const textToShare = `
${story.title}
----------------
${story.summary}

${story.content}

${story.moral ? `💡 العبرة: ${story.moral}` : ''}

✨ تم تأليف هذه القصة عبر تطبيق حكايات
`.trim();

    if (navigator.share) {
        try {
            await navigator.share({
                title: story.title,
                text: textToShare,
            });
        } catch (error) {
            console.log('Error sharing:', error);
        }
    } else {
        try {
            await navigator.clipboard.writeText(textToShare);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert("حدث خطأ أثناء نسخ النص");
        }
    }
  };

  const paragraphs = story.content.split(/\n\s*\n/).filter(Boolean);

  // Theme Classes Map
  const themeClasses = {
      light: 'bg-white text-stone-900 border-stone-200',
      sepia: 'bg-[#F4ECD8] text-[#433422] border-[#E6DCC6]',
      dark: 'bg-[#1a1614] text-stone-300 border-stone-800'
  };

  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 animate-fade-in pb-12 transition-colors duration-500`}>
      
      {/* Floating Toolbar - Hidden in Focus Mode */}
      {!isFocusMode && (
          <div className="sticky top-20 z-40 mx-auto max-w-3xl">
              <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-stone-200/50 dark:border-stone-700/50 transition-all duration-300 relative overflow-hidden flex flex-col">
                
                <div className="p-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <button 
                        onClick={onReset}
                        className="flex items-center gap-2 text-stone-600 dark:text-stone-300 font-bold hover:text-primary dark:hover:text-white px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                        title="قصة جديدة"
                        >
                            <ArrowRight className="w-5 h-5" />
                            <span className="hidden sm:inline text-sm">عودة</span>
                        </button>
                    </div>

                    <div className="h-6 w-px bg-stone-200 dark:bg-stone-700 mx-1"></div>
                    
                    <div className="flex items-center gap-1">
                        {/* Play / Pause */}
                        <button 
                            onClick={toggleSpeech}
                            disabled={isBuffering}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-300 min-w-[100px] justify-center
                                ${isPlaying
                                    ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                                }
                            `}
                        >
                            {isBuffering ? (
                                <Wand2 className="w-4 h-4 animate-spin" />
                            ) : isPlaying ? (
                                <Pause className="w-4 h-4 fill-current" />
                            ) : (
                                <Volume2 className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline text-sm">
                                {isBuffering ? "جاري التحميل" : isPlaying ? "إيقاف مؤقت" : (currentChunkIndex > 0 ? "متابعة" : "استماع")}
                            </span>
                        </button>

                        {/* Settings Toggle */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2.5 rounded-xl transition-all duration-200 active:scale-95
                                ${showSettings
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                                }
                            `}
                            title="إعدادات القراءة"
                        >
                            <Settings2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-stone-200 dark:bg-stone-700 mx-1"></div>

                    {/* Focus Mode & Other Actions */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsFocusMode(true)}
                            className="p-2.5 rounded-xl text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            title="وضع التركيز"
                        >
                            <Maximize className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleShare}
                            className="p-2.5 rounded-xl text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            title="مشاركة"
                        >
                            {isCopied ? <Check className="w-5 h-5 text-green-500" /> : <Share2 className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={onSave}
                            className={`p-2.5 rounded-xl transition-all duration-300 transform
                                ${isSaved 
                                    ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                                    : 'text-primary dark:text-accent hover:bg-primary/5 dark:hover:bg-stone-800'
                                }
                            `}
                            title={isSaved ? "تم الحفظ" : "حفظ"}
                        >
                            {isSaved ? <Check className="w-5 h-5" strokeWidth={3} /> : <Save className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                {(currentChunkIndex > 0 || isPlaying) && (
                    <div className="w-full h-1 bg-stone-100 dark:bg-stone-800/50">
                        <div 
                            className="h-full bg-gradient-to-r from-primary to-accent dark:from-primary-light dark:to-accent transition-all duration-500 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
              </div>

              {/* TTS Error Toast */}
              {ttsError && (
                 <div className="mt-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-xl text-sm flex items-center gap-2 animate-fade-in shadow-lg">
                    <AlertCircle className="w-4 h-4" />
                    {ttsError}
                 </div>
              )}

              {/* Settings Panel */}
              {showSettings && (
                 <div className="mt-2 bg-white/90 dark:bg-[#2D2420]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 p-6 animate-fade-in grid gap-6 relative overflow-hidden">
                    {/* Font Size */}
                    <div className="space-y-3">
                        <label className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Type className="w-4 h-4" />
                            حجم النص
                        </label>
                        <div className="flex items-center gap-4 bg-stone-100 dark:bg-stone-800/50 p-2 rounded-xl">
                            <span className="text-xs text-stone-400">صغير</span>
                            <input
                                type="range"
                                min="0"
                                max={fontSizes.length - 1}
                                step="1"
                                value={fontSizeLevel}
                                onChange={(e) => setFontSizeLevel(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-stone-300 dark:bg-stone-600 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <span className="text-xl text-stone-400">كبير</span>
                        </div>
                    </div>

                    {/* Themes */}
                    <div className="space-y-3">
                        <label className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            لون الورق
                        </label>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setReadingTheme('light')}
                                className={`flex-1 h-12 rounded-xl border-2 transition-all flex items-center justify-center gap-2
                                    ${readingTheme === 'light' ? 'border-primary ring-2 ring-primary/20' : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'}
                                    bg-white text-stone-800
                                `}
                            >
                                <Monitor className="w-4 h-4" />
                                <span className="text-sm font-bold">أبيض</span>
                            </button>
                            <button 
                                 onClick={() => setReadingTheme('sepia')}
                                 className={`flex-1 h-12 rounded-xl border-2 transition-all flex items-center justify-center gap-2
                                    ${readingTheme === 'sepia' ? 'border-[#8B5E3C] ring-2 ring-[#8B5E3C]/20' : 'border-[#E6DCC6] hover:border-[#D7C9A8]'}
                                    bg-[#F4ECD8] text-[#433422]
                                `}
                            >
                                <BookOpen className="w-4 h-4" />
                                <span className="text-sm font-bold">ورق</span>
                            </button>
                            <button 
                                 onClick={() => setReadingTheme('dark')}
                                 className={`flex-1 h-12 rounded-xl border-2 transition-all flex items-center justify-center gap-2
                                    ${readingTheme === 'dark' ? 'border-white/50 ring-2 ring-white/10' : 'border-stone-700 hover:border-stone-600'}
                                    bg-[#1a1614] text-stone-300
                                `}
                            >
                                <Monitor className="w-4 h-4" />
                                <span className="text-sm font-bold">ليلي</span>
                            </button>
                        </div>
                    </div>

                     {/* Audio Settings */}
                     <div className="space-y-3 pt-4 border-t border-stone-100 dark:border-stone-700/50">
                        <label className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Volume2 className="w-4 h-4" />
                            إعدادات الراوي
                        </label>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Voice Select */}
                            <div className="relative">
                                <select 
                                    value={selectedVoiceName}
                                    onChange={(e) => handleSettingsChange(e.target.value, undefined)}
                                    className="w-full p-2.5 bg-stone-100 dark:bg-stone-800 border-none rounded-xl text-sm text-stone-700 dark:text-stone-300 focus:ring-2 focus:ring-primary appearance-none font-sans"
                                >
                                    <optgroup label="أصوات ذكية (عالية الجودة)">
                                        {AI_VOICES.map(v => (
                                            <option key={v.name} value={v.name}>{v.label}</option>
                                        ))}
                                    </optgroup>
                                    {arabicVoices.length > 0 && (
                                        <optgroup label="أصوات الجهاز (سريعة)">
                                            {arabicVoices.map((v) => (
                                                <option key={v.name} value={v.name}>
                                                    {v.name.replace('Google', '').replace('Microsoft', '').replace('Arabic', 'عربي')}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                 <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>

                            {/* Speed Slider */}
                            <div className="flex items-center gap-3 bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-2">
                                <span className="text-xs text-stone-400 whitespace-nowrap">السرعة: {speechRate}x</span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={speechRate}
                                    onChange={(e) => handleSettingsChange(undefined, parseFloat(e.target.value))}
                                    className="w-full h-1 bg-stone-300 dark:bg-stone-600 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>
                    </div>

                 </div>
              )}
          </div>
      )}

      {/* Book / Paper Container */}
      <div 
        className={`${themeClasses[readingTheme]} transition-all duration-500
        ${isFocusMode 
            ? 'fixed inset-0 z-50 h-screen w-screen overflow-y-auto rounded-none m-0 max-w-none border-0' 
            : 'rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-none border relative overflow-hidden min-h-[600px] mb-12'
        }`}
      >
         
         {/* Exit Focus Button */}
         {isFocusMode && (
             <button
                onClick={() => setIsFocusMode(false)}
                className={`fixed top-6 right-6 z-[60] p-3 rounded-full shadow-lg transition-all hover:scale-110
                    ${readingTheme === 'dark' ? 'bg-stone-800 text-stone-200' : 'bg-white text-stone-800'}
                `}
                title="خروج من وضع التركيز"
             >
                <Minimize className="w-6 h-6" />
             </button>
         )}

         {/* Top Binding Effect */}
         {readingTheme !== 'dark' && (
             <>
                <div className={`absolute top-0 left-0 w-full h-3 bg-gradient-to-b from-black/5 to-transparent ${isFocusMode ? 'fixed' : 'absolute'}`}></div>
                {!isFocusMode && <div className="absolute top-0 left-8 bottom-0 w-[1px] bg-black/5"></div>}
             </>
         )}

        <div className={`relative z-10 mx-auto ${isFocusMode ? 'max-w-3xl py-16 px-6' : 'max-w-[95%] p-8 md:p-16'}`}>
          
          {/* Header */}
          <div className="text-center mb-12 relative">
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 leading-tight drop-shadow-sm">
                {story.title}
            </h1>
            <div className={`h-1 w-24 mx-auto rounded-full opacity-60 ${readingTheme === 'sepia' ? 'bg-[#8B5E3C]' : 'bg-primary'}`}></div>
            
            <p className={`mt-6 text-lg md:text-xl max-w-2xl mx-auto italic font-medium leading-relaxed opacity-80`}>
              {story.summary}
            </p>
          </div>

          {/* Image Section */}
          <div className="mb-14">
            {imageSrc ? (
              <div className="relative group rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 ease-out max-w-2xl mx-auto border-4 border-white/50 dark:border-stone-600/20">
                <img 
                  src={imageSrc} 
                  alt={story.title} 
                  className="w-full h-auto object-cover transform scale-100 group-hover:scale-105 transition-transform duration-1000"
                />
                 <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white/90 text-sm font-medium flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent" />
                        رسم بواسطة الذكاء الاصطناعي
                    </p>
                 </div>
              </div>
            ) : (
              <div className={`w-full max-w-xl mx-auto aspect-video rounded-3xl border-2 border-dashed ${readingTheme === 'sepia' ? 'border-[#D7C9A8] bg-[#EAE0C9]/50' : 'border-stone-300 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/30'} flex flex-col items-center justify-center p-8 gap-5 text-center transition-colors group`}>
                  <div className={`p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform duration-300 ${readingTheme === 'sepia' ? 'bg-[#EAE0C9]' : 'bg-white dark:bg-stone-800'}`}>
                     <ImageIcon className={`w-10 h-10 ${readingTheme === 'sepia' ? 'text-[#8B5E3C]/50' : 'text-stone-300 dark:text-stone-600'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold opacity-80">لمسة سحرية؟</h3>
                    <p className="text-sm mt-1 opacity-60">أضف رسماً توضيحياً لهذه القصة</p>
                  </div>
                  <button 
                    onClick={onGenerateImage}
                    disabled={isGeneratingImage}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all duration-300 transform active:scale-95 shadow-lg
                        ${isGeneratingImage 
                            ? 'bg-stone-200 dark:bg-stone-700 text-stone-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-accent to-accent-dark text-white hover:-translate-y-1'
                        }
                    `}
                  >
                    {isGeneratingImage ? (
                        <>
                            <Wand2 className="w-5 h-5 animate-spin" />
                            جاري الرسم...
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-5 h-5" />
                            <span>تخيل المشهد</span>
                        </>
                    )}
                  </button>
              </div>
            )}
          </div>

          {/* Story Content */}
          <div className={`prose prose-lg dark:prose-invert max-w-none ${fontSizes[fontSizeLevel]} ${lineHeights[fontSizeLevel]} font-serif`}>
            {paragraphs.map((paragraph, index) => (
               <div 
                  key={index} 
                  className={`group relative mb-8 p-4 rounded-2xl transition-all duration-500 -mx-4
                      ${activeParagraphIndex === index 
                        ? (readingTheme === 'dark' ? 'bg-white/10' : 'bg-primary/5') 
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }
                  `}
               >
                  <div className="text-justify whitespace-pre-wrap">{paragraph}</div>
                  
                  {/* Bookmark Button */}
                  <button
                    onClick={() => onToggleBookmark(index)}
                    className={`absolute left-0 top-1 p-2 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100
                        ${bookmarks.includes(index) 
                            ? 'opacity-100 text-accent fill-accent' 
                            : 'text-stone-400 hover:text-accent'
                        }
                    `}
                    title="حفظ المقطع"
                  >
                     <Bookmark className={`w-5 h-5 ${bookmarks.includes(index) ? 'fill-current' : ''}`} />
                  </button>
               </div>
            ))}
          </div>

          {/* Moral Section */}
          {story.moral && (
            <div className={`mt-16 p-8 rounded-3xl border relative ${readingTheme === 'sepia' ? 'bg-[#EAE0C9] border-[#D7C9A8]' : 'bg-stone-50 dark:bg-[#0f0c0b] border-stone-100 dark:border-stone-800'}`}>
               <Sparkles className="absolute -top-3 -right-3 w-8 h-8 text-accent fill-current" />
               <h3 className={`text-xl font-bold mb-3 font-serif ${readingTheme === 'sepia' ? 'text-[#8B5E3C]' : 'text-primary dark:text-primary-light'}`}>العبرة من الحكاية</h3>
               <p className="italic text-lg opacity-80">{story.moral}</p>
            </div>
          )}

          {/* Footer Number */}
          <div className="mt-16 text-center">
            <div className={`inline-block w-8 h-8 rounded-full border flex items-center justify-center text-sm font-serif opacity-40 ${readingTheme === 'sepia' ? 'border-[#8B5E3C] text-[#8B5E3C]' : 'border-stone-300 dark:border-stone-700'}`}>
                1
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryViewer;