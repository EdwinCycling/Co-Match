import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type ProviderImageCropperModalProps = {
  src: string;
  onComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
};

export default function ProviderImageCropperModal({
  src,
  onComplete,
  onCancel,
}: ProviderImageCropperModalProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<Crop>();
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(1.5);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect || 1, width, height),
      width,
      height
    );
    setCrop(initialCrop);
    setImgRef(e.currentTarget);
  };

  useEffect(() => {
    if (!imgRef) {
      return;
    }

    const { width, height } = imgRef;
    const nextCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect || 1, width, height),
      width,
      height
    );
    setCrop(nextCrop);
  }, [aspect, imgRef]);

  const getCroppedImg = () => {
    if (!imgRef || !crop) {
      return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.naturalWidth / imgRef.width;
    const scaleY = imgRef.naturalHeight / imgRef.height;

    let pixelX;
    let pixelY;
    let pixelWidth;
    let pixelHeight;

    if (crop.unit === '%') {
      pixelX = (crop.x / 100) * imgRef.naturalWidth;
      pixelY = (crop.y / 100) * imgRef.naturalHeight;
      pixelWidth = (crop.width / 100) * imgRef.naturalWidth;
      pixelHeight = (crop.height / 100) * imgRef.naturalHeight;
    } else {
      pixelX = crop.x * scaleX;
      pixelY = crop.y * scaleY;
      pixelWidth = crop.width * scaleX;
      pixelHeight = crop.height * scaleY;
    }

    canvas.width = Math.max(1, pixelWidth);
    canvas.height = Math.max(1, pixelHeight);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgRef, pixelX, pixelY, pixelWidth, pixelHeight, 0, 0, canvas.width, canvas.height);

    onComplete(canvas.toDataURL('image/jpeg', 0.9));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-[2.5rem] overflow-hidden max-w-3xl w-full shadow-2xl">
        <div className="p-8 border-b border-outline flex justify-between items-center">
          <div>
            <h3 className="text-xl font-display font-black uppercase tracking-tight">
              {t('prop.editor.edit_photo', 'Foto bewerken')}
            </h3>
            <p className="text-xs text-on-surface-variant font-medium mt-1">
              {t('prop.editor.edit_photo_desc', 'Versleep het kader om de foto bij te snijden')}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="p-2 hover:bg-surface-container rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="px-8 py-4 bg-surface-container-low flex gap-4 overflow-x-auto border-b border-outline">
          {[
            { label: t('common.aspect_3_2', '3:2 (Standard)'), val: 1.5 },
            { label: '4:3', val: 4 / 3 },
            { label: t('common.aspect_1_1', '1:1 (Square)'), val: 1 },
            { label: t('common.aspect_16_9', '16:9 (Wide)'), val: 16 / 9 },
            { label: t('common.aspect_free', 'Free'), val: undefined },
          ].map((opt) => (
            <button
              type="button"
              key={opt.label}
              onClick={() => setAspect(opt.val)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                aspect === opt.val
                  ? 'bg-primary text-on-primary border-primary shadow-md'
                  : 'bg-white border-outline hover:border-primary/50 text-on-surface-variant'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-8 flex justify-center bg-surface-container-lowest custom-scrollbar" style={{ maxHeight: '60vh' }}>
          <ReactCrop
            crop={crop}
            onChange={(nextCrop) => setCrop(nextCrop)}
            aspect={aspect}
            keepSelection
            className="flex items-center justify-center max-h-full"
          >
            <img
              src={src}
              onLoad={onImageLoad}
              style={{ maxHeight: 'calc(60vh - 4rem)' }}
              className="max-w-full object-contain rounded-xl"
              alt="Crop target"
            />
          </ReactCrop>
        </div>

        <div className="p-8 border-t border-outline flex justify-end gap-4 bg-white">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={getCroppedImg}
            className="px-10 py-3 bg-primary text-on-primary rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
