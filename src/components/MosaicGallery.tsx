import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MosaicGalleryProps {
  images: { url: string; id: string; title: string; onClick: () => void }[];
}

export const MosaicGallery: React.FC<MosaicGalleryProps> = ({ images }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[250px] p-4 md:p-0">
      {images.map((img, index) => (
        <MosaicImage 
          key={img.id + '-' + index} 
          image={img} 
          index={index} 
        />
      ))}
    </div>
  );
};

const MosaicImage = ({ image, index }: { image: { url: string; title: string; onClick: () => void }, index: number }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Transform unsplash URLs to use webp and specify size
  let optimizedUrl = image.url;
  let placeholderUrl = image.url;
  
  try {
    if (image.url.includes('unsplash.com')) {
      const urlObj = new URL(image.url);
      urlObj.searchParams.set('fm', 'webp');
      urlObj.searchParams.set('w', '800');
      urlObj.searchParams.set('q', '80');
      optimizedUrl = urlObj.toString();
      
      const placeholderObj = new URL(image.url);
      placeholderObj.searchParams.set('fm', 'webp');
      placeholderObj.searchParams.set('w', '20');
      placeholderObj.searchParams.set('q', '10');
      placeholderObj.searchParams.set('blur', '20');
      placeholderUrl = placeholderObj.toString();
    }
  } catch (e) {
    // If not a valid URL or not unsplash, fallback to original
  }

  // Assign different spans to create a mosaic effect
  const isLarge = index % 7 === 0;
  const isWide = index % 5 === 0 && !isLarge;
  const isTall = index % 6 === 0 && !isLarge && !isWide;

  let spanClasses = 'col-span-1 row-span-1';
  if (isLarge) spanClasses = 'col-span-2 row-span-2';
  else if (isWide) spanClasses = 'col-span-2 row-span-1';
  else if (isTall) spanClasses = 'col-span-1 row-span-2';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.05, // 50ms stagger
        ease: [0.21, 0.47, 0.32, 0.98] 
      }}
      className={`relative overflow-hidden rounded-3xl cursor-pointer group shadow-sm hover:shadow-xl transition-shadow duration-300 ${spanClasses}`}
      style={{ willChange: 'transform, opacity' }}
      onClick={image.onClick}
    >
      {/* Blurred Placeholder */}
      {placeholderUrl ? (
        <div 
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-in-out"
          style={{ 
            backgroundImage: `url(${placeholderUrl})`,
            filter: 'blur(20px)',
            transform: 'scale(1.1)', // Prevent blurred edges from showing
            opacity: isLoaded ? 0 : 1
          }}
        />
      ) : null}
      
      {/* Real Image */}
      {optimizedUrl ? (
        <img
          src={optimizedUrl}
          alt={image.title}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-110 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ willChange: 'transform' }}
        />
      ) : null}
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <h3 className="text-white font-display font-black text-lg md:text-xl leading-tight truncate">
          {image.title}
        </h3>
      </div>
    </motion.div>
  );
};
