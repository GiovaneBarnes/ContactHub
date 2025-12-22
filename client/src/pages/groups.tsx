import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { Group } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Users, ArrowRight, Loader2, Trash2, Edit3, CheckSquare, Square, X, Settings, Sparkles, Shield, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { SmartGroupSuggestions } from "@/components/smart-group-suggestions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const groupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().min(5, "Description is required"),
  backgroundInfo: z.string().min(10, "Background info is required for AI context"),
});

export default function GroupsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-open create modal if ?create=true is in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('create') === 'true') {
      setIsOpen(true);
      // Clean up the URL by navigating to /groups without query params
      window.history.replaceState(null, '', '/groups');
    }
  }, []);

  const { user } = useAuth();

  const { data: groups, isLoading } = useQuery({ 
    queryKey: ['groups', user?.id], 
    queryFn: firebaseApi.groups.list,
    enabled: !!user 
  });

  const createMutation = useMutation({
    mutationFn: firebaseApi.groups.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsOpen(false);
      toast({ title: "Group created" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: firebaseApi.groups.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setDeleteGroupId(null);
      toast({ title: "Group deleted" });
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: firebaseApi.groups.duplicate,
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({ 
        title: "Group duplicated",
        description: `Created "${newGroup.name}" with ${newGroup.contactIds.length} contacts. You can now customize it.`
      });
    },
    onError: () => {
      toast({ 
        title: "Failed to duplicate group",
        variant: "destructive"
      });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (groupIds: string[]) => {
      await Promise.all(groupIds.map(id => firebaseApi.groups.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setSelectedGroups(new Set());
      setIsSelectionMode(false);
      toast({ title: `${selectedGroups.size} groups deleted` });
    }
  });

  const bulkToggleEnabledMutation = useMutation({
    mutationFn: async ({ groupIds, enabled }: { groupIds: string[], enabled: boolean }) => {
      await Promise.all(groupIds.map(id => firebaseApi.groups.update(id, { enabled })));
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast({ title: `${selectedGroups.size} groups ${enabled ? 'enabled' : 'disabled'}` });
    }
  });

  const form = useForm<z.infer<typeof groupSchema>>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "", backgroundInfo: "" }
  });

  const onSubmit = (values: z.infer<typeof groupSchema>) => {
    createMutation.mutate({ ...values, contactIds: [], schedules: [], enabled: true });
  };

  const openCreate = () => {
    form.reset({ name: "", description: "", backgroundInfo: "" });
    setIsOpen(true);
  };

  const openDeleteDialog = (groupId: string, event: React.MouseEvent, group: Group) => {
    event.preventDefault(); // Prevent navigation to group detail
    event.stopPropagation(); // Prevent event bubbling
    
    // Prevent deletion of system groups
    if (group.isSystem) {
      toast({ 
        title: "Cannot delete system group",
        description: "The All Contacts group is protected. You can disable it in the group settings.",
        variant: "destructive"
      });
      return;
    }
    
    setDeleteGroupId(groupId);
  };

  const confirmDelete = () => {
    if (deleteGroupId) {
      deleteMutation.mutate(deleteGroupId);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedGroups(new Set());
  };

  const toggleGroupSelection = (groupId: string, group: Group) => {
    // Don't allow selecting system groups
    if (group.isSystem) {
      toast({ 
        title: "Cannot select system group",
        description: "The All Contacts group is protected and cannot be deleted.",
        variant: "destructive"
      });
      return;
    }
    
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const selectAllGroups = () => {
    if (groups) {
      // Don't select system groups
      const selectableGroups = groups.filter(g => !g.isSystem);
      setSelectedGroups(new Set(selectableGroups.map(g => g.id)));
    }
  };

  const clearSelection = () => {
    setSelectedGroups(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedGroups.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedGroups));
    }
  };

  const handleBulkEnable = () => {
    if (selectedGroups.size > 0) {
      bulkToggleEnabledMutation.mutate({ groupIds: Array.from(selectedGroups), enabled: true });
    }
  };

  const handleBulkDisable = () => {
    if (selectedGroups.size > 0) {
      bulkToggleEnabledMutation.mutate({ groupIds: Array.from(selectedGroups), enabled: false });
    }
  };

  const handleDuplicateGroup = (groupId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    duplicateMutation.mutate(groupId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Groups</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Organize contacts and automate messages</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!showSmartSuggestions && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSmartSuggestions(true)}
              className="w-full sm:w-auto gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Smart Suggestions
            </Button>
          )}
          {isSelectionMode ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedGroups.size === 0} className="flex-1 sm:flex-none">
                Clear ({selectedGroups.size})
              </Button>
              <Button variant="outline" size="sm" onClick={selectAllGroups} className="flex-1 sm:flex-none">
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleSelectionMode} className="flex-1 sm:flex-none">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={toggleSelectionMode} className="w-full sm:w-auto">
                <CheckSquare className="h-4 w-4 mr-2" />
                Select
              </Button>
              <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
                <Plus className="h-4 w-4" /> Create Group
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Smart Group Suggestions Section */}
      {showSmartSuggestions && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">AI-Powered Group Suggestions</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSmartSuggestions(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
          <SmartGroupSuggestions autoLoad={true} />
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedGroups.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="font-medium">{selectedGroups.size} groups selected</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkEnable}
                  disabled={bulkToggleEnabledMutation.isPending}
                  className="flex-1 sm:flex-none gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Enable
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDisable}
                  disabled={bulkToggleEnabledMutation.isPending}
                  className="flex-1 sm:flex-none gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Disable
                </Button>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="w-full sm:w-auto gap-2"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups?.map((group) => (
            <div key={group.id} className="block h-full">
              <Card className={`h-full interactive-card group ${selectedGroups.has(group.id) ? 'ring-2 ring-primary' : ''} ${group.isSystem ? 'border-blue-200 dark:border-blue-800' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-start">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isSelectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupSelection(group.id, group);
                          }}
                          className="flex-shrink-0"
                          disabled={group.isSystem}
                        >
                          {selectedGroups.has(group.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className={`h-5 w-5 ${group.isSystem ? 'text-muted-foreground/30' : 'text-muted-foreground hover:text-primary'}`} />
                          )}
                        </button>
                      )}
                      <span className="hover:text-primary transition-colors truncate">{group.name}</span>
                      {group.isSystem && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-medium">
                          <Shield className="h-3 w-3" />
                          System
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isSelectionMode && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDuplicateGroup(group.id, e)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            title={group.isSystem ? "Create a copy you can customize" : "Duplicate this group"}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {!group.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => openDeleteDialog(group.id, e, group)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                      <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors hover-scale" />
                    </div>
                  </CardTitle>
                  <CardDescription className="line-clamp-2 hover:text-foreground transition-colors">{group.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <span className="font-medium text-foreground">{group.contactIds.length}</span> members
                      {group.isSystem && <span className="text-xs ml-1">(auto-synced)</span>}
                    </div>
                    {group.enabled !== undefined && (
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        group.enabled 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {group.enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground line-clamp-2 bg-secondary/50 p-2 rounded hover:bg-secondary/70 transition-colors">
                    AI Context: {group.backgroundInfo}
                  </div>
                  {group.isSystem && (
                    <div className="mt-3 p-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-100">
                      <p className="flex items-start gap-1.5">
                        <Copy className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span><strong>Tip:</strong> Need everyone except one person? Click the copy button above to create a customizable version.</span>
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-0">
                  {!isSelectionMode ? (
                    <Link href={`/groups/${group.id}`} className="w-full">
                      <Button variant="ghost" className="w-full justify-between interactive-button px-0 text-primary">
                        Manage Group <ArrowRight className="h-4 w-4 hover-scale" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-center interactive-button px-0 text-muted-foreground"
                      onClick={() => toggleGroupSelection(group.id, group)}
                      disabled={group.isSystem}
                    >
                      {selectedGroups.has(group.id) ? 'Selected' : group.isSystem ? 'Protected' : 'Click to select'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          ))}
          {groups?.length === 0 && (
            <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
              <h3 className="text-lg font-medium text-muted-foreground">No groups yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Create your first group to start sending automated messages.</p>
              <Button onClick={openCreate} variant="outline" className="mt-4">Create Group</Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new group to organize your contacts.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Marketing Team" {...field} /></FormControl>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                      ⚠️ Note: Group names may appear in email communications
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input placeholder="Internal updates..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="backgroundInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Background Info (for AI)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the context for this group. The AI will use this to generate personalized messages."
                        className="resize-none h-24"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Group
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? This action cannot be undone and will also delete all associated schedules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
