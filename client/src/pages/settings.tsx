import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, Key, Trash2, User, Mail, AlertTriangle } from "lucide-react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLocation } from "wouter";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { metricsService } from "@/lib/metrics";

export default function Settings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Profile state
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Account deletion state
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleUpdateProfile = async () => {
    if (!auth.currentUser || !displayName.trim()) {
      toast({
        title: "Invalid name",
        description: "Please enter a valid display name",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
      });
      
      toast({
        title: "Profile updated",
        description: "Your display name has been updated successfully",
      });
      
      await metricsService.trackFeatureUsage("profile_updated");
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser || !user?.email) {
      toast({
        title: "Authentication required",
        description: "Please sign in to change your password",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, newPassword);
      
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully",
      });
      
      await metricsService.trackFeatureUsage("password_changed");
    } catch (error) {
      let errorMessage = "Failed to change password";
      if (error instanceof Error) {
        if (error.message.includes("wrong-password")) {
          errorMessage = "Current password is incorrect";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Password change failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser || !user?.email) {
      toast({
        title: "Authentication required",
        description: "Please sign in to delete your account",
        variant: "destructive",
      });
      return;
    }

    if (deleteConfirmation !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: 'Please type "DELETE" to confirm account deletion',
        variant: "destructive",
      });
      return;
    }

    setIsDeletingAccount(true);
    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Call cloud function to archive user data before deletion
      const archiveUserData = httpsCallable(functions, 'archiveUserData');
      await archiveUserData({ userId: user.id });
      
      // Delete the user account
      await auth.currentUser.delete();
      
      toast({
        title: "Account deleted",
        description: "Your account has been deleted. Your data has been archived for legal purposes.",
      });
      
      await metricsService.trackFeatureUsage("account_deleted");
      
      // Redirect to home
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    } catch (error) {
      let errorMessage = "Failed to delete account";
      if (error instanceof Error) {
        if (error.message.includes("wrong-password")) {
          errorMessage = "Password is incorrect";
        } else if (error.message.includes("requires-recent-login")) {
          errorMessage = "Please log out and log in again before deleting your account";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Account deletion failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsDeletingAccount(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to access settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/auth")} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="glass hover-lift">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Profile Information</CardTitle>
          </div>
          <CardDescription>
            Update your profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="flex-1 bg-muted"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <Button
            onClick={handleUpdateProfile}
            disabled={isUpdatingProfile || displayName === user.name}
            className="w-full sm:w-auto"
          >
            {isUpdatingProfile ? "Updating..." : "Update Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="glass hover-lift">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min. 6 characters)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="w-full sm:w-auto"
          >
            {isChangingPassword ? "Changing..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone - Account Deletion */}
      <Card className="glass hover-lift border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Once you delete your account, there is no going back. Your data will be archived for legal compliance but will no longer be accessible to you.
                </p>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This action cannot be undone. This will permanently delete your account and archive your data for legal compliance purposes.
                  </p>
                  <p className="font-medium text-foreground">
                    Your data will be retained for 90 days in a secure archive for legal and compliance reasons, then permanently deleted.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="deleteConfirmation">
                    Type <span className="font-bold">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="deleteConfirmation"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type DELETE"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="deletePassword">
                    Enter your password to confirm
                  </Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {
                  setDeleteConfirmation("");
                  setDeletePassword("");
                }}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || deleteConfirmation !== "DELETE" || !deletePassword}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isDeletingAccount ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
