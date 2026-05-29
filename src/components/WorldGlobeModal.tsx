import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Globe as GlobeIcon, Compass, Check, ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize } from "lucide-react";
import Globe, { GlobeMethods } from "react-globe.gl";

interface WorldGlobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (city: string, lat: number, lng: number) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

type GlobeSkin = "satellite" | "night";

const SKINS = {
  satellite: {
    label: "Satelliet",
    themeColor: "rgba(14, 116, 144, 0.45)", // Twilight cyan
    globeImage: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    atmosphereColor: "lightskyblue",
  },
  night: {
    label: "Nacht",
    themeColor: "rgba(124, 58, 237, 0.4)", // Cyberpunk violet
    globeImage: "//unpkg.com/three-globe/example/img/earth-night.jpg",
    atmosphereColor: "rgba(139, 92, 246, 0.6)",
  },
};

export function WorldGlobeModal({
  isOpen,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: WorldGlobeModalProps) {
  const { t } = useTranslation();

  const [skin, setSkin] = useState<GlobeSkin>(() => {
    const savedSkin = localStorage.getItem("globe_skin") as GlobeSkin;
    if (savedSkin === "satellite" || savedSkin === "night") {
      return savedSkin;
    }
    return "satellite";
  });
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Globe implementation
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [globeAltitude, setGlobeAltitude] = useState(2.5);

  const [loading, setLoading] = useState<boolean>(false);

  // Location details 
  const [locationName, setLocationName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "unset";
      return;
    }
    
    document.body.style.overflow = "hidden";
    
    if (initialLat && initialLng) {
      setSelectedPoint({ lat: initialLat, lng: initialLng });
      fetchLocationDetails(initialLat, initialLng);
      // Let the globe update its point of view once initialized
      setTimeout(() => {
        if (globeRef.current) {
          globeRef.current.pointOfView({ lat: initialLat, lng: initialLng, altitude: 1.8 }, 1000);
        }
      }, 500);
    } else {
      setSelectedPoint(null);
      setGlobeAltitude(2.5);
      setLocationName("");
      setCountryName("");
      setTimeout(() => {
        if (globeRef.current) {
          // Point over NL by default
          globeRef.current.pointOfView({ lat: 52.13, lng: 5.29, altitude: 2.5 }, 1000);
        }
      }, 500);
    }
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, initialLat, initialLng]);

  // Handle globe container resizing
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });
    };

    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    updateDimensions();
    return () => observer.disconnect();
  }, [isFullscreen]);

  const scheme = SKINS[skin];

  // Perform geolocation to Nominatim with absolute minimum data
  const fetchLocationDetails = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
      ).catch(() => null);

      if (geoResponse && geoResponse.ok) {
        const geoData = await geoResponse.json();
        const address = geoData.address || {};
        // Clean up: filter out weird chars and set default to empty if not found
        const rawCity = address.city || address.town || address.village || address.municipality || address.county || geoData.name || "";
        const cleanCity = rawCity.replace(/[?!]/g, "").trim();
        const cleanCountry = (address.country || "").replace(/[?!]/g, "").trim();
        
        setLocationName(cleanCity || t("globe.unknown_location"));
        setCountryName(cleanCountry);
      } else {
        setLocationName(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°W`);
        setCountryName("");
      }
    } catch (err) {
      console.error("Fout bij ophalen locatie details:", err);
      setLocationName(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°W`);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobeClick = ({ lat, lng }: { lat: number; lng: number }) => {
    setSelectedPoint({ lat, lng });
    fetchLocationDetails(lat, lng);
    
    // Animate camera to the clicked location
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat, lng, altitude: 1.2 }, 1000);
      setGlobeAltitude(1.2);
    }

    // Auto-exit fullscreen on selection to show the buttons
    if (isFullscreen) {
      setIsFullscreen(false);
    }
  };

  const resetRotation = () => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 52.13, lng: 5.29, altitude: 2.5 }, 1000);
      setGlobeAltitude(2.5);
    }
  };

  const zoomIn = () => {
    const newAltitude = Math.max(0.1, globeAltitude - 0.5);
    setGlobeAltitude(newAltitude);
    if (globeRef.current) {
      const currentPov = globeRef.current.pointOfView();
      globeRef.current.pointOfView({ ...currentPov, altitude: newAltitude }, 500);
    }
  };

  const zoomOut = () => {
    const newAltitude = globeAltitude + 0.5;
    setGlobeAltitude(newAltitude);
    if (globeRef.current) {
      const currentPov = globeRef.current.pointOfView();
      globeRef.current.pointOfView({ ...currentPov, altitude: newAltitude }, 500);
    }
  };

  const handleSkinChange = (newSkin: GlobeSkin) => {
    setSkin(newSkin);
    localStorage.setItem("globe_skin", newSkin);
  };

  const isUnknown = locationName === t("globe.unknown_location") || locationName === "";

  const confirmSelection = () => {
    if (selectedPoint && locationName && !isUnknown) {
      onConfirm(locationName, selectedPoint.lat, selectedPoint.lng);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-slate-950/95 backdrop-blur-lg flex flex-col md:flex-row items-stretch justify-stretch overflow-hidden animate-fade-in text-slate-100">
      
      {/* Globe Section */}
      <div className={`relative flex flex-col transition-all duration-500 ease-in-out bg-[#030712] select-none ${isFullscreen ? "flex-1" : "flex-1 h-[60vh] md:h-full border-b md:border-b-0 md:border-r border-slate-800/40"}`}>
        
        {/* Dynamic Top Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-[501] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Back/Close */}
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto h-11 px-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 backdrop-blur shadow-2xl border border-slate-700/60 flex items-center gap-2 text-xs font-black text-rose-400 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
          >
            <X size={15} strokeWidth={3} />
            <span>{t("globe.on_close")}</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="pointer-events-auto h-11 w-11 rounded-2xl bg-slate-900/90 hover:bg-slate-800 shadow-2xl border border-slate-700/60 flex items-center justify-center text-primary-light hover:scale-105 transition-all cursor-pointer"
              title={isFullscreen ? t("globe.minimize") : t("globe.fullscreen")}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

            {/* Reset button centering back to Netherlands */}
            <button
              type="button"
              onClick={resetRotation}
              className="pointer-events-auto h-11 w-11 rounded-2xl bg-slate-900/90 hover:bg-slate-800 shadow-2xl border border-slate-700/60 flex items-center justify-center text-primary-light hover:scale-105 transition-all cursor-pointer"
              title={t("globe.reset_netherlands")}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Skins Switcher bar - centered top */}
        {!isFullscreen && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[501] pointer-events-auto flex items-center gap-1 bg-slate-900/90 backdrop-blur p-1 rounded-2xl shadow-2xl border border-slate-700/60">
            {(Object.keys(SKINS) as GlobeSkin[]).map((sKey) => (
              <button
                key={sKey}
                type="button"
                onClick={() => handleSkinChange(sKey)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  skin === sKey
                    ? "bg-emerald-600 text-white shadow-md font-extrabold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {sKey === "satellite" ? t("globe.satellite") : t("globe.night")}
              </button>
            ))}
          </div>
        )}

        {/* Active Visual Box */}
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center" ref={containerRef}>
          <div className="absolute inset-0">
            <Globe
              ref={globeRef as any}
              width={dimensions.width}
              height={dimensions.height}
              globeImageUrl={scheme.globeImage}
              backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
              atmosphereColor={scheme.atmosphereColor}
              atmosphereAltitude={0.15}
              onGlobeClick={handleGlobeClick}
              backgroundColor="rgba(0,0,0,0)"
              labelsData={selectedPoint ? [selectedPoint] : []}
              labelLat={(d: any) => d.lat}
              labelLng={(d: any) => d.lng}
              labelText={() => "📍 " + (locationName || "")}
              labelSize={2.5}
              labelDotRadius={1}
              labelColor={() => (isUnknown ? "rgba(255, 100, 100, 0.5)" : "rgba(100, 255, 150, 1)")}
              labelResolution={2}
            />
          </div>
          
          {/* Toast Instruction badge */}
          {!isFullscreen && (
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-1 text-center pointer-events-none z-20">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#50c878] flex items-center gap-1.5 bg-[#50c878]/15 px-3 py-1 rounded-full animate-pulse border border-[#50c878]/25">
                <span className="w-2 h-2 rounded-full bg-[#50c878]" /> {t("globe.instruction_title")}
              </span>
              <p className="text-[10.5px] text-slate-400 font-medium max-w-xs leading-relaxed mt-1 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-md">
                {t("globe.instruction_desc")}
              </p>
            </div>
          )}

          {/* Zooms Trigger Widgets */}
          <div className="absolute top-20 right-4 z-[501] flex flex-col gap-1.5 pointer-events-auto">
            <button
              onClick={zoomIn}
              className="w-11 h-11 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center border border-slate-700/60 shadow-2xl transition-all active:scale-90 cursor-pointer"
              title={t("globe.zoom_in")}
            >
              <ZoomIn size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={zoomOut}
              className="w-11 h-11 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 flex items-center justify-center border border-slate-700/60 shadow-2xl transition-all active:scale-90 cursor-pointer"
              title={t("globe.zoom_out")}
            >
              <ZoomOut size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

      </div>

      {/* Detail panel Sidebar/Bottom sheet */}
      {!isFullscreen && (
        <div className="w-full md:w-[380px] bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800/80 flex flex-col justify-between overflow-y-auto h-[40vh] md:h-full p-6 shadow-2xl relative z-[502]">
          
          <div className="space-y-6">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#50c878] bg-[#50c878]/15 text-[#50c878] px-2.5 py-0.5 rounded-full animate-pulse">
                {t("globe.map_selection")}
              </span>
              <h2 className={`text-2xl font-display font-bold tracking-tight mt-2 ${isUnknown ? "text-rose-400" : "text-slate-100"}`}>
                {loading ? t("globe.loading_data") : locationName || t("globe.select_place")}
              </h2>
              {countryName && !loading && (
                <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1.5">
                  <span>📍</span>
                  <span>{countryName}</span>
                </p>
              )}
            </div>

            {selectedPoint && !loading && (
              <div className="space-y-4 pt-2">
                {/* Compass Coordinates */}
                <div className="bg-slate-950/50 p-4 rounded-2xl flex items-center justify-between border border-slate-800/60 shadow-inner">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Compass size={14} className="text-primary-light" />
                    <span className="text-[10px] font-black uppercase tracking-wider">{t("globe.coordinates")}</span>
                  </div>
                  <span className="font-mono text-xs font-black text-slate-200">
                    {selectedPoint.lat.toFixed(4)}°N, {selectedPoint.lng.toFixed(4)}°W
                  </span>
                </div>
              </div>
            )}

            {!selectedPoint && (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <span className="text-4xl block animate-bounce" style={{ animationDuration: '3s' }}>🌍</span>
                <p className="text-xs font-bold uppercase tracking-wider leading-relaxed px-4">
                  {t("globe.drag_instruction")}
                </p>
              </div>
            )}
          </div>

          {/* Action Button footer */}
          <div className="pt-6 border-t border-slate-800 flex flex-col gap-3 mt-auto">
            <button
              type="button"
              onClick={confirmSelection}
              disabled={!selectedPoint || loading || isUnknown}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-2xl transition-all transform active:scale-95 ${
                selectedPoint && !loading && !isUnknown
                  ? "bg-primary text-white hover:scale-[1.02] cursor-pointer"
                  : "bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800/10"
              }`}
            >
              <Check size={14} strokeWidth={3} />
              <span>{t("globe.confirm")}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            >
              <X size={14} strokeWidth={3} />
              <span>{t("globe.cancel")}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
