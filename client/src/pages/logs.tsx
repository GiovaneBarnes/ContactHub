import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/mock-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function LogsPage() {
  const { data: logs, isLoading } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: api.logs.list 
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight">Message Logs</h2>
        <p className="text-muted-foreground mt-1">History of all automated and manual messages sent.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="w-[40%]">Message</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{log.groupName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={log.messageContent}>
                      {log.messageContent}
                    </TableCell>
                    <TableCell>{log.recipients}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
