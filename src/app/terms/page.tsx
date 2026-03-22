import React from "react";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { FileText, ChevronLeft } from "lucide-react";

export default function TermsOfService() {
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
              <FileText size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">서비스 이용약관</h1>
              <p className="text-slate-400 font-bold">Terms of Service</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-600 font-medium leading-relaxed">
            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">1. 서비스 정의 및 목적</h2>
              <p>본 서비스('퀴즈잼')는 AI를 활용한 퀴즈 생성 및 교육적 목적의 실시간 퀴즈 진행을 위한 도구입니다. 본 약관은 이용자가 서비스를 이용함에 있어 필요한 권리와 의무를 규정합니다.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">2. 이용자의 의무</h2>
              <p>이용자는 관련 법령 및 본 약관을 준수해야 하며, 다음과 같은 행동을 해서는 안 됩니다.</p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>타인의 저작권 및 지식재산권을 침해하는 내용을 생성하거나 공유하는 행위</li>
                <li>부적절하고 공격적인 언어를 포함한 퀴즈를 생성하는 행위</li>
                <li>본 서비스의 정상적인 운영을 방해하거나 시스템을 공격하는 행위</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">3. 저작권 및 콘텐츠 소유권</h2>
              <p>이용자가 서비스를 통해 생성한 퀴즈의 저작권은 해당 이용자에게 있습니다. 본 서비스는 교육용 무료 도구로서, 이용자는 자신이 생성한 퀴즈를 교육 현장에서 자유롭게 활용할 수 있습니다. 단, 생성 과정에서 발생하는 AI 결과물의 저작권에 대해서는 이용자가 관련 법규를 숙지하고 책임져야 합니다.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">4. 면책 조항</h2>
              <p>본 서비스는 현재 개발 중인 베타 단계로 제공될 수 있으며, 운영자는 서비스의 장애나 중단에 대해 고의적인 과실이 없는 한 책임을 지지 않습니다. 특히 AI가 생성하는 퀴즈 내용의 정확성이나 적절성에 대해서는 이용자가 반드시 검토해야 하며, 기술적 오류로 인한 데이터 손실에 대해서도 운영자는 의무를 다하나 완전한 책임을 지지는 않습니다.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-4 border-l-4 border-indigo-500 pl-4">5. 서비스 중단 및 해지</h2>
              <p>이용자는 언제든지 서비스 내 회원 탈퇴를 통해 본 약관의 효력을 종료시킬 수 있으며, 탈퇴 시 본인이 생성한 모든 퀴즈 정보는 즉시 삭제됩니다.</p>
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
