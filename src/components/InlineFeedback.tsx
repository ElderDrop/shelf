import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InlineErrorProps {
  children: ReactNode;
  className?: string;
}

/** Shared inline API/form error style for product surfaces. */
export function InlineError({ children, className }: InlineErrorProps) {
  return <p className={cn("text-destructive text-sm", className)}>{children}</p>;
}

interface LoadingLabelProps {
  children?: ReactNode;
  className?: string;
}

/** Light pending label — no skeletons. */
export function LoadingLabel({ children = "Working…", className }: LoadingLabelProps) {
  return <p className={cn("text-muted-foreground text-sm", className)}>{children}</p>;
}
