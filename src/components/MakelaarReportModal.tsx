import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Share2, Printer, User, ShieldCheck, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

interface MakelaarReportModalProps {
  report: string;
  property: any;
  onClose: () => void;
}

export default function MakelaarReportModal({ report, property, onClose }: MakelaarReportModalProps) {
  const { t } = useTranslation();

  const enhancedReport = useMemo(() => {
    let newReport = report;
    if (property?.images && property.images.length > 0) {
      const paragraphs = newReport.split('\n\n');
      
      const images = [...property.images].filter((img: any) => img && img.url);
      
      // Inject all images distributed across the paragraphs
      let imgIndex = 0;
      let pIndex = 1; // start after the first paragraph snippet
      
      while (pIndex < paragraphs.length && imgIndex < images.length) {
        const img = images[imgIndex];
        const imgMarkdown = `![Woning afbeelding ${imgIndex + 1}](${img.url})`;
        paragraphs.splice(pIndex, 0, imgMarkdown);
        imgIndex++;
        // Skip ahead to spread them out (e.g. every 2-3 paragraphs depending on length)
        pIndex += Math.max(2, Math.floor(paragraphs.length / Math.max(1, images.length)));
      }
      
      return paragraphs.join('\n\n');
    }
    return report;
  }, [report, property]);

  const imageUrlToBase64 = async (url: string): Promise<string> => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
      // Use no-cache to avoid some CORS issues with cached responses
      const fetchUrl = url.includes('?') ? `${url}&cb=${Date.now()}` : `${url}?cb=${Date.now()}`;
      const response = await fetch(fetchUrl, { 
        mode: 'cors',
        credentials: 'omit'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("CORS/Fetch error for PDF image:", url, e);
      // Return a placeholder or just the URL (though URL won't work in canvas if CORS fails)
      return ''; 
    }
  };

  const getHtmlContent = (overrides: { base64Map?: Map<string, string> } = {}) => {
    let htmlContent = enhancedReport
      .replace(/^### (.*$)/gim, '<h3 style="font-family: inherit; color: #1e293b; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25em; font-weight: 800;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-family: inherit; color: #0f172a; margin-top: 1.8em; margin-bottom: 0.6em; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.3em; font-weight: 900;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-family: inherit; color: #0f172a; margin-top: 2em; margin-bottom: 0.8em; text-align: center; font-weight: 900; font-size: 2.2rem;">$1</h1>')
      .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
        const finalUrl = overrides.base64Map?.get(url) || url;
        if (!finalUrl) return ''; // Skip failed images
        return `<img src="${finalUrl}" alt="${alt}" style="max-height: 400px; width: 100%; object-fit: cover; border-radius: 24px; margin: 2rem 0; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);" />`;
      })
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a; font-weight: 800;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="color: #64748b;">$1</em>')
      .replace(/^- (.*$)/gim, '<li style="margin-bottom: 0.6em; line-height: 1.6;">$1</li>')
      .replace(/\n\n/g, '<p style="margin-bottom: 1.5em; line-height: 1.7; color: #334155; font-size: 15px;"></p>');

    htmlContent = htmlContent.replace(/(<li>.*<\/li>)/g, '<ul style="margin-bottom: 1.5em; padding-left: 1.5em;">$1</ul>');

    const fullHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', -apple-system, sans-serif; color: #334155; padding: 0; margin: 0; background-color: #ffffff; line-height: 1.6; }
        .page { width: 800px; margin: 0 auto; background: #fff; position: relative; min-height: 1100px; }
        .content-wrap { padding: 4rem 3.5rem; }
        
        /* Branding Header */
        .branding-header { 
          background: #cc6b49; 
          height: 120px; 
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          padding: 0 3.5rem;
          color: white;
          border-bottom: 8px solid #b55a3c;
        }
        .branding-logo { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.05em; font-style: italic; }
        .branding-sub { font-size: 0.9rem; font-weight: 700; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.1em; }
        
        /* Branding Footer */
        .branding-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 3.5rem;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .report-meta {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #fff8f6;
          border-radius: 1.5rem;
          border: 2px solid #fee2d5;
          display: grid;
          grid-template-cols: 1fr 1fr;
          gap: 1rem;
        }
        .meta-item span { display: block; font-size: 10px; font-weight: 900; color: #cc6b49; text-transform: uppercase; margin-bottom: 2px; }
        .meta-item strong { font-size: 14px; color: #334155; }

        .report-title-section { border-bottom: 4px solid #f1f5f9; padding-bottom: 2rem; margin-bottom: 2.5rem; }
        .report-title-section h1 { margin: 0; text-align: left; color: #0f172a; font-size: 3rem; letter-spacing: -0.03em; line-height: 0.9; }

        @media print { body { background: white; } .page { box-shadow: none; border: none; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="branding-header">
            <div class="branding-logo">Co-Match</div>
            <div style="text-align: right;">
              <div class="branding-sub">Makelaar Rapport</div>
              <div style="font-size: 14px; font-weight: 800; opacity: 0.8;">Objective Analysis</div>
            </div>
        </div>
        
        <div class="content-wrap">
            <div class="report-title-section">
                <h1>Makelaar<br/><span style="color: #cc6b49;">Expertise</span></h1>
                <div class="report-meta">
                    <div class="meta-item">
                        <span>Project</span>
                        <strong>${property?.title || 'Woning'}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Datum</span>
                        <strong>${new Date().toLocaleDateString('nl-NL')}</strong>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 2rem;">
              ${htmlContent}
            </div>
        </div>

        <div class="branding-footer">
            <div>© ${new Date().getFullYear()} Co-Match Platform</div>
            <div>Gegenereerd door AI-Makelaar Assistent</div>
            <div>Pagina 1</div>
        </div>
    </div>
</body>
</html>`;
    return fullHtml;
  };

  const [isExporting, setIsExporting] = useState(false);

  const generatePDFBlob = async (toastId?: string): Promise<Blob | null> => {
    try {
      // Find all image URLs in markdown
      const imageUrls: string[] = [];
      const imgRegex = /!\[.*?\]\((.*?)\)/g;
      let match;
      while ((match = imgRegex.exec(enhancedReport)) !== null) {
        imageUrls.push(match[1]);
      }

      // Convert all found images to base64 simultaneously
      const base64Map = new Map<string, string>();
      const uniqueUrls = Array.from(new Set(imageUrls));
      
      if (toastId) toast.loading('Afbeeldingen verwerken...', { id: toastId });
      
      await Promise.all(uniqueUrls.map(async (url) => {
        const b64 = await imageUrlToBase64(url);
        if (b64) base64Map.set(url, b64);
      }));

      if (toastId) toast.loading('Rapport opbouwen...', { id: toastId });
      
      const fullHtml = getHtmlContent({ base64Map });
      
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.innerHTML = fullHtml;
      document.body.appendChild(container);

      // Give it a moment to render and load images
      await new Promise(resolve => setTimeout(resolve, 2000));

      const canvas = await html2canvas(container, {
        scale: 1.5, // Lower scale slightly to avoid memory issues with large reports
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85); // Use JPEG to save space
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Handle multi-page (simple vertical split)
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const blob = pdf.output('blob');
      document.body.removeChild(container);
      return blob;
    } catch (error) {
      console.error('PDF Generation error:', error);
      if (toastId) toast.error('PDF genereren mislukt: ' + (error instanceof Error ? error.message : 'Onbekende fout'), { id: toastId });
      return null;
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Starten...', { duration: 0 }); // Persistence until manually replaced or dismissed
    try {
      const blob = await generatePDFBlob(toastId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `MakelaarRapport_${property?.id || 'Huis'}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('PDF succesvol opgeslagen!', { id: toastId });
      }
    } catch (err) {
      toast.error('Er ging iets mis.', { id: toastId });
    }
    setIsExporting(false);
  };

  const handlePrint = async () => {
    setIsExporting(true);
    const toastId = toast.loading('PDF voorbereiden...', { duration: 0 });
    try {
      const blob = await generatePDFBlob(toastId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        // Better way to print blob in some browsers
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          toast.success('Printscherm geopend!', { id: toastId });
        };
      }
    } catch (err) {
      toast.error('Printen mislukt.', { id: toastId });
    }
    setIsExporting(false);
  };

  const handleShare = async () => {
    setIsExporting(true);
    const toastId = toast.loading('PDF voorbereiden...', { duration: 0 });
    try {
      const blob = await generatePDFBlob(toastId);
      if (!blob) {
        setIsExporting(false);
        return;
      }

      const file = new File([blob], `MakelaarRapport.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Co-Match Makelaar Rapport',
          text: 'Bekijk dit makelaarsrapport van Co-Match.',
        });
        toast.success('PDF gedeeld!', { id: toastId });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `MakelaarRapport.pdf`;
        link.click();
        toast.success('Apparaat ondersteunt direct delen niet. PDF gedownload.', { id: toastId });
      }
    } catch (err) {
      toast.error('Delen mislukt.', { id: toastId });
    }
    setIsExporting(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] bg-[#020617]/90 backdrop-blur-2xl flex items-center justify-center p-0 md:p-4"
    >
      <AnimatePresence>
        {isExporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[170] bg-background/20 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto"
          >
            <div className="bg-background text-on-background p-12 rounded-[3.5rem] shadow-2xl border-4 border-primary/20 flex flex-col items-center gap-8 max-w-sm text-center">
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360, scale: [1, 1.1, 1] }} 
                  transition={{ rotate: { repeat: Infinity, duration: 2, ease: "linear" }, scale: { repeat: Infinity, duration: 2 } }} 
                  className="w-24 h-24 border-[6px] border-primary border-t-transparent rounded-full" 
                />
                <div className="absolute inset-0 flex items-center justify-center text-primary">
                  <FileText size={32} />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-black text-on-background">PDF Genereren...</h3>
                <p className="text-sm font-bold text-on-surface-variant opacity-70">
                  We ontwerpen je professionele rapport met Co-Match branding. <br/>Even geduld aub.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-background md:rounded-[3rem] w-full max-w-4xl h-[100dvh] md:h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-purple-200 dark:border-purple-800"
      >
        {/* Header */}
        <div className="p-6 md:p-8 bg-purple-600 text-on-primary shrink-0 relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/20 w-fit px-3 py-1 rounded-full">
                <User size={14} />
                {t('makelaar_title', 'Co-Match Makelaar')}
              </div>
              <h2 className="text-2xl md:text-4xl font-display font-black pr-12 drop-shadow-md">
                Makelaar Rapport
              </h2>
              <p className="text-purple-100 font-medium text-sm drop-shadow-sm tracking-wide">
                Gemaakt op {new Date().toLocaleDateString('nl-NL')}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white backdrop-blur-sm"
              title={t('common.close', 'Sluiten')}
            >
              <X size={20} />
            </button>
          </div>
          <div className="absolute top-0 right-0 -mr-10 -mt-10 opacity-20 pointer-events-none mix-blend-overlay">
            <User size={200} strokeWidth={0.5} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-6 md:p-10 custom-scrollbar bg-purple-50/30 dark:bg-[#020617]">
          <div className="max-w-3xl mx-auto">
             <div className="bg-surface rounded-3xl p-6 md:p-10 shadow-sm border border-purple-100/50 dark:border-purple-800/30">
               <div className="markdown-body prose prose-purple dark:prose-invert max-w-none text-sm md:text-[15px] leading-relaxed prose-headings:font-display prose-headings:font-black prose-p:text-on-surface-variant">
                  <ReactMarkdown
                    components={{
                      img: ({node, ...props}) => {
                        const index = Number(props.alt?.replace(/\D/g, '')) || 1;
                        let imgClass = "w-full max-h-[400px] object-cover rounded-2xl my-8 shadow-md";
                        
                        if (index % 3 === 1) {
                            imgClass = "float-left w-1/2 max-w-[300px] aspect-square object-cover rounded-2xl mr-6 mb-4 shadow-md";
                        } else if (index % 3 === 2) {
                            imgClass = "float-right w-1/2 max-w-[300px] aspect-[4/3] object-cover rounded-2xl ml-6 mb-4 shadow-md";
                        } else {
                            imgClass = "w-full aspect-[21/9] object-cover rounded-2xl my-8 shadow-sm";
                        }

                        return (
                          <img 
                            {...props} 
                            className={imgClass}
                            alt={props.alt || "Afbeelding"}
                          />
                        );
                      }
                    }}
                  >{enhancedReport}</ReactMarkdown>
               </div>

               {/* Disclaimer */}
               <div className="mt-8 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 flex items-center gap-3 shadow-inner">
                 <div className="p-2 bg-amber-100 dark:bg-amber-950/40 rounded-lg text-amber-600 font-bold shrink-0">
                    <ShieldCheck size={16} />
                 </div>
                 <p className="text-[10px] md:text-xs text-amber-900 dark:text-amber-100 font-medium leading-relaxed">
                   <strong>Tip:</strong> Dit rapport is met de grootst mogelijke zorgvuldigheid samengesteld. Houd er echter rekening mee dat AI-analyses gebaseerd zijn op data-interpretaties en dat AI incidenteel fouten kan maken of details onnauwkeurig kan inschatten.
                 </p>
               </div>
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-outline bg-surface flex items-center justify-between gap-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
           <div className="flex gap-2"></div>
           <div className="flex gap-2 w-full md:w-auto justify-end items-center">
             <button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                title="Exporteer als PDF" 
                className="flex items-center gap-2 px-4 py-2 border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50"
              >
                {isExporting ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                ) : (
                  <FileText size={16} />
                )}
                <span className="hidden sm:inline">PDF Export</span>
              </button>
             <button onClick={handlePrint} title={t('report.print_title', 'Print Rapport')} className="p-3 border border-outline rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-all">
               <Printer size={18} />
             </button>
             <button onClick={handleShare} title={t('report.share_btn_title', 'Delen')} className="p-3 border border-outline rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-all">
               <Share2 size={18} />
             </button>
             <div className="w-px h-8 bg-outline/30 mx-2 hidden md:block" />
             <button 
               onClick={onClose}
               className="px-8 py-3 bg-slate-950 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 border border-slate-900 cursor-pointer"
             >
               {t('common.close', 'Sluiten')}
             </button>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
