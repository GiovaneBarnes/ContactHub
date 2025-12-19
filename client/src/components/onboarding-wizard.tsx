import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { useAuth } from "@/lib/auth-context";
import { Contact, Group } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  UserPlus,
  Sparkles,
  Calendar,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  PartyPopper,
  Zap,
  Users,
  MessageSquare,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { metricsService } from "@/lib/metrics";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step 1: Contact Creation State
  const [contactMethod, setContactMethod] = useState<"manual" | "import" | null>(null);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Step 2: Group Creation State
  const [groupName, setGroupName] = useState("");
  const [groupPurpose, setGroupPurpose] = useState("");
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<any>(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Step 3: AI Message Generation State
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdContactId, setCreatedContactId] = useState<string | null>(null);

  // Step 4: Schedule Setup State
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Call onComplete when all steps are completed
  useEffect(() => {
    if (completedSteps.size === 4 && onComplete) {
      handleComplete();
    }
  }, [completedSteps.size, onComplete]);

  // Fetch existing groups for Step 3
  const { data: groups } = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: firebaseApi.groups.list,
    enabled: !!user && step === 3,
  });

  // Fetch smart group suggestions
  const smartGroupsQuery = useQuery({
    queryKey: ["smartGroups"],
    queryFn: firebaseApi.smartGroups.suggestGroups,
    enabled: showSmartSuggestions && step === 2,
  });

  // Track wizard progress
  useEffect(() => {
    if (open) {
      metricsService.trackFeatureUsage("onboarding_wizard_started");
    }
  }, [open]);

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contact: Omit<Contact, "id">) => {
      const createdContact = await firebaseApi.contacts.create(contact);
      return createdContact;
    },
    onSuccess: (contact) => {
      setCreatedContactId(contact.id);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setCompletedSteps((prev) => new Set([...prev, 1]));
      toast({
        title: "Contact created! 🎉",
        description: "Your first contact has been added.",
      });
      metricsService.trackFeatureUsage("onboarding_contact_created");
    },
    onError: () => {
      toast({
        title: "Failed to create contact",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create starter group mutation
  const createGroupMutation = useMutation({
    mutationFn: async ({ name, contactIds }: { name: string; contactIds: string[] }) => {
      return await firebaseApi.groups.create({
        name,
        description: "My first group created during onboarding",
        backgroundInfo: "A starter group for learning ContactHub. Feel free to customize this group's purpose and add more contacts!",
        contactIds,
        schedules: [],
        enabled: true,
      });
    },
    onSuccess: (group) => {
      setCreatedGroupId(group.id);
      setSelectedGroupId(group.id);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({
        title: "Starter group created! 🎉",
        description: "Now let's generate an AI message.",
      });
    },
  });

  // Import contacts mutation
  const importContactsMutation = useMutation({
    mutationFn: async (contacts: Omit<Contact, "id">[]) => {
      const results = [];
      for (const contact of contacts) {
        try {
          const result = await firebaseApi.contacts.create(contact);
          results.push(result);
        } catch (error) {
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setCompletedSteps((prev) => new Set([...prev, 1]));
      toast({
        title: `Successfully imported ${results.length} contacts! 🎉`,
      });
      metricsService.trackFeatureUsage("onboarding_contacts_imported", {
        count: results.length,
      });
    },
  });

  // Generate AI message mutation
  const generateMessageMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return await firebaseApi.ai.generateMessage(groupId);
    },
    onSuccess: (message) => {
      setGeneratedMessage(message);
      setCompletedSteps((prev) => new Set([...prev, 3]));
      toast({
        title: "Message generated! ✨",
        description: "AI created a personalized message for you.",
      });
      metricsService.trackFeatureUsage("onboarding_message_generated");
    },
    onError: (error) => {
      toast({
        title: "Failed to generate message",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Schedule message mutation
  const scheduleMessageMutation = useMutation({
    mutationFn: async ({
      groupId,
      message,
      date,
      time,
    }: {
      groupId: string;
      message: string;
      date: string;
      time: string;
    }) => {
      const schedule = {
        type: "one-time" as const,
        message: message,
        startDate: date,
        startTime: time,
        enabled: true,
      };
      return await firebaseApi.groups.createSchedule(groupId, schedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setCompletedSteps((prev) => new Set([...prev, 4]));
      toast({
        title: "Message scheduled! 📅",
        description: "Your message will be sent automatically.",
      });
      metricsService.trackFeatureUsage("onboarding_message_scheduled");
    },
    onError: () => {
      toast({
        title: "Failed to schedule message",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateContact = async () => {
    if (!newContact.name || !newContact.email || !newContact.phone) {
      toast({
        title: "Missing required fields",
        description: "Please fill in name, email, and phone.",
        variant: "destructive",
      });
      return;
    }

    try {
      const contact = await createContactMutation.mutateAsync(newContact as Omit<Contact, "id">);
      setStep(2);
    } catch (error) {
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a name for your group.",
        variant: "destructive",
      });
      return;
    }

    try {
      const contactIds = createdContactId ? [createdContactId] : [];
      await createGroupMutation.mutateAsync({
        name: groupName,
        contactIds,
      });
      setCompletedSteps((prev) => new Set([...prev, 2]));
      setStep(3);
    } catch (error) {
    }
  };

  const handleImportContacts = async () => {
    if (!importFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((line) => line.trim());

      // Parse CSV header
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const phoneIdx = headers.findIndex((h) => h.includes("phone"));

      if (nameIdx === -1 || emailIdx === -1) {
        throw new Error("CSV must have name and email columns");
      }

      const contacts = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        return {
          name: values[nameIdx] || "",
          email: values[emailIdx] || "",
          phone: phoneIdx !== -1 ? values[phoneIdx] || "" : "",
          notes: "",
        };
      });

      const importedContacts = await importContactsMutation.mutateAsync(contacts);
      
      // Create a starter group with imported contacts
      if (importedContacts.length > 0) {
        await createGroupMutation.mutateAsync({
          name: "Imported Contacts",
          contactIds: importedContacts.map(c => c.id),
        });
      }
      
      setStep(2);
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Please check your CSV format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerateMessage = async () => {
    // Use created group or selected group
    const groupId = createdGroupId || selectedGroupId;
    
    if (!groupId) {
      toast({
        title: "No group available",
        description: "Please create a contact first or select an existing group.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateMessageMutation.mutateAsync(groupId);
    } catch (error) {
    } finally {
      setIsGenerating(false);
    }
  };

  const handleScheduleMessage = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast({
        title: "Missing schedule details",
        description: "Please select a date and time.",
        variant: "destructive",
      });
      return;
    }

    const groupId = createdGroupId || selectedGroupId;
    if (!groupId) {
      toast({
        title: "No group available",
        description: "Please go back and create a contact first.",
        variant: "destructive",
      });
      return;
    }

    await scheduleMessageMutation.mutateAsync({
      groupId,
      message: generatedMessage,
      date: scheduleDate,
      time: scheduleTime,
    });
  };

  const handleSkipStep = () => {
    // Mark current step as completed when skipping
    setCompletedSteps(prev => new Set([...prev, step]));
    
    if (step < 4) {
      const nextStep = (step + 1) as Step;
      setStep(nextStep);
      metricsService.trackFeatureUsage("onboarding_step_skipped", {
        skippedStep: step,
      });
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    metricsService.trackFeatureUsage("onboarding_wizard_completed", {
      completedSteps: Array.from(completedSteps),
    });
    onComplete();
  };

  const progress = (completedSteps.size / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
      >
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-xs">
              Step {step} of 4
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-display">
            {step === 1 && "Welcome to ContactHub! 🎉"}
            {step === 2 && "Create Your First Group 👥"}
            {step === 3 && "Experience AI Magic ✨"}
            {step === 4 && "Schedule Your First Message 📅"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 &&
              "Let's get started by adding your first contact. You can import from CSV or create manually."}
            {step === 2 &&
              "Now let's create a group to organize your contacts. Groups help you send targeted messages."}
            {step === 3 &&
              "Now let's see how AI can craft perfect messages for your contacts automatically."}
            {step === 4 &&
              "Finally, schedule your message to be sent at the perfect time."}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="mb-6" />

        {/* STEP 1: Add Contact */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg hover:scale-105",
                  contactMethod === "manual" &&
                    "ring-2 ring-primary shadow-lg scale-105"
                )}
                onClick={() => setContactMethod("manual")}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-40">
                  <UserPlus className="h-10 w-10 mb-3 text-primary" />
                  <h3 className="font-semibold mb-1">Create Manually</h3>
                  <p className="text-xs text-muted-foreground">
                    Add one contact to get started
                  </p>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg hover:scale-105",
                  contactMethod === "import" &&
                    "ring-2 ring-primary shadow-lg scale-105"
                )}
                onClick={() => setContactMethod("import")}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-40">
                  <Upload className="h-10 w-10 mb-3 text-primary" />
                  <h3 className="font-semibold mb-1">Import CSV</h3>
                  <p className="text-xs text-muted-foreground">
                    Bulk import your contacts
                  </p>
                </CardContent>
              </Card>
            </div>

            {contactMethod === "manual" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newContact.name}
                    onChange={(e) =>
                      setNewContact({ ...newContact, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={newContact.email}
                      onChange={(e) =>
                        setNewContact({ ...newContact, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1234567890"
                      value={newContact.phone}
                      onChange={(e) =>
                        setNewContact({ ...newContact, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional but Recommended)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this contact..."
                    value={newContact.notes}
                    onChange={(e) =>
                      setNewContact({ ...newContact, notes: e.target.value })
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Adding notes helps our AI better understand your relationships and generate more personalized messages.
                  </p>
                </div>
              </div>
            )}

            {contactMethod === "import" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer text-primary hover:underline"
                  >
                    {importFile ? importFile.name : "Click to upload CSV file"}
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    CSV should have columns: name, email, phone
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={handleSkipStep}>
                Skip for now
              </Button>
              <Button
                onClick={
                  contactMethod === "manual"
                    ? handleCreateContact
                    : handleImportContacts
                }
                disabled={
                  !contactMethod ||
                  (contactMethod === "manual" &&
                    (!newContact.name ||
                      !newContact.email ||
                      !newContact.phone)) ||
                  (contactMethod === "import" && !importFile) ||
                  createContactMutation.isPending ||
                  isImporting
                }
              >
                {createContactMutation.isPending || isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Create Group */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Organize Your Contacts</h3>
                  <p className="text-sm text-muted-foreground">
                    Groups help you send targeted messages to specific sets of contacts.
                    Let's create your first group.
                  </p>
                </div>
              </div>
            </div>

            {!showSmartSuggestions ? (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowSmartSuggestions(true)}
                    className="flex-1"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get AI Suggestions
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSmartSuggestions(false)}
                    className="flex-1"
                  >
                    Create Manually
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {smartGroupsQuery.isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Analyzing your contacts to suggest optimal groups...
                    </p>
                  </div>
                ) : smartGroupsQuery.data ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        AI Group Suggestions
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {smartGroupsQuery.data.insights}
                      </p>
                      <div className="space-y-3">
                        {smartGroupsQuery.data.suggestedGroups.map((group: any, index: number) => (
                          <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium">{group.name}</h5>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {group.purpose}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {group.contactCount} contacts • {group.rationale}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setGroupName(group.name);
                                    setGroupPurpose(group.purpose);
                                    setShowSmartSuggestions(false);
                                  }}
                                >
                                  Use This
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setShowSmartSuggestions(false)}
                      className="w-full"
                    >
                      Create Custom Group Instead
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      Unable to generate suggestions. Try creating a group manually.
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() => setShowSmartSuggestions(false)}
                      className="mt-4"
                    >
                      Create Manually
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!showSmartSuggestions && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group Name</Label>
                  <Input
                    id="group-name"
                    placeholder="e.g., Friends, Family, Work Colleagues"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">
                    ⚠️ Note: Group names may appear in email communications to recipients.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group-purpose">Group Purpose (Optional)</Label>
                  <Textarea
                    id="group-purpose"
                    placeholder="e.g., Long-time friends I check in with occasionally"
                    value={groupPurpose}
                    onChange={(e) => setGroupPurpose(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This helps AI generate more personalized messages for this group.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || createGroupMutation.isPending}
              >
                {createGroupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Group...
                  </>
                ) : (
                  <>
                    Create Group
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: AI Message Generation */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">AI-Powered Messaging</h3>
                  <p className="text-sm text-muted-foreground">
                    Our AI understands your group context and crafts personalized
                    messages that resonate with your audience. Let's try it!
                  </p>
                </div>
              </div>
            </div>

            {createdGroupId ? (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium">Your starter group is ready!</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  We created a group with your contact. Now let's generate a message.
                </p>
              </div>
            ) : groups && groups.length > 0 ? (
              <div>
                <Label htmlFor="group-select">Select a Group</Label>
                <Select
                  value={selectedGroupId}
                  onValueChange={setSelectedGroupId}
                >
                  <SelectTrigger id="group-select">
                    <SelectValue placeholder="Choose a group to message..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group: Group) => (
                      <SelectItem key={group.id} value={group.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {group.name}
                          <Badge variant="outline" className="text-xs ml-2">
                            {group.contactIds?.length || 0} contacts
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select an existing group or go back to create one.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      No groups available yet
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      You'll need to create a group first before generating AI messages. 
                      You can go back to Step 2 or skip for now and create groups later.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(createdGroupId || selectedGroupId) && !generatedMessage && (
              <Button
                onClick={handleGenerateMessage}
                disabled={isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating with AI...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Generate AI Message
                  </>
                )}
              </Button>
            )}

            {generatedMessage && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Label>Generated Message</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg border">
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Message Generated Successfully!
                      </p>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{generatedMessage}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ✨ This message was crafted by AI based on your group's context
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                disabled={createContactMutation.isPending}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkipStep}>
                  Skip for now
                </Button>
                <Button
                  onClick={() => {
                    setCompletedSteps((prev) => new Set([...prev, 3]));
                    setStep(4);
                  }}
                  disabled={Boolean((createdGroupId || selectedGroupId) && !generatedMessage)}
                >
                  {generatedMessage ? "Continue" : "Skip to Scheduling"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Schedule Message */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Smart Scheduling</h3>
                  <p className="text-sm text-muted-foreground">
                    Schedule your message to be sent automatically at the perfect
                    time. Set it and forget it!
                  </p>
                </div>
              </div>
            </div>

            {generatedMessage && (
              <div>
                <Label>Your Message</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      PREVIEW
                    </span>
                  </div>
                  <p className="text-sm line-clamp-3">{generatedMessage}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="schedule-date">Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div>
                <Label htmlFor="schedule-time">Time</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            {scheduleDate && scheduleTime && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm">
                  <strong>Scheduled for:</strong>{" "}
                  {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(3)}
                disabled={scheduleMessageMutation.isPending}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleComplete}>
                  Skip for now
                </Button>
                <Button
                  onClick={() => {
                    if (scheduleDate && scheduleTime) {
                      handleScheduleMessage();
                    } else {
                      // If user clicks without filling form, just complete
                      handleComplete();
                    }
                  }}
                  disabled={scheduleMessageMutation.isPending}
                >
                  {scheduleMessageMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <PartyPopper className="mr-2 h-4 w-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Completion celebration */}
        {completedSteps.size === 4 && (
          <div className="mt-4 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-lg border border-green-200 dark:border-green-800 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <PartyPopper className="h-12 w-12 mx-auto mb-3 text-green-600" />
            <h3 className="font-semibold text-lg mb-2">
              Congratulations! 🎉
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              You've completed the onboarding and your first scheduled message is
              ready to go!
            </p>
            <Button onClick={handleComplete} size="lg">
              Start Using ContactHub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
