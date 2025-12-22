import { useState, useEffect, type SVGProps } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain,
  Sparkles,
  Users,
  MessageSquare,
  Calendar,
  TrendingUp,
  ChevronLeft,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { metricsService } from "@/lib/metrics";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  features: string[];
  ctaText: string;
  ctaLink?: string;
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to AI-Powered ContactHub! 🎉",
    description: "Discover how artificial intelligence can transform the way you manage relationships and stay connected.",
    icon: Sparkles,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100 dark:bg-purple-950",
    features: [
      "AI generates personalized messages for any group",
      "Smart contact insights and relationship analysis",
      "Intelligent group suggestions based on your network",
      "Automated communication scheduling",
      "Predictive engagement analytics"
    ],
    ctaText: "Start Tour",
  },
  {
    id: "smart-messages",
    title: "AI Message Generation ✨",
    description: "Never struggle with what to say again. Our AI crafts contextual, personalized messages that feel authentic and engaging.",
    icon: MessageSquare,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100 dark:bg-blue-950",
    features: [
      "Context-aware message creation based on group background",
      "Personalized tone matching your relationship style",
      "No generic templates - every message is unique",
      "Works for any group size or purpose",
      "Includes proper greetings and natural conversation flow"
    ],
    ctaText: "Try It Now",
    ctaLink: "/groups",
  },
  {
    id: "contact-insights",
    title: "AI Contact Insights 🧠",
    description: "Click the Brain icon on any contact to unlock deep AI-powered insights about your relationship dynamics.",
    icon: Brain,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-100 dark:bg-sky-950",
    features: [
      "Relationship strength and engagement analysis",
      "Communication pattern recommendations",
      "Best times to reach out based on history",
      "Contact summary with key relationship details",
      "Smart categorization and tagging"
    ],
    ctaText: "View Contacts",
    ctaLink: "/contacts",
  },
  {
    id: "smart-groups",
    title: "Smart Group Suggestions 👥",
    description: "AI analyzes your contacts and automatically suggests meaningful groups - no manual organization needed!",
    icon: Users,
    iconColor: "text-green-600",
    iconBg: "bg-green-100 dark:bg-green-950",
    features: [
      "Automatic grouping based on relationships and context",
      "Identifies overlooked contacts who need attention",
      "Creates natural, intuitive group structures",
      "One-click group creation from suggestions",
      "Learns from your communication patterns"
    ],
    ctaText: "See Suggestions",
    ctaLink: "/groups",
  },
  {
    id: "insights-analytics",
    title: "Personal Insights & Analytics 📊",
    description: "Understand your network health with AI-powered analytics and predictive insights.",
    icon: TrendingUp,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-100 dark:bg-orange-950",
    features: [
      "Network strength and engagement scoring",
      "Communication frequency analysis",
      "Predictive churn risk detection",
      "Smart goals and recommendations",
      "AI predictions for relationship maintenance"
    ],
    ctaText: "View Insights",
    ctaLink: "/insights",
  },
  {
    id: "complete",
    title: "You're All Set! 🚀",
    description: "You now know where to find all our AI-powered features. Start exploring and let AI help you build stronger relationships!",
    icon: Check,
    iconColor: "text-green-600",
    iconBg: "bg-green-100 dark:bg-green-950",
    features: [
      "Look for the ✨ Sparkles icon for AI features",
      "Brain 🧠 icon on contacts for deep insights",
      "Smart suggestions appear automatically when helpful",
      "All AI features work seamlessly in the background",
      "Your data privacy is always protected"
    ],
    ctaText: "Start Using ContactHub",
  },
];

const ChevronRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

interface AIFeatureTourProps {
  forceOpen?: boolean;
  onComplete?: () => void;
}

