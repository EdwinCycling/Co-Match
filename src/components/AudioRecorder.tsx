import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic, Square, Trash2, Send, Loader2, Play, Pause, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { processAudioMessage } from '../services/audioService';
import { hasEnoughCredits } from '../services/creditService';
import { CREDIT_COSTS } from '../constants';

interface AudioRecorderProps {
  onAudioReady: (base64Data: string, transcript: string) => Promise<void>;
  onCancel: () => void;
  maxDurationSeconds?: number;
}

export default function AudioRecorder({ onAudioReady, onCancel, maxDurationSeconds = 60 }: AudioRecorderProps) {
  const { t } = useTranslation();
  const [showIntro, setShowIntro] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [base64Audio, setBase64Audio] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setErrorStatus(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Aim for small file size suitable for database storage
      let options: MediaRecorderOptions = { audioBitsPerSecond: 16000 };
      const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
      let selectedType = '';
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          options.mimeType = t;
          selectedType = t;
          break;
        }
      }

      setMimeType(selectedType || 'audio/webm');
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedType || 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Extract base64 without the prefix
          const base64String = base64data.split(',')[1];
          setBase64Audio(base64String);
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDurationSeconds - 1) {
            stopRecording();
            return maxDurationSeconds;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied or error:', err);
      setErrorStatus("Microfoon kon niet worden geopend.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSend = async () => {
    if (!base64Audio) return;
    
    setIsProcessing(true);
    setErrorStatus(null);
    try {
      // Analyze the audio via Gemini
      const analysis = await processAudioMessage(base64Audio, mimeType);
      
      if (!analysis.isAcceptable) {
        setErrorStatus(`Audio geweigerd: ${analysis.reason || "Je audio bevat ongepaste woorden."}`);
        setIsProcessing(false);
        return;
      }

      await onAudioReady(`data:${mimeType};base64,${base64Audio}`, analysis.transcript);
    } catch (error: any) {
      setErrorStatus(error.message || "Fout bij de analyse. Probeer het opnieuw.");
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStartIntro = async () => {
    const hasCredits = await hasEnoughCredits(CREDIT_COSTS.AUDIO_MESSAGE);
    if (!hasCredits) {
      window.dispatchEvent(new Event('open-credits-modal'));
      onCancel();
      return;
    }
    setShowIntro(false);
  };

  return (
    <div className="bg-surface border-2 border-primary/20 rounded-3xl p-3 md:p-6 shadow-sm mb-2">
      {showIntro ? (
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Mic className="w-[18px] h-[18px] md:w-[20px] md:h-[20px]" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-sm md:text-base">{t('chat.audio_record', 'Spreek een audiobericht in')}</h3>
              <p className="text-[10px] md:text-xs text-on-surface-variant font-medium">{t('chat.audio_extra_service', 'Extra service')} • {CREDIT_COSTS.AUDIO_MESSAGE} {t('credits.label', 'Credits')}</p>
            </div>
          </div>
          
          <div className="bg-surface-container rounded-2xl p-3 md:p-4 space-y-2 md:space-y-3">
            <p className="text-[13px] md:text-sm font-medium text-on-surface leading-snug">
              {t('chat.audio_intro_title', 'Val op bij de aanbieder met een persoonlijk geluidsfragment! Dit verhoogt je slagingskansen aanzienlijk.')}
            </p>
            <ul className="text-[11px] md:text-xs text-on-surface-variant space-y-1 list-disc pl-4">
              <li>{t('chat.audio_intro_li1', 'Max {{maxDurationSeconds}} seconden', { maxDurationSeconds })}</li>
              <li>{t('chat.audio_intro_li2', 'Eenmalig te beluisteren door aanbieder')}</li>
              <li>{t('chat.audio_intro_li3', 'Bereid je van te voren voor, maar blijf spontaan.')}</li>
            </ul>
          </div>
          
          <div className="flex gap-2 md:gap-3">
            <button onClick={onCancel} className="px-3 py-2.5 md:p-3 text-on-surface-variant hover:bg-surface-container rounded-xl transition-all font-bold text-sm">
              {t('app.cancel', 'Annuleren')}
            </button>
            <button onClick={handleStartIntro} className="flex-1 py-2.5 md:py-3 bg-primary text-on-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md text-sm">
              {t('chat.audio_intro_btn', 'Begrepen (-{{cost}})', { cost: CREDIT_COSTS.AUDIO_MESSAGE })}
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-bold text-on-surface mb-2">{t('chat.audio_record', 'Spreek een audiobericht in')} <span className="text-primary font-black text-xs uppercase uppercase">max {maxDurationSeconds}s</span></h3>
          
          {errorStatus && (
            <div className="mb-4 bg-error/10 text-error p-3 rounded-xl text-sm font-medium">
              {errorStatus}
            </div>
          )}

          {!audioUrl && !isRecording && (
            <div className="flex items-center gap-4">
              <button
                onClick={startRecording}
                className="flex-1 bg-primary text-on-primary font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md"
              >
                <Mic size={20} />
                {t('chat.start_recording', 'Start Opname')}
              </button>
              <button onClick={onCancel} className="p-3 text-on-surface-variant hover:bg-surface-variant rounded-xl transition-all font-bold">
                {t('app.cancel', 'Annuleren')}
              </button>
            </div>
          )}

      {isRecording && (
        <div className="flex items-center justify-between bg-error/10 border border-error/30 rounded-xl p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2.5 h-2.5 md:w-3 md:h-3 bg-error rounded-full"
            />
            <span className="font-mono font-bold text-error text-sm md:text-base">{formatTime(recordingTime)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="bg-error text-white font-bold py-1.5 px-3 md:py-2 md:px-4 rounded-lg flex items-center gap-2 hover:bg-error/90 transition-all text-xs md:text-sm"
          >
            <Square className="w-[14px] h-[14px] md:w-[16px] md:h-[16px]" fill="currentColor" />
            {t('chat.stop', 'Stop')}
          </button>
        </div>
      )}

      {audioUrl && (
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center gap-2 md:gap-3 bg-primary/5 border border-primary/20 rounded-xl p-2 md:p-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 md:w-10 md:h-10 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" fill="currentColor" /> : <Play className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] ml-0.5 md:ml-1" fill="currentColor" />}
            </button>
            <span className="font-mono font-bold text-primary flex-1 text-sm md:text-base">{formatTime(recordingTime)}</span>
            <button
              disabled={isProcessing}
              onClick={() => {
                setAudioUrl(null);
                setBase64Audio(null);
                setErrorStatus(null);
              }}
              className="p-1.5 md:p-2 text-error hover:bg-error/10 rounded-lg transition-all disabled:opacity-50"
              title={t('chat.delete_audio', 'Verwijder')}
            >
              <Trash2 className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" />
            </button>
          </div>
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="hidden" 
          />
          
          <div className="flex gap-2 md:gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 py-2.5 md:py-3 text-on-surface-variant font-bold border border-outline/50 rounded-xl hover:bg-surface-variant transition-all disabled:opacity-50 text-sm"
            >
              {t('app.cancel', 'Annuleren')}
            </button>
            <button
              onClick={handleSend}
              disabled={isProcessing}
              className="flex-[2] py-2.5 md:py-3 bg-primary text-on-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 text-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] animate-spin" />
                  {t('chat.processing', 'Analyseren...')}
                </>
              ) : (
                <>
                  <Send className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" />
                  {t('chat.send_audio', 'Verzenden')}
                </>
              )}
            </button>
          </div>
          {isProcessing && (
            <p className="text-[10px] md:text-xs text-center text-on-surface-variant animate-pulse font-medium px-4 leading-tight">
              Korte controle op ongepast taalgebruik voor we doorsturen.
            </p>
          )}
        </div>
      )}
      </>
    )}
    </div>
  );
}
