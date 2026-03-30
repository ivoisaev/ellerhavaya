"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Spot {
  grid_index: number;
  message: string;
  location: string;
  created_at: string; // TARİH EKLENDİ
}

interface ActiveAnimation {
  id: number;
  startTime: number;
}

// Yaş kategorileri
enum AgeCategory {
  NEW,      // Son 24 saat
  OLD,      // 1 - 7 gün arası
  VERY_OLD  // 1 haftadan eski
}

interface VirtualSpot {
  id: number;
  x: number;
  y: number;
  baseSize: number;
  isFilled: boolean;
  message: string;
  location: string;
  grid_index: number;
  ageCategory?: AgeCategory; // Mesajın ne kadar eski olduğu
}

export default function Crowd({ timeMode }: { timeMode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveSpots, setLiveSpots] = useState<Spot[]>([]);
  const newArrivalsRef = useRef<number[]>([]);

  useEffect(() => {
    const fetchSpots = async () => {
      // Eski mesajları da görebilmek için limiti 500'e çıkardık
      const { data } = await supabase
        .from("spots")
        .select("grid_index, message, location, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (data) setLiveSpots(data);
    };
    fetchSpots();

    const subscription = supabase
      .channel("live-spots")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "spots" }, (payload) => {
        const newSpot = payload.new as Spot;
        setLiveSpots((current) => [newSpot, ...current]);
        newArrivalsRef.current.push(newSpot.grid_index);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const isDay = timeMode === "day";
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    let spotsArray: VirtualSpot[] = [];
    let activeAnimations: ActiveAnimation[] = [];
    let animationFrameId: number;

    // 3 FARKLI ZAMANLAYICI (Yeni Algoritma)
    let timerNew = 0;
    let timerOld = 0;
    let timerVeryOld = 0;

    const drawClubLights = (width: number, height: number, time: number) => {
      ctx.globalCompositeOperation = "screen";
      const t = time * 0.0005;
      const x1 = width * 0.5 + Math.sin(t) * width * 0.4;
      const y1 = height * 0.5 + Math.cos(t * 1.3) * height * 0.4;
      const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, width * 0.6);
      grad1.addColorStop(0, "rgba(255, 0, 150, 0.2)");
      grad1.addColorStop(1, "rgba(255, 0, 150, 0)");
      ctx.fillStyle = grad1;
      ctx.beginPath(); ctx.arc(x1, y1, width * 0.6, 0, Math.PI * 2); ctx.fill();

      const x2 = width * 0.5 + Math.cos(t * 0.8) * width * 0.4;
      const y2 = height * 0.5 + Math.sin(t * 1.1) * height * 0.4;
      const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, width * 0.6);
      grad2.addColorStop(0, "rgba(0, 255, 255, 0.2)");
      grad2.addColorStop(1, "rgba(0, 255, 255, 0)");
      ctx.fillStyle = grad2;
      ctx.beginPath(); ctx.arc(x2, y2, width * 0.6, 0, Math.PI * 2); ctx.fill();

      ctx.globalCompositeOperation = "source-over";
    };

    const generateVirtualSpots = (width: number, height: number) => {
      const spots: VirtualSpot[] = [];
      const count = isMobile ? 1000 : 3000;
      for (let i = 0; i < count; i++) {
        const px = Math.random() * width;
        const py = Math.random() * height;
        const distance = py / height;
        const size = (isMobile ? 20 : 25) + distance * 15;
        spots.push({ id: i, x: px, y: py, baseSize: size, isFilled: false, message: "", location: "", grid_index: i });
      }
      return spots.sort((a, b) => a.y - b.y);
    };

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      spotsArray = generateVirtualSpots(rect?.width || window.innerWidth, rect?.height || window.innerHeight);
      const now = new Date().getTime();

      liveSpots.forEach((ls) => {
        if (spotsArray.length > 0) {
          const targetIndex = ls.grid_index % spotsArray.length;
          if (spotsArray[targetIndex]) {
            // Mesajın ne kadar eski olduğunu hesapla
            const spotTime = new Date(ls.created_at).getTime();
            const hoursDiff = (now - spotTime) / (1000 * 60 * 60);
            
            let category = AgeCategory.NEW; // Varsayılan: Son 24 Saat
            if (hoursDiff > 24 && hoursDiff <= 168) category = AgeCategory.OLD; // 1-7 Gün arası
            else if (hoursDiff > 168) category = AgeCategory.VERY_OLD; // 1 Haftadan eski

            spotsArray[targetIndex].isFilled = true;
            spotsArray[targetIndex].message = ls.message;
            spotsArray[targetIndex].location = ls.location;
            spotsArray[targetIndex].grid_index = ls.grid_index;
            spotsArray[targetIndex].ageCategory = category;
          }
        }
      });
    };

    const ANIMATION_DURATION = 6000;
    const FADE_IN = 800;
    const FADE_OUT = 800;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // Rastgele mesaj patlatma yardımcısı
    const popRandomMessage = (currentTime: number, category: AgeCategory) => {
      const filteredSpots = spotsArray.filter(s => s.isFilled && s.ageCategory === category);
      if (filteredSpots.length > 0) {
        const randomSpot = filteredSpots[Math.floor(Math.random() * filteredSpots.length)];
        if (!activeAnimations.find(a => a.id === randomSpot.id)) {
          activeAnimations.push({ id: randomSpot.id, startTime: currentTime });
        }
      }
    };

    const drawCrowd = (currentTime: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isDay) {
        drawClubLights(canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), currentTime);
      }

      // 1. ANINDA TEPKİ (Biri QR'dan yazarsa saniyesinde fırlar)
      if (newArrivalsRef.current.length > 0) {
        newArrivalsRef.current.forEach((newGridIndex) => {
          const targetSpot = spotsArray.find((s) => s.grid_index === newGridIndex);
          if (targetSpot && !activeAnimations.find((a) => a.id === targetSpot.id)) {
            activeAnimations.push({ id: targetSpot.id, startTime: currentTime });
          }
        });
        newArrivalsRef.current = [];
      }

      // 2. YENİ MESAJLAR (Son 24 saat) -> Her 3-5 saniyede bir patlar
      if (currentTime > timerNew) {
        popRandomMessage(currentTime, AgeCategory.NEW);
        timerNew = currentTime + 3000 + (Math.random() * 2000); // 3-5 sn
      }

      // 3. ESKİ MESAJLAR (1-7 Gün) -> Her 10-15 saniyede bir patlar
      if (currentTime > timerOld) {
        popRandomMessage(currentTime, AgeCategory.OLD);
        timerOld = currentTime + 10000 + (Math.random() * 5000); // 10-15 sn
      }

      // 4. ÇOK ESKİ MESAJLAR (+1 Hafta) -> Her 60-90 saniyede bir patlar (Nostalji)
      if (currentTime > timerVeryOld) {
        popRandomMessage(currentTime, AgeCategory.VERY_OLD);
        timerVeryOld = currentTime + 60000 + (Math.random() * 30000); // 1-1.5 Dk
      }

      activeAnimations = activeAnimations.filter((a) => currentTime - a.startTime < ANIMATION_DURATION);

      activeAnimations.forEach((anim) => {
        const spot = spotsArray.find((s) => s.id === anim.id);
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

        const currentY = spot.y - progress * (isMobile ? 30 : 50);
        const currentSize = spot.baseSize + progress * 15;

        ctx.globalAlpha = alpha;

        ctx.font = `${currentSize}px Arial`;
        ctx.shadowColor = isDay ? "rgba(0,0,0,0.3)" : "rgba(255, 204, 0, 0.8)";
        ctx.shadowBlur = isDay ? 10 : glow * 25;
        ctx.fillText("🙌", spot.x - currentSize / 2, currentY + currentSize / 3);
        ctx.shadowBlur = 0;

        if (glow > 0.5) {
          const boxY = currentY - currentSize - 35;

          ctx.fillStyle = isDay ? "rgba(255, 255, 255, 0.95)" : "rgba(10, 10, 10, 0.95)";
          ctx.beginPath();
          ctx.roundRect(spot.x - 100, boxY, 200, 42, 10);
          ctx.fill();

          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 15;
          ctx.strokeStyle = `rgba(255, 204, 0, ${glow})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.shadowBlur = 0;

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