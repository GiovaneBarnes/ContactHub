import { useState } from "react";
import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Loader2 } from "lucide-react";
import ContactItem from "./ContactItem";
import ContactForm from "./ContactForm";
import { useContacts } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";

export default function ContactList() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { contacts, isLoading, createContact, updateContact, deleteContact } = useContacts();
  const { toast } = useToast();

  const filteredContacts = contacts?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (values: any) => {
    if (editingContact) {
      updateContact.mutate({ id: editingContact.id, data: values }, {
        onSuccess: () => {
          setIsOpen(false);
          setEditingContact(null);
          toast({ title: "Contact updated" });
        }
      });
    } else {
      createContact.mutate({ ...values, notes: values.notes || "" }, {
        onSuccess: () => {
          setIsOpen(false);
          toast({ title: "Contact created" });
        }
      });
    }
  };

  const openCreate = () => {
    setEditingContact(null);
    setIsOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground mt-1">Manage your address book</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
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

      <div className="bg-card rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Contact Info</TableHead>
              <TableHead className="hidden lg:table-cell">Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredContacts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No contacts found.
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts?.map((contact) => (
                <ContactItem 
                  key={contact.id} 
                  contact={contact} 
                  onEdit={openEdit} 
                  onDelete={(id) => deleteContact.mutate(id)} 
                />
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
          <ContactForm 
            initialData={editingContact || undefined} 
            onSubmit={handleSubmit} 
            onCancel={() => setIsOpen(false)}
            isLoading={createContact.isPending || updateContact.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
