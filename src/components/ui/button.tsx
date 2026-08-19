"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Spinner } from "./spinner";
import { CutIcon } from "./cut-icon";

export type ButtonVariant = "primary" | "outline" | "danger" | "danger-solid" | "ghost";
export type ButtonSize = "md" | "sm";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-unal-green-dark text-white hover:bg-unal-green",
  outline: "border border-(--rule) text-(--ink) hover:border-unal-green",
  danger: "border border-unal-red text-unal-red hover:bg-unal-red/10",
  "danger-solid": "bg-unal-red text-white hover:opacity-90",
  ghost: "border border-(--rule) text-(--ink-2) hover:text-unal-green-dark",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "py-2.5 pl-4 text-sm",
  sm: "py-2 pl-3 text-xs",
};

const ICON_PADDING: Record<ButtonSize, string> = {
  md: "pr-10",
  sm: "pr-8",
};

const ICON_SIZE: Record<ButtonSize, string> = {
  md: "h-9 w-9",
  sm: "h-7 w-7",
};

interface StyleProps {
  icon?: LucideIcon;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

function buttonClasses({ icon, variant = "primary", size = "md", className = "" }: StyleProps) {
  return [
    "relative isolate inline-flex items-center gap-2 overflow-hidden rounded font-bold",
    "disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    icon ? ICON_PADDING[size] : "pr-4",
    className,
  ].join(" ");
}

function IconLayer({ icon, size = "md" }: { icon?: LucideIcon; size?: ButtonSize }) {
  if (!icon) return null;
  return <CutIcon icon={icon} sizeClass={ICON_SIZE[size]} className="opacity-25" />;
}

interface ButtonProps extends StyleProps, Omit<ComponentPropsWithoutRef<"button">, "className"> {
  loading?: boolean;
  children: ReactNode;
}

export function Button({ icon, variant, size, loading = false, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={buttonClasses({ icon, variant, size, className })} {...rest}>
      {loading ? <Spinner /> : null}
      <span className="relative z-1">{children}</span>
      {loading ? null : <IconLayer icon={icon} size={size} />}
    </button>
  );
}

interface LinkButtonProps extends StyleProps, Omit<ComponentPropsWithoutRef<typeof Link>, "className"> {
  children: ReactNode;
}

export function LinkButton({ icon, variant, size, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses({ icon, variant, size, className })} {...rest}>
      <span className="relative z-1">{children}</span>
      <IconLayer icon={icon} size={size} />
    </Link>
  );
}
