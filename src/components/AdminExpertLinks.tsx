import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Edit2, Trash2, Globe, Tag, SortAsc, Eye, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ExpertLink, ExpertHub } from './ExpertHub';
import { motion, AnimatePresence } from 'motion/react';
import { TypeAheadSelect } from './TypeAheadSelect';

const CATEGORIES = ['Juristen', 'Verzekeraars', 'Hypotheekadviseurs', 'Notarissen', 'Verhuizers', 'Overige'];
const COUNTRIES = [
  'België', 'Bulgarije', 'Cyprus', 'Denemarken', 'Duitsland', 'Estland', 
  'Finland', 'Frankrijk', 'Griekenland', 'Hongarije', 'Ierland', 'Italië', 
  'Kroatië', 'Letland', 'Litouwen', 'Luxemburg', 'Malta', 'Nederland', 
  'Oostenrijk', 'Polen', 'Portugal', 'Roemenië', 'Slovenië', 'Slowakije', 
  'Spanje', 'Tsjechië', 'Zweden', 'Verenigd Koninkrijk', 'Zwitserland', 'Noorwegen'
];

export default function AdminExpertLinks() {
  const { t } = useTranslation();
  const [links, setLinks] = useState<ExpertLink[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterCountry, setFilterCountry] = useState<string>('Alle');
  const [filterCategory, setFilterCategory] = useState<string>('Alle');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Partial<ExpertLink> | null>(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCountry, setPreviewCountry] = useState('Nederland');

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'expert_links'));
      const snapshot = await getDocs(q);
      const fetchedLinks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExpertLink));
      fetchedLinks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setLinks(fetchedLinks);
    } catch (err) {
      console.error(err);
      toast.error('Fout bij ophalen links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink?.title || !editingLink?.url || !editingLink?.country || !editingLink?.category) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    try {
      const id = editingLink.id || doc(collection(db, 'expert_links')).id;
      const ref = doc(db, 'expert_links', id);
      
      const payload: any = {
        title: editingLink.title,
        url: editingLink.url,
        country: editingLink.country,
        category: editingLink.category,
        order_index: editingLink.order_index || 0,
        description: editingLink.description || '',
        linkType: editingLink.linkType || 'lead',
        isActive: editingLink.isActive !== undefined ? editingLink.isActive : true,
        updatedAt: serverTimestamp()
      };

      if (!editingLink.id) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(ref, payload, { merge: true });
      toast.success('Link opgeslagen');
      setIsEditModalOpen(false);
      fetchLinks();
    } catch (err) {
      console.error(err);
      toast.error('Gevalideerde fout bij opslaan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Weet je zeker dat je deze link wilt verwijderen?')) return;
    try {
      await deleteDoc(doc(db, 'expert_links', id));
      toast.success('Link verwijderd');
      fetchLinks();
    } catch (err) {
      console.error(err);
      toast.error('Fout bij verwijderen');
    }
  };

  const moveUp = async (index: number, filteredList: ExpertLink[]) => {
    if (index === 0) return;
    const current = filteredList[index];
    const prev = filteredList[index - 1];
    
    try {
      await updateDoc(doc(db, 'expert_links', current.id), { order_index: prev.order_index });
      await updateDoc(doc(db, 'expert_links', prev.id), { order_index: current.order_index });
      
      // Optimaal lokaal updaten in plaats van full fetch
      fetchLinks();
    } catch (err) {
      toast.error('Fout bij sorteren');
    }
  };

  const moveDown = async (index: number, filteredList: ExpertLink[]) => {
    if (index === filteredList.length - 1) return;
    const current = filteredList[index];
    const next = filteredList[index + 1];
    
    try {
      await updateDoc(doc(db, 'expert_links', current.id), { order_index: next.order_index });
      await updateDoc(doc(db, 'expert_links', next.id), { order_index: current.order_index });
      
      fetchLinks();
    } catch (err) {
      toast.error('Fout bij sorteren');
    }
  };

  const filteredLinks = links.filter(l => 
    (filterCountry === 'Alle' || l.country === filterCountry) &&
    (filterCategory === 'Alle' || l.category === filterCategory)
  );

  const countriesInUse = Array.from(new Set(links.map(l => l.country)));
  const filterCountryOptions = ['Alle', ...new Set([...COUNTRIES, ...countriesInUse])];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
        <div className="flex flex-wrap gap-4 flex-1">
          <div>
            <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1 mb-1">
              <Globe size={14} /> Land
            </label>
            <TypeAheadSelect
              value={filterCountry}
              onChange={(val) => setFilterCountry(val)}
              options={filterCountryOptions.map(c => ({ value: c, label: c }))}
              placeholder="Selecteer een land"
              className="w-full sm:w-[200px]"
              inputClassName="w-full px-4 py-2 bg-surface rounded-xl border border-outline-variant outline-none focus:border-primary text-sm pr-10"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1 mb-1">
              <Tag size={14} /> Categorie
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 bg-surface rounded-xl border border-outline-variant outline-none focus:border-primary text-sm min-w-[150px]"
            >
              <option value="Alle">Alle categorieën</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPreviewCountry(filterCountry === 'Alle' ? 'Nederland' : filterCountry);
              setIsPreviewOpen(true);
            }}
            className="flex items-center gap-2 py-2 px-4 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors rounded-xl font-bold text-sm"
          >
            <Eye size={16} /> Voorbeeld
          </button>
          <button
            onClick={() => {
              setEditingLink({
                country: filterCountry !== 'Alle' ? filterCountry : 'Nederland',
                category: filterCategory !== 'Alle' ? filterCategory : CATEGORIES[0],
                order_index: links.length > 0 ? Math.max(...links.map(l => l.order_index || 0)) + 1 : 0,
                isActive: true,
                linkType: 'lead'
              });
              setIsEditModalOpen(true);
            }}
            className="flex items-center gap-2 py-2 px-4 bg-primary text-on-primary hover:bg-primary/90 transition-colors rounded-xl font-bold text-sm"
          >
            <Plus size={16} /> Nieuwe Link
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Laden...</div>
        ) : filteredLinks.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">Geen links gevonden voor deze filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant text-sm border-t border-outline-variant/30">
                  <th className="p-4 font-bold">{t('admin_experts.col_country', 'Land')}</th>
                  <th className="p-4 font-bold">Categorie</th>
                  <th className="p-4 font-bold">Titel & Details</th>
                  <th className="p-4 font-bold w-32">Volgorde</th>
                  <th className="p-4 font-bold w-24">{t('admin_experts.col_status', 'Status')}</th>
                  <th className="p-4 font-bold text-right">{t('common.actions', 'Acties')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map((link, idx) => (
                  <tr key={link.id || idx} className="border-b border-outline-variant/50 hover:bg-surface-container-low/50">
                    <td className="p-4 font-medium">{link.country}</td>
                    <td className="p-4 text-sm text-on-surface-variant">
                      {link.category}
                      <div className="text-[10px] uppercase font-bold mt-1 text-primary">{link.linkType === 'info' ? 'Informatief' : 'Lead Gen'}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-on-surface">{link.title}</div>
                      <div className="text-xs text-on-surface-variant mt-1 line-clamp-1 max-w-sm" title={link.description}>
                        {link.description}
                      </div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                        {link.url}
                      </a>
                    </td>
                    <td className="p-4">
                      {filterCountry !== 'Alle' && filterCategory !== 'Alle' ? (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => moveUp(idx, filteredLinks)}
                            disabled={idx === 0}
                            className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:hover:text-current"
                          >
                            <SortAsc size={16} className="rotate-180" />
                          </button>
                          <span className="w-6 text-center text-sm font-mono">{link.order_index}</span>
                          <button 
                            onClick={() => moveDown(idx, filteredLinks)}
                            disabled={idx === filteredLinks.length - 1}
                            className="p-1 text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:hover:text-current"
                          >
                            <SortAsc size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-mono text-on-surface-variant/70">{link.order_index}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${link.isActive ? 'bg-primary/10 text-primary' : 'bg-outline-variant/20 text-on-surface-variant'}`}>
                        {link.isActive ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingLink(link);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-on-surface-variant hover:text-primary bg-surface-container rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(link.id)}
                          className="p-2 text-error/70 hover:text-error bg-error/10 hover:bg-error/20 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filterCountry === 'Alle' || filterCategory === 'Alle' ? (
              <div className="p-3 text-xs text-center text-on-surface-variant bg-surface-container-lowest">
                Selecteer een specifiek Land én Categorie om de volgorde te wijzigen met pijltjes.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface rounded-3xl p-6 w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{editingLink?.id ? 'Bewerk Link' : 'Nieuwe Link'}</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-surface-container rounded-full text-on-surface-variant hover:text-on-surface">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-1">{t('admin_experts.col_country', 'Land')}</label>
                    <TypeAheadSelect
                      value={editingLink?.country || ''}
                      onChange={(val) => setEditingLink({...editingLink, country: val})}
                      options={[...new Set([...COUNTRIES, ...(links.map(l => l.country))])].map(c => ({ value: c, label: c }))}
                      placeholder="Selecteer land"
                      inputClassName="w-full px-4 py-3 bg-surface-container rounded-xl outline-none focus:border-primary border border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-1">Categorie</label>
                    <select required className="w-full px-4 py-3 bg-surface-container rounded-xl outline-none focus:border-primary border border-transparent" value={editingLink?.category || CATEGORIES[0]} onChange={(e) => setEditingLink({...editingLink, category: e.target.value})}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Sorteer Volgorde</label>
                  <input type="number" required className="w-full px-4 py-3 bg-surface-container rounded-xl outline-none focus:border-primary border border-transparent" value={editingLink?.order_index || 0} onChange={(e) => setEditingLink({...editingLink, order_index: Number(e.target.value)})} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">{t('admin_experts.col_title', 'Titel')}</label>
                  <input type="text" required className="w-full px-4 py-3 bg-surface-container rounded-xl outline-none focus:border-primary border border-transparent" value={editingLink?.title || ''} onChange={(e) => setEditingLink({...editingLink, title: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Type Link</label>
                  <select required className="w-full px-4 py-3 bg-surface-container rounded-xl outline-none focus:border-primary border border-transparent" value={editingLink?.linkType || 'lead'} onChange={(e) => setEditingLink({...editingLink, linkType: e.target.value as 'lead'|'info'})}>
                    <option value="lead">Lead Gen (Met 'Meer info' prospect formulier)</option>
                    <option value="info">Informatief (Directe knop naar website)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">URL (Website)</label>
                  <input type="url" required placeholder="https://" className="w-full px-4 py-3 bg-surface-container rounded-xl outline-none focus:border-primary border border-transparent" value={editingLink?.url || ''} onChange={(e) => setEditingLink({...editingLink, url: e.target.value})} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Korte beschrijving</label>
                  <textarea rows={3} className="w-full px-4 py-3 bg-surface-container rounded-xl outline-none focus:border-primary border border-transparent resize-none" value={editingLink?.description || ''} onChange={(e) => setEditingLink({...editingLink, description: e.target.value})} />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={editingLink?.isActive !== false} onChange={(e) => setEditingLink({...editingLink, isActive: e.target.checked})} />
                    <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    <span className="ml-3 text-sm font-medium text-on-surface">Actief (zichtbaar voor gebruikers)</span>
                  </label>
                </div>

                <div className="pt-6 flex gap-3">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-3 bg-surface-container hover:bg-outline-variant/20 rounded-xl font-bold transition-colors">
                    Annuleren
                  </button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-primary text-on-primary hover:bg-primary/90 rounded-xl font-bold transition-colors">
                    Opslaan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col items-center">
              <button onClick={() => setIsPreviewOpen(false)} className="absolute top-4 right-4 p-2 bg-surface-container rounded-full text-on-surface-variant hover:text-on-surface">
                <X size={20} />
              </button>
              
              <h2 className="text-xl font-bold mb-4 w-full text-left">Voorbeeld: {previewCountry}</h2>
              <div className="w-full p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
                 {/* Trigger the real component */}
                 <ExpertHub forceShow={true} isProvider={false} isFavorite={true} country={previewCountry} />
              </div>
              <p className="text-xs text-center text-on-surface-variant mt-4 w-full">
                Let op: klik in de voorbeeld modal niet op opt-in of url's om popups te voorkomen!
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
