import React, { useState } from 'react';
import { Key, Lock, CheckCircle, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave }) => {
  const [keyInput, setKeyInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInput.trim()) {
      onSave(keyInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#2D2420] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 dark:border-stone-700">
        <div className="bg-primary p-6 text-white text-center">
            <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                <Key className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold font-serif">مطلوب مفتاح التشغيل</h2>
            <p className="text-primary-light/80 text-sm mt-1">للبدء في تأليف الحكايات، نحتاج إلى ربط التطبيق</p>
        </div>
        
        <div className="p-8 space-y-6">
            <div className="text-stone-600 dark:text-stone-300 text-sm leading-relaxed text-center">
                هذا التطبيق يستخدم <strong>Google Gemini AI</strong>. لكي يعمل، يجب عليك إدخال مفتاح API الخاص بك.
                <br/>
                <span className="text-xs opacity-70">(يتم حفظ المفتاح في جهازك فقط ولا يشارك مع أحد)</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input 
                        type="password" 
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full pr-12 pl-4 py-4 rounded-xl border-2 border-stone-200 dark:border-stone-600 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-stone-50 dark:bg-stone-800 dark:text-white outline-none transition-all font-mono text-sm"
                        required
                    />
                </div>
                
                <button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-primary/30 flex items-center justify-center gap-2"
                >
                    <CheckCircle className="w-5 h-5" />
                    حفظ ومتابعة
                </button>
            </form>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-700 text-center">
                <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary dark:text-accent text-sm font-bold hover:underline"
                >
                    <ExternalLink className="w-4 h-4" />
                    احصل على مفتاح مجاني من Google
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;