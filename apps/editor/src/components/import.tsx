"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { toast } from "@zoonk/ui/components/sonner";
import { cn } from "@zoonk/ui/lib/utils";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  LoaderCircleIcon,
  UploadIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

type ImportMode = "merge" | "replace";

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

  return (
    <ImportContext.Provider value={value}>{children}</ImportContext.Provider>
  );
}

const BYTES_PER_KB = 1024;

function isJsonFile(f: File): boolean {
  return f.type === "application/json" || f.name.endsWith(".json");
}

function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
  e.preventDefault();
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isJsonFile(selectedFile)) {
      setFile(selectedFile);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isJsonFile(droppedFile)) {
      setFile(droppedFile);
    }
  }

  return (
    <label
      className={cn(
        "group flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-input border-dashed bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50",
        className,
      )}
      data-slot="import-dropzone"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      {...props}
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
    <div
      className={cn("grid gap-3", className)}
      data-slot="import-mode-selector"
      {...props}
    >
      {label && <Label className="font-medium text-sm">{label}</Label>}
      <RadioGroup
        onValueChange={(value) => setMode(value as ImportMode)}
        value={mode}
      >
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
      className={cn(
        "flex cursor-pointer items-center gap-3 font-normal",
        className,
      )}
      data-slot="import-mode-option"
      {...props}
    >
      <RadioGroupItem value={value} />
      <span>{children}</span>
    </Label>
  );
}

function ImportFormatPreview({
  format,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  format: object;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      className={className}
      data-slot="import-format-preview"
      onOpenChange={setOpen}
      open={open}
      {...props}
    >
      <CollapsibleTrigger className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        {open ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="wrap-break-word mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 font-mono text-xs">
          {JSON.stringify(format, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ImportSubmit({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { file, pending, handleImport } = useImport();

  return (
    <Button
      className={className}
      data-slot="import-submit"
      disabled={!file || pending}
      onClick={handleImport}
      {...props}
    >
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {children}
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
      onClick={(e) => {
        reset();
        onClick?.(e);
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
  ImportFormatPreview,
  ImportSubmit,
  ImportCancel,
};
