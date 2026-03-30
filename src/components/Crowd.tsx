"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Spot {
  grid_index: number;
  message: string;
  location: string;
}

// Yükselen animasyonların durumunu tutacak yapı
interface ActiveAnimation {
  index: number;
  startTime: number;
}

export default function Crowd({ timeMode }: { timeMode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveSpots, setLiveSpots] = useState<Spot[]>([]);

  // Veri Çekme
  useEffect(() => {
    const fetchSpots = async () => {
      const { data } = await supabase.from("spots").select("grid_index, message, location").order('created_at', { ascending: false }).limit(200);
      if (data) setLiveSpots(data);
    };
    fetchSpots();

    const subscription = supabase
      .channel("live-spots")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spots" }, (payload) => {
          setLiveSpots((current) => [payload.new as Spot, ...current]);
      }).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // Sanat Motoru
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const isDay = timeMode === "day";
    const spotCount = typeof window !== "undefined" && window.innerWidth < 768 ? 2000 : 5000; 

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    
    const allSpots = Array.from({ length: spotCount }).map((_, index) => {
      const liveSpot = liveSpots.find(s => (s.grid_index % spotCount) === index);
      return {
        x: seededRandom(index * 123.456), 
        y: seededRandom(index * 987.654), 
        isFilled: !!liveSpot, 
        message: liveSpot ? liveSpot.message : "",
        location: liveSpot ? liveSpot.location : "",
      };
    });

    const filledIndices = allSpots.map((spot, i) => spot.isFilled ? i : -1).filter(i => i !== -1);

    let animationFrameId: number;
    let activeAnimations: ActiveAnimation[] = [];
    
    // Animasyon Kuralları
    const ANIMATION_DURATION = 5000; // 5 Saniye sürer
    const FADE_IN_TIME = 1000; // İlk 1 saniye gri->sarı geçiş ve yükseliş
    const FADE_OUT_TIME = 1000; // Son 1 saniye sarı->gri ve düşüş

    // Yumuşak yükseliş matematiği (Ease Out)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // Rastgele Animasyon Tetikleyici
    const triggerRandomAnimation = () => {
      if (filledIndices.length === 0) return;
      
      // %10 ihtimalle "Rare Moment" (Aynı anda 2-3 tane kalkar)
      const count = Math.random() > 0.9 ? Math.floor(Math.random() * 2) + 2 : 1;

      for(let i=0; i<count; i++) {
        // Yeni mesajlara daha çok öncelik vermek için basit bir hile (dizi başındakiler yeni kabul edilir)
        const rand = Math.random();
        const skewedIndex = Math.floor(rand * rand * filledIndices.length); 
        const indexToAnimate = filledIndices[skewedIndex];

        // Zaten animasyonda değilse ekle
        if (!activeAnimations.find(a => a.index === indexToAnimate)) {
          activeAnimations.push({ index: indexToAnimate, startTime: performance.now() });
        }
      }

      // Bir sonraki tetikleme 2 ile 5 saniye arası rastgele
      setTimeout(triggerRandomAnimation, 2000 + Math.random() * 3000);
    };

    // İlk tetiklemeyi başlat
    const timeoutId = setTimeout(triggerRandomAnimation, 2000);

    const drawCrowd = (currentTime: number) => {
      // Arkaplan Rengi (Gündüz/Gece)
      ctx.fillStyle = isDay ? "#e2e2df" : "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Biten animasyonları temizle
      activeAnimations = activeAnimations.filter(a => currentTime - a.startTime < ANIMATION_DURATION);

      allSpots.forEach((spot, index) => {
         const px = spot.x * canvas.width;
         const py = spot.y * canvas.height;
         const distance = spot.y; // 0 uzak, 1 yakın (2.5D derinlik hissi)
         
         const isMobile = window.innerWidth < 768;
         const baseSize = (isMobile ? 6 : 4) + (distance * 14); 
         
         const activeAnim = activeAnimations.find(a => a.index === index);

         if (activeAnim) {
            // --- HAREKETLİ (YÜKSELEN) DURUM ---
            const elapsed = currentTime - activeAnim.startTime;
            let progress = 0;
            let alpha = 1;
            let glow = 0;

            if (elapsed < FADE_IN_TIME) {
              // Yükselme ve Sararma
              progress = easeOutCubic(elapsed / FADE_IN_TIME);
              glow = progress;
              alpha = 0.3 + (0.7 * progress);
            } else if (elapsed > ANIMATION_DURATION - FADE_OUT_TIME) {
              // Düşme ve Griye Dönme
              const outElapsed = elapsed - (ANIMATION_DURATION - FADE_OUT_TIME);
              progress = 1 - easeOutCubic(outElapsed / FADE_OUT_TIME);
              glow = progress;
              alpha = 0.3 + (0.7 * progress);
            } else {
              // Havada asılı bekleme
              progress = 1;
              glow = 1;
              alpha = 1;
            }

            const currentY = py - (progress * (isMobile ? 30 : 40)); // Havaya kalkma miktarı
            const size = baseSize + (progress * (isMobile ? 15 : 10)); // Büyüme miktarı

            // Glow ve Renk Efekti (Gri -> Neon Sarı)
            ctx.globalAlpha = alpha;
            ctx.font = `${size}px Arial`;
            
            // Eğer gündüzse sarı biraz daha koyu/turuncumsu olsun ki okunsun, geceyse neon sarı
            const targetColor = isDay ? `rgba(230, 150, 0, ${glow})` : `rgba(255, 204, 0, ${glow})`;
            ctx.fillStyle = glow > 0.1 ? targetColor : (isDay ? "#a1a1aa" : "#3f3f46");
            
            // Shadow (Glow) efekti sadece tepe noktasındayken tam çalışır
            ctx.shadowColor = isDay ? "transparent" : "#ffcc00";
            ctx.shadowBlur = glow * 15;
            
            ctx.fillText("🙌", px, currentY);
            
            // Mesajın Metni
            if (glow > 0.5) {
              ctx.shadowBlur = 0; // Yazılarda blur kapalı
              ctx.fillStyle = isDay ? `rgba(0,0,0,${glow})` : `rgba(255,255,255,${glow})`;
              
              // Lokasyon
              ctx.font = `bold ${isMobile ? 10 : 12}px Arial`;
              ctx.fillText(`📍 ${spot.location || "Anonim"}`, px - 10, currentY - size - 10);
              
              // Mesaj
              ctx.font = `${isMobile ? 12 : 14}px Arial`;
              ctx.fillText(`"${spot.message}"`, px - 10, currentY - size + 5);
            }
            
            ctx.shadowBlur = 0; // Sıfırla

         } else {
            // --- SAKİN (GRİ) DURUM ---
            ctx.globalAlpha = isDay ? 0.4 + (distance * 0.3) : 0.1 + (distance * 0.2);
            ctx.fillStyle = isDay ? "#a1a1aa" : "#27272a"; // Gündüz açık gri, Gece koyu antrasit
            ctx.font = `${baseSize}px Arial`;
            ctx.fillText("🙌", px, py);
         }
      });

      animationFrameId = requestAnimationFrame(() => drawCrowd(performance.now()));
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

    window.addEventListener("resize", resize);
    resize();
    drawCrowd(performance.now());

    return () => {
      window.removeEventListener("resize", resize);
      clearTimeout(timeoutId);
      cancelAnimationFrame(animationFrameId);
    };
  }, [liveSpots, timeMode]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}