"use client";

import React, { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX, Pause, Play, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface BGMPlayerProps {
  status: string;
  audioPath?: string;
}

export function BGMPlayer({ status, audioPath = "/audio/quiz_bgm.mp3" }: BGMPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5); 
  const [showCredits, setShowCredits] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const audio = new Audio(audioPath);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    return () => {
      audio.pause();
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, [audioPath]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (status === "PLAYING") fadeIn();
    else if (status === "RESULT" || status === "ENDED") fadeOut();
  }, [status]);

  const fadeIn = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    audio.play().catch(() => {});
    let currentVol = audio.volume;
    fadeIntervalRef.current = setInterval(() => {
      currentVol = Math.min(volume, currentVol + 0.05);
      audio.volume = currentVol;
      if (currentVol >= volume) clearInterval(fadeIntervalRef.current!);
    }, 100);
  };

  const fadeOut = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    let currentVol = audio.volume;
    fadeIntervalRef.current = setInterval(() => {
      currentVol = Math.max(0, currentVol - 0.05);
      audio.volume = currentVol;
      if (currentVol <= 0) {
        audio.pause();
        clearInterval(fadeIntervalRef.current!);
      }
    }, 100);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      if (newVol > 0) setIsMuted(false);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().catch(() => {}); audio.volume = volume; setIsPlaying(true); }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className="fixed top-20 right-6 z-[200] flex flex-col items-end gap-2 group/player">
      {/* Credits Panel (Hover) */}
      <div className={cn(
        "bg-white/95 backdrop-blur-md border-2 border-indigo-200 p-4 rounded-2xl shadow-2xl max-w-xs transition-all duration-300 pointer-events-none",
        showCredits ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}>
        <h4 className="font-black text-indigo-900 text-sm mb-1">Music Credits</h4>
        <div className="text-[10px] text-gray-600 space-y-0.5 leading-tight">
          <p className="font-bold">Provided to YouTube by DistroKid</p>
          <p>oriental beat "거문((검은黑))(black) 국악비트 거문고비트 · TaWoo</p>
          <p>© 11014098 Records DK</p>
          <p>Released on: 2025-12-11</p>
        </div>
      </div>

      {/* Main Control Bar */}
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md border-2 border-indigo-100 p-1.5 rounded-full shadow-lg ring-4 ring-white/50">
        {/* Info Icon (Hover Trigger) */}
        <div 
          onMouseEnter={() => setShowCredits(true)}
          onMouseLeave={() => setShowCredits(false)}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all cursor-help"
        >
          <Info size={16} />
        </div>

        <div className="h-5 w-px bg-indigo-100 mx-0.5" />

        {/* Play/Pause */}
        <button onClick={togglePlay} className="w-9 h-9 bg-white border border-indigo-50 rounded-full flex items-center justify-center text-indigo-600 hover:scale-110 active:scale-95 transition-all shadow-sm">
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} className="ml-0.5" fill="currentColor" />}
        </button>

        {/* Volume & Slider (Hover) */}
        <div 
          className="relative flex items-center"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button onClick={toggleMute} className="w-9 h-9 bg-white border border-indigo-50 rounded-full flex items-center justify-center text-indigo-600 hover:scale-110 transition-all shadow-sm">
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          
          <div className={cn(
            "absolute right-full mr-2 bg-white px-3 py-2 rounded-xl shadow-xl border border-indigo-100 transition-all origin-right flex items-center gap-2",
            showVolumeSlider ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
          )}>
            <input 
              type="range" min="0" max="1" step="0.01" 
              value={volume} onChange={handleVolumeChange}
              className="w-24 h-1.5 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-[10px] font-black text-indigo-900 w-6">{Math.round(volume * 100)}</span>
          </div>
        </div>
        
        <div className="pr-3 pl-1">
          <Music size={16} className={cn("text-indigo-400", isPlaying && "animate-spin-slow")} />
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  );
}
