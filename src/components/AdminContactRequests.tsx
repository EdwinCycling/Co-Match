import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { MessageSquare, Mail, Calendar, User, CheckCircle2, Clock, ChevronRight, X, Reply, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface ContactRequest {
  id: string;
  uid: string;
  email: string;
  title: string;
  message: string;
  createdAt: any;
  status: 'OPEN' | 'REPLIED';
  type?: 'general' | 'limit_upgrade';
}

export const AdminContactRequests: React.FC = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'contact_requests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactRequest)));
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Fout bij ophalen berichten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleStatusChange = async (id: string, newStatus: 'OPEN' | 'REPLIED') => {
    try {
      await updateDoc(doc(db, 'contact_requests', id), { status: newStatus });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      if (selectedRequest?.id === id) {
        setSelectedRequest(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success('Status bijgewerkt');
    } catch (error) {
      toast.error('Fout bij bijwerken status');
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '-';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('nl-NL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-gray-900">{t('admin_contact.title', 'Contact Berichten')}</h2>
          <p className="text-gray-500 font-medium">Beheer vragen van gebruikers ({requests.length})</p>
        </div>
        <button 
          onClick={fetchRequests}
          className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
        >
          <Calendar size={20} className="text-primary" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* List */}
        <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-bold">Nog geen berichten ontvangen</p>
            </div>
          ) : (
            requests.map(request => (
              <motion.div
                layoutId={request.id}
                key={request.id}
                onClick={() => setSelectedRequest(request)}
                className={`bg-white rounded-3xl p-6 border-2 transition-all cursor-pointer group ${
                  selectedRequest?.id === request.id ? 'border-primary shadow-xl' : 'border-transparent shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      request.status === 'OPEN' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {request.status}
                    </div>
                    {request.type === 'limit_upgrade' && (
                      <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                        <Home size={10} />
                        Upgrade
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">{formatDate(request.createdAt)}</span>
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-1 group-hover:text-primary transition-colors line-clamp-1">{request.title}</h3>
                <p className="text-sm text-gray-500 font-medium line-clamp-2 mb-4">{request.message}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <User size={14} className="text-gray-400" />
                  </div>
                  <span className="text-xs font-bold text-gray-600">{request.email}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Selected View */}
        <div className="lg:sticky lg:top-0">
          <AnimatePresence mode="wait">
            {selectedRequest ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-8 h-fit"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${selectedRequest.type === 'limit_upgrade' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-primary/10 text-primary'}`}>
                      {selectedRequest.type === 'limit_upgrade' ? <Home size={28} /> : <Mail size={28} />}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-gray-900">
                        {selectedRequest.type === 'limit_upgrade' ? 'Woninglimiet Aanvraag' : 'Details Bericht'}
                      </h4>
                      <p className="text-sm text-gray-500 font-medium">Status: {selectedRequest.status}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedRequest(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={24} className="text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <User size={20} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Verzonden door</p>
                        <p className="text-sm font-bold text-gray-900">{selectedRequest.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Onderwerp</p>
                      <h3 className="text-lg font-black text-gray-900 leading-tight">{selectedRequest.title}</h3>
                    </div>

                    <div className="mt-6 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Bericht</p>
                      <div className="bg-white/50 p-6 rounded-2xl text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {selectedRequest.message}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <a 
                      href={`mailto:${selectedRequest.email}?subject=RE: ${selectedRequest.title}`}
                      className="flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20"
                    >
                      <Reply size={20} />
                      Beantwoorden
                    </a>
                    <button 
                      onClick={() => handleStatusChange(selectedRequest.id, selectedRequest.status === 'OPEN' ? 'REPLIED' : 'OPEN')}
                      className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                        selectedRequest.status === 'OPEN' 
                        ? 'bg-green-500 text-white shadow-green-500/20 shadow-xl' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <CheckCircle2 size={20} />
                      {selectedRequest.status === 'OPEN' ? 'Markeer als afgehandeld' : 'Zet terug op open'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 p-20 text-center">
                <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-400 font-bold">Selecteer een bericht om de details te bekijken</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
