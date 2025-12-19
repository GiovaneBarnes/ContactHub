import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Plus,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { metricsService } from "@/lib/metrics";

interface SmartGroupSuggestion {
  name: string;
  purpose: string;
  contacts: string[];
  contactIds: string[];
  contactCount: number;
  rationale: string;
}

interface SmartGroupSuggestionsProps {
  onAccept?: (suggestion: SmartGroupSuggestion) => void;
  compact?: boolean;
  autoLoad?: boolean;
}

export function SmartGroupSuggestions({ 
  onAccept, 
  compact = false,
  autoLoad = false 
}: SmartGroupSuggestionsProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch smart group suggestions
  const {
    data: suggestions,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["smartGroups"],
    queryFn: firebaseApi.smartGroups.suggestGroups,
    enabled: autoLoad,
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (suggestion: SmartGroupSuggestion) => {
      return await firebaseApi.groups.create({
        name: suggestion.name,
        description: suggestion.purpose,
        backgroundInfo: suggestion.rationale,
        contactIds: suggestion.contactIds,
        schedules: [],
        enabled: true,
      });
    },
    onSuccess: (_, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({
        title: "Group created",
        description: `"${suggestion.name}" has been created with ${suggestion.contactCount} members.`,
      });
      metricsService.trackFeatureUsage("smart_group_accepted", {
        groupName: suggestion.name,
        memberCount: suggestion.contactCount,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create group",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggleSelection = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleAcceptSuggestion = async (suggestion: SmartGroupSuggestion, index: number) => {
    if (onAccept) {
      onAccept(suggestion);
    } else {
      await createGroupMutation.mutateAsync(suggestion);
    }
    
    setAcceptedSuggestions(prev => new Set([...Array.from(prev), index]));
    setRejectedSuggestions((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const handleRejectSuggestion = (index: number) => {
    setRejectedSuggestions(prev => new Set([...Array.from(prev), index]));
    setAcceptedSuggestions((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
    
    metricsService.trackFeatureUsage("smart_group_rejected", {
      suggestionIndex: index,
    });
  };

  const handleAcceptSelected = async () => {
    if (!suggestions?.suggestedGroups) return;
    
    const selected = Array.from(selectedSuggestions)
      .filter(idx => !acceptedSuggestions.has(idx) && !rejectedSuggestions.has(idx))
      .map(idx => suggestions.suggestedGroups[idx]);

    for (const suggestion of selected) {
      await createGroupMutation.mutateAsync(suggestion);
    }

    setAcceptedSuggestions(prev => new Set([...Array.from(prev), ...selectedSuggestions]));
    setSelectedSuggestions(new Set());
    
    toast({
      title: "Groups created",
      description: `${selected.length} smart groups have been created.`,
    });
  };

  const handleRefresh = () => {
    setAcceptedSuggestions(new Set());
    setRejectedSuggestions(new Set());
    setSelectedSuggestions(new Set());
    refetch();
    metricsService.trackFeatureUsage("smart_group_refresh");
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Failed to load smart group suggestions. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", compact && "border-dashed")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analyzing your contacts...
          </CardTitle>
          <CardDescription>
            Our AI is creating smart group suggestions based on your contact network.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!suggestions?.suggestedGroups || suggestions.suggestedGroups.length === 0) {
    return (
      <Card className={cn(compact && "border-dashed")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            No Smart Groups Available
          </CardTitle>
          <CardDescription>
            Add more contacts to get AI-powered group suggestions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const visibleSuggestions = suggestions.suggestedGroups.filter(
    (_, idx) => !rejectedSuggestions.has(idx)
  );

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Smart Group Suggestions
              </CardTitle>
              <CardDescription>
                AI-powered group recommendations based on your {suggestions.suggestedGroups.length} contacts
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        {suggestions.insights && (
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{suggestions.insights}</AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {selectedSuggestions.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">
                {selectedSuggestions.size} group{selectedSuggestions.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSuggestions(new Set())}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleAcceptSelected}
                  disabled={createGroupMutation.isPending}
                  className="gap-2"
                >
                  {createGroupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={cn(
        "grid gap-4",
        compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {visibleSuggestions.map((suggestion, index) => {
          const isAccepted = acceptedSuggestions.has(index);
          const isSelected = selectedSuggestions.has(index);
          
          return (
            <Card
              key={index}
              className={cn(
                "group transition-all duration-200 hover:shadow-lg",
                isSelected && "ring-2 ring-primary",
                isAccepted && "opacity-60 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="line-clamp-1">{suggestion.name}</span>
                  </div>
                  {isAccepted && (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {suggestion.purpose}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {suggestion.contactCount} member{suggestion.contactCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
                  <p className="font-medium mb-1">Why this grouping:</p>
                  <p className="line-clamp-3">{suggestion.rationale}</p>
                </div>

                {suggestion.contacts.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Members:</p>
                    <p className="line-clamp-2">
                      {suggestion.contacts.slice(0, 3).join(", ")}
                      {suggestion.contacts.length > 3 && ` +${suggestion.contacts.length - 3} more`}
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex gap-2">
                {isAccepted ? (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    disabled
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Created
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => handleRejectSuggestion(index)}
                    >
                      <XCircle className="h-4 w-4" />
                      Skip
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => handleAcceptSuggestion(suggestion, index)}
                      disabled={createGroupMutation.isPending}
                    >
                      {createGroupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Create
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {visibleSuggestions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">All suggestions reviewed</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You've reviewed all smart group suggestions.
            </p>
            <Button onClick={handleRefresh} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Generate New Suggestions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
