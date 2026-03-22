import React from "react";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ShieldCheck, ChevronLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-100 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-indigo-600">
              <ChevronLeft size={20} className="mr-1" /> 돌아가기
            </Button>
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-16">
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">개인정보처리방침</h1>
              <p className="text-slate-400 font-bold">Privacy Policy</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-600 font-medium leading-relaxed">
            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">1. 수집하는 개인정보</h2>
              <p>본 서비스는 원활한 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>구글 로그인을 통해 제공받는 정보:</strong> 구글 이메일 주소, 이름, 프로필 사진</li>
                <li><strong>이용자가 직접 입력하는 정보:</strong> 소속 학교, 선생님 이름, 프로필 사진</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">2. 수집 및 이용 목적</h2>
              <p>수집된 개인정보는 다음의 목적을 위해 활용됩니다.</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>교사 사용자의 본인 식별 및 계정 관리</li>
                <li>개인화된 프로필 제공 및 퀴즈 보관함 연동</li>
                <li>서비스 품질 개선 및 사용자 문의 응대</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">3. 개인정보의 보유 및 이용 기간</h2>
              <p>이용자의 개인정보는 원칙적으로 <strong>회원 탈퇴 시</strong> 또는 <strong>서비스 종료 시</strong>까지 보유하며, 목적이 달성된 후에는 지체 없이 해당 정보를 파기합니다.</p>
              <p className="mt-2 text-sm text-slate-400 italic">* 회원 탈퇴 시 해당 계정과 연결된 모든 퀴즈 및 게임 데이터가 함께 삭제됩니다.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">4. 개인정보의 제3자 제공</h2>
              <p>본 서비스는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만, 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우는 예외로 합니다.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">5. 이용자의 권리</h2>
              <p>이용자는 언제든지 자신의 개인정보를 열람, 수정하거나 삭제(탈퇴)를 요청할 수 있습니다. 이는 서비스 내 '프로필 정보 수정' 화면에서 직접 수행할 수 있습니다.</p>
            </section>
          </div>

          <div className="mt-16 pt-8 border-t border-slate-100 text-slate-400 text-sm font-bold text-center">
            시행 일자: 2026년 3월 23일
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
