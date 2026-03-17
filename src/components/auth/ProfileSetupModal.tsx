"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { useDialog } from "@/components/ui/DialogProvider";
import { usePathname } from "next/navigation";

export function ProfileSetupModal() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const pathname = usePathname();
  const [schoolName, setSchoolName] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { showAlert } = useDialog();

  // 학생용 페이지(/join, /play)에서는 프로필 설정 모달을 표시하지 않음
  const isStudentPage = pathname?.startsWith('/join') || pathname?.startsWith('/play');

  // Show only if we have a logged-in user but no profile, and not on student pages
  if (loading || !user || profile || isStudentPage) return null;

  const handleSave = async () => {
    if (!schoolName.trim() || !name.trim()) {
      await showAlert("학교 이름과 선생님 성함을 모두 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").insert([{
        id: user.id,
        school_name: schoolName,
        name: name
      }]);
      if (error) throw error;
      await refreshProfile();
    } catch (err: any) {
      await showAlert("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-black text-gray-800 mb-2">환영합니다! 🎉</h2>
        <p className="text-gray-500 font-medium mb-6">원활한 서비스 이용을 위해 선생님의 소속을 알려주세요.</p>
        
        <div className="space-y-4 mb-8">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">학교 이름</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:bg-white outline-none font-bold"
              placeholder="학교 이름을 입력하세요"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">선생님 성함</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:bg-white outline-none font-bold"
              placeholder="성함을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <Button 
          variant="primary" 
          className="w-full py-4 text-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "저장 중..." : "시작하기"}
        </Button>
      </div>
    </div>
  );
}
