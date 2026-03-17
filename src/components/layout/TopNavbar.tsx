"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, LogOut, Library, Users, User as UserIcon } from "lucide-react";
import { ProfileEditModal } from "@/components/auth/ProfileEditModal";
import { useState } from "react";

export function TopNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  if (!user) return null;

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/edit");
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm w-full">
      <div 
        className="flex items-center gap-2 cursor-pointer group" 
        onClick={() => router.push("/dashboard")}
      >
        <div className="bg-indigo-600 p-2 rounded-xl text-white group-hover:bg-indigo-700 transition-colors">
          <BookOpen size={24} />
        </div>
        <span className="text-2xl font-jua text-indigo-900 group-hover:text-indigo-700 transition-colors">퀴즈 잼!</span>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-2 text-sm font-bold">
          <TabButton 
            icon={<BookOpen size={18} />} 
            label="내 퀴즈 보관함" 
            active={isActive("/dashboard")} 
            onClick={() => router.push("/dashboard")} 
          />
          <TabButton 
            icon={<Library size={18} />} 
            label="라이브러리" 
            active={isActive("/library")} 
            onClick={() => router.push("/library")} 
          />
          <TabButton 
            icon={<Users size={18} />} 
            label="커뮤니티" 
            active={isActive("/community")} 
            onClick={() => router.push("/community")} 
          />
        </div>
        <div className="flex items-center gap-3 bg-gray-100 py-1.5 px-4 rounded-full border border-gray-200 shadow-inner">
           <button 
             onClick={() => setIsEditModalOpen(true)}
             className="flex items-center gap-3 hover:bg-gray-200 py-1 px-2 -ml-2 rounded-full transition-colors"
           >
             {profile?.avatar_url ? (
               <img src={profile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-gray-200 shadow-sm" />
             ) : (
               <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                 {profile?.name ? profile.name.charAt(0) : user.email?.[0].toUpperCase()}
               </div>
             )}
             
             {profile ? (
               <span className="text-sm font-bold text-gray-700">
                 <span className="text-indigo-600">{profile.school_name}</span> {profile.name} 선생님
               </span>
             ) : (
               <span className="text-sm font-bold text-gray-700">{user.email?.split('@')[0]}</span>
             )}
           </button>
           <div className="w-px h-6 bg-gray-300 mx-1"></div>
           <button 
             onClick={signOut} 
             className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-full transition-all" 
             title="로그아웃"
           >
             <LogOut size={18} />
           </button>
        </div>
      </div>
      
      {isEditModalOpen && (
        <ProfileEditModal onClose={() => setIsEditModalOpen(false)} />
      )}
    </nav>
  );
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300
        ${active 
          ? "bg-indigo-50 text-indigo-700 font-black shadow-sm" 
          : "text-gray-500 hover:text-indigo-600 hover:bg-gray-50"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}
