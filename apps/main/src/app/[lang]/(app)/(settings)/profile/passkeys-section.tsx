import { getPasskeys } from "@zoonk/core/users/passkeys";
import {
  PageSection,
  PageSectionFooter,
  PageSectionHeader,
  PageSectionTitle,
} from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";
import { PasskeyList } from "./passkey-list";

const PASSKEYS_ID = "passkeys";

export async function PasskeysSection() {
  const [t, passkeys] = await Promise.all([getExtracted(), getPasskeys()]);

  if (!passkeys) {
    return null;
  }

  return (
    <PageSection aria-labelledby={PASSKEYS_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={PASSKEYS_ID}>{t("Passkeys")}</PageSectionTitle>
      </PageSectionHeader>

      <PasskeyList passkeys={passkeys} />

      <PageSectionFooter>
        {t("You approve content fixes in Admin with a passkey.")}
      </PageSectionFooter>
    </PageSection>
  );
}
