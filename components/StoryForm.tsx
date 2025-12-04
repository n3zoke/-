import React, { useState, useRef, useEffect } from 'react';
import { StoryParams, Genre, AgeGroup, StoryLength } from '../types';
import { BookOpen, Sparkles, User, Feather, Mic, MicOff, Clock, AlignLeft, AlertCircle, Wand2, Heart } from 'lucide-react';

interface StoryFormProps {
  onSubmit: (params: StoryParams) => void;
  isLoading: boolean;
}

const StoryForm: React.FC<StoryFormProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState<Genre>(Genre.ADVENTURE);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(AgeGroup.CHILD);
  const [length, setLength] = useState<StoryLength>(StoryLength.TIER_1);
  const [characterName, setCharacterName] = useState('');
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const promptRef = useRef(prompt);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  // Effect to handle Genre filtering
  useEffect(() => {
    // If user switches away from Adult, and currently selected genre is Adult Romance, reset genre
    if (ageGroup !== AgeGroup.ADULT && genre === Genre.ADULT_ROMANCE) {
        setGenre(Genre.ADVENTURE);
    }
  }, [ageGroup, genre]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("عذراً، متصفحك لا يدعم ميزة تحويل الصوت إلى نص.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    const baseText = promptRef.current; 

    recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
        
        const prefix = baseText && !baseText.match(/\s$/) ? ' ' : '';
        setPrompt(baseText + prefix + transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit({ prompt, genre, ageGroup, length, characterName });
    }
  };

  // Filter available genres based on age group
  const availableGenres = Object.values(Genre).filter(g => {
    if (g === Genre.ADULT_ROMANCE) {
        return ageGroup === AgeGroup.ADULT;
    }
    return true;
  });

  // Dynamic placeholder based on age group
  const getPlaceholder = (age: AgeGroup) => {
    switch (age) {
        case AgeGroup.TODDLER:
            return "مثال: عصفور صغير يتعلم الطيران لأول مرة ويبحث عن أمه...";
        case AgeGroup.CHILD:
            return "مثال: أرنب شجاع يحاول الوصول إلى القمر ليجد دواءً لصديقه المريض...";
        case AgeGroup.PRETEEN:
            return "مثال: مجموعة أصدقاء يكتشفون خريطة كنز قديمة في مكتبة المدرسة...";
        case AgeGroup.TEEN:
            return "مثال: طالب يكتشف قدرات خارقة ويحاول موازنة حياته الدراسية مع إنقاذ المدينة...";
        case AgeGroup.ADULT:
            return "مثال: رواية تاريخية عن صراع العروش في الأندلس، أو قصة درامية معقدة عن الذاكرة والهوية...";
        default:
            return "اكتب فكرة حكايتك هنا...";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-[#2D2420] rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.4)] border border-stone-100 dark:border-stone-700/50 overflow-hidden relative transition-colors duration-300">
        
      {/* Header Decorative */}
      <div className={`h-2 w-full transition-colors duration-500 ${ageGroup === AgeGroup.ADULT ? 'bg-gradient-to-r from-amber-700 to-red-900' : 'bg-gradient-to-r from-primary to-primary-light'}`}></div>

      <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">
        
        {/* Main Prompt */}
        <div className="space-y-4">
          <label className="text-xl text-primary-dark dark:text-stone-200 font-bold flex items-center gap-2 font-serif">
            <BookOpen className="w-6 h-6 text-accent" />
            ما هي فكرة حكايتك؟
          </label>
          <div className="relative group">
            <textarea
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={getPlaceholder(ageGroup)}
              className="w-full p-6 pb-14 border-2 border-stone-200 dark:border-stone-600 rounded-3xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all h-40 resize-none text-xl leading-relaxed bg-stone-50 dark:bg-[#1f1a18] dark:text-white dark:placeholder-stone-600 shadow-inner"
            />
            
            {/* Microphone Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`absolute bottom-4 left-4 p-3 rounded-full transition-all duration-300 flex items-center justify-center shadow-lg
                ${isListening 
                  ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' 
                  : 'bg-white dark:bg-stone-700 text-primary dark:text-stone-300 hover:text-accent border border-stone-200 dark:border-stone-500 hover:scale-110'
                }
              `}
              title="اضغط للتحدث"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            {isListening && (
                <span className="absolute bottom-6 left-16 text-sm text-red-500 font-bold animate-pulse">جاري الاستماع...</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Age Group Selection */}
          <div className="space-y-3">
            <label className="text-gray-700 dark:text-stone-300 font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              الفئة العمرية
            </label>
            <div className="relative">
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                className="w-full p-4 border-2 border-stone-200 dark:border-stone-600 rounded-2xl focus:border-accent focus:ring-4 focus:ring-accent/10 bg-white dark:bg-[#1f1a18] dark:text-white appearance-none transition-all cursor-pointer hover:border-stone-300 dark:hover:border-stone-500"
              >
                {Object.values(AgeGroup).map((age) => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
              
              {ageGroup === AgeGroup.ADULT && (
                 <div className="absolute -bottom-10 right-0 w-full animate-fade-in z-10">
                     <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>تفعيل السرد للكبار: تم فتح الخيارات الخاصة والمواضيع المعقدة.</p>
                     </div>
                 </div>
              )}
            </div>
          </div>

          {/* Genre Selection */}
          <div className="space-y-3">
            <label className="text-gray-700 dark:text-stone-300 font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              نوع القصة
            </label>
            <div className="relative">
                <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as Genre)}
                className="w-full p-4 border-2 border-stone-200 dark:border-stone-600 rounded-2xl focus:border-accent focus:ring-4 focus:ring-accent/10 bg-white dark:bg-[#1f1a18] dark:text-white appearance-none transition-all cursor-pointer hover:border-stone-300 dark:hover:border-stone-500"
                >
                {availableGenres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                ))}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                {genre === Genre.ADULT_ROMANCE && (
                    <div className="absolute right-0 top-0 -mt-2 -mr-2">
                        <Heart className="w-6 h-6 text-red-500 fill-current animate-pulse" />
                    </div>
                )}
            </div>
          </div>

          {/* Length Selection */}
          <div className="space-y-3">
            <label className="text-gray-700 dark:text-stone-300 font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              طول القصة
            </label>
            <div className="relative">
                <select
                value={length}
                onChange={(e) => setLength(e.target.value as StoryLength)}
                className="w-full p-4 border-2 border-stone-200 dark:border-stone-600 rounded-2xl focus:border-accent focus:ring-4 focus:ring-accent/10 bg-white dark:bg-[#1f1a18] dark:text-white appearance-none transition-all cursor-pointer hover:border-stone-300 dark:hover:border-stone-500"
                >
                {Object.values(StoryLength).map((len) => (
                    <option key={len} value={len}>{len}</option>
                ))}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
          </div>

          {/* Character Name */}
          <div className="space-y-3">
             <label className="text-gray-700 dark:text-stone-300 font-bold flex items-center gap-2">
                <AlignLeft className="w-5 h-5 text-accent" />
                اسم البطل (اختياري)
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="مثال: علي، ليلى..."
                className="w-full p-4 border-2 border-stone-200 dark:border-stone-600 rounded-2xl focus:border-accent focus:ring-4 focus:ring-accent/10 bg-white dark:bg-[#1f1a18] dark:text-white dark:placeholder-stone-600 transition-all"
              />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
            <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-5 px-8 rounded-2xl font-bold text-xl text-white transition-all duration-300 transform shadow-xl
                ${isLoading 
                    ? 'bg-stone-300 dark:bg-stone-700 cursor-not-allowed translate-y-0 shadow-none' 
                    : ageGroup === AgeGroup.ADULT
                        ? 'bg-gradient-to-r from-stone-800 to-stone-700 hover:to-stone-900 hover:-translate-y-1 hover:shadow-stone-900/30'
                        : 'bg-gradient-to-r from-primary to-primary-light hover:to-primary hover:-translate-y-1 hover:shadow-primary/30 active:scale-[0.98]'
                }
            `}
            >
            {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                <Wand2 className="w-6 h-6 animate-spin" />
                جاري التأليف...
                </span>
            ) : (
                <span className="flex items-center justify-center gap-3">
                    <Feather className="w-6 h-6" />
                    {ageGroup === AgeGroup.ADULT ? 'تأليف الرواية' : 'ابـدأ الـحـكـايـة'}
                </span>
            )}
            </button>
        </div>
      </form>
    </div>
  );
};

export default StoryForm;