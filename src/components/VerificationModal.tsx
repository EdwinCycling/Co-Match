import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, ShieldAlert, Monitor, Camera as CameraIcon, Check, AlertCircle, Linkedin, UploadCloud, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TrustBadge } from './TrustBadge';
import { verifyLinkedIn, verifyAddressLive } from '../services/verificationService';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userVerificationLevel: number;
  onVerificationUpdate?: (newLevel: number) => void;
  userEmail?: string;
  userName?: string;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ isOpen, onClose, userVerificationLevel, onVerificationUpdate, userName }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'info' | 'linkedin' | 'camera'>('info');
  
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isVerifyingLinkedIn, setIsVerifyingLinkedIn] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [propertyAddress, setPropertyAddress] = useState('');

  // Fetch a property address for the currently logged in provider to cross-check
  useEffect(() => {
     if (isOpen && auth.currentUser) {
        // Just try to get one of their properties
        // A minimal approach: let's query their properties or let them type it if they don't have one?
        // Let's assume we can prompt them or we just use whatever they claim.
        // Actually, we need them to type the expected address to verify against the document.
     }
  }, [isOpen]);

  const handleLinkedInSubmit = async () => {
     if (!linkedinUrl.includes('linkedin.com/in/')) {
        toast.error("Voer een geldige LinkedIn profiel URL in.");
        return;
     }
     
     if (!auth.currentUser) return;
     
     setIsVerifyingLinkedIn(true);
     try {
         const result = await verifyLinkedIn(auth.currentUser.uid, linkedinUrl, userName || '');
         if (result.status === 'APPROVED') {
             toast.success(t('verification.linkedin_success_msg', "Succes! Je LinkedIn profiel is geverifieerd en opgeslagen voor onze administratie. Je bent nu Professional (Niveau 2)."), { duration: 6000 });
             onVerificationUpdate?.(2);
             setActiveTab('info');
         } else {
             toast.error(`Verificatie mislukt. Score was ${result.score}. Zorg voor een volledig ingevuld profiel.`);
         }
     } catch (err) {
         toast.error("Er ging iets mis bij de verificatie. Probeer het later opnieuw.");
     } finally {
         setIsVerifyingLinkedIn(false);
     }
  };

  const startCamera = async () => {
      setCameraError('');
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment' } 
          });
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
              setIsCameraActive(true);
          }
      } catch (err) {
          setCameraError("Camera toegang geweigerd of niet beschikbaar. Zorg dat je de app toestemming hebt gegeven.");
          console.error(err);
      }
  };

  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
      }
      setIsCameraActive(false);
  };

  const captureAndVerify = async () => {
      if (!videoRef.current || !canvasRef.current || !auth.currentUser) return;
      if (!propertyAddress) {
          toast.error("Vul het referentieadres in zodat we dit kunnen matchen.");
          return;
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.4); // compressed quality to fit in Firestore
      
      setIsScanning(true);
      setScanResult(null);
      stopCamera();

      try {
          // Send to Gemini
          const expectedName = userName || auth.currentUser.displayName || '';
          const result = await verifyAddressLive(auth.currentUser.uid, dataUrl, propertyAddress, expectedName);
          setScanResult(result);
          
          if (result.status === 'APPROVED') {
              toast.success("Document herkend en Adres Geverifieerd! (Niveau 3)");
              onVerificationUpdate?.(3);
          } else if (result.status === 'PENDING_MANUAL') {
              toast('Verificatie doorgestuurd voor handmatige controle.', { icon: '⏳' });
              // It is now stored in Firestore (verificationStatus.level3.manualReviewImage)
          } else {
              toast.error("Verificatie afgewezen: " + (result.reason || 'Onduidelijke AI uitkomst.'));
          }
      } catch (err) {
          toast.error("Scan fout: " + String(err));
      } finally {
          setIsScanning(false);
      }
  };

  useEffect(() => {
      if (isOpen) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = 'unset';
          stopCamera();
          setActiveTab('info');
          setScanResult(null);
      }
      return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const [verificationDetails, setVerificationDetails] = useState<any>(null);

  useEffect(() => {
    const fetchVerificationDetails = async () => {
      if (!isOpen || !auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'settings', 'verification'));
        if (snap.exists()) {
          setVerificationDetails(snap.data());
        }
      } catch (e) {
        console.error("Failed to fetch verification details", e);
      }
    };
    fetchVerificationDetails();
   }, [isOpen, userVerificationLevel]);

   if (!isOpen) return null;

   return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface w-full max-w-2xl rounded-3xl overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
           <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-container-lowest sticky top-0 z-10">
               <div>
                  <h2 className="text-xl font-black">{t('verification.modal_title')}</h2>
                  <TrustBadge level={userVerificationLevel} size="md" className="mt-1" />
               </div>
               <button onClick={onClose} className="p-2 bg-surface-container rounded-full hover:bg-surface-container-high transition-colors">
                  <X size={20} />
               </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 md:p-8">
               {activeTab === 'info' && (
                 <div className="space-y-6">
                    <p className="text-on-surface-variant font-medium">
                       <strong>{t('verification.ladder_intro_title')}</strong> {t('verification.ladder_intro_desc')}
                    </p>

                    <div className="grid gap-4">
                        <div className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${userVerificationLevel >= 1 ? 'border-primary/20 bg-primary/5 opacity-70' : 'border-outline/20'}`}>
                          <Check className="text-primary shrink-0" size={24} />
                          <div className="flex-1">
                             <h4 className="font-bold">Niveau 1: {t('verification.level1.name', 'Standard')}</h4>
                             <p className="text-sm text-on-surface-variant">{t('verification.level1.desc', 'Geregistreerd via een gecontroleerd Google account (Gmail). Dit is de basis.')}</p>
                          </div>
                          {userVerificationLevel >= 1 && <span className="text-xs font-bold uppercase text-primary">{t('common.achieved', 'Behaald')}</span>}
                       </div>

                        <div onClick={() => userVerificationLevel < 2 ? setActiveTab('linkedin') : null} className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${userVerificationLevel >= 2 ? 'border-primary/20 bg-primary/5' : 'border-outline/20 hover:border-primary/50 cursor-pointer'}`}>
                          <div className="flex items-center gap-4">
                            {userVerificationLevel >= 2 ? <Check className="text-primary shrink-0" size={24} /> : <Linkedin className="text-blue-500 shrink-0" size={24} />}
                            <div className="flex-1">
                               <h4 className="font-bold text-blue-500">Niveau 2: {t('verification.level2.name', 'Professional')}</h4>
                               <p className="text-sm text-on-surface-variant">{t('verification.level2.desc', 'Zakelijke of professionele identiteit gekoppeld aan Co-Match met LinkedIn. Minder kans op nep-accounts.')}</p>
                            </div>
                            {userVerificationLevel >= 2 ? (
                               <span className="text-xs font-bold uppercase text-primary">{t('common.achieved', 'Behaald')}</span>
                            ) : (
                               <ChevronRight size={20} className="text-outline" />
                            )}
                          </div>

                          {userVerificationLevel >= 2 && verificationDetails?.level2?.aiResult && (
                            <div className="ml-10 p-3 bg-white/40 rounded-xl text-xs border border-primary/5">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-black text-blue-600 uppercase tracking-widest text-[10px]">LinkedIn AI Report</span>
                                <span className="bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold">Score: {verificationDetails.level2.aiResult.score}/100</span>
                              </div>
                              <p className="text-on-surface-variant italic leading-relaxed">"{verificationDetails.level2.aiResult.reason}"</p>
                            </div>
                          )}
                       </div>

                        <div onClick={() => userVerificationLevel < 3 ? setActiveTab('camera') : null} className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${userVerificationLevel >= 3 ? 'border-primary/20 bg-primary/5' : 'border-outline/20 hover:border-green-500/50 cursor-pointer'}`}>
                          {userVerificationLevel >= 3 ? <Check className="text-primary shrink-0" size={24} /> : <CameraIcon className="text-green-500 shrink-0" size={24} />}
                          <div className="flex-1">
                             <h4 className="font-bold text-green-500">Niveau 3: {t('verification.level3.name', 'Live Verified')}</h4>
                             <p className="text-sm text-on-surface-variant text-balance">{t('verification.level3.desc', 'Heeft via de app live toegang tot de woning/facturen bewezen met AI anti-fraude check.')}</p>
                          </div>
                          {userVerificationLevel >= 3 ? (
                             <span className="text-xs font-bold uppercase text-primary">{t('common.achieved', 'Behaald')}</span>
                          ) : (
                             <ChevronRight size={20} className="text-outline" />
                          )}
                       </div>

                       <div className="p-4 rounded-2xl border-2 border-outline/10 bg-surface-container-lowest flex items-center gap-4 opacity-50 cursor-not-allowed">
                          <ShieldCheck className="text-gray-400 shrink-0" size={24} />
                          <div className="flex-1">
                             <h4 className="font-bold text-gray-400">Niveau 4: {t('verification.level4.name', 'Identity Check')}</h4>
                             <p className="text-sm text-gray-400 text-balance">{t('verification.level4.desc', 'Officiële identificatie met paspoort of document en selfie via Stripe.com (Binnenkort).')}</p>
                          </div>
                       </div>
                    </div>
                 </div>
               )}

               {activeTab === 'linkedin' && (
                  <div className="space-y-6">
                     <button onClick={() => setActiveTab('info')} className="text-primary font-bold flex items-center gap-1 hover:underline mb-2">
                        <ArrowLeft size={16} /> {t('verification.back')}
                     </button>
                     <h3 className="text-2xl font-black text-blue-500 flex items-center gap-2"><Linkedin size={28}/> {t('verification.linkedin_title')}</h3>
                     <p className="text-on-surface-variant">
                        {t('verification.linkedin_desc')}
                     </p>
                     
                     <div className="space-y-2">
                        <label className="text-sm font-bold ml-2">{t('verification.linkedin_url')}</label>
                        <input
                           type="url"
                           value={linkedinUrl}
                           onChange={e => setLinkedinUrl(e.target.value)}
                           className="w-full bg-surface-container p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary"
                           placeholder={t('verification.linkedin_placeholder')}
                        />
                     </div>

                     <button 
                        onClick={handleLinkedInSubmit}
                        disabled={isVerifyingLinkedIn || !linkedinUrl}
                        className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {isVerifyingLinkedIn ? <Monitor className="animate-pulse" /> : <ShieldCheck />}
                        {isVerifyingLinkedIn ? t('verification.linkedin_analyzing') : t('verification.linkedin_verify_btn')}
                     </button>
                  </div>
               )}

               {activeTab === 'camera' && (
                  <div className="space-y-6">
                     <button onClick={() => { setActiveTab('info'); stopCamera(); }} className="text-primary font-bold flex items-center gap-1 hover:underline mb-2">
                        <ArrowLeft size={16} /> {t('verification.back')}
                     </button>
                     <h3 className="text-2xl font-black text-green-500 flex items-center gap-2"><CameraIcon size={28}/> {t('verification.camera_title')}</h3>
                     <p className="text-on-surface-variant text-sm">
                        {t('verification.camera_desc')}
                     </p>

                     <div className="space-y-2">
                        <label className="text-sm font-bold ml-2">{t('verification.camera_address_label')}</label>
                        <input
                           type="text"
                           value={propertyAddress}
                           onChange={e => setPropertyAddress(e.target.value)}
                           className="w-full bg-surface-container p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                           placeholder={t('verification.camera_address_placeholder')}
                        />
                     </div>

                     {!isCameraActive && !isScanning && !scanResult && (
                          <button onClick={startCamera} className="w-full py-6 mt-4 bg-surface-container-high rounded-2xl border-2 border-dashed border-outline/50 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 transition-colors">
                              <CameraIcon size={32} className="text-on-surface-variant" />
                              <span className="font-bold">{t('verification.camera_open_btn')}</span>
                          </button>
                     )}

                     {cameraError && <div className="p-4 bg-error/10 text-error rounded-xl text-sm">{cameraError}</div>}

                     {isCameraActive && (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] md:aspect-[4/3]">
                           <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                           {/* Ghost/Grid Overlay */}
                           <div className="absolute inset-0 pointer-events-none">
                               <div className="w-full h-full border-[20px] border-black/40 relative">
                                   <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded flex items-center justify-center">
                                       <span className="text-white/80 font-black tracking-widest uppercase bg-black/40 px-3 py-1 rounded">{t('verification.camera_overlay_text')}</span>
                                   </div>
                               </div>
                           </div>
                           <button onClick={captureAndVerify} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-2xl hover:scale-105 transition-transform" />
                        </div>
                     )}

                     <canvas ref={canvasRef} className="hidden" />

                     {isScanning && (
                        <div className="p-8 text-center space-y-4">
                            <Monitor size={48} className="mx-auto text-primary animate-bounce" />
                            <h3 className="font-bold text-lg">{t('verification.camera_scanning_title')}</h3>
                            <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                                <div className="h-full bg-primary animate-[translate_2s_infinite]" style={{ width: '30%' }} />
                            </div>
                            <p className="text-xs text-on-surface-variant">{t('verification.camera_scanning_desc')}</p>
                        </div>
                     )}

                     {scanResult && (
                        <div className={`p-6 rounded-2xl border-2 ${scanResult.status === 'APPROVED' ? 'border-green-500 bg-green-500/10' : scanResult.status === 'PENDING_MANUAL' ? 'border-orange-500 bg-orange-500/10' : 'border-error bg-error/10'}`}>
                           <div className="flex items-start gap-4">
                              {scanResult.status === 'APPROVED' ? <Check className="text-green-500 shrink-0" size={32} /> : scanResult.status === 'PENDING_MANUAL' ? <AlertCircle className="text-orange-500 shrink-0" size={32} /> : <X className="text-error shrink-0" size={32} />}
                              <div>
                                  <h4 className="font-black text-lg">
                                      {scanResult.status === 'APPROVED' ? t('verification.camera_success_title') : scanResult.status === 'PENDING_MANUAL' ? t('verification.camera_manual_title') : t('verification.camera_failed_title')}
                                  </h4>
                                  <p className="text-sm mt-1 mb-3">{scanResult.reason || (scanResult.status === 'APPROVED' ? t('verification.camera_success_desc') : "")}</p>
                                  {scanResult.extracted_data && (
                                     <div className="text-xs bg-white/50 p-2 rounded">
                                        Detectie Naam: <b>{scanResult.extracted_data.name}</b><br/>
                                        Detectie Adres: <b>{scanResult.extracted_data.address}</b>
                                     </div>
                                  )}
                                  {scanResult.status !== 'APPROVED' && (
                                      <button onClick={() => { setScanResult(null); startCamera(); }} className="mt-4 px-4 py-2 bg-surface-container font-bold rounded-lg hover:brightness-95">
                                          {t('verification.camera_retry_btn')}
                                      </button>
                                  )}
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               )}
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Component helper for ArrowLeft because it wasn't imported from lucide above
const ArrowLeft = ({ size = 24 }: {size?: number}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
