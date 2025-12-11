import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit, Trash2, Mail, Phone } from "lucide-react";

interface ContactItemProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

export default function ContactItem({ contact, onEdit, onDelete }: ContactItemProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
            {contact.name.slice(0, 2).toUpperCase()}
          </div>
          {contact.name}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex flex-col text-sm text-muted-foreground gap-1">
          <span className="flex items-center gap-2"><Mail className="h-3 w-3" /> {contact.email}</span>
          <span className="flex items-center gap-2"><Phone className="h-3 w-3" /> {contact.phone}</span>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
        {contact.notes}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={() => onEdit(contact)}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(contact.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
