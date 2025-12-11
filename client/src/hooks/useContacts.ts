import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contactService } from "@/services/contactService";
import { Contact } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

export function useContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading, error } = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: () => contactService.getAll(user?.id || ''),
    enabled: !!user?.id
  });

  const createContact = useMutation({
    mutationFn: (contact: Omit<Contact, 'id'>) => contactService.create(contact, user?.id || ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] })
  });

  const updateContact = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Contact> }) => contactService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] })
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => contactService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] })
  });

  return {
    contacts,
    isLoading,
    error,
    createContact,
    updateContact,
    deleteContact
  };
}
