import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "yellow" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }: ButtonProps, ref: React.Ref<HTMLButtonElement>) => {
    const variants: Record<string, string> = {
      primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md",
      secondary: "bg-gray-200 hover:bg-gray-300 text-gray-700",
      danger: "bg-red-500 hover:bg-red-600 text-white",
      ghost: "hover:bg-gray-100 text-gray-600",
      yellow: "bg-yellow-500 hover:bg-yellow-600 text-white shadow-md",
      outline: "border-2 border-slate-200 hover:bg-slate-50 text-slate-600",
    };

    const sizes: Record<string, string> = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2",
      lg: "px-6 py-3 text-lg",
      xl: "px-8 py-4 text-xl font-black",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
          variants[variant as string] || variants.primary,
          sizes[size as string] || sizes.md,
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
