import React, { useState, ChangeEvent, DragEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Save, Upload, FileText, HelpCircle, X, ShieldAlert, AlertCircle } from 'lucide-react';

const countries = ['België', 'Nederland', 'Frankrijk', 'Duitsland', 'Spanje', 'Italië', 'Verenigd Koninkrijk']; // Minimal example list
const genders = ['Man / Vrouw / Non-binair / Anders', 'Man', 'Vrouw', 'Non-binair', 'Anders']; // Simplified example list

export default function UserProfilePage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState({
    name: '',
    birthCountry: '',
    age: '',
    gender: '',
    description: '',
    hobbies: '',
    questText: ''
  });
  const [showExamples, setShowExamples] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPIIConfirmation, setShowPIIConfirmation] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleFileUpload = (files: FileList | null) => {
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfile(prev => ({ ...prev, questText: prev.questText + (prev.questText ? '\n\n' : '') + (e.target?.result as string) }));
      };
      reader.readAsText(files[0]);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const handleSave = () => {
    const combinedText = `${profile.questText} ${profile.description} ${profile.hobbies}`;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
    const hasPII = emailRegex.test(combinedText) || phoneRegex.test(combinedText);

    if (hasPII && !showPIIConfirmation) {
      setShowPIIConfirmation(true);
      return;
    }

    console.log("Save profile:", profile);
    onBack();
  };

  React.useEffect(() => {
    if (showExamples || showPIIConfirmation) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showExamples, showPIIConfirmation]);

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12">
      <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant font-bold mb-8 hover:text-primary transition-all">
        <ArrowLeft size={20} />
        {t('common.cancel')}
      </button>

      <h1 className="text-3xl font-display font-bold text-on-background mb-8">{t('profile.title')}</h1>

      <div className="bg-surface p-8 rounded-[2rem] border border-outline shadow-sm space-y-8">
        {/* Hard Profile Data */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Hard Gegevens (Verplicht)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="font-bold text-sm text-on-surface">{t('profile.name')} *</label>
              <input required name="name" value={profile.name} onChange={handleChange} className="w-full p-3 rounded-xl border border-outline focus:outline-primary" />
            </div>
            <div className="space-y-2">
              <label className="font-bold text-sm text-on-surface">{t('profile.birth_country')} *</label>
              <select required name="birthCountry" value={profile.birthCountry} onChange={handleChange} className="w-full p-3 rounded-xl border border-outline focus:outline-primary bg-surface text-on-surface">
                <option value="">{t('user.select_country', 'Kies land...')}</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-bold text-sm text-on-surface">{t('profile.age')} *</label>
              <input required name="age" type="number" value={profile.age} onChange={handleChange} className="w-full p-3 rounded-xl border border-outline focus:outline-primary" />
            </div>
            <div className="space-y-2">
              <label className="font-bold text-sm text-on-surface">{t('profile.gender')} *</label>
              <select required name="gender" value={profile.gender} onChange={handleChange} className="w-full p-3 rounded-xl border border-outline focus:outline-primary bg-surface text-on-surface">
                <option value="">{t('user.select_gender', 'Kies geslacht...')}</option>
                {genders.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Quest/Description */}
        <section className="space-y-6 border-t pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Jouw Zoekopdracht / Jezelf (optioneel)</h2>
            <button onClick={() => setShowExamples(true)} className="flex items-center gap-1 text-sm text-primary font-bold"><HelpCircle size={16}/> Voorbeelden</button>
          </div>

          <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-3">
            <AlertCircle size={20} className="text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-primary">Privacy Waarschuwing</p>
              <p className="text-xs leading-relaxed text-on-surface-variant font-medium">
                Vermeld in deze velden geen privégegevens zoals je adres, telefoonnummer of e-mailadres. Dit is belangrijk voor je privacy en helpt onze AI om een betere match voor je te vinden.
              </p>
            </div>
          </div>
          
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-outline rounded-2xl p-6 text-center cursor-pointer hover:border-primary transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
           <Upload className="mx-auto mb-2 text-primary" size={24}/>
           <p className="text-sm">Sleep hier je tekst/pdf/doc of klik om te uploaden</p>
           <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e.target.files)} accept=".txt,.pdf,.doc,.docx"/>
          </div>

          <div className="space-y-2">
            <textarea name="questText" value={profile.questText} onChange={handleChange} className="w-full p-3 rounded-xl border border-outline focus:outline-primary h-48" placeholder="Beschrijf jezelf en waar je naar op zoek bent..." />
          </div>
          
          <div className="space-y-2">
            <label className="font-bold text-sm text-on-surface">Jezelf beschrijven (optioneel)</label>
            <textarea name="description" value={profile.description} onChange={handleChange} className="w-full p-3 rounded-xl border border-outline focus:outline-primary h-24" />
          </div>

          <div className="space-y-2">
            <label className="font-bold text-sm text-on-surface">Hobbies (optioneel)</label>
            <textarea name="hobbies" value={profile.hobbies} onChange={handleChange} className="w-full p-3 rounded-xl border border-outline focus:outline-primary h-24" />
          </div>
        </section>

        <button onClick={handleSave} className="w-full py-4 bg-primary text-on-primary rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all">
          <Save size={20} />
          {t('common.save')}
        </button>
      </div>

      {showExamples && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background text-on-background rounded-3xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto relative border border-outline">
            <button onClick={() => setShowExamples(false)} className="absolute top-4 right-4"><X /></button>
            <h2 className="text-2xl font-bold mb-4">Voorbeelden</h2>
            <div className="bg-surface-container p-4 rounded-xl text-sm italic mb-4">
              "I'm 24F and an incoming master's student at UGent. I'm quiet but very friendly. I enjoy meeting new people. I'm very clean and respectful, and I enjoy sharing."
              <button className="mt-2 block w-full bg-surface border border-outline p-2 rounded text-xs font-bold">Kopieer</button>
            </div>
            {/* Add more examples in other languages if needed based on the request */}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPIIConfirmation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-background text-on-background max-w-md w-full p-8 rounded-[2.5rem] shadow-2xl border border-outline text-center"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-primary">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-xl font-display font-black mb-4">Privacy Check</h3>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed mb-8">
                We hebben mogelijk contactgegevens in je tekst gevonden. Voor een eerlijke AI match en jouw privacy raden we aan deze niet te vermelden. Wil je de tekst aanpassen?
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowPIIConfirmation(false)}
                  className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Ja, ik pas het aan
                </button>
                <button 
                  onClick={() => {
                    setShowPIIConfirmation(false);
                    // Force save
                    console.log("Save profile (forced):", profile);
                    onBack();
                  }}
                  className="w-full py-3 text-on-surface-variant font-bold hover:bg-surface-container rounded-xl transition-all"
                >
                  Nee, ga door met opslaan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
