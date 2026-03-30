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
      const { data } = await supabase
        .from("spots")
        .select("grid_index, message, location")
        .order("created_at", { ascending: false })
        .limit(200);
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
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const isDay = timeMode === "day";
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    let spotsArray: AvatarSpot[] = [];
    let activeAnimations: ActiveAnimation[] = [];
    let animationFrameId: number;
    let randomTimer = 0;

    // 👤 BİR İNSAN SİLÜETİ ÇİZME (Daha zarif ve küçük)
    const drawAvatar = (x: number, y: number, size: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      // Gündüz: Çok açık gri (ferah), Gece: Zifiri karanlıkta parlayan antrasit
      ctx.fillStyle = isDay ? "#a1a1aa" : "#18181b"; 

      // Kafa
      ctx.beginPath();
      ctx.arc(x, y - size / 3, size / 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Omuzlar
      ctx.beginPath();
      ctx.arc(x, y + size / 2.5, size / 1.2, Math.PI, 0);
      ctx.fill();
    };

    // 🎇 GECE KULÜBÜ IŞIKLARI (Lazer/Spotlight Efekti)
    const drawClubLights = (width: number, height: number, time: number) => {
      ctx.globalCompositeOperation = "screen"; // Işıkların birleşip parlaması için
      const t = time * 0.0005;

      // 1. Işık: Magenta
      const x1 = width * 0.5 + Math.sin(t) * width * 0.4;
      const y1 = height * 0.5 + Math.cos(t * 1.3) * height * 0.4;
      const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, width * 0.5);
      grad1.addColorStop(0, "rgba(255, 0, 150, 0.15)"); // Parlak merkez
      grad1.addColorStop(1, "rgba(255, 0, 150, 0)");
      ctx.fillStyle = grad1;
      ctx.beginPath(); ctx.arc(x1, y1, width * 0.5, 0, Math.PI * 2); ctx.fill();

      // 2. Işık: Cyan
      const x2 = width * 0.5 + Math.cos(t * 0.8) * width * 0.4;
      const y2 = height * 0.5 + Math.sin(t * 1.1) * height * 0.4;
      const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, width * 0.5);
      grad2.addColorStop(0, "rgba(0, 255, 255, 0.15)");
      grad2.addColorStop(1, "rgba(0, 255, 255, 0)");
      ctx.fillStyle = grad2;
      ctx.beginPath(); ctx.arc(x2, y2, width * 0.5, 0, Math.PI * 2); ctx.fill();

      ctx.globalCompositeOperation = "source-over"; // Normale döndür
    };

    const generateSpots = (width: number, height: number) => {
      const spots: AvatarSpot[] = [];
      // Silüetleri daha seyrek yapmak için aralıkları açıyoruz
      const spacingX = isMobile ? 30 : 45; 
      const spacingY = isMobile ? 25 : 35;
      
      const cols = Math.floor(width / spacingX) + 2;
      const rows = Math.floor(height / spacingY) + 2;

      let idCounter = 0;

      for (let r = -1; r < rows; r++) {
        for (let c = -1; c < cols; c++) {
          // Askeri düzeni kırmak için rastgele kayma (jitter)
          const jitterX = (Math.random() - 0.5) * (spacingX * 0.6);
          const jitterY = (Math.random() - 0.5) * (spacingY * 0.6);

          const px = (c * spacingX) + jitterX;
          const py = (r * spacingY) + jitterY;

          const distance = py / height;
          // Boyutları çok küçülttük ki kalabalık net görünsün
          const size = (isMobile ? 5 : 7) + (distance * 10);

          spots.push({
            id: idCounter++,
            x: px,
            y: py,
            baseSize: size,
            distance: Math.max(0, Math.min(1, distance)),
            isFilled: false,
            message: "",
            location: "",
            grid_index: idCounter
          });
        }
      }

      // Y ekseninde (Aşağıdan yukarı) sırala (3D derinlik için kritik)
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

      spotsArray = generateSpots(rect?.width || window.innerWidth, rect?.height || window.innerHeight);

      // Veritabanından gelen gerçek mesajları yerleştir
      liveSpots.forEach((ls) => {
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
      // Gündüz: Çok ferah beyazımsı gri / Gece: Zifiri siyah (Kulüp ortamı)
      ctx.fillStyle = isDay ? "#f4f4f5" : "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // EĞER GECEYSE LAZERLERİ/IŞIKLARI ÇİZ
      if (!isDay) {
        drawClubLights(canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), currentTime);
      }

      // Animasyon Tetikleyicileri (Yeni Gelenler & Rastgeleler)
      if (newArrivalsRef.current.length > 0) {
        newArrivalsRef.current.forEach((newGridIndex) => {
          const targetSpot = spotsArray.find((s) => s.grid_index === newGridIndex);
          if (targetSpot && !activeAnimations.find((a) => a.id === targetSpot.id)) {
            activeAnimations.push({ id: targetSpot.id, startTime: currentTime });
          }
        });
        newArrivalsRef.current = [];
      }

      if (currentTime > randomTimer) {
        const filledSpots = spotsArray.filter((s) => s.isFilled);
        if (filledSpots.length > 0) {
          const count = Math.random() > 0.8 ? 3 : Math.random() > 0.4 ? 2 : 1;
          for (let i = 0; i < count; i++) {
            const randomSpot = filledSpots[Math.floor(Math.random() * filledSpots.length)];
            if (!activeAnimations.find((a) => a.id === randomSpot.id)) {
              activeAnimations.push({ id: randomSpot.id, startTime: currentTime });
            }
          }
        }
        randomTimer = currentTime + 3000 + Math.random() * 4000;
      }

      activeAnimations = activeAnimations.filter((a) => currentTime - a.startTime < ANIMATION_DURATION);
      const animatingIds = activeAnimations.map((a) => a.id);

      // 1. ÖNCE SESSİZ İNSANLARI (AVATARLARI) ÇİZ
      spotsArray.forEach((spot) => {
        if (animatingIds.includes(spot.id)) return;

        // Saydamlığı ayarladık. Arka planla daha iyi kaynaşıyorlar.
        const alpha = isDay ? 0.3 + spot.distance * 0.4 : 0.4 + spot.distance * 0.5;
        drawAvatar(spot.x, spot.y, spot.baseSize, alpha);
      });

      // 2. SONRA ELLERİNİ KALDIRAN MESAJLARI ÇİZ
      activeAnimations.forEach((anim) => {
        const spot = spotsArray.find((s) => s.id === anim.id);
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

        const currentY = spot.y - progress * (isMobile ? 30 : 50);
        const currentSize = spot.baseSize + progress * (isMobile ? 18 : 24);

        ctx.globalAlpha = alpha;

        // Zıplayan kişinin fontu ve emojisi
        ctx.font = `${currentSize}px Arial`;
        ctx.shadowColor = isDay ? "transparent" : "rgba(255, 204, 0, 0.8)";
        ctx.shadowBlur = isDay ? 0 : glow * 25;
        ctx.fillText("🙌", spot.x - currentSize / 2, currentY + currentSize / 3);
        ctx.shadowBlur = 0;

        // Mesaj Kutusu
        if (glow > 0.5) {
          const boxY = currentY - currentSize - 35;

          ctx.fillStyle = isDay ? "rgba(255, 255, 255, 0.95)" : "rgba(10, 10, 10, 0.95)";
          ctx.beginPath();
          ctx.roundRect(spot.x - 100, boxY, 200, 40, 8); // roundRect ile modern köşeler
          ctx.fill();

          ctx.strokeStyle = `rgba(255, 204, 0, ${glow})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = isDay ? "#71717a" : "#a1a1aa";
          ctx.font = `bold 10px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(`📍 ${spot.location || "Anonim"}`, spot.x, boxY + 14);

          ctx.fillStyle = isDay ? "#000000" : "#ffffff";
          ctx.font = `bold 13px sans-serif`;
          const shortText = spot.message.length > 25 ? spot.message.substring(0, 25) + "..." : spot.message;
          ctx.fillText(`"${shortText}"`, spot.x, boxY + 30);

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