"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";

// 🛑 OTOMATİK SANSÜR LİSTESİ (Genişletilebilir)
const BAD_WORDS = [
  "amk", "aq", "amq", "sik", "sikerim", "siktir", "orospu", "piç", "pic",
  "yarrak", "yarak", "amcık", "amcik", "göt", "ibne", "yavşak", "yavsak",
  "kahpe", "kaltak", "orosbu", "oç", "oc", "sokuk", "sokarım", "sikerler"
];

export default function QrPage() {
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // 🤖 SANSÜR MOTORU: Kötü kelimeleri *** yapar
  const censorText = (text: string) => {
    let censoredText = text;
    BAD_WORDS.forEach((word) => {
      // Kelimenin büyük/küçük harf varyasyonlarını yakalar (gi)
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      censoredText = censoredText.replace(regex, "***");
    });
    return censoredText;
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);

    // Mesajı ve Lokasyonu Veritabanına Gitmeden Önce Sansürle
    const cleanMessage = censorText(message.trim());
    const cleanLocation = censorText(location.trim()) || "Gizli Konum";

    const randomSpot = Math.floor(Math.random() * 100000) + 1;

    const { error } = await supabase.from("spots").insert([
      {
        grid_index: randomSpot,
        emoji_type: "🙌",
        message: cleanMessage, // Sansürlü mesaj
        location: cleanLocation, // Sansürlü lokasyon
      },
    ]);

    setIsSubmitting(false);

    if (!error) {
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 5000);
      setMessage("");
      setLocation("");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans text-white">
      <div className="max-w-md w-full space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-[0.2em] text-[#ffcc00]">ELLER HAVAYA</h1>
          <p className="text-zinc-500 text-sm tracking-widest uppercase">Dijital Kalabalığa Karış</p>
        </div>

        <div className="bg-black border border-zinc-800 p-6 rounded-2xl shadow-2xl">
          {isSuccess ? (
            <div className="text-center py-8 space-y-4">
              <span className="text-5xl block animate-bounce">🙌</span>
              <p className="text-[#ffcc00] font-bold tracking-widest">MESAJIN YAYINDA!</p>
              <p className="text-sm text-zinc-500">Şimdi ana ekrana bak. Birazdan yükselecek...</p>
            </div>
          ) : (
            <form onSubmit={handleCheckIn} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-2 tracking-widest">İÇİNDEN GEÇENİ YAZ (Max 60)</label>
                <input 
                  type="text" maxLength={60} required
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="örn: bu gece bitmesin..."
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-white px-4 py-4 rounded-xl focus:outline-none focus:border-[#ffcc00] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-2 tracking-widest">NEREDESİN? (Opsiyonel)</label>
                <input 
                  type="text" maxLength={30}
                  value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="örn: Kadıköy Moda"
                  className="w-full bg-zinc-900/50 border border-zinc-800 text-white px-4 py-4 rounded-xl focus:outline-none focus:border-zinc-500 transition"
                />
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full bg-[#ffcc00] text-black font-black py-4 rounded-xl hover:bg-white transition disabled:opacity-50 tracking-widest uppercase"
              >
                {isSubmitting ? "GÖNDERİLİYOR..." : "KALABALIĞA İZ BIRAK"}
              </button>
            </form>
          )}
        </div>

        {/* 🚀 QR KOD VE STICKER KISMI */}
        <div className="text-center pt-8 border-t border-zinc-900 flex flex-col items-center">
          <p className="text-xs text-zinc-500 mb-4 tracking-widest">SİTEYE GİDEN RESMİ QR KOD (Sticker İçin)</p>
          
          <div className="bg-white p-4 rounded-xl mb-4 shadow-[0_0_20px_rgba(255,204,0,0.2)]">
            <QRCode 
              value="https://ellerhavaya.com" 
              size={120}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>

          <p className="text-[10px] text-zinc-600 mb-4 tracking-widest max-w-[250px]">
            MEKANIN İÇİN ELLER HAVAYA QR STICKER'I İSTİYORSAN BİZE ULAŞ
          </p>
          <a href="mailto:iletisim@ellerhavaya.com" className="text-sm text-[#ffcc00] hover:text-white underline underline-offset-4 transition">
            Sipariş Ver
          </a>
        </div>

      </div>
    </main>
  );
}