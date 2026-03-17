"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface MathKeypadContextType {
  activeField: any | null;
  isOpen: boolean;
  pos: { x: number; y: number };
  level: 'elementary' | 'middle' | 'high';
  openKeypad: (field: any, level: 'elementary' | 'middle' | 'high') => void;
  closeKeypad: () => void;
  updatePos: (pos: { x: number; y: number }) => void;
}

const MathKeypadContext = createContext<MathKeypadContextType | undefined>(undefined);

export function MathKeypadProvider({ children }: { children: React.ReactNode }) {
  const [activeField, setActiveField] = useState<any | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [level, setLevel] = useState<'elementary' | 'middle' | 'high'>('elementary');
  const pathname = usePathname();

  const openKeypad = useCallback((field: any, currentLevel: 'elementary' | 'middle' | 'high') => {
    setActiveField(field);
    setLevel(currentLevel);
    setIsOpen(true);
  }, []);

  const closeKeypad = useCallback(() => {
    setIsOpen(false);
    setActiveField(null);
  }, []);

  const updatePos = useCallback((newPos: { x: number; y: number }) => {
    setPos(newPos);
  }, []);

  // Close keypad on route changes
  useEffect(() => {
    closeKeypad();
  }, [pathname, closeKeypad]);

  return (
    <MathKeypadContext.Provider value={{
      activeField,
      isOpen,
      pos,
      level,
      openKeypad,
      closeKeypad,
      updatePos
    }}>
      {children}
    </MathKeypadContext.Provider>
  );
}

export function useMathKeypad() {
  const context = useContext(MathKeypadContext);
  if (context === undefined) {
    throw new Error('useMathKeypad must be used within a MathKeypadProvider');
  }
  return context;
}
