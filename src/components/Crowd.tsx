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

// Artık sadece "sanal" noktalar. Çizilmeyecekler, sadece animasyonun çıkacağı koordinatları tutacaklar.
interface VirtualSpot {
  id: number;
  x: number;
  y: number;
  baseSize: number;
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
    const ctx = canvas.getContext("2d", { alpha: true }); // ARTIK ŞEFFAF!
    if (!ctx) return;

    const isDay = timeMode === "day";
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    let spotsArray: VirtualSpot[] = [];
    let activeAnimations: ActiveAnimation[] = [];
    let animationFrameId: number;
    let randomTimer = 0;

    // 🎇 GECE KULÜBÜ IŞIKLARI (Lazer/Spotlight)
    const drawClubLights = (width: number, height: number, time: number) => {
      ctx.globalCompositeOperation = "screen"; 
      const t = time * 0.0005;

      // 1. Işık: Magenta
      const x1 = width * 0.5 + Math.sin(t) * width * 0.4;
      const y1 = height * 0.5 + Math.cos(t * 1.3) * height * 0.4;
      const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, width * 0.6);
      grad1.addColorStop(0, "rgba(255, 0, 150, 0.2)"); 
      grad1.addColorStop(1, "rgba(255, 0, 150, 0)");
      ctx.fillStyle = grad1;
      ctx.beginPath(); ctx.arc(x1, y1, width * 0.6, 0, Math.PI * 2); ctx.fill();

      // 2. Işık: Cyan
      const x2 = width * 0.5 + Math.cos(t * 0.8) * width * 0.4;
      const y2 = height * 0.5 + Math.sin(t * 1.1) * height * 0.4;
      const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, width * 0.6);
      grad2.addColorStop(0, "rgba(0, 255, 255, 0.2)");
      grad2.addColorStop(1, "rgba(0, 255, 255, 0)");
      ctx.fillStyle = grad2;
      ctx.beginPath(); ctx.arc(x2, y2, width * 0.6, 0, Math.PI * 2); ctx.fill();

      ctx.globalCompositeOperation = "source-over"; 
    };

    // Sanal Koordinat Haritası (Ekranda görünmezler, sadece emojilerin çıkacağı yerleri belirler)
    const generateVirtualSpots = (width: number, height: number) => {
      const spots: VirtualSpot[] = [];
      const count = isMobile ? 1000 : 3000; 

      for(let i = 0; i < count; i++) {
        const px = Math.random() * width;
        const py = Math.random() * height;
        const distance = py / height; // Derinlik algısı (aşağıdakiler daha büyük)
        const size = (isMobile ? 20 : 25) + (distance * 15);

        spots.push({
          id: i,
          x: px,
          y: py,
          baseSize: size,
          isFilled: false,
          message: "",
          location: "",
          grid_index: i
        });
      }
      return spots.sort((a, b) => a.y - b.y); // Önce arkadakiler (Y ekseni sıralaması)
    };

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if(rect) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }
      
      spotsArray = generateVirtualSpots(rect?.width || window.innerWidth, rect?.height || window.innerHeight);

      // Veritabanı mesajlarını sanal noktalara bağla
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
    const FADE_IN = 800;
    const FADE_OUT = 800;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const drawCrowd = (currentTime: number) => {
      // 1. CANVAS'I TAMAMEN TEMİZLE (Arkada resim görünsün)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 2. GECEYSE LAZERLERİ ÇİZ
      if (!isDay) {
        drawClubLights(canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), currentTime);
      }

      // Animasyon Tetikleyicileri
      if (newArrivalsRef.current.length > 0) {
        newArrivalsRef.current.forEach(newGridIndex => {
          const targetSpot = spotsArray.find(s => s.grid_index === newGridIndex);
          if (targetSpot && !activeAnimations.find(a => a.id === targetSpot.id)) {
            activeAnimations.push({ id: targetSpot.id, startTime: currentTime });
          }
        });
        newArrivalsRef.current = []; 
      }

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

      // 3. SADECE ELLERİNİ KALDIRAN MESAJLARI ÇİZ (Avatar silüeti yok, sihir tam burada!)
      activeAnimations.forEach(anim => {
         const spot = spotsArray.find(s => s.id === anim.id);
         if (!spot) return;

         const elapsed = currentTime - anim.startTime;
         let progress = 0, glow = 0, alpha = 1;

         if (elapsed < FADE_IN) {
            progress = easeOutCubic(elapsed / FADE_IN);
            glow = progress; alpha = progress; 
         } else if (elapsed > ANIMATION_DURATION - FADE_OUT) {
            const outElapsed = elapsed - (ANIMATION_DURATION - FADE_OUT);
            progress = 1 - easeOutCubic(outElapsed / FADE_OUT);
            glow = progress; alpha = progress; 
         } else {
            progress = 1; glow = 1; alpha = 1;
         }

         const currentY = spot.y - (progress * (isMobile ? 30 : 50)); 
         const currentSize = spot.baseSize + (progress * 15); 

         ctx.globalAlpha = alpha;
         
         // Zıplayan kişinin emojisi (Sanki fotoğraftan fırlamış gibi)
         ctx.font = `${currentSize}px Arial`;
         ctx.shadowColor = isDay ? "rgba(0,0,0,0.3)" : "rgba(255, 204, 0, 0.8)";
         ctx.shadowBlur = isDay ? 10 : glow * 25;
         ctx.fillText("🙌", spot.x - currentSize/2, currentY + currentSize/3);
         ctx.shadowBlur = 0; 

         // Mesaj Kutusu
         if (glow > 0.5) {
            const boxY = currentY - currentSize - 35;
            
            ctx.fillStyle = isDay ? "rgba(255, 255, 255, 0.95)" : "rgba(10, 10, 10, 0.95)";
            ctx.beginPath();
            ctx.roundRect(spot.x - 100, boxY, 200, 42, 10);
            ctx.fill();

            // Kutuya gölge eklendi (Fotoğrafın üzerinde havada dursun diye)
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 15;
            ctx.strokeStyle = `rgba(255, 204, 0, ${glow})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.shadowBlur = 0; // Gölgeyi diğer çizimlere bulaşmasın diye sıfırla

            ctx.fillStyle = isDay ? "#71717a" : "#a1a1aa"; 
            ctx.font = `bold 10px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(`📍 ${spot.location || "Anonim"}`, spot.x, boxY + 14);

            ctx.fillStyle = isDay ? "#000000" : "#ffffff";
            ctx.font = `bold 13px sans-serif`;
            const shortText = spot.message.length > 25 ? spot.message.substring(0, 25) + "..." : spot.message;
            ctx.fillText(`"${shortText}"`, spot.x, boxY + 30);
            
            ctx.textAlign = "left"; 
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

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}