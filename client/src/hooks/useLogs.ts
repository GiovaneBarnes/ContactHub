import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logService } from "@/services/logService";
import { useAuth } from "@/context/AuthContext";

export function useLogs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['logs', user?.id],
    queryFn: () => logService.getAll(user?.id || ''),
    enabled: !!user?.id
  });

  const sendMessage = useMutation({
    mutationFn: ({ groupId, content, channels }: { groupId: string, content: string, channels: string[] }) => 
      logService.sendMessage(groupId, content, channels),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logs'] })
  });

  return {
    logs,
    isLoading,
    error,
    sendMessage
  };
}
