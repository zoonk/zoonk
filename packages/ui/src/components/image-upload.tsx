"use client";

import {
  DEFAULT_IMAGE_ACCEPTED_TYPES,
  DEFAULT_IMAGE_MAX_SIZE,
} from "@zoonk/utils/constants";
import { LoaderCircleIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useTransition,
} from "react";
import { cn } from "../lib/utils";
import { Skeleton } from "./skeleton";
import { toast } from "./sonner";

type ImageUploadContextValue = {
  currentImageUrl: string | null;
  uploading: boolean;
  removing: boolean;
  hasImage: boolean;
  pending: boolean;
  openFilePicker: () => void;
  handleRemove: () => void;
};

const ImageUploadContext = createContext<ImageUploadContextValue | undefined>(
  undefined,
);

function useImageUpload() {
  const context = useContext(ImageUploadContext);
  if (!context) {
    throw new Error(
      "ImageUpload components must be used within an ImageUploadProvider.",
    );
  }
  return context;
}

function isValidImage(params: {
  file: File;
  acceptedTypes: string[];
  maxSize: number;
  onInvalidType?: () => void;
  onTooLarge?: () => void;
}): boolean {
  const { file, acceptedTypes, maxSize, onInvalidType, onTooLarge } = params;

  if (!acceptedTypes.includes(file.type)) {
    onInvalidType?.();
    return false;
  }

  if (file.size > maxSize) {
    onTooLarge?.();
    return false;
  }

  return true;
}

type ImageUploadMessages = {
  invalidType?: string;
  tooLarge?: string;
  uploadSuccess?: string;
  removeSuccess?: string;
};

const DEFAULT_MESSAGES: Required<ImageUploadMessages> = {
  invalidType: "Invalid file type",
  removeSuccess: "Image removed",
  tooLarge: "File is too large",
  uploadSuccess: "Image uploaded",
};

function ImageUploadProvider({
  children,
  currentImageUrl,
  onUpload,
  onRemove,
  onSuccess,
  acceptedTypes = DEFAULT_IMAGE_ACCEPTED_TYPES,
  maxSize = DEFAULT_IMAGE_MAX_SIZE,
  messages,
}: {
  children: React.ReactNode;
  currentImageUrl: string | null;
  onUpload: (formData: FormData) => Promise<{ error: string | null }>;
  onRemove: () => Promise<{ error: string | null }>;
  onSuccess?: () => void;
  acceptedTypes?: string[];
  maxSize?: number;
  messages?: ImageUploadMessages;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUploadTransition] = useTransition();
  const [removing, startRemoveTransition] = useTransition();

  const resolvedMessages = { ...DEFAULT_MESSAGES, ...messages };

  const handleInvalidType = useCallback(() => {
    toast.error(resolvedMessages.invalidType);
  }, [resolvedMessages.invalidType]);

  const handleTooLarge = useCallback(() => {
    toast.error(resolvedMessages.tooLarge);
  }, [resolvedMessages.tooLarge]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (
        !(
          file &&
          isValidImage({
            acceptedTypes,
            file,
            maxSize,
            onInvalidType: handleInvalidType,
            onTooLarge: handleTooLarge,
          })
        )
      ) {
        return;
      }

      startUploadTransition(async () => {
        const formData = new FormData();
        formData.append("file", file);

        const { error } = await onUpload(formData);

        if (error) {
          toast.error(error);
        } else {
          toast.success(resolvedMessages.uploadSuccess);
          onSuccess?.();
        }
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [
      acceptedTypes,
      maxSize,
      onUpload,
      onSuccess,
      handleInvalidType,
      handleTooLarge,
      resolvedMessages.uploadSuccess,
    ],
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleRemove = useCallback(() => {
    startRemoveTransition(async () => {
      const { error } = await onRemove();

      if (error) {
        toast.error(error);
      } else {
        toast.success(resolvedMessages.removeSuccess);
        onSuccess?.();
      }
    });
  }, [onRemove, onSuccess, resolvedMessages.removeSuccess]);

  const hasImage = Boolean(currentImageUrl);
  const pending = uploading || removing;

  const value = useMemo<ImageUploadContextValue>(
    () => ({
      currentImageUrl,
      handleRemove,
      hasImage,
      openFilePicker,
      pending,
      removing,
      uploading,
    }),
    [
      currentImageUrl,
      handleRemove,
      hasImage,
      openFilePicker,
      pending,
      removing,
      uploading,
    ],
  );

  return (
    <ImageUploadContext.Provider value={value}>
      {children}
      <input
        accept={acceptedTypes.join(",")}
        className="hidden"
        disabled={pending}
        onChange={handleFileSelect}
        ref={inputRef}
        type="file"
      />
    </ImageUploadContext.Provider>
  );
}

function ImageUploadTrigger({
  children,
  className,
  size = 96,
  ...props
}: Omit<React.ComponentProps<"div">, "onClick"> & {
  size?: number;
}) {
  const { hasImage, pending, openFilePicker, handleRemove } = useImageUpload();

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    } else if (
      (e.key === "Delete" || e.key === "Backspace") &&
      hasImage &&
      !pending
    ) {
      e.preventDefault();
      handleRemove();
    }
  }

  return (
    <div
      aria-disabled={pending}
      className={cn(
        "group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        pending && "pointer-events-none",
        className,
      )}
      data-slot="image-upload-trigger"
      onClick={openFilePicker}
      onKeyDown={handleKeyDown}
      role="button"
      style={{ height: size, width: size }}
      tabIndex={pending ? -1 : 0}
      {...props}
    >
      {children}
    </div>
  );
}

function ImageUploadOverlay({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { pending } = useImageUpload();

  if (pending) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center gap-2 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
        className,
      )}
      data-slot="image-upload-overlay"
      {...props}
    >
      {children}
    </div>
  );
}

function ImageUploadLoading({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { pending } = useImageUpload();

  if (!pending) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-background/80",
        className,
      )}
      data-slot="image-upload-loading"
      {...props}
    >
      <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" />
      {children}
    </div>
  );
}

function ImageUploadRemoveButton({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onClick" | "type">) {
  const { hasImage, handleRemove } = useImageUpload();

  if (!hasImage) {
    return null;
  }

  return (
    <button
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border hover:bg-destructive hover:text-destructive-foreground hover:ring-destructive [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="image-upload-remove-button"
      onClick={(e) => {
        e.stopPropagation();
        handleRemove();
      }}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

function ImageUploadPlaceholder({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "size-8 text-muted-foreground transition-colors group-hover:text-foreground [&>svg]:size-full",
        className,
      )}
      data-slot="image-upload-placeholder"
      {...props}
    >
      {children}
    </span>
  );
}

function ImageUploadActionButton({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="image-upload-action-button"
      {...props}
    >
      {children}
    </span>
  );
}

function ImageUploadSkeleton({
  className,
  size = 96,
  ...props
}: React.ComponentProps<"div"> & {
  size?: number;
}) {
  return (
    <Skeleton
      className={cn("rounded-xl", className)}
      data-slot="image-upload-skeleton"
      style={{ height: size, width: size }}
      {...props}
    />
  );
}

export {
  ImageUploadProvider,
  ImageUploadTrigger,
  ImageUploadOverlay,
  ImageUploadLoading,
  ImageUploadRemoveButton,
  ImageUploadPlaceholder,
  ImageUploadActionButton,
  ImageUploadSkeleton,
  useImageUpload,
};
