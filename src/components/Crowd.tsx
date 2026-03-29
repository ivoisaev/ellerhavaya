"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Spot {
  grid_index: number;
  message: string;
  location: string;
  color: string;
}

export default function Crowd() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Veriler yüklendi mi? (Burası Canvas'a ne zaman çizeceğini söyleyecek)
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [liveSpots, setLiveSpots] = useState<Spot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);

  // 1. ADIM: VERİLERİ SUPABASE'DEN ÇEK
  useEffect(() => {
    const fetchSpots = async () => {
      const { data } = await supabase.from("spots").select("grid_index, message, location").limit(100);
      if (data) {
        const coloredData = data.map(spot => ({
          ...spot,
          color: Math.random() > 0.5 ? "#ff007f" : "#00f3ff"
        }));
        setLiveSpots(coloredData);
      }
      setIsDataLoaded(true); // Veriler geldi! Artık çizebiliriz.
    };
    fetchSpots();

    const subscription = supabase
      .channel("live-spots")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spots" }, (payload) => {
          const newSpot = {
            grid_index: payload.new.grid_index,
            message: payload.new.message,
            location: payload.new.location,
            color: Math.random() > 0.5 ? "#ff007f" : "#00f3ff"
          };
          setLiveSpots((current) => [...current, newSpot]);
      }).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // 2. ADIM: VERİLER GELDİKTEN SONRA CANVAS'I ÇİZ
  useEffect(() => {
    if (!isDataLoaded) return; // Veriler gelmeden sakın çizme!

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const spotCount = 5000; 
    
    // 🚀 DİKKAT: Artık bu dizi oluşturulurken liveSpots KESİN DOLU oluyor.
    const allSpots = Array.from({ length: spotCount }).map((_, index) => {
      const liveSpot = liveSpots.find(s => (s.grid_index % spotCount) === index);
      return {
        x: seededRandom(index * 123.456), 
        y: seededRandom(index * 987.654), 
        isFilled: !!liveSpot, 
        color: liveSpot ? liveSpot.color : "#ffffff", 
        message: liveSpot ? liveSpot.message : "",
        location: liveSpot ? liveSpot.location : "",
        grid_index: liveSpot ? liveSpot.grid_index : 0, 
      };
    });

    let animationFrameId: number;
    let currentHeroIndex = -1;
    let heroTimer = 0;
    let heroDuration = 180; 

    const drawCrowd = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (heroTimer <= 0 && liveSpots.length > 0) {
        const filledSpots = allSpots.filter(s => s.isFilled);
        if (filledSpots.length > 0) {
          const randomIndex = Math.floor(Math.random() * filledSpots.length);
          currentHeroIndex = allSpots.indexOf(filledSpots[randomIndex]);
          heroTimer = heroDuration; 
        }
      }
      if (heroTimer > 0) heroTimer--; 

      allSpots.forEach((spot, index) => {
         const px = spot.x * canvas.width;
         const py = spot.y * canvas.height;
         const distance = spot.y; 

         const isHero = index === currentHeroIndex && heroTimer > 0;

         // 🚀 MOBİLDE EMOJİLER BÜYÜTÜLDÜ (Daha rahat görünmesi ve tıklanması için)
         let baseSize = (isMobile ? 8 : 4) + (distance * 18); 
         let size = isHero ? baseSize * 2.5 : baseSize; 

         if (spot.isFilled) {
            // GERÇEK MESAJLAR PARIL PARIL YANSIN
            ctx.globalAlpha = isHero ? 1 : 0.85 + (distance * 0.15); // Her zaman çok parlak
            ctx.fillStyle = spot.color;
            ctx.font = `${size}px Arial`;
            
            const drawY = isHero ? py - 10 : py;
            ctx.fillText("🙌", px, drawY);
            
            if (isHero) {
              const text = spot.message;
              const shortText = text.length > 20 ? text.substring(0, 20) + "..." : text;
              
              const boxY = drawY - size - 40;
              ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
              ctx.fillRect(px - 15, boxY, 160, 35);
              ctx.strokeStyle = spot.color;
              ctx.lineWidth = 1;
              ctx.strokeRect(px - 15, boxY, 160, 35);

              ctx.fillStyle = "#a1a1aa"; 
              ctx.font = "bold 9px Arial";
              ctx.fillText(`📍 ${spot.location || "Gizli"}`, px - 10, boxY + 15);

              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 11px Arial";
              ctx.fillText(shortText, px - 10, boxY + 30);
            }
         } else {
            // BOŞ SİLÜETLER (Sadece Gri Noktalar)
            ctx.globalAlpha = isMobile ? 0.25 + (distance * 0.3) : 0.15 + (distance * 0.3);
            ctx.fillStyle = "#334155"; 
            ctx.beginPath();
            ctx.arc(px, py, size / 3, 0, Math.PI * 2);
            ctx.fill();
         }
      });
      animationFrameId = requestAnimationFrame(drawCrowd);
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if(rect) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
    };

    const handleClick = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let cx = 0, cy = 0;

      if ("touches" in e) {
        if (e.touches.length > 0) {
          cx = e.touches[0].clientX - rect.left;
          cy = e.touches[0].clientY - rect.top;
        }
      } else {
        cx = (e as MouseEvent).clientX - rect.left;
        cy = (e as MouseEvent).clientY - rect.top;
      }

      const clickedSpot = allSpots.find(spot => {
         if (!spot.isFilled) return false;
         const px = spot.x * rect.width;
         const py = spot.y * rect.height;
         const dist = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
         return dist < (isMobile ? 50 : 30); 
      });

      if (clickedSpot) {
        setSelectedSpot(clickedSpot);
      }
    };

    window.addEventListener("resize", resize);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchend", handleClick);
    
    resize();
    drawCrowd();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchend", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [liveSpots, isDataLoaded]); // 🚀 KRİTİK NOKTA: Veri Geldiği An Kendini Yenile

  return (
    <>
      <canvas ref={canvasRef} className="w-full h-full cursor-pointer block" />

      {selectedSpot && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer p-4"
          onClick={() => setSelectedSpot(null)} 
        >
          <div 
            className="bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl w-[90%] max-w-sm text-center relative overflow-hidden"
            style={{ boxShadow: `0 0 50px ${selectedSpot.color}40` }} 
            onClick={(e) => e.stopPropagation()} 
          >
            <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: selectedSpot.color }} />
            <span className="text-4xl sm:text-5xl mb-4 block" style={{ textShadow: `0 0 20px ${selectedSpot.color}` }}>🙌</span>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-6 break-words">"{selectedSpot.message}"</h3>
            <p className="text-xs sm:text-sm font-bold tracking-widest uppercase text-zinc-500 mb-6">
              📍 {selectedSpot.location || "GİZLİ KONUM"}
            </p>
            <button 
              onClick={() => setSelectedSpot(null)}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 px-8 rounded-full transition active:scale-95"
            >
              KAPAT
            </button>
          </div>
        </div>
      )}
    </>
  );
}