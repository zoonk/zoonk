"use client";

import { type ImportMode, isImportMode } from "@/lib/import-mode";
import { Button } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { toast } from "@zoonk/ui/components/sonner";
import { cn } from "@zoonk/ui/lib/utils";
import { FileIcon, LoaderCircleIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

type ImportContextValue = {
  file: File | null;
  mode: ImportMode;
  pending: boolean;
  setFile: (file: File | null) => void;
  setMode: (mode: ImportMode) => void;
  handleImport: () => void;
  reset: () => void;
};

const ImportContext = createContext<ImportContextValue | undefined>(undefined);

function useImport() {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error("Import components must be used within an ImportProvider.");
  }
  return context;
}

function ImportProvider({
  children,
  onImport,
  onSuccess,
}: {
  children: React.ReactNode;
  onImport: (formData: FormData) => Promise<{ error: string | null }>;
  onSuccess?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [pending, startTransition] = useTransition();

  const reset = useCallback(() => {
    setFile(null);
    setMode("merge");
  }, []);

  const handleImport = useCallback(() => {
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
      } else {
        reset();
        onSuccess?.();
      }
    });
  }, [file, mode, onImport, onSuccess, reset]);

  const value = useMemo<ImportContextValue>(
    () => ({
      file,
      handleImport,
      mode,
      pending,
      reset,
      setFile,
      setMode,
    }),
    [file, handleImport, mode, pending, reset],
  );

  return <ImportContext.Provider value={value}>{children}</ImportContext.Provider>;
}

const BYTES_PER_KB = 1024;

function isJsonFile(file: File): boolean {
  return file.type === "application/json" || file.name.endsWith(".json");
}

function handleDragOver(event: React.DragEvent<HTMLLabelElement>) {
  event.preventDefault();
}

function formatFileSize(bytes: number): string {
  return (bytes / BYTES_PER_KB).toFixed(1);
}

function ImportDropzone({
  children,
  className,
  fileSizeUnit = "KB",
  ...props
}: React.ComponentProps<"label"> & {
  fileSizeUnit?: string;
}) {
  const { file, setFile } = useImport();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && isJsonFile(selectedFile)) {
      setFile(selectedFile);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && isJsonFile(droppedFile)) {
      setFile(droppedFile);
    }
  }

  return (
    <label
      className={cn(
        "group border-input bg-muted/30 hover:border-primary/50 hover:bg-muted/50 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
        className,
      )}
      data-slot="import-dropzone"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      {...props}
    >
      {file ? (
        <>
          <FileIcon className="text-muted-foreground size-8" />
          <span className="text-sm font-medium">{file.name}</span>
          <span className="text-muted-foreground text-xs">
            {formatFileSize(file.size)} {fileSizeUnit}
          </span>
        </>
      ) : (
        <>
          <UploadIcon className="text-muted-foreground group-hover:text-foreground size-8 transition-colors" />
          <span className="text-muted-foreground text-sm">{children}</span>
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
  );
}

function ImportModeSelector({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"div"> & {
  label?: string;
}) {
  const { mode, setMode } = useImport();

  return (
    <div className={cn("grid gap-3", className)} data-slot="import-mode-selector" {...props}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <RadioGroup onValueChange={(value) => isImportMode(value) && setMode(value)} value={mode}>
        {children}
      </RadioGroup>
    </div>
  );
}

function ImportModeOption({
  children,
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"label">, "value"> & {
  value: ImportMode;
}) {
  return (
    <Label
      className={cn("flex cursor-pointer items-center gap-3 font-normal", className)}
      data-slot="import-mode-option"
      {...props}
    >
      <RadioGroupItem value={value} />
      <span>{children}</span>
    </Label>
  );
}

function ImportReplaceWarning({ children, className, ...props }: React.ComponentProps<"p">) {
  const { mode } = useImport();

  if (mode !== "replace") {
    return null;
  }

  return (
    <p
      className={cn("text-destructive flex items-start gap-2 text-sm", className)}
      data-slot="import-replace-warning"
      role="alert"
      {...props}
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function ImportSubmit({
  children,
  replaceChildren,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  replaceChildren?: React.ReactNode;
}) {
  const { file, mode, pending, handleImport } = useImport();
  const isReplace = mode === "replace";

  return (
    <Button
      className={className}
      data-slot="import-submit"
      disabled={!file || pending}
      onClick={handleImport}
      variant={isReplace ? "destructive" : undefined}
      {...props}
    >
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {isReplace && replaceChildren ? replaceChildren : children}
    </Button>
  );
}

function ImportCancel({
  children,
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending, reset } = useImport();

  return (
    <Button
      className={className}
      data-slot="import-cancel"
      disabled={pending}
      onClick={(event) => {
        reset();
        onClick?.(event);
      }}
      variant="outline"
      {...props}
    >
      {children}
    </Button>
  );
}

export {
  ImportProvider,
  ImportDropzone,
  ImportModeSelector,
  ImportModeOption,
  ImportReplaceWarning,
  ImportSubmit,
  ImportCancel,
};
