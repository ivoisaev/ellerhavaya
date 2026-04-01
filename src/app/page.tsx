import Crowd from "@/components/Crowd";

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden relative bg-black">
      
      {/* 📸 SABİT GECE KALABALIĞI RESMİ */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: "url('/crowd-bg.jpg')",
          filter: "brightness(0.6) contrast(1.2)"
        }}
      />

      {/* 🎨 ŞEFFAF CANVAS (Sanat Motoru - Gece modunda çalışacak) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
         <Crowd timeMode="night" />
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