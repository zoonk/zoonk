"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { toast } from "@zoonk/ui/components/sonner";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  LoaderCircleIcon,
  UploadIcon,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";

type ImportMode = "merge" | "replace";

const BYTES_PER_KB = 1024;

export function ImportDialog({
  cancelLabel,
  description,
  dropLabel,
  exampleFormat,
  fileSizeUnit,
  importLabel,
  modeLabel,
  modeMergeLabel,
  modeReplaceLabel,
  onImport,
  onOpenChange,
  open,
  showFormatLabel,
  successMessage,
  title,
}: {
  cancelLabel: string;
  description: string;
  dropLabel: string;
  exampleFormat: object;
  fileSizeUnit: string;
  importLabel: string;
  modeLabel: string;
  modeMergeLabel: string;
  modeReplaceLabel: string;
  onImport: (formData: FormData) => Promise<{ error: string | null }>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  showFormatLabel: string;
  successMessage: string;
  title: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [showFormat, setShowFormat] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }

  function isJsonFile(f: File): boolean {
    return f.type === "application/json" || f.name.endsWith(".json");
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isJsonFile(droppedFile)) {
      setFile(droppedFile);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
  }

  function handleImport() {
    if (!file) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);

      const { error } = await onImport(formData);

      if (error) {
        toast.error(error);
        return;
      }

      toast.success(successMessage);
      handleClose();
    });
  }

  function formatFileSize(bytes: number): string {
    return (bytes / BYTES_PER_KB).toFixed(1);
  }

  function handleClose() {
    setFile(null);
    setMode("merge");
    setShowFormat(false);
    onOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-6">
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: label wrapping file input is the accessible pattern for file uploads */}
          <label
            className="group flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-input border-dashed bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {file ? (
              <>
                <FileIcon className="size-8 text-muted-foreground" />
                <span className="font-medium text-sm">{file.name}</span>
                <span className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)} {fileSizeUnit}
                </span>
              </>
            ) : (
              <>
                <UploadIcon className="size-8 text-muted-foreground transition-colors group-hover:text-foreground" />
                <span className="text-muted-foreground text-sm">
                  {dropLabel}
                </span>
              </>
            )}
            <input
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
              ref={inputRef}
              type="file"
            />
          </label>

          <div className="grid gap-3">
            <Label className="font-medium text-sm">{modeLabel}</Label>
            <RadioGroup
              defaultValue="merge"
              onValueChange={(value) => setMode(value as ImportMode)}
              value={mode}
            >
              <Label className="flex cursor-pointer items-center gap-3 font-normal">
                <RadioGroupItem value="merge" />
                <span>{modeMergeLabel}</span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-3 font-normal">
                <RadioGroupItem value="replace" />
                <span>{modeReplaceLabel}</span>
              </Label>
            </RadioGroup>
          </div>

          <Collapsible onOpenChange={setShowFormat} open={showFormat}>
            <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
              {showFormat ? (
                <ChevronDownIcon className="size-4" />
              ) : (
                <ChevronRightIcon className="size-4" />
              )}
              {showFormatLabel}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="wrap-break-word mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 font-mono text-xs">
                {JSON.stringify(exampleFormat, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button disabled={pending} onClick={handleClose} variant="outline">
            {cancelLabel}
          </Button>
          <Button disabled={!file || pending} onClick={handleImport}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {importLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
