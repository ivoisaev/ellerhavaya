"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Spot {
  grid_index: number;
  message: string;
  location: string;
}

interface ActiveAnimation {
  id: number;
  startTime: number;
}

interface AvatarSpot {
  id: number;
  x: number;
  y: number;
  baseSize: number;
  distance: number;
  isFilled: boolean;
  message: string;
  location: string;
  grid_index: number;
}

export default function Crowd({ timeMode }: { timeMode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveSpots, setLiveSpots] = useState<Spot[]>([]);
  const newArrivalsRef = useRef<number[]>([]);

  useEffect(() => {
    const fetchSpots = async () => {
      const { data } = await supabase.from("spots").select("grid_index, message, location").order('created_at', { ascending: false }).limit(200);
      if (data) setLiveSpots(data);
    };
    fetchSpots();

    const subscription = supabase
      .channel("live-spots")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spots" }, (payload) => {
          const newSpot = payload.new as Spot;
          setLiveSpots((current) => [newSpot, ...current]);
          newArrivalsRef.current.push(newSpot.grid_index);
      }).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const isDay = timeMode === "day";
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    let spotsArray: AvatarSpot[] = [];
    let activeAnimations: ActiveAnimation[] = [];
    let animationFrameId: number;
    let randomTimer = 0;

    // 👤 BİR İNSAN SİLÜETİ ÇİZME FONKSİYONU (Whatsapp tarzı)
    const drawAvatar = (x: number, y: number, size: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isDay ? "#a1a1aa" : "#27272a"; // Gündüz gri, Gece koyu gri
      
      // Kafa
      ctx.beginPath();
      ctx.arc(x, y - size / 4, size / 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Omuzlar (Yarım Daire)
      ctx.beginPath();
      ctx.arc(x, y + size / 2, size / 1.5, Math.PI, 0);
      ctx.fill();
    };

    const generateSpots = () => {
      const spots: AvatarSpot[] = [];
      const count = isMobile ? 3000 : 7000; // Rastgele dağınık kitle
      
      const seededRandom = (seed: number) => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };

      for(let i = 0; i < count; i++) {
        const px = seededRandom(i * 123) * (canvas.width + 100) - 50;
        const py = seededRandom(i * 987) * (canvas.height + 100) - 50;
        const distance = py / canvas.height;
        const size = (isMobile ? 12 : 16) + (distance * 24);

        spots.push({
          id: i,
          x: px,
          y: py,
          baseSize: size,
          distance: distance,
          isFilled: false,
          message: "",
          location: "",
          grid_index: i
        });
      }

      // 3D Hissi için: Y ekseninde (Aşağıdan yukarı) sırala ki arkadakiler öndekilerin altında kalsın
      return spots.sort((a, b) => a.y - b.y);
    };

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if(rect) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }
      
      spotsArray = generateSpots();

      // Gerçek mesajları rastgele insan silüetlerinin içine gizle
      liveSpots.forEach(ls => {
        if (spotsArray.length > 0) {
          const targetIndex = ls.grid_index % spotsArray.length;
          if (spotsArray[targetIndex]) {
            spotsArray[targetIndex].isFilled = true;
            spotsArray[targetIndex].message = ls.message;
            spotsArray[targetIndex].location = ls.location;
            spotsArray[targetIndex].grid_index = ls.grid_index;
          }
        }
      });
    };

    const ANIMATION_DURATION = 6000; 
    const FADE_IN = 1000;
    const FADE_OUT = 1000;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const drawCrowd = (currentTime: number) => {
      ctx.fillStyle = isDay ? "#f4f4f5" : "#050505"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Yeni Gelenleri Patlat
      if (newArrivalsRef.current.length > 0) {
        newArrivalsRef.current.forEach(newGridIndex => {
          const targetSpot = spotsArray.find(s => s.grid_index === newGridIndex);
          if (targetSpot && !activeAnimations.find(a => a.id === targetSpot.id)) {
            activeAnimations.push({ id: targetSpot.id, startTime: currentTime });
          }
        });
        newArrivalsRef.current = []; 
      }

      // Rastgele Eskileri Patlat
      if (currentTime > randomTimer) {
        const filledSpots = spotsArray.filter(s => s.isFilled);
        if (filledSpots.length > 0) {
          const count = Math.random() > 0.8 ? 3 : (Math.random() > 0.4 ? 2 : 1); 
          for(let i=0; i<count; i++) {
             const randomSpot = filledSpots[Math.floor(Math.random() * filledSpots.length)];
             if (!activeAnimations.find(a => a.id === randomSpot.id)) {
               activeAnimations.push({ id: randomSpot.id, startTime: currentTime });
             }
          }
        }
        randomTimer = currentTime + 3000 + (Math.random() * 4000); 
      }

      activeAnimations = activeAnimations.filter(a => currentTime - a.startTime < ANIMATION_DURATION);
      const animatingIds = activeAnimations.map(a => a.id);
      
      // 1. ÖNCE SESSİZ İNSANLARI (AVATARLARI) ÇİZ
      spotsArray.forEach(spot => {
         if (animatingIds.includes(spot.id)) return; 
         
         const alpha = isDay ? 0.4 + (spot.distance * 0.3) : 0.2 + (spot.distance * 0.3);
         drawAvatar(spot.x, spot.y, spot.baseSize, alpha);
      });

      // 2. SONRA ELLERİNİ KALDIRAN MESAJLARI ÇİZ
      activeAnimations.forEach(anim => {
         const spot = spotsArray.find(s => s.id === anim.id);
         if (!spot) return;

         const elapsed = currentTime - anim.startTime;
         let progress = 0, glow = 0, alpha = 1;

         if (elapsed < FADE_IN) {
            progress = easeOutCubic(elapsed / FADE_IN);
            glow = progress;
            alpha = progress; 
         } else if (elapsed > ANIMATION_DURATION - FADE_OUT) {
            const outElapsed = elapsed - (ANIMATION_DURATION - FADE_OUT);
            progress = 1 - easeOutCubic(outElapsed / FADE_OUT);
            glow = progress;
            alpha = progress; 
         } else {
            progress = 1; glow = 1; alpha = 1;
         }

         const currentY = spot.y - (progress * (isMobile ? 30 : 40)); 
         const currentSize = spot.baseSize + (progress * 15); 

         ctx.globalAlpha = alpha;
         
         ctx.shadowColor = isDay ? "transparent" : "#ffcc00";
         ctx.shadowBlur = glow * 20;
         
         // Sadece bu kişi ayağa kalkıp ellerini kaldırır!
         ctx.font = `${currentSize}px Arial`;
         ctx.fillText("🙌", spot.x - currentSize/2, currentY + currentSize/3);
         ctx.shadowBlur = 0; 

         // Mesaj Kutusu
         if (glow > 0.5) {
            const boxY = currentY - currentSize - 35;
            
            ctx.fillStyle = isDay ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)";
            ctx.fillRect(spot.x - 90, boxY, 180, 35);
            ctx.strokeStyle = `rgba(255, 204, 0, ${glow})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(spot.x - 90, boxY, 180, 35);

            ctx.fillStyle = isDay ? "#52525b" : "#a1a1aa"; 
            ctx.font = `bold 10px Arial`;
            ctx.textAlign = "center"; // Yazıyı ortala
            ctx.fillText(`📍 ${spot.location || "Anonim"}`, spot.x, boxY + 14);

            ctx.fillStyle = isDay ? "#000000" : "#ffffff";
            ctx.font = `bold 13px Arial`;
            const shortText = spot.message.length > 25 ? spot.message.substring(0, 25) + "..." : spot.message;
            ctx.fillText(`"${shortText}"`, spot.x, boxY + 28);
            
            ctx.textAlign = "left"; // Düzeni geri al
         }
      });

      animationFrameId = requestAnimationFrame(drawCrowd);
    };

    window.addEventListener("resize", setupCanvas);
    setupCanvas();
    drawCrowd(performance.now());

    return () => {
      window.removeEventListener("resize", setupCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [liveSpots, timeMode]);

  return <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />;
}