export function AIFeatureTour({ forceOpen = false, onComplete }: AIFeatureTourProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check if user has seen the tour
    const tourSeen = localStorage.getItem(`ai-tour-seen-${user.id}`);
    
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStep(0);
    } else if (!tourSeen) {
      // Show tour after a brief delay on first login
      const timer = setTimeout(() => {
        setIsOpen(true);
        metricsService.trackFeatureUsage("ai_tour_auto_started");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, forceOpen]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      metricsService.trackFeatureUsage("ai_tour_step_completed", {
        step: tourSteps[currentStep].id,
        stepNumber: currentStep + 1,
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (user) {
      localStorage.setItem(`ai-tour-seen-${user.id}`, "true");
    }
    setIsOpen(false);
    setHasSeenTour(true);
    metricsService.trackFeatureUsage("ai_tour_skipped", {
      stepsCompleted: currentStep + 1,
      totalSteps: tourSteps.length,
    });
    onComplete?.();
  };

  const handleComplete = () => {
    if (user) {
      localStorage.setItem(`ai-tour-seen-${user.id}`, "true");
    }
    setIsOpen(false);
    setHasSeenTour(true);
    metricsService.trackFeatureUsage("ai_tour_completed");
    onComplete?.();
  };

  const handleCTA = () => {
    const step = tourSteps[currentStep];
    if (step.ctaLink) {
      metricsService.trackFeatureUsage("ai_tour_cta_clicked", {
        step: step.id,
        link: step.ctaLink,
      });
      window.location.href = step.ctaLink;
    } else if (currentStep === 0) {
      handleNext();
    } else {
      handleComplete();
    }
  };

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleSkip();
    }}>
      <DialogContent className="max-w-2xl sm:max-h-[85vh]" hideClose>
        <DialogHeader>
          <Badge variant="secondary" className="text-xs mb-2 w-fit">
            {currentStep + 1} of {tourSteps.length}
          </Badge>
          <DialogTitle className="text-xl sm:text-2xl">{step.title}</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          {/* Icon Display */}
          <div className={cn("w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto", step.iconBg)}>
            <step.icon className={cn("h-6 w-6 sm:h-8 sm:w-8", step.iconColor)} />
          </div>

          {/* Feature List */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 sm:pt-6">
              <ul className="space-y-2 sm:space-y-3">
                {step.features.slice(0, isFirstStep ? 5 : 4).map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 sm:gap-3">
                    <div className="bg-primary/10 rounded-full p-1 mt-0.5 flex-shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-xs sm:text-sm flex-1 leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === currentStep
                    ? "w-8 bg-primary"
                    : index < currentStep
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-muted-foreground/30"
                )}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={isFirstStep}
              className="gap-2 order-2 sm:order-1"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex gap-2 order-1 sm:order-2">
              {!isLastStep && (
                <Button variant="outline" onClick={handleSkip} size="sm" className="flex-1 sm:flex-none">
                  Skip
                </Button>
              )}
              {!isLastStep && (
                <Button variant="outline" onClick={handleNext} className="gap-2 flex-1 sm:flex-none" size="sm">
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={handleCTA} className="gap-2 flex-1 sm:flex-none" size="sm">
                <span className="truncate">{step.ctaText}</span>
                {step.ctaLink && <ChevronRightIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact banner component for showing AI features are available
export function AIFeaturesBanner() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!user) return;

    const tourSeen = localStorage.getItem(`ai-tour-seen-${user.id}`);
    const bannerDismissed = localStorage.getItem(`ai-banner-dismissed-${user.id}`);

    if (!tourSeen && !bannerDismissed) {
      setShowBanner(true);
    }
  }, [user]);

  const handleDismiss = () => {
    if (user) {
      localStorage.setItem(`ai-banner-dismissed-${user.id}`, "true");
    }
    setShowBanner(false);
    metricsService.trackFeatureUsage("ai_banner_dismissed");
  };

  const handleStartTour = () => {
    setShowBanner(false);
    setShowTour(true);
    metricsService.trackFeatureUsage("ai_tour_started_from_banner");
  };

  if (!showBanner && !showTour) return null;

  return (
    <>
      {showBanner && (
        <div className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white">
          <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="bg-white/20 rounded-full p-1.5 sm:p-2 flex-shrink-0">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm sm:text-base">
                    ✨ AI-Powered Features
                  </p>
                  <p className="text-xs sm:text-sm text-white/90 hidden sm:block">
                    Let AI help you build stronger relationships with smart insights, personalized messages, and more
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <Button
                  onClick={handleStartTour}
                  variant="secondary"
                  size="sm"
                  className="gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm h-8 sm:h-9"
                >
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Take Tour</span>
                  <span className="sm:hidden">Tour</span>
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTour && (
        <AIFeatureTour
          forceOpen={true}
          onComplete={() => setShowTour(false)}
        />
      )}
    </>
  );
}

// Hook to manually trigger the tour
export function useAIFeatureTour() {
  const [showTour, setShowTour] = useState(false);

  const startTour = () => {
    setShowTour(true);
    metricsService.trackFeatureUsage("ai_tour_manually_started");
  };

  return {
    showTour,
    startTour,
    TourComponent: showTour ? (
      <AIFeatureTour
        forceOpen={true}
        onComplete={() => setShowTour(false)}
      />
    ) : null,
  };
}
