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
  const [liveSpots, setLiveSpots] = useState<Spot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Mobilde emoji sayısını azalttık ki rahat dokunulsun
    const isMobile = window.innerWidth < 768;
    const spotCount = isMobile ? 2500 : 6000; 
    
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
    let mouseX = -1000;
    let mouseY = -1000;
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
         
         const dx = px - mouseX;
         const dy = py - mouseY;
         const distToMouse = Math.sqrt(dx * dx + dy * dy);
         const isHovered = distToMouse < (isMobile ? 100 : 70); // Mobilde feneri büyüttük

         const isHero = index === currentHeroIndex && heroTimer > 0;

         let baseSize = (isMobile ? 4 : 3) + (distance * 16); 
         let size = isHero ? baseSize * 2.5 : baseSize; 

         if (spot.isFilled) {
            ctx.globalAlpha = (isHovered || isHero) ? 1 : 0.6 + (distance * 0.4);
            ctx.fillStyle = spot.color;
            ctx.font = `${size}px Arial`;
            
            const drawY = isHero ? py - 10 : py;
            ctx.fillText("🙌", px, drawY);
            
            if ((isHovered && distToMouse < 30) || isHero) {
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
            if (isHovered) {
                ctx.globalAlpha = 1 - (distToMouse / 90); 
                ctx.fillStyle = "#ffcc00"; 
                ctx.font = `${size}px Arial`;
                ctx.fillText("🙌", px, py);
            } else {
                ctx.globalAlpha = 0.2 + (distance * 0.3);
                ctx.fillStyle = "#334155"; 
                ctx.beginPath();
                ctx.arc(px, py, size / 3, 0, Math.PI * 2);
                ctx.fill();
            }
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

    // --- MOUSE KONTROLLERİ ---
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    // --- MOBİL (TOUCH) KONTROLLERİ EKLENDİ ---
    const handleTouchMove = (e: TouchEvent) => {
      if(e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.touches[0].clientX - rect.left;
        mouseY = e.touches[0].clientY - rect.top;
      }
    };

    const handleMouseLeave = () => { mouseX = -1000; mouseY = -1000; };

    // --- TIKLAMA KONTROLÜ (MOBİL VE PC) ---
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let cx = 0, cy = 0;

      if ("touches" in e) { // Eğer telefondan dokunulduysa
        if (e.touches.length > 0) {
          cx = e.touches[0].clientX - rect.left;
          cy = e.touches[0].clientY - rect.top;
        }
      } else { // Eğer PC'den tıklandıysa
        cx = (e as MouseEvent).clientX - rect.left;
        cy = (e as MouseEvent).clientY - rect.top;
      }

      const clickedSpot = allSpots.find(spot => {
         if (!spot.isFilled) return false;
         const px = spot.x * rect.width;
         const py = spot.y * rect.height;
         const dist = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
         return dist < (isMobile ? 40 : 30); // Mobilde parmak kalın olduğu için tıklama alanını büyüttük
      });

      if (clickedSpot) {
        setSelectedSpot(clickedSpot);
      }
    };

    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleClick);
    
    // Mobil Eventleri
    canvas.addEventListener("touchstart", handleTouchMove, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleClick);
    
    resize();
    drawCrowd();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchstart", handleTouchMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [liveSpots]);

  return (
    <>
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair block" />

      {/* 🌟 MOBİL UYUMLU BÜYÜYEN MESAJ KARTI */}
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
            
            {/* break-words sayesinde uzun yazılar telefonda ekrandan taşmaz, alt satıra iner */}
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