"use client";

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
} from "@zoonk/ui/components/alert-dialog";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { banUserAction } from "./_actions/ban-user";

export function BanUserDialog({ userId, userName }: { userId: number; userName: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Ban User
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will prevent the user from accessing the platform.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={banUserAction}>
          <input type="hidden" name="userId" value={userId} />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" name="reason" placeholder="Reason for banning..." />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="expires">Expires (optional)</Label>
              <Input id="expires" name="expires" type="date" />
            </div>
          </div>

          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive">
              Ban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
