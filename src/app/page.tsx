"use client";

import React, { useEffect, useState } from "react";
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
import { Footer } from "@/components/layout/Footer";

const PREVIEW_IMAGES = [
  "/landing/preview1.png",
  "/landing/preview2.png",
  "/landing/preview3.png",
  "/landing/preview4.png",
];

function TeacherPreviewSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev: number) => (prev + 1) % PREVIEW_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center p-8 bg-gradient-to-br from-indigo-50/50 to-white">
      {PREVIEW_IMAGES.map((img, index) => (
        <div
          key={img}
          className={`absolute inset-0 transition-opacity duration-1000 flex items-center justify-center p-8 ${index === currentIndex ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            }`}
        >
          <img
            src={img}
            alt={`Preview ${index + 1}`}
            className="w-full h-full object-contain drop-shadow-2xl rounded-2xl border border-white/50"
          />
        </div>
      ))}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        {PREVIEW_IMAGES.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all duration-500 ${index === currentIndex ? "bg-indigo-600 w-10" : "bg-indigo-100 w-2 hover:bg-indigo-200"
              }`}
          />
        ))}
      </div>

      {/* Decorative Badge */}
      <div className="absolute top-8 right-8 bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-slate-100 z-20 animate-bounce">
        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Teacher View</span>
      </div>
    </div>
  );
}

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

  if (loading || user) {
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
          <div className="flex items-center">
            <img src="/logo.png" alt="클래스 퀴즈 잼!" className="h-14 object-contain" />
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
              수업의 활력을 <br />
              <span className="text-indigo-600">실시간</span>으로 <br />
              깨우세요
            </h1>
            <p className="text-xl text-slate-500 font-medium max-w-lg mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000">
              더 이상 지루한 수업은 없습니다. AI가 도와주는 스마트한 문항 생성과
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
            <div className="relative bg-white rounded-[2.5rem] border border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] overflow-hidden aspect-[4/3] group">
              <TeacherPreviewSlider />
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
              description="AI가 학습 자료에서 핵심 문항을 자동으로 추출해 드립니다."
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

      <Footer />
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
