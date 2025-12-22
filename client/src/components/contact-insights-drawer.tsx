import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Contact } from "@/lib/types";
import { firebaseApi } from "@/lib/firebase-api";
import { useAuth } from "@/lib/auth-context";
import { formatInUserTimezone, formatScheduleTime, parseToUserTimezone } from "@/lib/timezone-utils";
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  Mail,
  Phone,
  RefreshCcw,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactInsightsDrawerProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const infoChips = (items: string[] | undefined, variant: "category" | "tag") => {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, 6).map((item) => (
        <Badge
          key={`${variant}-${item}`}
          variant={variant === "category" ? "secondary" : "outline"}
          className={cn(
            "text-xs",
            variant === "category"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
              : "border-dashed"
          )}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
};

export function ContactInsightsDrawer({ contact, open, onOpenChange }: ContactInsightsDrawerProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const contactId = contact?.id;

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const summaryQuery = useQuery({
    queryKey: ["contact", contactId, "summary"],
    queryFn: async () => {
      if (!contactId) throw new Error("Missing contact context");
      try {
        const result = await firebaseApi.ai.generateContactSummary(contactId);
        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: open && !!contactId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });

  const patternsQuery = useQuery({
    queryKey: ["contact", contactId, "communication"],
    queryFn: async () => {
      if (!contactId) throw new Error("Missing contact context");
      try {
        const result = await firebaseApi.ai.analyzeCommunicationPatterns(contactId);
        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: open && !!contactId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });

  const timingQuery = useQuery({
    queryKey: ["contact", contactId, "timing"],
    queryFn: async () => {
      if (!contactId) throw new Error("Missing contact context");
      try {
        const result = await firebaseApi.ai.suggestContactTime(contactId);
        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: open && !!contactId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });

  const isLoading = summaryQuery.isLoading || patternsQuery.isLoading || timingQuery.isLoading;

  const lastContactLabel = useMemo(() => {
    if (!contact?.lastContact) return "No recent activity";
    try {
      return formatInUserTimezone(contact.lastContact, 'MMM d, yyyy zzz', user?.timezone);
    } catch (error) {
      return contact.lastContact;
    }
  }, [contact?.lastContact, user?.timezone]);

  // Format timing recommendation with actual date/time in user's CURRENT timezone
  const formatTimingRecommendation = (recommendation: string): { date: string; time: string; full: string } => {
    try {
      // Parse common patterns like "Next business day, 9 AM" or "Tomorrow 2 PM"
      const now = new Date();
      let targetDate = new Date();
      let targetHour = 9; // default

      // Extract time
      const timeMatch = recommendation.match(/(\d{1,2})\s*(AM|PM|am|pm)/i);
      if (timeMatch) {
        targetHour = parseInt(timeMatch[1]);
        const isPM = timeMatch[2].toLowerCase() === 'pm';
        if (isPM && targetHour !== 12) targetHour += 12;
        if (!isPM && targetHour === 12) targetHour = 0;
      }

      // Extract day
      if (/tomorrow/i.test(recommendation)) {
        targetDate.setDate(now.getDate() + 1);
      } else if (/next.*day|business day/i.test(recommendation)) {
        targetDate.setDate(now.getDate() + 1);
        // Skip to next weekday if needed
        while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
      } else if (/friday/i.test(recommendation)) {
        const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
        targetDate.setDate(now.getDate() + daysUntilFriday);
      } else if (/monday/i.test(recommendation)) {
        const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7;
        targetDate.setDate(now.getDate() + daysUntilMonday);
      }

      targetDate.setHours(targetHour, 0, 0, 0);

      // Format in user's CURRENT timezone
      const userTimezone = user?.timezone;
      const dateStr = formatInUserTimezone(targetDate.toISOString(), 'EEE, MMM d', userTimezone);
      const timeStr = formatInUserTimezone(targetDate.toISOString(), 'h:mm a zzz', userTimezone);
      const fullStr = formatInUserTimezone(targetDate.toISOString(), 'EEEE, MMMM d', userTimezone) + ' at ' + timeStr;

      return {
        date: dateStr,
        time: timeStr,
        full: fullStr
      };
    } catch (error) {
      return { date: '', time: '', full: recommendation };
    }
  };

  const handleRefresh = () => {
    summaryQuery.refetch();
    patternsQuery.refetch();
    timingQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const handleCopySummary = async () => {
    if (!summaryQuery.data) return;
    try {
      await navigator.clipboard.writeText(summaryQuery.data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
    }
  };

  const hasErrors = summaryQuery.isError || patternsQuery.isError || timingQuery.isError;
  
  const errorMessages = [
    summaryQuery.error && `Summary: ${(summaryQuery.error as Error).message}`,
    patternsQuery.error && `Patterns: ${(patternsQuery.error as Error).message}`,
    timingQuery.error && `Timing: ${(timingQuery.error as Error).message}`,
  ].filter(Boolean);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh] border-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
        <div className="relative flex h-full max-h-[92vh] flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-slate-950/60 backdrop-blur-xl">
          <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden>
            <div className="absolute -left-20 top-4 h-64 w-64 rounded-full bg-purple-500/30 blur-3xl" />
            <div className="absolute -right-10 bottom-10 h-56 w-56 rounded-full bg-blue-500/30 blur-3xl" />
          </div>

          <div className="relative flex items-start justify-between px-6 pt-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
                <Sparkles className="h-3 w-3 text-purple-300" />
                Relationship Intelligence
              </div>
              <h2 className="mt-4 text-3xl font-display font-semibold text-white">
                {contact?.name || "Contact Insights"}
              </h2>
              <p className="mt-1 text-sm text-white/70">
                {contact?.email}
                {contact?.phone ? ` · ${contact.phone}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <Clock className="h-3 w-3" />
                  {lastContactLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <Mail className="h-3 w-3" />
                  {contact?.communicationStyle || "Standard"}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {infoChips(contact?.aiCategories, "category")}
                {infoChips(contact?.aiTags, "tag")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading} className="text-white/60 hover:text-white">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              </Button>
              <Button variant="secondary" size="icon" onClick={() => onOpenChange(false)}>
                <TimerReset className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator className="mt-4 border-white/10" />

          {hasErrors && (
            <div className="relative px-6 pt-4">
              <Alert variant="destructive" className="border-red-400/40 bg-red-500/10 text-red-100">
                <AlertDescription>
                  <div>Unable to load some AI insights. Please check the console for details and try refreshing.</div>
                  {errorMessages.length > 0 && (
                    <ul className="mt-2 text-xs space-y-1">
                      {errorMessages.map((msg, i) => (
                        <li key={i}>• {msg}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="relative flex-1 overflow-y-auto px-6 pb-16 pt-6">
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="col-span-2 border-white/10 bg-white/5 text-white shadow-2xl shadow-purple-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Brain className="h-5 w-5 text-purple-300" />
                      Relationship Briefing
                    </CardTitle>
                    <p className="text-sm text-white/70">A living dossier powered by your messages.</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySummary}
                    disabled={!summaryQuery.data}
                    className="text-white/80 hover:text-white"
                  >
                    {copied ? (
                      <>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {summaryQuery.isLoading ? (
                    <div className="space-y-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                      <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-white/80">
                      {summaryQuery.data ? (
                        summaryQuery.data.split('\n').map((line, i) => {
                          // Handle bold text
                          const boldText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                          // Handle bullet points
                          if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
                            return <div key={i} className="flex gap-2 my-1"><span>•</span><span dangerouslySetInnerHTML={{ __html: boldText.replace(/^[-•]\s*/, '') }} /></div>;
                          }
                          // Handle numbered lists
                          if (/^\d+\./.test(line.trim())) {
                            return <div key={i} className="flex gap-2 my-1"><span>{line.match(/^\d+\./)?.[0]}</span><span dangerouslySetInnerHTML={{ __html: boldText.replace(/^\d+\.\s*/, '') }} /></div>;
                          }
                          // Regular paragraphs
                          if (line.trim()) {
                            return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: boldText }} />;
                          }
                          return <br key={i} />;
                        })
                      ) : (
                        "We need at least one interaction to build a briefing."
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-gradient-to-br from-blue-600/30 via-slate-900/90 to-slate-900 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <CalendarDays className="h-5 w-5" />
                    Best Moment to Reach Out
                  </CardTitle>
                  <p className="text-xs text-white/70">Based on timezone + response streaks</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {timingQuery.isLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                    </div>
                  ) : timingQuery.data ? (
                    <>
                      {(() => {
                        const formatted = formatTimingRecommendation(timingQuery.data.recommendedTime || "When you are ready");
                        return (
                          <div>
                            <p className="text-sm text-white/70">Recommended Window</p>
                            {formatted.date && formatted.time ? (
                              <div className="space-y-1">
                                <p className="text-2xl font-bold text-white">{formatted.date}</p>
                                <p className="text-lg text-purple-300">{formatted.time}</p>
                              </div>
                            ) : (
                              <p className="text-xl font-semibold text-white">{formatted.full}</p>
                            )}
                          </div>
                        );
                      })()}
                      <p className="text-sm text-white/80">{timingQuery.data.reasoning}</p>
                      {timingQuery.data.alternatives?.length ? (
                        <div className="text-xs text-white/70">
                          <span className="font-medium">Alternates:</span> {timingQuery.data.alternatives.map(alt => {
                            const formatted = formatTimingRecommendation(alt);
                            return formatted.date && formatted.time ? `${formatted.date} ${formatted.time}` : alt;
                          }).join(", ")}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-white/60">Not enough history yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <Card className="col-span-2 border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Phone className="h-5 w-5" />
                    Communication Rhythm
                  </CardTitle>
                  <p className="text-xs text-white/70">Powered by your recent message logs</p>
                </CardHeader>
                <CardContent>
                  {patternsQuery.isLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                      <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                    </div>
                  ) : patternsQuery.data ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          <Clock className="h-3 w-3" />
                          {patternsQuery.data.frequency || "No cadence yet"}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          <Mail className="h-3 w-3" />
                          {patternsQuery.data.preferredMethod || "Mixed"}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          <Sparkles className="h-3 w-3" />
                          Next touch: {patternsQuery.data.nextContactSuggestion || "Flexible"}
                        </span>
                      </div>
                      <Separator className="border-white/10" />
                      <div className="space-y-2">
                        {patternsQuery.data.insights?.length ? (
                          patternsQuery.data.insights.map((insight, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm text-white/80">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                              <span>{insight}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-white/60">Send a message to unlock insights.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">Need more signals to analyze patterns.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Sparkles className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                  <p className="text-xs text-white/70">Stay proactive without leaving this view</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start gap-3 border border-white/20 bg-transparent text-left text-white shadow-none hover:border-white/40"
                    variant="outline"
                    onClick={() => handleRefresh()}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Refresh AI insights
                  </Button>
                  <Button
                    className="w-full justify-start gap-3 border border-white/20 bg-transparent text-left text-white shadow-none hover:border-white/40"
                    variant="outline"
                    asChild
                  >
                    <a href={`mailto:${contact?.email || ""}`}>Compose quick email</a>
                  </Button>
                  {contact?.phone && (
                    <Button
                      className="w-full justify-start gap-3 border border-white/20 bg-transparent text-left text-white shadow-none hover:border-white/40"
                      variant="outline"
                      asChild
                    >
                      <a href={`tel:${contact.phone}`}>Call now</a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default ContactInsightsDrawer;
