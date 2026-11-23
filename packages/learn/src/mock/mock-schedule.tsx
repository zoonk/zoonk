"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { Spinner } from "@zoonk/ui/components/spinner";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { ListGroup, ListRowButton, ListRowContent, ListRowTitle } from "../_components/list-group";
import { useChangeSaveFailed } from "../_components/save-error";
import { SheetHeader } from "../_components/sheet-header";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useMockSchedule } from "../learn-context";

export function MockSchedule({
  disabled = false,
  planItemId,
}: {
  disabled?: boolean;
  planItemId: string;
}) {
  const t = useExtracted();
  const format = useFormatIsoDate();
  const schedule = useMockSchedule();
  const failed = useChangeSaveFailed();
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<string[] | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const readId = useRef(0);

  if (!schedule) {
    return null;
  }

  const read = async () => {
    readId.current += 1;
    const id = readId.current;
    setReadFailed(false);
    setDates(null);
    const { data } = await safeAsync(() => schedule.dates(planItemId));

    if (readId.current === id) {
      setDates(data);
      setReadFailed(data === null);
    }
  };

  const save = async (date: string | null) => {
    setSaving(true);
    const { data: changeId } = await safeAsync(() => schedule.change(planItemId, date));
    setSaving(false);

    if (!changeId) {
      failed();
      void read();
      return;
    }

    setOpen(false);
    schedule.showToday();

    showSuccessToast(
      date
        ? t("Moved to {date}", { date: format(date, "sentence", { weekday: true }) })
        : t("Mock exam skipped"),
      {
        label: t("Undo"),
        onClick: async () => {
          const { data: undone } = await safeAsync(() => schedule.undo(planItemId, changeId));

          if (undone) {
            schedule.showToday();
          } else {
            failed();
          }
        },
      },
    );
  };

  const rows = dates?.map((date) => (
    <ListRowButton disabled={saving} key={date} onClick={() => void save(date)}>
      <ListRowContent className="min-h-11">
        <ListRowTitle>{format(date, "row", { weekday: true })}</ListRowTitle>
      </ListRowContent>
    </ListRowButton>
  ));

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (saving) {
          return;
        }

        setOpen(next);

        if (next) {
          void read();
        }
      }}
    >
      <DrawerTrigger
        disabled={disabled}
        render={<Button className="relative z-1 self-start" size="sm" variant="link" />}
      >
        {t("Change schedule")}
      </DrawerTrigger>
      <DrawerPopup>
        <SheetHeader>
          <DrawerTitle>{t("Change mock exam date")}</DrawerTitle>
        </SheetHeader>
        <DrawerContent>
          {readFailed && (
            <div role="alert">
              <Button onClick={() => void read()} variant="outline">
                {t("Try again")}
              </Button>
            </div>
          )}
          {!readFailed && dates === null && <Spinner aria-label={t("Loading")} />}
          <ListGroup>{rows}</ListGroup>
        </DrawerContent>
        {dates && (
          <DrawerFooter>
            <Button disabled={saving} onClick={() => void save(null)} variant="ghost">
              {t("Skip this mock exam")}
            </Button>
          </DrawerFooter>
        )}
      </DrawerPopup>
    </Drawer>
  );
}
