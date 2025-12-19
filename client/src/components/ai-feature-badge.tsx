import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIFeatureBadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  tooltip?: string;
  pulse?: boolean;
  "data-testid"?: string;
}

export function AIFeatureBadge({ 
  className, 
  size = "sm",
  tooltip = "AI-Powered Feature",
  pulse = false,
  "data-testid": dataTestId
}: AIFeatureBadgeProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };

  const badge = (
    <div 
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400",
        pulse && "animate-pulse",
        className
      )}
      data-testid={dataTestId}
    >
      <Sparkles className={cn(sizeClasses[size])} />
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p className="flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              {tooltip}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

export function AIFeatureLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      <AIFeatureBadge size="sm" />
    </span>
  );
}
