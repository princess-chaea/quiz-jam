"use client";

import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface QRCodeModalProps {
  url: string;
  onClose: () => void;
}

export function QRCodeModal({ url, onClose }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <h3 className="text-xl font-jua">QR 코드로 입장하기</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl shadow-inner border-4 border-indigo-50 mb-6">
            <QRCodeSVG value={url} size={200} />
          </div>
          
          <p className="text-gray-500 text-sm font-bold mb-6 text-center break-all px-4">
            {url}
          </p>

          <Button 
            className="w-full" 
            variant={copied ? "yellow" : "primary"}
            onClick={handleCopy}
          >
            {copied ? (
              <><Check size={20} className="mr-2" /> 복사 완료!</>
            ) : (
              <><Copy size={20} className="mr-2" /> 링크 복사하기</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
