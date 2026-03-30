"use client";

import { useState, useEffect } from "react";
import Crowd from "@/components/Crowd";

export default function Home() {
  const [timeMode, setTimeMode] = useState("night");

  // Günün saatine göre minimal renk paleti
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) setTimeMode("day");
    else setTimeMode("night");
  }, []);

  const getBackground = () => {
    if (timeMode === "day") return "bg-[#e2e2df]"; // Gündüz: Çok soft, kirli kırık beyaz / gri
    return "bg-[#0a0a0a]"; // Gece: Zifiri karanlığa yakın antrasit
  };

  return (
    <main className={`h-screen w-screen overflow-hidden relative ${getBackground()} transition-colors duration-1000`}>
      
      {/* SANAT ENSTALASYONU (CANVAS) */}
      <div className="absolute inset-0 z-0">
         <Crowd timeMode={timeMode} />
      </div>

      {/* GİZEMLİ İMZA (Sağ Altta) */}
      <div className="absolute bottom-6 right-6 z-10 opacity-30 hover:opacity-100 transition-opacity duration-500">
        <a href="/qr" className="text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-zinc-500 hover:text-[#ffcc00] transition-colors">
          ellerhavaya.com
        </a>
      </div>

    </main>
  );
}