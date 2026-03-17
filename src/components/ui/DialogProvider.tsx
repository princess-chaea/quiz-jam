"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, HelpCircle, MessageSquare } from "lucide-react";

type DialogType = "alert" | "confirm" | "prompt";

interface DialogConfig {
  id: string;
  type: DialogType;
  message: string;
  defaultValue?: string;
  resolve: (value: any) => void;
}

interface DialogContextType {
  showAlert: (message: string) => Promise<boolean>;
  showConfirm: (message: string) => Promise<boolean>;
  showPrompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogConfig[]>([]);
  const [promptValue, setPromptValue] = useState("");

  const showAlert = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setDialogs((prev) => [
        ...prev,
        { id: Math.random().toString(), type: "alert", message, resolve },
      ]);
    });
  };

  const showConfirm = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setDialogs((prev) => [
        ...prev,
        { id: Math.random().toString(), type: "confirm", message, resolve },
      ]);
    });
  };

  const showPrompt = (message: string, defaultValue: string = "") => {
    setPromptValue(defaultValue);
    return new Promise<string | null>((resolve) => {
      setDialogs((prev) => [
        ...prev,
        { id: Math.random().toString(), type: "prompt", message, defaultValue, resolve },
      ]);
    });
  };

  const closeDialog = (id: string, result: any) => {
    setDialogs((prev) => {
      const dialog = prev.find((d) => d.id === id);
      if (dialog) {
        dialog.resolve(result);
      }
      return prev.filter((d) => d.id !== id);
    });
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      
      {dialogs.map((dialog) => (
        <div key={dialog.id} className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-pop border border-gray-100">
            <div className="p-6 flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                dialog.type === 'alert' ? 'bg-red-50 text-red-500' : 
                dialog.type === 'confirm' ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'
              }`}>
                {dialog.type === 'alert' ? <AlertCircle size={32} /> : 
                 dialog.type === 'confirm' ? <HelpCircle size={32} /> : <MessageSquare size={32} />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {dialog.type === 'alert' ? '알림' : 
                 dialog.type === 'confirm' ? '확인' : '입력'}
              </h3>
              <p className="text-gray-500 font-medium whitespace-pre-wrap mb-4">{dialog.message}</p>
              
              {dialog.type === 'prompt' && (
                <input 
                  type="text"
                  autoFocus
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-amber-400 focus:bg-white font-bold text-center transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') closeDialog(dialog.id, promptValue);
                  }}
                />
              )}
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
                <Button 
                  variant="ghost" 
                  className="flex-1 rounded-xl py-3 border border-gray-200 bg-white"
                  onClick={() => closeDialog(dialog.id, dialog.type === 'confirm' ? false : null)}
                >
                  취소
                </Button>
              )}
              <Button 
                variant="primary" 
                className={`flex-1 rounded-xl py-3 shadow-sm ${
                  dialog.type === 'alert' ? 'bg-indigo-600 hover:bg-indigo-700' : 
                  dialog.type === 'confirm' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
                }`}
                onClick={() => closeDialog(dialog.id, dialog.type === 'prompt' ? promptValue : true)}
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      ))}
    </DialogContext.Provider>
  );
}
