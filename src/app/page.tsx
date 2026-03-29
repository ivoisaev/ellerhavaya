"use client";

import { useState, useEffect } from "react";
import { Users, MapPin, X } from "lucide-react";
import Crowd from "@/components/Crowd";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [timeMode, setTimeMode] = useState("night");
  
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [totalHands, setTotalHands] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(1);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 16) setTimeMode("day");
    else if (hour >= 16 && hour < 20) setTimeMode("afternoon");
    else setTimeMode("night");
  }, []);

  const getSkyTheme = () => {
    if (timeMode === "day") return "bg-gradient-to-b from-blue-400 to-sky-200";
    if (timeMode === "afternoon") return "bg-gradient-to-b from-orange-500 to-rose-400";
    return "bg-gradient-to-b from-zinc-950 via-zinc-900 to-black";
  };

  const getGroundTheme = () => {
    if (timeMode === "day") return "bg-gradient-to-b from-slate-900 via-zinc-950 to-black";
    if (timeMode === "afternoon") return "bg-gradient-to-b from-[#110d1c] via-zinc-950 to-black";
    return "bg-gradient-to-b from-zinc-950 via-[#050505] to-black";
  };

  useEffect(() => {
    const fetchTotalCount = async () => {
      const { count, error } = await supabase.from('spots').select('*', { count: 'exact', head: true });
      if (!error && count !== null) setTotalHands(count);
    };
    fetchTotalCount();

    const subscription = supabase
      .channel('public:spots')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'spots' }, () => {
        setTotalHands((prev) => prev + 1);
      }).subscribe();

    const presenceChannel = supabase.channel('online-users');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        setOnlineUsers(count === 0 ? 1 : count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user: 'anonymous' });
        }
      });

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    const randomSpot = Math.floor(Math.random() * 100000) + 1;

    const { error } = await supabase.from("spots").insert([
      {
        grid_index: randomSpot,
        emoji_type: "🙌",
        message: message.trim(),
        location: location.trim() || "Gizli Konum",
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      alert("Hata oluştu! Tekrar dene.");
    } else {
      setShowModal(false);
      setMessage("");
      setLocation("");
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col font-sans overflow-hidden">
      
      {/* 🎪 ÜST KISIM: SAHNE */}
      <div className={`h-[35vh] w-full relative flex items-end justify-center overflow-hidden ${getSkyTheme()}`}>
        {timeMode === "day" && <div className="absolute top-10 left-1/4 w-32 h-32 bg-yellow-100 rounded-full blur-2xl opacity-80" />}
        {timeMode === "night" && <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-transparent pointer-events-none" />}

        <div className="relative w-full max-w-6xl h-[85%] flex items-end justify-center px-4">
          
          <div className="hidden sm:flex flex-col justify-end w-24 md:w-32 h-full bg-zinc-950 border-4 border-zinc-800 rounded-t-lg z-20 shadow-2xl relative">
            <div className="w-full h-[40%] bg-black border-t-2 border-zinc-700 opacity-90 flex flex-col items-center justify-evenly py-2 relative z-10">
               <div className="w-12 h-12 rounded-full bg-zinc-900 shadow-[inset_0_5px_15px_rgba(0,0,0,1)]" />
               <div className="w-16 h-16 rounded-full bg-zinc-900 shadow-[inset_0_5px_15px_rgba(0,0,0,1)]" />
            </div>
          </div>

          <div className="w-[90%] sm:w-[60%] h-full bg-zinc-900 border-t-8 border-x-8 border-zinc-950 rounded-t-[3rem] sm:rounded-t-[5rem] flex items-center justify-center z-10 relative shadow-[0_-10px_50px_rgba(0,0,0,0.5)] mx-[-10px]">
            {timeMode === "night" && <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-[#ff007f]/30 to-transparent blur-2xl pointer-events-none" />}
            
            {/* 🚀 VİDEO EKRANI (Boris Brejcha - Cercle / %100 Çalışır) */}
            <div className="w-[85%] h-[75%] bg-black border-4 border-zinc-800 rounded-xl relative shadow-[0_0_30px_rgba(0,0,0,0.8)] z-50 pointer-events-auto">
              <iframe 
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                src="https://www.youtube.com/embed/vqwGvscPzY8?controls=1&mute=0&rel=0" 
                title="Eller Havaya Canlı Sahne"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            </div>
          </div>

          <div className="hidden sm:flex flex-col justify-end w-24 md:w-32 h-full bg-zinc-950 border-4 border-zinc-800 rounded-t-lg z-20 shadow-2xl relative">
            <div className="w-full h-[40%] bg-black border-t-2 border-zinc-700 opacity-90 flex flex-col items-center justify-evenly py-2 relative z-10">
               <div className="w-16 h-16 rounded-full bg-zinc-900 shadow-[inset_0_5px_15px_rgba(0,0,0,1)]" />
               <div className="w-12 h-12 rounded-full bg-zinc-900 shadow-[inset_0_5px_15px_rgba(0,0,0,1)]" />
            </div>
          </div>
        </div>

        {timeMode === "night" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute bottom-0 left-[20%] w-1 h-[200vh] bg-[#00f3ff] blur-[3px] opacity-50 transform -rotate-[30deg] origin-bottom" />
            <div className="absolute bottom-0 right-[20%] w-1 h-[200vh] bg-[#ff007f] blur-[3px] opacity-50 transform rotate-[30deg] origin-bottom" />
          </div>
        )}
      </div>

      {/* ⚡ KONTROL ÇİZGİSİ */}
      <div className="h-10 w-full bg-zinc-950 border-y-2 border-zinc-900 flex items-center justify-center px-4 z-30 shadow-[0_5px_20px_rgba(0,0,0,0.9)] relative">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGxpbmUgeDE9IjEwIiB5MT0iMCIgeDI9IjEwIiB5Mj0iNDAiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+')]"/>
        
        <div className="flex items-center gap-6 z-10 bg-black/80 px-6 py-1 rounded-full border border-zinc-800">
          <div className="flex items-center gap-2 text-[#00f3ff] text-xs sm:text-sm font-bold tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#00f3ff] animate-ping" />
            {onlineUsers} ONLINE
          </div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm font-medium border-l border-zinc-800 pl-6 tracking-widest">
            <Users size={14} /> {totalHands.toLocaleString()} ELLER HAVADA
          </div>
        </div>
      </div>

      {/* 👥 KALABALIK ZEMİNİ */}
      <div className={`flex-1 w-full relative overflow-hidden ${getGroundTheme()}`}>
        <div className="absolute inset-0 z-0 opacity-80">
           <Crowd />
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
           <button 
             onClick={() => setShowModal(true)}
             className="pointer-events-auto bg-[#ff007f] hover:bg-white hover:text-black text-white font-black py-4 px-8 rounded-full shadow-[0_0_30px_rgba(255,0,127,0.6)] hover:shadow-[0_0_40px_rgba(255,255,255,0.8)] transition-all duration-300 active:scale-95 flex items-center gap-3 tracking-widest uppercase"
           >
             <MapPin size={20} />
             YERİNİ KAP
           </button>
        </div>
      </div>

      {/* 🚨 YERİNİ KAP POPUP MODALI */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-zinc-950 border-2 border-zinc-800 w-[95%] sm:w-full max-w-md rounded-2xl p-6 relative shadow-[0_0_50px_rgba(255,0,127,0.2)]">
            
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition">
              <X size={24} />
            </button>

            <div className="text-center mb-6 mt-2">
              <h2 className="text-2xl font-black text-white tracking-widest mb-1">ELLERİNİ KALDIR</h2>
              <p className="text-sm text-zinc-400">Bu kalabalıkta sonsuza dek izini bırak.</p>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1 tracking-widest">MESAJIN (Max 60)</label>
                <input 
                  type="text" 
                  maxLength={60}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="örn: dj harika, kopuyoruz! 🔥"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#ff007f] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1 tracking-widest">NEREDESİN? (Opsiyonel)</label>
                <input 
                  type="text" 
                  maxLength={30}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="örn: Kadıköy / Çadır Alanı"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#00f3ff] transition"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#00f3ff] text-black font-black py-4 rounded-xl mt-4 hover:bg-white transition disabled:opacity-50 tracking-widest uppercase"
              >
                {isSubmitting ? "GÖNDERİLİYOR..." : "🙌 KALABALIĞA KARIŞ"}
              </button>
            </form>

          </div>
        </div>
      )}

    </main>
  );
}