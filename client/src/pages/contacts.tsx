import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { Contact } from "@/lib/types";
import { getAuth } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Search, Trash2, Edit, Phone, Mail, StickyNote, Loader2, CheckSquare, Square, X, Upload, Download, Sparkles, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import ContactInsightsDrawer from "@/components/contact-insights-drawer";
import { ContactImportDialog } from "@/components/contact-import-dialog";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(5, "Phone is required"),
  notes: z.string().optional(),
});

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [insightsContact, setInsightsContact] = useState<Contact | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-open create modal if ?create=true is in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('create') === 'true') {
      setIsOpen(true);
      // Clean up the URL by navigating to /contacts without query params
      window.history.replaceState(null, '', '/contacts');
    }
  }, []);

  const { user } = useAuth();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: async () => {
      const result = await firebaseApi.contacts.list();
      return result;
    },
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: firebaseApi.contacts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsOpen(false);
      toast({ title: "Contact created" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; data: Partial<Contact> }) => 
      firebaseApi.contacts.update(data.id, data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsOpen(false);
      setEditingContact(null);
      toast({ title: "Contact updated" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: firebaseApi.contacts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeleteContactId(null);
      toast({ title: "Contact deleted" });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      await Promise.all(contactIds.map(id => firebaseApi.contacts.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setSelectedContacts(new Set());
      setIsSelectionMode(false);
      toast({ title: `${selectedContacts.size} contacts deleted` });
    }
  });

  const importMutation = useMutation({
    mutationFn: async (contacts: Omit<Contact, 'id'>[]) => {
      const results = [];
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        try {
          const createdContact = await firebaseApi.contacts.create(contact);
          results.push({ success: true, contact: createdContact });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ success: false, contact, error: errorMessage });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      if (errorCount === 0) {
        toast({ title: `Successfully imported ${successCount} contacts` });
      } else {
        toast({ 
          title: `Imported ${successCount} contacts, ${errorCount} failed`,
          variant: "destructive"
        });
      }
    }
  });

  const handleContactsImported = (contacts: any[]) => {
    importMutation.mutate(contacts);
  };

  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", notes: "" }
  });

  const onSubmit = (values: z.infer<typeof contactSchema>) => {
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: values });
    } else {
      createMutation.mutate({ ...values, notes: values.notes || "" });
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validatePhone = (phone: string): boolean => {
    // Basic international phone validation - allows +, spaces, dashes, parentheses, and digits
    const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)]{7,}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 8 && cleanPhone.length <= 15;
  };

  const sanitizeContact = (contact: any) => {
    const sanitized: any = {
      name: contact.name?.trim(),
    };

    // Only add email if it exists and is valid
    if (contact.email?.trim()) {
      sanitized.email = contact.email.trim().toLowerCase();
    }

    // Only add phone if it exists
    if (contact.phone?.replace(/[\s\-\(\)]/g, '')) {
      sanitized.phone = contact.phone.replace(/[\s\-\(\)]/g, '');
    }

    // Always add notes (can be empty string)
    sanitized.notes = contact.notes?.trim() || '';

    return sanitized;
  };

  const openInsights = (contact: Contact) => {
    setInsightsContact(contact);
    setIsInsightsOpen(true);
  };

  const filteredContacts = contacts?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.toLowerCase().includes(search.toLowerCase()) ||
    c.notes.toLowerCase().includes(search.toLowerCase())
  );
  
  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    form.reset(contact);
    setIsOpen(true);
  };

  const openCreate = () => {
    setEditingContact(null);
    form.reset({ name: "", email: "", phone: "", notes: "" });
    setIsOpen(true);
  };

  const openDeleteDialog = (contactId: string) => {
    setDeleteContactId(contactId);
  };

  const confirmDelete = () => {
    if (deleteContactId) {
      deleteMutation.mutate(deleteContactId);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedContacts(new Set());
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const selectAllContacts = () => {
    if (filteredContacts) {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedContacts(new Set());
  };

  const handleBulkDelete = () => {
    setConfirmBulkDelete(true);
  };

  const confirmBulkDeleteAction = () => {
    if (selectedContacts.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedContacts));
      setConfirmBulkDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Manage your address book</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {isSelectionMode ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedContacts.size === 0} className="flex-1 sm:flex-none">
                Clear ({selectedContacts.size})
              </Button>
              <Button variant="outline" size="sm" onClick={selectAllContacts} className="flex-1 sm:flex-none">
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleSelectionMode} className="flex-1 sm:flex-none">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={toggleSelectionMode} className="w-full sm:w-auto">
              <CheckSquare className="h-4 w-4 mr-2" />
              Select
            </Button>
          )}
          <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" /> Add Contact
          </Button>
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="w-full sm:w-auto gap-2">
            <Upload className="h-4 w-4" /> Import Contacts
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm w-full">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isSelectionMode && selectedContacts.size > 0 && (
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {isSelectionMode && <TableHead className="w-12"></TableHead>}
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Contact Info</TableHead>
              <TableHead className="md:hidden">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isSelectionMode ? 6 : 5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredContacts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSelectionMode ? 6 : 5} className="h-24 text-center text-muted-foreground">
                  No contacts found.
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts?.map((contact) => (
                <TableRow key={contact.id} className="hover:bg-muted/50 transition-colors">
                  {isSelectionMode && (
                    <TableCell>
                      <button
                        onClick={() => toggleContactSelection(contact.id)}
                        className="flex items-center justify-center"
                      >
                        {selectedContacts.has(contact.id) ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground hover:text-primary" />
                        )}
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs hover-scale">
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="hover:text-primary transition-colors cursor-pointer">{contact.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col text-sm text-muted-foreground gap-1 hover:text-foreground transition-colors">
                      <span className="flex items-center gap-2"><Mail className="h-3 w-3 hover-scale" /> {contact.email}</span>
                      <span className="flex items-center gap-2"><Phone className="h-3 w-3 hover-scale" /> {contact.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="md:hidden">
                    <div className="flex flex-col text-xs text-muted-foreground gap-0.5">
                      <span className="truncate max-w-[120px]">{contact.email}</span>
                      <span className="truncate max-w-[120px]">{contact.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-[200px] truncate hover:text-foreground transition-colors">
                    {contact.notes}
                  </TableCell>
                  <TableCell className="text-right">
                    {contact.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.location.href = `mailto:${contact.email}`}
                        className="interactive-button hover:text-blue-500"
                        title="Send email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    {contact.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.location.href = `tel:${contact.phone}`}
                        className="interactive-button hover:text-green-500"
                        title="Call contact"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(contact)} className="interactive-button hover:text-primary">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openInsights(contact)}
                      className="interactive-button hover:text-sky-400"
                      title="Open AI insights"
                    >
                      <Brain className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive interactive-button" onClick={() => openDeleteDialog(contact.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "Create Contact"}</DialogTitle>
            <DialogDescription>
              {editingContact ? "Update the contact information." : "Add a new contact to your address book."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional but Recommended)</FormLabel>
                    <FormControl><Input {...field} placeholder="Add context to help AI personalize messages..." /></FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Notes help AI generate better personalized messages
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingContact ? "Save Changes" : "Create Contact"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkDelete} onOpenChange={() => setConfirmBulkDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDeleteAction} disabled={bulkDeleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedContacts.size} Contact${selectedContacts.size !== 1 ? 's' : ''}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContactImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onContactsImported={handleContactsImported}
      />

      <ContactInsightsDrawer
        contact={insightsContact}
        open={isInsightsOpen && !!insightsContact}
        onOpenChange={(open) => {
          setIsInsightsOpen(open);
          if (!open) {
            setInsightsContact(null);
          }
        }}
      />
    </div>
  );
}
