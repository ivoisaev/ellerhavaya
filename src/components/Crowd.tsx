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

export default function Crowd({ timeMode }: { timeMode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [liveSpots, setLiveSpots] = useState<Spot[]>([]);
  
  // Yeni gelen mesajları anında tespit edip patlatmak için Ref
  const newArrivalsRef = useRef<number[]>([]);

  // 1. VERİLERİ ÇEK VE CANLI DİNLE
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
          // Yeni gelen mesajın ID'sini "Hemen Patlat" listesine ekle!
          newArrivalsRef.current.push(newSpot.grid_index);
      }).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // 2. SANAT MOTORU (BOŞLUKSUZ GRID VE ANİMASYON)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const isDay = timeMode === "day";
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    let gridSpots: any[] = [];
    let activeAnimations: ActiveAnimation[] = [];
    let animationFrameId: number;
    let randomTimer = 0;

    // 🧩 BOŞLUKSUZ PETEK (HEXAGONAL) DİZİLİMİ OLUŞTUR
    const generateGrid = () => {
      const spots = [];
      let currentY = -20;
      let row = 0;

      while (currentY < canvas.height + 50) {
        const distance = currentY / canvas.height; // 0 üst, 1 alt
        const size = (isMobile ? 16 : 20) + (distance * 20); // Boyutlar
        
        // Emojiler arası boşlukları (X ve Y ekseninde) sıfıra yakın tutuyoruz
        const spacingX = size * 0.9; 
        const spacingY = size * 0.7; 

        let currentX = -20;
        let col = 0;
        
        // Petek (çapraz) dizilim için her çift satırı yarım birim kaydır
        if (row % 2 === 1) currentX -= spacingX / 2;

        while (currentX < canvas.width + 50) {
          spots.push({
            id: row * 1000 + col, // Benzersiz ID
            x: currentX,
            y: currentY,
            baseSize: size,
            distance: distance,
            isFilled: false,
            message: "",
            location: "",
            grid_index: 0
          });
          currentX += spacingX;
          col++;
        }
        currentY += spacingY;
        row++;
      }
      return spots;
    };

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if(rect) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      
      // Ekran boyutuna göre halıyı baştan ör
      gridSpots = generateGrid();

      // Gerçek mesajları halıdaki rastgele (ama sabit) yerlere oturt
      liveSpots.forEach(ls => {
        const targetIndex = ls.grid_index % gridSpots.length;
        gridSpots[targetIndex].isFilled = true;
        gridSpots[targetIndex].message = ls.message;
        gridSpots[targetIndex].location = ls.location;
        gridSpots[targetIndex].grid_index = ls.grid_index;
      });
    };

    // Animasyon Ayarları
    const ANIMATION_DURATION = 6000; // 6 saniye havada kalır
    const FADE_IN = 1000;
    const FADE_OUT = 1000;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const drawCrowd = (currentTime: number) => {
      // 1. ZEMİNİ BOYA
      ctx.fillStyle = isDay ? "#e2e2df" : "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. YENİ GELEN MESAJLARI ANINDA FIRLAT
      if (newArrivalsRef.current.length > 0) {
        newArrivalsRef.current.forEach(newGridIndex => {
          const targetSpot = gridSpots.find(s => s.grid_index === newGridIndex);
          if (targetSpot && !activeAnimations.find(a => a.id === targetSpot.id)) {
            activeAnimations.push({ id: targetSpot.id, startTime: currentTime });
          }
        });
        newArrivalsRef.current = []; // Sıfırla
      }

      // 3. ESKİ MESAJLARI RASTGELE FIRLAT (4-5 saniyede bir, 2'li 3'lü)
      if (currentTime > randomTimer) {
        const filledSpots = gridSpots.filter(s => s.isFilled);
        if (filledSpots.length > 0) {
          const count = Math.random() > 0.8 ? 3 : (Math.random() > 0.4 ? 2 : 1); // Bazen 3, bazen 2, bazen 1 tane kalkar
          for(let i=0; i<count; i++) {
             const randomSpot = filledSpots[Math.floor(Math.random() * filledSpots.length)];
             if (!activeAnimations.find(a => a.id === randomSpot.id)) {
               activeAnimations.push({ id: randomSpot.id, startTime: currentTime });
             }
          }
        }
        randomTimer = currentTime + 3000 + (Math.random() * 3000); // 3 ile 6 sn arası bekle
      }

      // Süresi biten animasyonları temizle
      activeAnimations = activeAnimations.filter(a => currentTime - a.startTime < ANIMATION_DURATION);

      // 4. ÇİZİM: ÖNCE SESSİZ KALABALIK (Z-Index için ayırıyoruz)
      const animatingIds = activeAnimations.map(a => a.id);
      
      gridSpots.forEach(spot => {
         if (animatingIds.includes(spot.id)) return; // Animasyonluları sona bırak

         ctx.globalAlpha = isDay ? 0.3 + (spot.distance * 0.2) : 0.15 + (spot.distance * 0.15);
         ctx.fillStyle = isDay ? "#8f8f96" : "#27272a"; 
         ctx.font = `${spot.baseSize}px Arial`;
         ctx.fillText("🙌", spot.x, spot.y);
      });

      // 5. ÇİZİM: YÜKSELEN NEON MESAJLAR (En Üst Katman)
      activeAnimations.forEach(anim => {
         const spot = gridSpots.find(s => s.id === anim.id);
         if (!spot) return;

         const elapsed = currentTime - anim.startTime;
         let progress = 0, glow = 0, alpha = 1;

         if (elapsed < FADE_IN) {
            progress = easeOutCubic(elapsed / FADE_IN);
            glow = progress;
            alpha = 0.2 + (0.8 * progress);
         } else if (elapsed > ANIMATION_DURATION - FADE_OUT) {
            const outElapsed = elapsed - (ANIMATION_DURATION - FADE_OUT);
            progress = 1 - easeOutCubic(outElapsed / FADE_OUT);
            glow = progress;
            alpha = 0.2 + (0.8 * progress);
         } else {
            progress = 1; glow = 1; alpha = 1;
         }

         const currentY = spot.y - (progress * (isMobile ? 30 : 45)); // Havaya kalkma
         const currentSize = spot.baseSize + (progress * 15); // Büyüme

         // Emojiyi Çiz (Gri -> Sarı)
         ctx.globalAlpha = alpha;
         ctx.font = `${currentSize}px Arial`;
         ctx.fillStyle = glow > 0.1 ? `rgba(255, 204, 0, ${glow})` : (isDay ? "#8f8f96" : "#27272a");
         
         ctx.shadowColor = isDay ? "transparent" : "#ffcc00";
         ctx.shadowBlur = glow * 20;
         ctx.fillText("🙌", spot.x, currentY);
         ctx.shadowBlur = 0; // Kapat

         // Mesaj Kutusu