import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mock-api";
import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Trash2, Edit, Phone, Mail, StickyNote, Loader2, CheckSquare, Square, X, Upload, Download } from "lucide-react";
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

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(5, "Phone is required"),
  notes: z.string().optional(),
});

// Generate VCF content for a single contact
const generateVCF = (contact: Contact): string => {
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.name}`,
    `N:${contact.name};;;`,
    `TEL;TYPE=CELL:${contact.phone}`,
    `EMAIL;TYPE=INTERNET:${contact.email}`,
    contact.notes ? `NOTE:${contact.notes.replace(/\n/g, '\\n')}` : null,
    'END:VCARD'
  ].filter(Boolean).join('\n');

  return vcf;
};

// Export contacts to VCF file
const exportContactsToVCF = (contacts: Contact[]) => {
  if (contacts.length === 0) return;

  let vcfContent: string;

  if (contacts.length === 1) {
    // Single contact - create individual VCF file
    vcfContent = generateVCF(contacts[0]);
  } else {
    // Multiple contacts - combine into single VCF file
    vcfContent = contacts.map(generateVCF).join('\n\n');
  }

  // Create and download the file
  const blob = new Blob([vcfContent], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  if (contacts.length === 1) {
    link.download = `${contacts[0].name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
  } else {
    link.download = `contacts_${new Date().toISOString().split('T')[0]}.vcf`;
  }

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState(0);
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

  const { data: contacts, isLoading } = useQuery({ 
    queryKey: ['contacts'], 
    queryFn: api.contacts.list 
  });

  const createMutation = useMutation({
    mutationFn: api.contacts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsOpen(false);
      toast({ title: "Contact created" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; data: Partial<Contact> }) => 
      api.contacts.update(data.id, data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsOpen(false);
      setEditingContact(null);
      toast({ title: "Contact updated" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: api.contacts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeleteContactId(null);
      toast({ title: "Contact deleted" });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      await Promise.all(contactIds.map(id => api.contacts.delete(id)));
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
          await api.contacts.create(contact);
          results.push({ success: true, contact });
          setImportProgress((i + 1) / contacts.length * 100);
        } catch (error) {
          results.push({ success: false, contact, error });
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
      
      setIsImportOpen(false);
      setImportData([]);
      setImportProgress(0);
    }
  });

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
    return {
      name: contact.name?.trim(),
      email: contact.email?.trim().toLowerCase(),
      phone: contact.phone?.replace(/[\s\-\(\)]/g, ''), // Clean phone format
      notes: contact.notes?.trim() || ''
    };
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let parsedData: any[] = [];
        
        if (fileExtension === 'csv') {
          // Parse CSV
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          
          parsedData = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const contact: any = {};
            
            headers.forEach((header, index) => {
              if (values[index]) {
                if (header.includes('name') || header.includes('fn')) contact.name = values[index];
                else if (header.includes('email')) contact.email = values[index];
                else if (header.includes('phone') || header.includes('tel')) contact.phone = values[index];
                else if (header.includes('notes') || header.includes('description') || header.includes('note')) contact.notes = values[index];
              }
            });
            
            return contact;
          });
        } else if (fileExtension === 'vcf' || fileExtension === 'vcard') {
          // Parse VCF (vCard)
          parsedData = parseVCF(text);
        } else if (fileExtension === 'json') {
          // Parse JSON
          const jsonData = JSON.parse(text);
          parsedData = Array.isArray(jsonData) ? jsonData : [jsonData];
        }
        
        // Validate and sanitize contacts
        const validContacts: any[] = [];
        const invalidContacts: any[] = [];
        const duplicateContacts: any[] = [];
        const existingContacts = contacts?.map(c => ({ email: c.email?.toLowerCase(), phone: c.phone })) || [];

        parsedData.forEach((contact, index) => {
          const sanitized = sanitizeContact(contact);

          // Check for required fields
          if (!sanitized.name || (!sanitized.email && !sanitized.phone)) {
            invalidContacts.push({ ...sanitized, reason: "Missing name or contact info", row: index + 1 });
            return;
          }

          // Validate email if provided
          if (sanitized.email && !validateEmail(sanitized.email)) {
            invalidContacts.push({ ...sanitized, reason: "Invalid email format", row: index + 1 });
            return;
          }

          // Validate phone if provided
          if (sanitized.phone && !validatePhone(sanitized.phone)) {
            invalidContacts.push({ ...sanitized, reason: "Invalid phone format", row: index + 1 });
            return;
          }

          // Check for duplicates
          const isDuplicate = existingContacts.some(existing =>
            (sanitized.email && existing.email === sanitized.email) ||
            (sanitized.phone && existing.phone === sanitized.phone)
          );

          if (isDuplicate) {
            duplicateContacts.push({ ...sanitized, reason: "Duplicate contact", row: index + 1 });
            return;
          }

          validContacts.push(sanitized);
        });

        // Show validation results
        if (invalidContacts.length > 0 || duplicateContacts.length > 0) {
          const totalIssues = invalidContacts.length + duplicateContacts.length;
          toast({
            title: `${totalIssues} contact(s) skipped`,
            description: `${invalidContacts.length} invalid, ${duplicateContacts.length} duplicates. ${validContacts.length} contacts will be imported.`,
            variant: "default",
          });
        }

        if (validContacts.length === 0) {
          toast({
            title: "No valid contacts found",
            description: "Please check your file format and data.",
            variant: "destructive",
          });
          return;
        }

        setImportData(validContacts);
        toast({ title: `Parsed ${validContacts.length} valid contacts from ${parsedData.length} entries` });
      } catch (error) {
        toast({ title: "Import failed", description: "Invalid file format or corrupted file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const parseVCF = (vcfText: string) => {
    const contacts: any[] = [];
    const vcards = vcfText.split('BEGIN:VCARD');
    
    vcards.forEach(vcard => {
      if (!vcard.includes('END:VCARD')) return;
      
      const contact: any = {};
      const lines = vcard.split('\n');
      
      lines.forEach(line => {
        if (line.startsWith('FN:') || line.startsWith('N:')) {
          contact.name = line.split(':')[1]?.trim();
        } else if (line.startsWith('EMAIL')) {
          contact.email = line.split(':')[1]?.trim();
        } else if (line.startsWith('TEL')) {
          contact.phone = line.split(':')[1]?.trim();
        } else if (line.startsWith('NOTE')) {
          contact.notes = line.split(':')[1]?.trim();
        }
      });
      
      if (contact.name) contacts.push(contact);
    });
    
    return contacts;
  };

  const handleImport = () => {
    if (importData.length > 0) {
      importMutation.mutate(importData);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = "name,email,phone,notes\nJohn Doe,john@example.com,+1234567890,Colleague\nJane Smith,jane@example.com,+0987654321,Friend";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_contacts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleVCF = () => {
    const vcfContent = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL:john@example.com
TEL:+1234567890
NOTE:Colleague
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Jane Smith
EMAIL:jane@example.com
TEL:+0987654321
NOTE:Friend
END:VCARD`;
    const blob = new Blob([vcfContent], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_contacts.vcf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleJSON = () => {
    const jsonContent = JSON.stringify([
      { name: "John Doe", email: "john@example.com", phone: "+1234567890", notes: "Colleague" },
      { name: "Jane Smith", email: "jane@example.com", phone: "+0987654321", notes: "Friend" }
    ], null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_contacts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredContacts = contacts?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.toLowerCase().includes(search.toLowerCase()) ||
    c.notes.toLowerCase().includes(search.toLowerCase())
  );  const openEdit = (contact: Contact) => {
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

  const handleExportVCF = () => {
    const selectedContactsData = filteredContacts.filter(contact => selectedContacts.has(contact.id));
    exportContactsToVCF(selectedContactsData);
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportVCF}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export VCF
              </Button>
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
                    <Button variant="ghost" size="icon" onClick={() => openEdit(contact)} className="interactive-button hover:text-primary">
                      <Edit className="h-4 w-4" />
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
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to import multiple contacts at once.
            </p>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadSampleCSV} className="gap-2">
                <Download className="h-4 w-4" />
                CSV Sample
              </Button>
              <Button variant="outline" size="sm" onClick={downloadSampleVCF} className="gap-2">
                <Download className="h-4 w-4" />
                VCF Sample
              </Button>
              <Button variant="outline" size="sm" onClick={downloadSampleJSON} className="gap-2">
                <Download className="h-4 w-4" />
                JSON Sample
              </Button>
              <div className="text-sm text-muted-foreground ml-2">
                Download samples to see expected formats
              </div>
            </div>

            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv,.vcf,.vcard,.json"
                onChange={handleFileImport}
                className="hidden"
                id="contact-upload"
              />
              <label htmlFor="contact-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload contact file</p>
                <p className="text-xs text-muted-foreground">Supports CSV, VCF (vCard), and JSON files</p>
              </label>
            </div>

            {importData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Preview ({importData.length} contacts)</h4>
                  {importProgress > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Importing... {Math.round(importProgress)}%
                    </div>
                  )}
                </div>
                
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <div className="p-3 bg-muted/50 font-medium text-sm grid grid-cols-4 gap-4">
                    <div>Name</div>
                    <div>Email</div>
                    <div>Phone</div>
                    <div>Notes</div>
                  </div>
                  {importData.map((contact, index) => (
                    <div key={index} className="p-3 border-t text-sm grid grid-cols-4 gap-4">
                      <div className="truncate">{contact.name}</div>
                      <div className="truncate">{contact.email}</div>
                      <div className="truncate">{contact.phone}</div>
                      <div className="truncate">{contact.notes || '-'}</div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setImportData([])}>
                    Clear
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={importMutation.isPending}
                    className="gap-2"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Import {importData.length} Contacts
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
