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

interface GridSpot {
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

    let gridSpots: GridSpot[] = [];
    let activeAnimations: ActiveAnimation[] = [];
    let animationFrameId: number;
    let randomTimer = 0;

    const generateGrid = () => {
      const spots: GridSpot[] = [];
      let currentY = -20;
      let row = 0;

      while (currentY < canvas.height + 50) {
        const distance = currentY / canvas.height; 
        const size = (isMobile ? 16 : 20) + (distance * 20); 
        
        const spacingX = size * 0.9; 
        const spacingY = size * 0.7; 

        let currentX = -20;
        let col = 0;
        
        if (row % 2 === 1) currentX -= spacingX / 2;

        while (currentX < canvas.width + 50) {
          spots.push({
            id: row * 1000 + col,
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
      
      gridSpots = generateGrid();

      liveSpots.forEach(ls => {
        if (gridSpots.length > 0) {
          const targetIndex = ls.grid_index % gridSpots.length;
          if (gridSpots[targetIndex]) {
            gridSpots[targetIndex].isFilled = true;
            gridSpots[targetIndex].message = ls.message;
            gridSpots[targetIndex].location = ls.location;
            gridSpots[targetIndex].grid_index = ls.grid_index;
          }
        }
      });
    };

    const ANIMATION_DURATION = 6000; 
    const FADE_IN = 1000;
    const FADE_OUT = 1000;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const drawCrowd = (currentTime: number) => {
      ctx.fillStyle = isDay ? "#e2e2df" : "#050505";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (newArrivalsRef.current.length > 0) {
        newArrivalsRef.current.forEach(newGridIndex => {
          const targetSpot = gridSpots.find(s => s.grid_index === newGridIndex);
          if (targetSpot && !activeAnimations.find(a => a.id === targetSpot.id)) {
            activeAnimations.push({ id: targetSpot.id, startTime: currentTime });
          }
        });
        newArrivalsRef.current = []; 
      }

      if (currentTime > randomTimer) {
        const filledSpots = gridSpots.filter(s => s.isFilled);
        if (filledSpots.length > 0) {
          const count = Math.random() > 0.8 ? 3 : (Math.random() > 0.4 ? 2 : 1); 
          for(let i=0; i<count; i++) {
             const randomSpot = filledSpots[Math.floor(Math.random() * filledSpots.length)];
             if (!activeAnimations.find(a => a.id === randomSpot.id)) {
               activeAnimations.push({ id: randomSpot.id, startTime: currentTime });
             }
          }
        }
        randomTimer = currentTime + 3000 + (Math.random() * 3000); 
      }

      activeAnimations = activeAnimations.filter(a => currentTime - a.startTime < ANIMATION_DURATION);

      const animatingIds = activeAnimations.map(a => a.id);
      
      gridSpots.forEach(spot => {
         if (animatingIds.includes(spot.id)) return; 

         ctx.globalAlpha = isDay ? 0.3 + (spot.distance * 0.2) : 0.15 + (spot.distance * 0.15);
         ctx.fillStyle = isDay ? "#8f8f96" : "#27272a"; 
         ctx.font = `${spot.baseSize}px Arial`;
         ctx.fillText("🙌", spot.x, spot.y);
      });

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

         const currentY = spot.y - (progress * (isMobile ? 30 : 45)); 
         const currentSize = spot.baseSize + (progress * 15); 

         ctx.globalAlpha = alpha;
         ctx.font = `${currentSize}px Arial`;
         ctx.fillStyle = glow > 0.1 ? `rgba(255, 204, 0, ${glow})` : (isDay ? "#8f8f96" : "#27272a");
         
         ctx.shadowColor = isDay ? "transparent" : "#ffcc00";
         ctx.shadowBlur = glow * 20;
         ctx.fillText("🙌", spot.x, currentY);
         ctx.shadowBlur = 0; 

         if (glow > 0.5) {
            const boxY = currentY - currentSize - 35;
            
            ctx.fillStyle = isDay ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.8)";
            ctx.fillRect(spot.x - 10, boxY, 180, 35);
            ctx.strokeStyle = `rgba(255, 204, 0, ${glow})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(spot.x - 10, boxY, 180, 35);

            ctx.fillStyle = isDay ? "#52525b" : "#a1a1aa"; 
            ctx.font = `bold ${isMobile ? 9 : 10}px Arial`;
            ctx.fillText(`📍 ${spot.location || "Anonim"}`, spot.x - 5, boxY + 14);

            ctx.fillStyle = isDay ? "#000000" : "#ffffff";
            ctx.font = `bold ${isMobile ? 11 : 13}px Arial`;
            const shortText = spot.message.length > 22 ? spot.message.substring(0, 22) + "..." : spot.message;
            ctx.fillText(shortText, spot.x - 5, boxY + 28);
         }
      });

      animationFrameId = requestAnimationFrame(drawCrowd);
    };

    window.addEventListener("resize", setupCanvas);
    setupCanvas();
    animationFrameId = requestAnimationFrame(drawCrowd);

    return () => {
      window.removeEventListener("resize", setupCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [liveSpots, timeMode]);

  return <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />;
}