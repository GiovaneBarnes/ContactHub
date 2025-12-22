import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { firebaseApi } from "@/lib/firebase-api";
import { useAuth } from "@/lib/auth-context";
import { formatWithTimezone } from "@/lib/timezone-utils";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, MessageSquare, ExternalLink, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { MessageLog } from "@/lib/types";

export default function LogsPage() {
  const { user } = useAuth();
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);
  const { data: logs, isLoading } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: firebaseApi.logs.list 
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
                <TableHead className="w-[140px] sm:w-auto">Time</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="hidden md:table-cell w-[40%]">Message</TableHead>
                <TableHead className="hidden sm:table-cell">Recipients</TableHead>
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
                  <TableRow
                    key={log.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-muted-foreground text-xs sm:text-sm whitespace-nowrap hover:text-foreground transition-colors">
                      {formatWithTimezone(log.timestamp, user?.timezone)}
                    </TableCell>
                    <TableCell className="font-medium hover:text-primary transition-colors text-sm">
                      {log.groupDeleted ? (
                        <span className="text-muted-foreground italic text-xs sm:text-sm">Group Deleted</span>
                      ) : (
                        log.groupName
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate hover:text-foreground transition-colors" title={log.messageContent}>
                      {log.messageContent}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell hover:text-foreground transition-colors text-sm">{log.recipients}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="hover-scale text-xs">
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

      {/* Detailed Log View Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-base sm:text-lg">Message Details</span>
              <Badge variant={selectedLog?.status === 'sent' ? 'default' : 'destructive'}>
                {selectedLog?.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-sm">
              View detailed information about this message log entry.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 sm:space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="text-xs sm:text-sm mt-1">{formatWithTimezone(selectedLog.timestamp, user?.timezone)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Group</label>
                  <div className="flex items-center gap-2">
                    {selectedLog.groupDeleted ? (
                      <p className="text-sm text-muted-foreground italic">Group Deleted</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{selectedLog.groupName}</p>
                        <Link href={`/groups/${selectedLog.groupId}`}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Delivery Method</label>
                  <div className="flex items-center gap-2">
                    {selectedLog.deliveryMethod === 'both' && (
                      <>
                        <Mail className="h-4 w-4" />
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">SMS & Email</span>
                      </>
                    )}
                    {selectedLog.deliveryMethod === 'email' && (
                      <>
                        <Mail className="h-4 w-4" />
                        <span className="text-sm">Email Only</span>
                      </>
                    )}
                    {selectedLog.deliveryMethod === 'sms' && (
                      <>
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">SMS Only</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Message Content */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Message Content</label>
                <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedLog.messageContent}</p>
                </div>
              </div>

              <Separator />

              {/* Recipients */}
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 block">
                  Recipients ({selectedLog.recipientDetails.length})
                </label>
                <div className="space-y-2 sm:space-y-3">
                  {selectedLog.recipientDetails.map((recipient) => (
                    <div key={recipient.contactId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{recipient.name}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="truncate">{recipient.email}</span>
                          <span className="truncate">{recipient.phone}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                        {/* Email Status */}
                        {selectedLog.deliveryMethod === 'email' || selectedLog.deliveryMethod === 'both' ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {recipient.emailStatus === 'sent' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {recipient.emailStatus === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                            {recipient.emailStatus === 'not_sent' && <AlertCircle className="h-4 w-4 text-gray-400" />}
                            <span className="text-xs capitalize">{recipient.emailStatus.replace('_', ' ')}</span>
                          </div>
                        ) : null}

                        {/* SMS Status */}
                        {selectedLog.deliveryMethod === 'sms' || selectedLog.deliveryMethod === 'both' ? (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {recipient.smsStatus === 'sent' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {recipient.smsStatus === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                            {recipient.smsStatus === 'not_sent' && <AlertCircle className="h-4 w-4 text-gray-400" />}
                            <span className="text-xs capitalize">{recipient.smsStatus.replace('_', ' ')}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Messages */}
              {selectedLog.recipientDetails.some(r => r.errorMessage) && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-3 block">Errors</label>
                    <div className="space-y-2">
                      {selectedLog.recipientDetails
                        .filter(r => r.errorMessage)
                        .map((recipient) => (
                          <div key={recipient.contactId} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <span className="font-medium">{recipient.name}:</span>
                            <span>{recipient.errorMessage}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
