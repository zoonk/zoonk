import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <AdminPage>
      <AdminPageHeader title="Nothing here">
        This record doesn&apos;t exist. It may have been deleted, or the link is wrong.
      </AdminPageHeader>

      <AdminPageBody>
        <Button className="w-max" nativeButton={false} render={<Link href="/" prefetch />}>
          Go to Home
        </Button>
      </AdminPageBody>
    </AdminPage>
  );
}
