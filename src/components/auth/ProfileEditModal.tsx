"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { useDialog } from "@/components/ui/DialogProvider";
import { X, Upload, User as UserIcon } from "lucide-react";
import Image from "next/image";

interface ProfileEditModalProps {
  onClose: () => void;
}

export function ProfileEditModal({ onClose }: ProfileEditModalProps) {
   const { user, profile, refreshProfile, signOut } = useAuth();
   const [schoolName, setSchoolName] = useState("");
   const [name, setName] = useState("");
   const [avatarUrl, setAvatarUrl] = useState("");
   const [saving, setSaving] = useState(false);
   const [uploading, setUploading] = useState(false);
   const [deleting, setDeleting] = useState(false);
   const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
   const [deleteConfirmText, setDeleteConfirmText] = useState("");
   const { showAlert } = useDialog();
   const fileInputRef = useRef<HTMLInputElement>(null);
   const router = useRouter();

  // Sync state when profile is loaded or changes
  useEffect(() => {
    if (profile) {
      setSchoolName(profile.school_name || "");
      setName(profile.name || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  if (!user) return null;

  const hasChanges = 
    schoolName.trim() !== (profile?.school_name || "") ||
    name.trim() !== (profile?.name || "") ||
    avatarUrl !== (profile?.avatar_url || "");

  const handleSave = async () => {
    if (!hasChanges) {
      await showAlert({ message: "변경된 내용이 없습니다." });
      return;
    }

    const updates: any = { id: user.id };
    if (schoolName.trim() !== (profile?.school_name || "")) updates.school_name = schoolName.trim();
    if (name.trim() !== (profile?.name || "")) updates.name = name.trim();
    if (avatarUrl !== (profile?.avatar_url || "")) updates.avatar_url = avatarUrl;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq('id', user.id);
        
      if (error) throw error;
      await refreshProfile();
      onClose();
    } catch (err: any) {
      await showAlert({ message: "저장 실패: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "회원 탈퇴") return;
    
    setDeleting(true);
    try {
      // 1. Call server-side function to delete auth record and cascaded data
      const { error: deleteError } = await supabase.rpc('delete_user');
      if (deleteError) throw deleteError;

      // 2. Sign out locally
      await signOut();
      
      // 3. Close modal and redirect
      onClose();
      router.push("/");
      router.refresh();
    } catch (err: any) {
      await showAlert({ message: "탈퇴 처리 중 오류가 발생했습니다: " + err.message });
    } finally {
      setDeleting(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (error: any) {
      await showAlert({ message: '업로드 실패: ' + error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] relative animate-pop overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-50 to-purple-50 -z-10" />
        
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all"
        >
          <X size={24} />
        </button>
        
        <div className="flex flex-col items-center mb-10">
          <div className="relative group mb-4">
            <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-white bg-white shadow-xl flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform duration-500">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-50 flex items-center justify-center">
                  <UserIcon size={48} className="text-indigo-200" />
                </div>
              )}
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-3 rounded-2xl shadow-lg hover:bg-indigo-700 hover:scale-110 transition-all z-10"
              disabled={uploading}
            >
              <Upload size={18} />
            </button>
            
            {uploading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-[2rem] flex items-center justify-center z-20">
                <p className="text-[10px] font-black text-indigo-600 animate-pulse">UPLOADING...</p>
              </div>
            )}
          </div>
          
          <div className="text-center">
             <h2 className="text-2xl font-black text-gray-800 flex items-center justify-center gap-2">
               프로필 정보 수정
             </h2>
             <p className="text-xs text-gray-400 mt-1 font-bold">원하는 정보만 수정하고 저장하세요.</p>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={uploadAvatar} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="space-y-6 mb-10">
          <div className="relative group">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2 px-1">소속 학교</label>
            <div className="relative">
              <input 
                type="text" 
                className="w-full px-6 py-4 rounded-[1.25rem] border-2 border-gray-100 bg-gray-50/50 focus:border-indigo-400 focus:bg-white outline-none font-bold transition-all text-gray-800 placeholder:text-gray-300"
                placeholder="학교 이름을 입력하세요"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-400 transition-colors">
                <X size={16} className="cursor-pointer hover:text-red-400" onClick={() => setSchoolName("")} />
              </div>
            </div>
          </div>
          
          <div className="relative group">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2 px-1">선생님 이름</label>
            <div className="relative">
              <input 
                type="text" 
                className="w-full px-6 py-4 rounded-[1.25rem] border-2 border-gray-100 bg-gray-50/50 focus:border-indigo-400 focus:bg-white outline-none font-bold transition-all text-gray-800 placeholder:text-gray-300"
                placeholder="성함을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-400 transition-colors">
                <X size={16} className="cursor-pointer hover:text-red-400" onClick={() => setName("")} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <Button 
            variant="primary" 
            className={`flex-[2] py-4.5 rounded-2xl text-lg font-black shadow-xl transition-all ${hasChanges ? 'shadow-indigo-100' : 'opacity-40 grayscale pointer-events-none'}`}
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving ? "저장 중..." : "변경사항 저장"}
          </Button>
          <Button 
            variant="ghost" 
            className="flex-1 py-4.5 rounded-2xl text-gray-400 font-bold hover:text-gray-900 border-2 border-transparent hover:border-gray-100 transition-all"
            onClick={onClose}
          >
            취소
          </Button>
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs font-bold text-red-300 hover:text-red-500 transition-colors underline underline-offset-4"
          >
            회원 탈퇴하기
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-pop">
            <h3 className="text-xl font-black text-gray-900 mb-2">정말 탈퇴하시겠습니까?</h3>
            <p className="text-sm text-red-500 font-bold mb-6">
              수집된 개인정보 및 제작된 퀴즈는 모두 삭제되며 복구할 수 없습니다.
            </p>
            
            <div className="space-y-4">
              <p className="text-xs text-gray-500 font-medium">
                탈퇴를 진행하시려면 아래에 <span className="text-red-600 font-black">"회원 탈퇴"</span>를 정확히 입력해주세요.
              </p>
              <input 
                type="text"
                className="w-full px-5 py-3 rounded-xl border-2 border-red-50 focus:border-red-200 outline-none font-black text-center"
                placeholder="회원 탈퇴"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
              
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="primary" 
                  className={`flex-1 rounded-xl py-3 bg-red-500 hover:bg-red-600 shadow-red-100 ${deleteConfirmText === "회원 탈퇴" ? "" : "opacity-30 grayscale pointer-events-none"}`}
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "처리 중..." : "탈퇴 확정"}
                </Button>
                <Button 
                  variant="ghost" 
                  className="flex-1 rounded-xl py-3 text-gray-400"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
