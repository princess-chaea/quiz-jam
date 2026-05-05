"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { 
  Users, 
  ShieldCheck, 
  UserMinus, 
  Search, 
  ChevronLeft,
  ShieldAlert,
  UserPlus,
  Trash2,
  BookOpen,
  Mail
} from "lucide-react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { useDialog } from "@/components/ui/DialogProvider";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export default function AdminManagementPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { showAlert, showConfirm } = useDialog();

  // Role check - Use profile.role instead of user.role
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
  const isAdmin = profile?.role === 'ADMIN' || isSuperAdmin;

  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin) {
        showAlert({ message: "접근 권한이 없습니다." });
        router.push("/");
        return;
      }
      fetchUsers();
    }
  }, [authLoading, isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all profiles and their quiz counts
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          *,
          quizzes:quizzes(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Get emails from auth.users (This might need a server-side edge function in a real production environment
      // but for now we'll display what we have in profiles)
      setUsers(profiles || []);
    } catch (err) {
      console.error("사용자 목록 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (targetUser: any) => {
    if (!isSuperAdmin) {
      await showAlert({ message: "일반 관리자는 관리자 임명 권한이 없습니다." });
      return;
    }

    const isCurrentlyAdmin = targetUser.role === 'ADMIN';
    const confirm = await showConfirm({
      title: isCurrentlyAdmin ? "관리자 권한 해제" : "관리자 권한 부여",
      message: `${targetUser.name} 선생님의 관리자 권한을 ${isCurrentlyAdmin ? '해제' : '부여'}하시겠습니까?`,
      confirmLabel: isCurrentlyAdmin ? "해제하기" : "부여하기",
      cancelLabel: "취소"
    });

    if (!confirm) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: isCurrentlyAdmin ? 'USER' : 'ADMIN' })
        .eq("id", targetUser.id);

      if (error) throw error;
      await showAlert({ message: "권한이 변경되었습니다." });
      fetchUsers();
    } catch (err) {
      await showAlert({ message: "변경 실패: " + (err as Error).message });
    }
  };

  const handleDeleteUser = async (targetUser: any) => {
    if (!isSuperAdmin) {
      await showAlert({ message: "최고 관리자만 사용자를 삭제할 수 있습니다." });
      return;
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      await showAlert({ message: "최고 관리자 본인은 삭제할 수 없습니다." });
      return;
    }

    const confirm = await showConfirm({
      title: "사용자 삭제",
      message: `${targetUser.name} 사용자와 관련된 모든 데이터(퀴즈 포함)가 삭제됩니다. 정말 삭제하시겠습니까?`,
      confirmLabel: "삭제",
      cancelLabel: "취소"
    });

    if (!confirm) return;

    try {
      // 1. Delete the user's quizzes first to ensure all associated data is removed
      const { error: quizError } = await supabase
        .from("quizzes")
        .delete()
        .eq("user_id", targetUser.id);

      if (quizError) throw quizError;

      // 2. Delete the profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", targetUser.id);

      if (profileError) throw profileError;
      
      await showAlert({ message: "사용자 정보와 생성한 모든 퀴즈가 성공적으로 삭제되었습니다." });
      fetchUsers();
    } catch (err) {
      await showAlert({ message: "삭제 실패: " + (err as Error).message });
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.school_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-8 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-200">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
              <ShieldCheck className="text-indigo-600" size={32} /> 관리 모드
            </h1>
          </div>
          
          <div className="bg-indigo-600 text-white px-6 py-2 rounded-2xl font-black flex items-center gap-2 shadow-lg">
             {isSuperAdmin ? "최고 관리자" : "관리자"} 모드
          </div>
        </div>

        {/* Search & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-indigo-400 focus:bg-white outline-none transition-all font-bold"
                placeholder="사용자 이름 또는 학교명으로 검색..."
              />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">전체 가입자</div>
              <div className="text-3xl font-black text-indigo-600">{users.length}명</div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-2xl">
              <Users className="text-indigo-600" />
            </div>
          </div>
        </div>

        {/* User List */}
        {loading ? (
          <Spinner label="사용자 데이터를 불러오는 중..." />
        ) : (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">사용자 정보</th>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">권한</th>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">콘텐츠</th>
                    <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gray-100 overflow-hidden border border-gray-200">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Users size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-black text-gray-800 text-lg">{u.name || "미설정"}</div>
                            <div className="text-sm font-bold text-gray-400">{u.school_name || "학교 정보 없음"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight",
                          u.role === 'SUPER_ADMIN' ? "bg-amber-100 text-amber-700 border border-amber-200" :
                          u.role === 'ADMIN' ? "bg-indigo-100 text-indigo-700 border border-indigo-200" :
                          "bg-slate-100 text-slate-500 border border-slate-200"
                        )}>
                          {u.role === 'SUPER_ADMIN' ? "최고 관리자" : u.role === 'ADMIN' ? "일반 관리자" : "사용자"}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                            <BookOpen size={16} className="text-slate-400" />
                            <span>{u.quizzes?.[0]?.count || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {isSuperAdmin && u.role !== 'SUPER_ADMIN' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={cn(
                                  "rounded-xl",
                                  u.role === 'ADMIN' ? "text-orange-500 hover:bg-orange-50" : "text-indigo-600 hover:bg-indigo-50"
                                )}
                                onClick={() => handleToggleAdmin(u)}
                              >
                                {u.role === 'ADMIN' ? <UserMinus size={18} /> : <UserPlus size={18} />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="rounded-xl text-red-500 hover:bg-red-50"
                                onClick={() => handleDeleteUser(u)}
                              >
                                <Trash2 size={18} />
                              </Button>
                            </>
                          )}
                          {u.role === 'SUPER_ADMIN' && (
                             <ShieldAlert size={18} className="text-amber-500 m-2" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center">
                 <ShieldAlert size={48} className="text-gray-200 mb-4" />
                 <p className="text-gray-400 font-bold">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
