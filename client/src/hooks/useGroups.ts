import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupService } from "@/services/groupService";
import { Group } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

export function useGroups() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: groups, isLoading, error } = useQuery({
    queryKey: ['groups', user?.id],
    queryFn: () => groupService.getAll(user?.id || ''),
    enabled: !!user?.id
  });

  const createGroup = useMutation({
    mutationFn: (group: Omit<Group, 'id'>) => groupService.create(group, user?.id || ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] })
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Group> }) => groupService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] })
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => groupService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] })
  });

  const generateAiMessage = useMutation({
    mutationFn: (groupId: string) => groupService.generateAiMessage(groupId)
  });

  return {
    groups,
    isLoading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    generateAiMessage
  };
}
