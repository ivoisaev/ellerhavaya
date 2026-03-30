"use client";

import { useState, useEffect } from "react";
import Crowd from "@/components/Crowd";

export default function Home() {
  const [timeMode, setTimeMode] = useState("night");

  useEffect(() => {
    // Saat 06:00 ile 18:00 arası gündüz, gerisi gece
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) setTimeMode("day");
    else setTimeMode("night");
  }, []);

  // Gündüz ve Gece resimlerinin otomatik değişimi
  const getBackgroundImage = () => {
    return timeMode === "day" ? "url('/day-crowd.jpg')" : "url('/crowd-bg.jpg')";
  };

  return (
    <main className="h-screen w-screen overflow-hidden relative bg-black">
      
      {/* 📸 DİNAMİK KALABALIK RESMİ */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
        style={{ 
          backgroundImage: getBackgroundImage(),
          // Eğer gece resmi çok karanlıksa brightness'i 0.8 yapabilirsin, şimdilik lazerler parlasın diye 0.6 tutuyorum
          filter: timeMode === "night" ? "brightness(0.6) contrast(1.2)" : "brightness(1) contrast(1)"
        }}
      />

      {/* 🎨 ŞEFFAF CANVAS (Sanat Motoru) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
         <Crowd timeMode={timeMode} />
      </div>

      {/* 🔗 LOGO / YÖNLENDİRME */}
      <div className="absolute bottom-6 right-6 z-20 opacity-30 hover:opacity-100 transition-opacity duration-500 pointer-events-auto">
        <a href="/qr" className="text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-white hover:text-[#ffcc00] drop-shadow-lg transition-colors">
          ellerhavaya.com
        </a>
      </div>

    </main>
  );
}