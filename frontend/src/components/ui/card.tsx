import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        // Frosted-glass surface: translucent + backdrop blur so the animated
        // background glows through the edges, with a soft depth shadow.
        "rounded-xl border border-line/70 bg-paper-raised/80 text-ink backdrop-blur-md",
        "shadow-[0_1px_2px_rgba(28,37,48,0.04)] supports-[backdrop-filter]:bg-paper-raised/70",
        "[html[data-theme=dark]_&]:shadow-[0_10px_40px_-16px_rgba(0,0,0,0.55)]",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-semibold leading-tight text-ink", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-ink-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
