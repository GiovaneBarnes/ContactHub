import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoogleContactsIntegration } from "@/lib/google-contacts";
import { VCardParser, isVCardFile } from "@/lib/vcard-parser";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactsImported: (contacts: any[]) => void;
}

export function ContactImportDialog({
  open,
  onOpenChange,
  onContactsImported,
}: ContactImportDialogProps) {
  const [importMethod, setImportMethod] = useState<"google" | "apple" | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleGoogleImport = async () => {
    setIsImporting(true);
    try {
      const googleContacts = await GoogleContactsIntegration.importContacts();
      
      if (googleContacts.length === 0) {
        toast({
          title: "No contacts found",
          description: "Your Google account has no contacts to import.",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      onContactsImported(googleContacts);
      onOpenChange(false);
      
      toast({
        title: "Google Contacts imported! 🎉",
        description: `Successfully imported ${googleContacts.length} contacts.`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import Google contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleAppleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const appleContacts = await VCardParser.parseFile(importFile);
      
      if (appleContacts.length === 0) {
        toast({
          title: "No contacts found",
          description: "The vCard file appears to be empty.",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      onContactsImported(appleContacts);
      onOpenChange(false);
      
      toast({
        title: "Apple Contacts imported! 🎉",
        description: `Successfully imported ${appleContacts.length} contacts.`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to parse vCard file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = () => {
    if (importMethod === "google") {
      handleGoogleImport();
    } else if (importMethod === "apple") {
      handleAppleImport();
    }
  };

  const handleClose = () => {
    setImportMethod(null);
    setImportFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Import Contacts</DialogTitle>
          <DialogDescription>
            Choose how you'd like to import your contacts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg hover:scale-105",
                importMethod === "google" && "ring-2 ring-primary shadow-lg scale-105"
              )}
              onClick={() => setImportMethod("google")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center h-48">
                <div className="relative mb-4">
                  <div className="bg-blue-500/10 p-4 rounded-full">
                    <svg className="h-10 w-10" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">Google Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  Android • Gmail • One-click import
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg hover:scale-105",
                importMethod === "apple" && "ring-2 ring-primary shadow-lg scale-105"
              )}
              onClick={() => setImportMethod("apple")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center h-48">
                <div className="relative mb-4">
                  <div className="bg-gray-500/10 p-4 rounded-full">
                    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">Apple Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  iPhone • Mac • Export & upload
                </p>
              </CardContent>
            </Card>
          </div>

          {importMethod === "google" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500/10 p-3 rounded-full">
                    <svg className="h-8 w-8" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Import from Google Contacts</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Sign in with Google to import all your contacts instantly. We'll only access your contacts - nothing else.
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Secure OAuth - we never see your password</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Imports names, emails, phones, and notes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>One-time import - we don't store Google credentials</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">What happens next?</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      You'll see a Google sign-in popup. Select your account, grant permission to read contacts, and we'll import them automatically. Takes about 10 seconds for 100 contacts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {importMethod === "apple" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-start gap-4">
                  <div className="bg-gray-500/10 p-3 rounded-full">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Export from Apple Contacts</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Export your contacts as a vCard file from your iPhone or Mac, then upload it here. Takes less than 2 minutes!
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <h4 className="font-semibold text-sm">From iPhone/iPad</h4>
                  </div>
                  <ol className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">1.</span>
                      <span>Open the <strong>Contacts</strong> app on your iPhone</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">2.</span>
                      <span>Tap <strong>Lists</strong> at the top left</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">3.</span>
                      <span>Tap and hold on <strong>All Contacts</strong> or <strong>All iCloud</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">4.</span>
                      <span>Tap <strong>Export</strong> from the menu</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">5.</span>
                      <span>Choose <strong>Save to Files</strong> or <strong>AirDrop to Mac</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">6.</span>
                      <span>Upload the <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">.vcf</code> file below</span>
                    </li>
                  </ol>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <h4 className="font-semibold text-sm">From Mac</h4>
                  </div>
                  <ol className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">1.</span>
                      <span>Open the <strong>Contacts</strong> app on your Mac</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">2.</span>
                      <span>Press <kbd className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">⌘ Cmd</kbd> + <kbd className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">A</kbd> to select all contacts</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">3.</span>
                      <span>Click <strong>File</strong> → <strong>Export</strong> → <strong>Export vCard...</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">4.</span>
                      <span>Save the file (it will be a <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">.vcf</code> file)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">5.</span>
                      <span>Upload the <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">.vcf</code> file below</span>
                    </li>
                  </ol>
                </div>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-900 dark:text-green-100">Pro Tip</p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      The vCard format (.vcf) is universal - it also works with contacts exported from Google, Outlook, Samsung, and most contact apps!
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="apple-file">Upload your vCard file (.vcf)</Label>
                <Input
                  id="apple-file"
                  type="file"
                  accept=".vcf,text/vcard,text/x-vcard"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="mt-2"
                />
                {importFile && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected: {importFile.name}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importMethod || (importMethod === "apple" && !importFile) || isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {importMethod === "google" ? "Importing from Google..." : "Processing..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {importMethod === "google" ? "Sign in with Google" : "Import Contacts"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
