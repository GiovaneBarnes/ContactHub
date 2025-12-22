import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { useAuth } from "@/lib/auth-context";
import { formatWithTimezone } from "@/lib/timezone-utils";
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
  Mail,
  Phone,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { metricsService } from "@/lib/metrics";
import { DEMO_CONTACTS } from "@/lib/demo-data";
import { GoogleContactsIntegration, formatContactCount } from "@/lib/google-contacts";
import { VCardParser, isVCardFile } from "@/lib/vcard-parser";

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
  const [contactMethod, setContactMethod] = useState<"manual" | "demo" | "google" | "apple" | null>(null);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [googlePreview, setGooglePreview] = useState<{ count: number; preview: any[] } | null>(null);

  // Step 2: Group Creation State
  const [groupName, setGroupName] = useState("");
  const [groupPurpose, setGroupPurpose] = useState("");
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<any>(null);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

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
    if (completedSteps.size === 4) {
      handleComplete();
    }
  }, [completedSteps.size]);

  // Fetch contacts for Step 2 (group creation)
  const { data: contacts } = useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: firebaseApi.contacts.list,
    enabled: !!user && (step === 2 || step === 3),
  });

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
      setSelectedContactIds([contact.id]); // Auto-select the created contact
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
      console.log(`[ImportMutation] Starting import of ${contacts.length} contacts`);
      const results = [];
      const errors = [];
      
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        try {
          console.log(`[ImportMutation] Creating contact ${i + 1}/${contacts.length}: ${contact.name}`);
          const result = await firebaseApi.contacts.create(contact);
          console.log(`[ImportMutation] Success: ${contact.name} -> ID: ${result.id}`);
          results.push(result);
        } catch (error: any) {
          console.error(`[ImportMutation] Failed to create contact ${contact.name}:`, error);
          console.error(`[ImportMutation] Contact data:`, JSON.stringify(contact, null, 2));
          errors.push({ contact: contact.name, error: error.message });
        }
      }
      
      console.log(`[ImportMutation] Import complete. Success: ${results.length}, Failed: ${errors.length}`);
      if (errors.length > 0) {
        console.error(`[ImportMutation] Errors:`, errors);
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
      // Use selected contacts, or fallback to created contact from step 1
      let contactIds = selectedContactIds;
      if (contactIds.length === 0 && createdContactId) {
        contactIds = [createdContactId];
      }
      
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
        description: "Please select a file to import.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      let contacts: Omit<Contact, "id">[] = [];

      // Check if it's a vCard file
      if (isVCardFile(importFile)) {
        console.log("[FileImport] Parsing vCard file...");
        contacts = await VCardParser.parseFile(importFile);
        console.log(`[FileImport] Parsed ${contacts.length} contacts from vCard`);
      } else {
        // Parse as CSV
        console.log("[FileImport] Parsing CSV file...");
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

        contacts = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          return {
            name: values[nameIdx] || "",
            email: values[emailIdx] || "",
            phone: phoneIdx !== -1 ? values[phoneIdx] || "" : "",
            notes: "",
          };
        });
        console.log(`[FileImport] Parsed ${contacts.length} contacts from CSV`);
      }

      const importedContacts = await importContactsMutation.mutateAsync(contacts);
      
      // Auto-select imported contacts for group creation
      if (importedContacts.length > 0) {
        setSelectedContactIds(importedContacts.map(c => c.id));
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

  const handleDemoMode = async () => {
    setIsImporting(true);
    try {
      // Import demo contacts
      const demoContactsData = DEMO_CONTACTS.map(contact => ({
        ...contact,
        notes: `[DEMO] ${contact.notes}`,
      }));

      const importedContacts = await importContactsMutation.mutateAsync(demoContactsData);
      
      // Auto-select all demo contacts
      if (importedContacts.length > 0) {
        setSelectedContactIds(importedContacts.map(c => c.id));
      }
      
      toast({
        title: "Demo contacts loaded! 🎉",
        description: `Added ${importedContacts.length} sample contacts. You can delete these anytime and add your own.`,
      });
      
      metricsService.trackFeatureUsage("onboarding_demo_mode_activated");
      
      setStep(2);
    } catch (error) {
      toast({
        title: "Failed to load demo",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleGoogleImport = async () => {
    setIsImporting(true);
    try {
      console.log("[GoogleImport] Step 1: Starting OAuth authentication...");
      
      // Import contacts from Google
      const googleContacts = await GoogleContactsIntegration.importContacts();
      console.log(`[GoogleImport] Step 2: Fetched ${googleContacts.length} contacts from Google`);
      
      if (googleContacts.length === 0) {
        toast({
          title: "No contacts found",
          description: "Your Google account has no contacts to import.",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      console.log("[GoogleImport] Step 3: Saving contacts to Firestore...");
      console.log("[GoogleImport] Sample contact:", JSON.stringify(googleContacts[0], null, 2));
      
      // Import to Firebase
      const importedContacts = await importContactsMutation.mutateAsync(googleContacts);
      console.log(`[GoogleImport] Step 4: Successfully saved ${importedContacts.length} contacts`);
      
      // Auto-select imported contacts
      if (importedContacts.length > 0) {
        setSelectedContactIds(importedContacts.map(c => c.id));
      }
      
      toast({
        title: "Google Contacts imported! 🎉",
        description: `Successfully imported ${importedContacts.length} contacts from your Google account.`,
      });
      
      metricsService.trackFeatureUsage("onboarding_google_import_completed", {
        count: importedContacts.length,
      });
      
      setStep(2);
    } catch (error: any) {
      console.error("[GoogleImport] ERROR:", error);
      console.error("[GoogleImport] Error stack:", error.stack);
      console.error("[GoogleImport] Error code:", error.code);
      console.error("[GoogleImport] Error details:", JSON.stringify(error, null, 2));
      
      toast({
        title: "Import failed",
        description: error.message || "Failed to import Google contacts. Please try again.",
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
        className="max-w-3xl [&>button]:hidden"
      >
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-xs">
              Step {step} of 4
            </Badge>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-display">
            {step === 1 && "Welcome to ContactHub! 🎉"}
            {step === 2 && "Create Your First Group 👥"}
            {step === 3 && "Experience AI Magic ✨"}
            {step === 4 && "Schedule Your First Message 📅"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === 1 &&
              "Try our demo to see ContactHub in action instantly, or add your own contacts to get started."}
            {step === 2 &&
              "Now let's create a group to organize your contacts. Groups help you send targeted messages."}
            {step === 3 &&
              "Now let's see how AI can craft perfect messages for your contacts automatically."}
            {step === 4 &&
              "Finally, schedule your message to be sent at the perfect time."}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="mb-4 sm:mb-6" />

        {/* STEP 1: Add Contact */}
        {step === 1 && (
          <div className="space-y-4 sm:space-y-6">
            {/* Highlight Demo Mode */}
            <Card
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg border-2",
                contactMethod === "demo"
                  ? "ring-2 ring-primary shadow-lg border-primary bg-primary/5"
                  : "border-primary/20 hover:border-primary/40"
              )}
              onClick={() => setContactMethod("demo")}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">Try Demo Mode</h3>
                      <Badge className="bg-green-500 hover:bg-green-600">Recommended</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      See ContactHub in action with 8 sample contacts. Experience AI messaging,
                      smart groups, and scheduling instantly - no setup required!
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>See value in 60 seconds</span>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Switch to real contacts anytime</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or add your own contacts
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto">
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                  contactMethod === "google" &&
                    "ring-2 ring-primary shadow-lg scale-[1.02]"
                )}
                onClick={() => setContactMethod("google")}
              >
                <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6 text-center h-32 sm:h-40">
                  <div className="relative mb-2 sm:mb-3">
                    <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-0.5">
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1 text-sm sm:text-base">Google Contacts</h3>
                  <p className="text-xs text-muted-foreground">
                    Android • Gmail • One-click import
                  </p>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                  contactMethod === "apple" &&
                    "ring-2 ring-primary shadow-lg scale-[1.02]"
                )}
                onClick={() => setContactMethod("apple")}
              >
                <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6 text-center h-32 sm:h-40">
                  <div className="relative mb-2 sm:mb-3">
                    <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-0.5">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1 text-sm sm:text-base">Apple Contacts</h3>
                  <p className="text-xs text-muted-foreground">
                    iPhone • Mac • Export & upload
                  </p>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                  contactMethod === "manual" &&
                    "ring-2 ring-primary shadow-lg scale-[1.02]"
                )}
                onClick={() => setContactMethod("manual")}
              >
                <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6 text-center h-32 sm:h-40">
                  <UserPlus className="h-10 w-10 mb-3 text-primary" />
                  <h3 className="font-semibold mb-1">Create Manually</h3>
                  <p className="text-xs text-muted-foreground">
                    Add one contact to get started
                  </p>
                </CardContent>
              </Card>
            </div>

            {contactMethod === "google" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-500/10 p-3 rounded-full">
                      <svg className="h-8 w-8" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">Import from Google Contacts</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Sign in with Google to import all your contacts instantly. We'll only access your contacts - nothing else.
                      </p>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Secure OAuth - we never see your password</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>Imports names, emails, phones, and notes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>One-time import - we don't store Google credentials</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900 dark:text-blue-100">Limited Beta Access</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Google Contacts import is currently in beta with limited slots (100 test users). 
                        <strong> Interested in early access?</strong> Email us at{" "}
                        <a href="mailto:contacthubwebapp@gmail.com?subject=Google Contacts Beta Access Request" className="underline font-medium hover:text-blue-900 dark:hover:text-blue-200">
                          contacthubwebapp@gmail.com
                        </a>
                        {" "}to request access.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900 dark:text-amber-100">What happens next?</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        You'll see a Google sign-in popup. Select your account, grant permission to read contacts, and we'll import them automatically. Takes about 10 seconds for 100 contacts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {contactMethod === "apple" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex items-start gap-4">
                    <div className="bg-gray-500/10 p-3 rounded-full">
                      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">Export from Apple Contacts</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Export your contacts as a vCard file from your iPhone or Mac, then upload it here. Takes less than 2 minutes!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <h4 className="font-semibold text-sm">From iPhone/iPad</h4>
                    </div>
                    <ol className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">1.</span>
                        <span>Open the <strong>Contacts</strong> app on your iPhone</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">2.</span>
                        <span>Tap <strong>Lists</strong> at the top left</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">3.</span>
                        <span>Tap and hold on <strong>All Contacts</strong> or <strong>All iCloud</strong></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">4.</span>
                        <span>Tap <strong>Export</strong> from the menu</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">5.</span>
                        <span>Choose <strong>Save to Files</strong> or <strong>AirDrop to Mac</strong></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">6.</span>
                        <span>Upload the <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">.vcf</code> file below</span>
                      </li>
                    </ol>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <h4 className="font-semibold text-sm">From Mac</h4>
                    </div>
                    <ol className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">1.</span>
                        <span>Open the <strong>Contacts</strong> app on your Mac</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">2.</span>
                        <span>Press <kbd className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">⌘ Cmd</kbd> + <kbd className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">A</kbd> to select all contacts</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">3.</span>
                        <span>Click <strong>File</strong> → <strong>Export</strong> → <strong>Export vCard...</strong></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">4.</span>
                        <span>Save the file (it will be a <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">.vcf</code> file)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-primary">5.</span>
                        <span>Upload the <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">.vcf</code> file below</span>
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-900 dark:text-green-100">Pro Tip</p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        The vCard format (.vcf) is universal - it also works with contacts exported from Google, Outlook, Samsung, and most contact apps!
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="apple-file">Upload your vCard file (.vcf)</Label>
                  <Input
                    id="apple-file"
                    type="file"
                    accept=".vcf,text/vcard,text/x-vcard"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="mt-2"
                  />
                  {importFile && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Selected: {importFile.name}
                    </p>
                  )}
                </div>
              </div>
            )}

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

            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-4">
              <Button variant="ghost" onClick={handleSkipStep} className="order-2 sm:order-1">
                Skip for now
              </Button>
              <Button
                onClick={
                  contactMethod === "demo"
                    ? handleDemoMode
                    : contactMethod === "google"
                    ? handleGoogleImport
                    : contactMethod === "apple"
                    ? handleImportContacts
                    : contactMethod === "manual"
                    ? handleCreateContact
                    : handleImportContacts
                }
                disabled={
                  !contactMethod ||
                  (contactMethod === "manual" &&
                    (!newContact.name ||
                      !newContact.email ||
                      !newContact.phone)) ||
                  (contactMethod === "apple" && !importFile) ||
                  createContactMutation.isPending ||
                  isImporting
                }
              >
                {createContactMutation.isPending || isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {contactMethod === "demo" 
                      ? "Loading Demo..." 
                      : contactMethod === "google"
                      ? "Importing from Google..."
                      : "Processing..."}
                  </>
                ) : (
                  <>
                    {contactMethod === "demo" 
                      ? "Start Demo" 
                      : contactMethod === "google"
                      ? "Sign in with Google"
                      : "Continue"}
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
                        {smartGroupsQuery.data.suggestedGroups.map((group: any, index: number) => {
                          // Get contact details for this suggested group
                          const groupContacts = contacts?.filter((c) => 
                            group.contactIds?.includes(c.id)
                          ) || [];
                          
                          return (
                            <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="space-y-3">
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
                                        // Pre-select the contacts from AI suggestion
                                        setSelectedContactIds(group.contactIds || []);
                                        setShowSmartSuggestions(false);
                                      }}
                                    >
                                      Use This
                                    </Button>
                                  </div>
                                  
                                  {/* Show which contacts will be in this group */}
                                  {groupContacts.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <p className="text-xs font-medium text-muted-foreground mb-2">
                                        This group will include:
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {groupContacts.slice(0, 5).map((contact) => (
                                          <Badge
                                            key={contact.id}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {contact.name}
                                          </Badge>
                                        ))}
                                        {groupContacts.length > 5 && (
                                          <Badge variant="secondary" className="text-xs">
                                            +{groupContacts.length - 5} more
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
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

                {/* Contact Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Add Contacts to Group</Label>
                    <Badge variant="secondary" className="text-xs">
                      {selectedContactIds.length} selected
                    </Badge>
                  </div>
                  
                  {contacts && contacts.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                      {contacts.map((contact) => {
                        const isSelected = selectedContactIds.includes(contact.id);
                        return (
                          <div
                            key={contact.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                              isSelected
                                ? "bg-primary/10 border-primary shadow-sm"
                                : "bg-background hover:bg-accent/50"
                            )}
                            onClick={() => {
                              setSelectedContactIds((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== contact.id)
                                  : [...prev, contact.id]
                              );
                            }}
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">{contact.name}</p>
                              <div className="flex items-center gap-3 mt-1">
                                {contact.email && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {contact.email}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center border rounded-lg bg-muted/50">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No contacts available yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You can add contacts later from the Contacts page
                      </p>
                    </div>
                  )}
                  
                  {selectedContactIds.length > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <p className="text-xs font-medium">
                          {selectedContactIds.length} contact{selectedContactIds.length > 1 ? 's' : ''} will be added to this group
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedContactIds.map((contactId) => {
                          const contact = contacts?.find((c) => c.id === contactId);
                          if (!contact) return null;
                          return (
                            <Badge
                              key={contactId}
                              variant="outline"
                              className="text-xs gap-1"
                            >
                              {contact.name}
                              <X
                                className="h-3 w-3 cursor-pointer hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContactIds((prev) =>
                                    prev.filter((id) => id !== contactId)
                                  );
                                }}
                              />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="order-2 sm:order-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2 order-1 sm:order-2">
                <Button variant="ghost" onClick={handleSkipStep} className="flex-1 sm:flex-none">
                  Skip for now
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || createGroupMutation.isPending}
                  className="flex-1 sm:flex-none"
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

            {/* Show who will receive the message */}
            {createdGroupId && (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-medium">Your starter group is ready!</p>
                  </div>
                  
                  {/* Show recipients */}
                  {selectedContactIds.length > 0 && contacts ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">
                          Message will be sent to {selectedContactIds.length} contact{selectedContactIds.length > 1 ? 's' : ''}:
                        </p>
                      </div>
                      <div className="pl-6 space-y-1">
                        {selectedContactIds.map((contactId) => {
                          const contact = contacts.find((c) => c.id === contactId);
                          if (!contact) return null;
                          return (
                            <div
                              key={contactId}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                              <span className="font-medium">{contact.name}</span>
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                      No contacts in this group yet. You can add contacts later.
                    </p>
                  )}
                </div>
              </div>
            )}

            {!createdGroupId && groups && groups.length > 0 && (
              <div className="space-y-3">
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

                {/* Show selected group details */}
                {selectedGroupId && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    {(() => {
                      const selectedGroup = groups.find((g: Group) => g.id === selectedGroupId);
                      if (!selectedGroup) return null;
                      
                      const groupContacts = contacts?.filter((c) => 
                        selectedGroup.contactIds?.includes(c.id)
                      ) || [];
                      
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            <p className="text-sm font-medium">
                              {selectedGroup.name}
                            </p>
                          </div>
                          
                          {groupContacts.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Message will be sent to {groupContacts.length} contact{groupContacts.length > 1 ? 's' : ''}:
                              </p>
                              <div className="pl-4 space-y-1">
                                {groupContacts.map((contact) => (
                                  <div
                                    key={contact.id}
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                    <span className="font-medium">{contact.name}</span>
                                    {contact.email && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {contact.email}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              This group has no contacts yet. Add contacts to send messages.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {!createdGroupId && (!groups || groups.length === 0) && (
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
                <Label htmlFor="edit-message">Generated Message</Label>
                <div className="mt-2 p-4 bg-muted rounded-lg border">
                  <div className="flex items-start gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Message Generated Successfully!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Feel free to edit the message below before continuing
                      </p>
                    </div>
                  </div>
                  <Textarea
                    id="edit-message"
                    value={generatedMessage}
                    onChange={(e) => setGeneratedMessage(e.target.value)}
                    className="min-h-[150px] bg-background"
                    placeholder="Edit your message..."
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ✨ This message was crafted by AI - personalize it to make it yours
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                disabled={createContactMutation.isPending}
                className="order-2 sm:order-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2 order-1 sm:order-2">
                <Button variant="ghost" onClick={handleSkipStep} className="flex-1 sm:flex-none">
                  Skip for now
                </Button>
                <Button
                  onClick={() => {
                    setCompletedSteps((prev) => new Set([...prev, 3]));
                    setStep(4);
                  }}
                  disabled={Boolean((createdGroupId || selectedGroupId) && !generatedMessage)}
                  className="flex-1 sm:flex-none"
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
                  <h3 className="font-semibold mb-2">Schedule Your Message (Optional)</h3>
                  <p className="text-sm text-muted-foreground">
                    {generatedMessage 
                      ? "Set a date and time to automatically send your message, or skip to send it manually later."
                      : "You can schedule messages later from the Groups page. Click 'Complete Setup' to finish."}
                  </p>
                </div>
              </div>
            </div>

            {generatedMessage && (
              <div className="space-y-3">
                <div>
                  <Label>Your Message to Send</Label>
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

                {/* Show who will receive this scheduled message */}
                {selectedContactIds.length > 0 && contacts && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-green-600" />
                      <p className="text-xs font-medium text-green-900 dark:text-green-100">
                        Will be sent to {selectedContactIds.length} contact{selectedContactIds.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedContactIds.slice(0, 5).map((contactId) => {
                        const contact = contacts.find((c) => c.id === contactId);
                        if (!contact) return null;
                        return (
                          <Badge
                            key={contactId}
                            variant="secondary"
                            className="text-xs"
                          >
                            {contact.name}
                          </Badge>
                        );
                      })}
                      {selectedContactIds.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{selectedContactIds.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {generatedMessage && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground">Choose when to send</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="schedule-date">Date</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        placeholder="Select date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-time">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        placeholder="Select time"
                      />
                    </div>
                  </div>
                </div>

                {scheduleDate && scheduleTime && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-300 dark:border-green-700 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                          Your message will be scheduled!
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Scheduled for: <strong>{formatWithTimezone(
                            `${scheduleDate}T${scheduleTime}`,
                            user?.timezone
                          )}</strong>
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          You can manage this schedule from the Groups page after completing setup.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!scheduleDate && !scheduleTime && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          Leave empty to send manually later from the Groups page.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(3)}
                disabled={scheduleMessageMutation.isPending}
                className="order-2 sm:order-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex gap-2 order-1 sm:order-2">
                {scheduleDate && scheduleTime && generatedMessage ? (
                  <>
                    <Button variant="ghost" onClick={handleComplete} className="flex-1 sm:flex-none">
                      Skip Scheduling
                    </Button>
                    <Button
                      onClick={handleScheduleMessage}
                      disabled={scheduleMessageMutation.isPending}
                      className="flex-1 sm:flex-none"
                    >
                      {scheduleMessageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule & Finish
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleComplete}
                    className="flex-1 sm:flex-none"
                  >
                    <PartyPopper className="mr-2 h-4 w-4" />
                    {generatedMessage ? "Skip Scheduling & Finish" : "Finish Setup"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Completion celebration */}
        {completedSteps.size === 4 && (
          <div className="mt-4 p-4 sm:p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-lg border border-green-200 dark:border-green-800 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <PartyPopper className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 text-green-600" />
            <h3 className="font-semibold text-base sm:text-lg mb-2">
              Setup Complete! 🎉
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              {scheduleDate && scheduleTime && generatedMessage
                ? `Your message is scheduled to send on ${formatWithTimezone(`${scheduleDate}T${scheduleTime}`, user?.timezone)}. You can manage it from the Groups page.`
                : generatedMessage
                ? "Your group and message are ready. Visit the Groups page to send it or set up a schedule."
                : "You're all set! Start managing your contacts and creating groups."}
            </p>
            <Button onClick={handleComplete} size="lg" className="w-full sm:w-auto">
              Start Using ContactHub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
