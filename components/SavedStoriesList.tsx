import React, { useRef } from 'react';
import { SavedStory } from '../types';
import { Trash2, Calendar, BookOpen, ArrowLeft, ArrowUpRight, Clock, Download, Upload } from 'lucide-react';

interface SavedStoriesListProps {
  stories: SavedStory[];
  onSelect: (story: SavedStory) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

const SavedStoriesList: React.FC<SavedStoriesListProps> = ({ stories, onSelect, onDelete, onBack }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const dataStr = JSON.stringify(stories);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `hakayat_backup_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = event.target.files && event.target.files[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = e.target?.result as string;
            const importedStories = JSON.parse(json) as SavedStory[];
            
            if (Array.isArray(importedStories)) {
                // Merge with existing stories, avoiding duplicates by ID
                const existingIds = new Set(stories.map(s => s.id));
                const newStories = importedStories.filter(s => !existingIds.has(s.id));
                
                if (newStories.length === 0) {
                    alert("لم يتم العثور على قصص جديدة لاستيرادها (ربما هي موجودة بالفعل).");
                } else {
                    const merged = [...newStories, ...stories];
                    localStorage.setItem('hakayat_stories', JSON.stringify(merged));
                    alert(`تم استيراد ${newStories.length} قصة بنجاح! قم بتحديث الصفحة لرؤيتها.`);
                    window.location.reload();
                }
            } else {
                alert("صيغة الملف غير صحيحة.");
            }
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء قراءة الملف.");
        }
    };
    reader.readAsText(fileObj);
    // Reset input
    if (event.target) event.target.value = '';
  };

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in">
        <div className="bg-white dark:bg-stone-800 p-10 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] border border-stone-100 dark:border-stone-700">
           <BookOpen className="w-20 h-20 text-stone-200 dark:text-stone-600" />
        </div>
        <div className="max-w-md space-y-2">
            <h3 className="text-3xl font-bold text-stone-800 dark:text-stone-200 font-serif">المكتبة فارغة</h3>
            <p className="text-stone-500 dark:text-stone-400 text-lg">لم تقم بحفظ أي قصص بعد. ابدأ رحلتك الآن وقم بتأليف قصتك الأولى.</p>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={onBack} 
                className="group flex items-center gap-3 bg-primary text-white font-bold px-8 py-4 rounded-2xl hover:bg-primary-light transition-all duration-300 transform hover:-translate-y-1 shadow-lg shadow-primary/20"
            >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                تأليف قصة جديدة
            </button>
            <button 
                onClick={handleImportClick}
                className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold px-6 py-4 rounded-2xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
            >
                <Upload className="w-5 h-5" />
                استيراد قصص
            </button>
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            className="hidden" 
        />
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-fade-in pb-12">
       <div className="flex flex-col md:flex-row items-center justify-between border-b border-stone-200 dark:border-stone-700/50 pb-8 gap-6">
         <div className="flex items-center gap-5">
            <div className="bg-primary/5 dark:bg-primary/20 p-4 rounded-2xl">
                <BookOpen className="w-10 h-10 text-primary dark:text-primary-light" />
            </div>
            <div>
                <h2 className="text-4xl font-bold font-serif text-stone-800 dark:text-stone-100">مكتبة الحكايات</h2>
                <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 mt-2 text-sm font-medium">
                    <span className="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md text-stone-700 dark:text-stone-300">
                        {stories.length}
                    </span>
                    <span>قصص محفوظة</span>
                </div>
            </div>
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
             <button 
                onClick={handleExport}
                className="flex items-center gap-2 text-stone-500 dark:text-stone-400 font-bold hover:text-primary dark:hover:text-white px-4 py-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors bg-white dark:bg-[#2D2420] border border-stone-200 dark:border-stone-700/50 shadow-sm"
                title="حفظ نسخة احتياطية"
             >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">تصدير</span>
             </button>
             
             <button 
                onClick={handleImportClick}
                className="flex items-center gap-2 text-stone-500 dark:text-stone-400 font-bold hover:text-primary dark:hover:text-white px-4 py-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors bg-white dark:bg-[#2D2420] border border-stone-200 dark:border-stone-700/50 shadow-sm"
                title="استعادة نسخة احتياطية"
             >
                <Upload className="w-5 h-5" />
                <span className="hidden sm:inline">استيراد</span>
             </button>
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".json" 
                className="hidden" 
            />

            <div className="w-px h-8 bg-stone-200 dark:bg-stone-700 mx-1"></div>

             <button 
                onClick={onBack} 
                className="flex items-center gap-2 text-stone-500 dark:text-stone-400 font-bold hover:text-primary dark:hover:text-white px-6 py-3 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors bg-white dark:bg-[#2D2420] border border-stone-200 dark:border-stone-700/50 shadow-sm"
            >
                <ArrowLeft className="w-5 h-5" />
                العودة للرئيسية
            </button>
         </div>
       </div>
       
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stories.map((item) => (
            <div 
                key={item.id} 
                className="group bg-white dark:bg-[#25201d] rounded-[2rem] shadow-sm hover:shadow-2xl border border-stone-100 dark:border-stone-800 overflow-hidden transition-all duration-500 hover:-translate-y-2 flex flex-col cursor-pointer relative"
                onClick={() => onSelect(item)}
            >
               <div className="h-64 bg-stone-100 dark:bg-stone-800 relative overflow-hidden">
                  {item.imageSrc ? (
                    <img 
                        src={item.imageSrc} 
                        alt={item.story.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-800/50 text-stone-300 dark:text-stone-600 bg-pattern">
                      <BookOpen className="w-16 h-16 mb-4 opacity-50" />
                      <span className="text-sm font-medium opacity-70">بدون غلاف</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
                  
                  {/* Floating Date Badge */}
                  <div className="absolute top-4 right-4 bg-white/90 dark:bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-200 shadow-sm">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString('ar-SA')}
                  </div>

                  {/* Title Overlay on Image */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                     <h3 className="font-bold text-2xl text-white font-serif line-clamp-2 leading-tight drop-shadow-md">
                        {item.story.title}
                     </h3>
                  </div>
               </div>
               
               <div className="p-6 flex-1 flex flex-col bg-white dark:bg-[#25201d]">
                 <p className="text-stone-500 dark:text-stone-400 line-clamp-3 mb-6 flex-1 leading-relaxed text-sm">
                    {item.story.summary}
                 </p>
                 
                 <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800 mt-auto">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                        className="flex items-center gap-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl transition-all text-xs font-bold"
                        title="حذف القصة"
                    >
                        <Trash2 className="w-4 h-4" />
                        حذف
                    </button>
                    <span className="text-primary dark:text-accent font-bold text-sm flex items-center gap-1 bg-primary/5 dark:bg-accent/10 px-4 py-2 rounded-xl group-hover:bg-primary group-hover:text-white dark:group-hover:bg-accent dark:group-hover:text-stone-900 transition-all duration-300">
                        قراءة الآن
                        <ArrowLeft className="w-4 h-4" />
                    </span>
                 </div>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
};

export default SavedStoriesList;