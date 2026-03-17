"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { 
  GraduationCap, 
  Sparkles, 
  Zap, 
  Users, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function TeacherLanding() {
  const router = useRouter();
  const { user, loading, signInWithGoogle } = useAuth();

  // Auto-redirect logged-in teachers to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // After login, useEffect above will redirect
    } catch (err) {
      alert("로그인 실패: " + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <GraduationCap size={24} />
            </div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Class Quiz Jam
            </span>
          </div>
          <button 
            onClick={() => router.push("/join")}
            className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            학생 입장 →
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full text-indigo-600 font-bold text-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Sparkles size={16} /> 2026년형 차세대 클래스 퀴즈 솔루션
            </div>
            <h1 className="text-6xl md:text-8xl font-black leading-[1.1] tracking-tight text-slate-900 mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              수업의 활력을 <br/>
              <span className="text-indigo-600">실시간</span>으로 <br/>
              깨우세요
            </h1>
            <p className="text-xl text-slate-500 font-medium max-w-lg mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000">
              더 이상 지루한 수업은 없습니다. 제미나이 AI가 도와주는 스마트한 문항 생성과 
              박진감 넘치는 실시간 레이스로 교실을 열정으로 채웁니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000">
              <Button onClick={handleLogin} size="xl" className="px-10 py-6 rounded-2xl group shadow-2xl shadow-indigo-200">
                구글로 선생님 로그인 <ArrowRight size={24} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                onClick={() => router.push("/join")} 
                size="xl" 
                variant="ghost" 
                className="px-10 py-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-slate-50"
              >
                학생으로 참여하기
              </Button>
            </div>
          </div>

          <div className="relative animate-in fade-in zoom-in duration-1000">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-200/50 rounded-full blur-[100px]" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-200/50 rounded-full blur-[100px]" />
            <div className="relative bg-white rounded-[2.5rem] border border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden aspect-[4/3]">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-white" />
              <div className="absolute inset-0 flex items-center justify-center p-12">
                <div className="w-full text-center">
                  <div className="grid grid-cols-3 gap-6 mb-8 transform -rotate-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 aspect-square flex items-center justify-center text-3xl">
                        {['🎉', '💡', '🚀', '🔥', '🎯', '🌈'][i-1]}
                      </div>
                    ))}
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">선생님 화면 예시</h3>
                  <div className="w-2/3 h-2 bg-indigo-100 rounded-full mx-auto overflow-hidden">
                    <div className="w-3/4 h-full bg-indigo-500 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-slate-900 mb-4">놀라운 기능들이 기다립니다</h2>
            <p className="text-slate-500 font-bold">수업 준비 시간은 줄이고, 참여도는 극대화하세요.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="text-amber-500" />}
              title="초고속 AI 문항 생성"
              description="제미나이 AI가 학습 자료에서 핵심 문항을 자동으로 추출해 드립니다."
            />
            <FeatureCard 
              icon={<Users className="text-indigo-500" />}
              title="박진감 넘치는 실시간 레이스"
              description="점수 뺏기, 기부, 쉴드 등 다양한 이벤트가 수업을 게임처럼 만듭니다."
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-emerald-500" />}
              title="강력한 보안 및 관리"
              description="구글 로그인을 통한 간편한 퀴즈 라이브러리 관리와 개인정보 보호."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <GraduationCap size={20} />
            </div>
            <span className="font-black text-lg">Class Quiz Jam</span>
          </div>
          <p className="text-slate-400 text-sm font-bold">
            © 2026 Class Quiz Jam • Created for Inspired Education
          </p>
          <div className="flex gap-6 text-slate-400 font-bold text-sm">
            <a href="#" className="hover:text-indigo-600">이용약관</a>
            <a href="#" className="hover:text-indigo-600">개인정보처리방침</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactElement, title: string, description: string }) {
  return (
    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white group-hover:shadow-lg transition-all">
        {React.cloneElement(icon, { size: 32 } as any)}
      </div>
      <h3 className="text-2xl font-black text-slate-900 mb-4">{title}</h3>
      <p className="text-slate-500 font-medium leading-relaxed">{description}</p>
    </div>
  );
}
