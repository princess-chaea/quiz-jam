import type { Metadata } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const jua = Jua({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-jua",
});

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "클래스 퀴즈 잼! - 실시간 교실 퀴즈",
  description: "선생님과 학생이 함께하는 초스피드 실시간 퀴즈 게임",
};

import { DialogProvider } from "@/components/ui/DialogProvider";
import { ProfileSetupModal } from "@/components/auth/ProfileSetupModal";
import { AuthProvider } from "@/providers/AuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${jua.variable} ${noto.variable}`}>
      <body className="antialiased bg-[#fefce8] text-gray-900 font-noto">
        <AuthProvider>
          <DialogProvider>
            {children}
            <ProfileSetupModal />
          </DialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
