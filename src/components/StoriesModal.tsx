import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Quote, Coffee, Leaf, ArrowRight, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoriesModal: React.FC<StoriesModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeStory, setActiveStory] = useState<'anouk' | 'mark'>('anouk');
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
    }
    if (modalContainerRef.current) {
      modalContainerRef.current.scrollTop = 0;
    }
  }, [activeStory]);

  const stories = [
    {
      id: 'anouk' as const,
      title: t('stories.anouk.title'),
      content: t('stories.anouk.content'),
      author: "Anouk, 24",
      role: "Huiszoeker",
      icon: Coffee,
      color: "bg-primary",
      image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=640&auto=format&fit=crop"
    },
    {
      id: 'mark' as const,
      title: t('stories.mark.title'),
      content: t('stories.mark.content'),
      author: "Mark, 32",
      role: "Huisaanbieder",
      icon: Leaf,
      color: "bg-secondary",
      image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=640&auto=format&fit=crop"
    }
  ];

  const currentStory = stories.find(s => s.id === activeStory) || stories[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            ref={modalContainerRef}
            className="relative w-full max-w-6xl max-h-[90vh] bg-background text-on-background rounded-2xl md:rounded-[3rem] shadow-2xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row"
          >
            {/* Sidebar / Tabs */}
            <div className="w-full md:w-80 bg-surface-container-low border-r border-outline flex flex-col shrink-0">
              <div className="p-8 pb-4">
                <h2 className="text-2xl font-black tracking-tight text-on-background mb-2">
                  {t('stories.modal.title')}
                </h2>
                <div className="h-1.5 w-12 bg-primary rounded-full" />
              </div>

              <div className="flex-1 p-4 space-y-3">
                {stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => setActiveStory(story.id)}
                    className={`w-full text-left p-6 rounded-3xl transition-all flex items-start gap-4 group ${
                      activeStory === story.id 
                        ? 'bg-surface shadow-xl shadow-black/5 border border-outline' 
                        : 'hover:bg-surface-container'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl shrink-0 transition-colors ${
                      activeStory === story.id ? story.color + ' text-white' : 'bg-surface-container-high text-on-surface-variant group-hover:bg-surface-container-highest'
                    }`}>
                      <story.icon size={20} />
                    </div>
                    <div>
                      <h4 className={`font-black text-sm leading-tight mb-1 ${
                        activeStory === story.id ? 'text-on-background' : 'text-on-surface-variant'
                      }`}>
                        {story.title}
                      </h4>
                      <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">{story.author}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-8 border-t border-outline hidden md:block">
                <div className="flex items-center gap-3 text-primary">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                     <Quote size={14} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Real stories</span>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-6 flex justify-end shrink-0 md:absolute md:top-4 md:right-4 md:z-10">
                <button 
                  onClick={onClose}
                  className="cm-modal-close-button p-3 rounded-2xl"
                  id="close-stories-modal"
                >
                  <X size={24} />
                </button>
              </div>

              <div ref={contentAreaRef} className="flex-1 overflow-y-auto p-8 md:p-16">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStory}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-12"
                  >
                    <div className="grid lg:grid-cols-2 gap-12 items-start">
                       <div className="space-y-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                             <User size={12} />
                             {currentStory.role}
                          </div>
                          <h3 className="text-3xl md:text-4xl lg:text-5xl font-black text-on-background leading-[1.1] tracking-tight">
                            {currentStory.title}
                          </h3>
                       </div>

                       <div className="sticky top-0">
                          <div className="aspect-[4/3] lg:aspect-[16/10] rounded-2xl md:rounded-[3rem] overflow-hidden shadow-2xl relative group">
                             <img 
                              src={currentStory.image} 
                              alt={currentStory.author}
                              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                              referrerPolicy="no-referrer"
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                             <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 text-white">
                                <p className="text-2xl md:text-3xl font-black">{currentStory.author}</p>
                                <p className="text-white/70 font-bold uppercase tracking-widest text-xs md:text-sm">{currentStory.role}</p>
                             </div>
                          </div>
                       </div>

                       <div className="lg:col-span-2 relative mt-2 md:mt-6">
                          <div className="absolute -left-6 -top-4 text-primary opacity-20 hidden md:block">
                            <Quote size={48} />
                          </div>
                          <div className="text-base md:text-lg text-on-surface-variant leading-relaxed space-y-6 whitespace-pre-wrap md:pl-2">
                            {currentStory.content}
                          </div>
                       </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
