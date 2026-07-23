"use client";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "./button";

const toast = ToastPrimitive.createToastManager();
const centeredToast = ToastPrimitive.createToastManager();
const DEFAULT_TOAST_ACTION_RENDER = <Button size="xs" variant="outline" />;
const DEFAULT_TOAST_CLOSE_RENDER = <Button size="icon-xs" variant="ghost" />;
const DEFAULT_TOAST_TITLE_RENDER = <div />;

const toastVariants = cva(
  "group/toast bg-popover text-popover-foreground focus-visible:border-ring focus-visible:ring-ring/50 pointer-events-auto absolute bottom-0 z-[calc(1000-var(--toast-index))] h-(--height) origin-bottom transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-lg border shadow-[0_4px_12px_rgb(0_0_0/0.1)] will-change-transform outline-none select-none [--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] focus-visible:ring-[3px] data-expanded:h-(--toast-height) data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))] data-limited:opacity-0 data-starting-style:transform-[translateY(150%)] data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(150%)]",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: { centered: "right-0 left-0 mx-auto w-fit max-w-full", default: "right-0 w-full" },
    },
  },
);

const toastViewportVariants = cva(
  "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto outline-none sm:right-8 sm:bottom-8",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        centered: "max-w-none sm:left-8",
        default: "max-w-[356px] sm:left-auto sm:mx-0 sm:w-full",
      },
    },
  },
);

type ToasterVariant = NonNullable<VariantProps<typeof toastVariants>["variant"]>;
type ShowToastOptions = Parameters<typeof toast.add>[0] & { variant?: ToasterVariant };

/**
 * Routes each notification to the region that owns its placement while keeping
 * Base UI's separate stores private to the shared toaster.
 */
function showToast({ variant = "default", ...options }: ShowToastOptions) {
  const toastManager = variant === "centered" ? centeredToast : toast;

  return toastManager.add(options);
}

/**
 * Keeps success notifications visually consistent without making every
 * producer repeat the renderer's status-type contract.
 */
function showSuccessToast(title: ReactNode) {
  return showToast({ title, type: "success" });
}

/**
 * Couples error styling with an urgent live-region announcement so producers
 * cannot accidentally render an error icon that assistive technology treats
 * as a routine update.
 */
function showErrorToast(title: ReactNode) {
  return showToast({ priority: "high", title, type: "error" });
}

/**
 * Keeps Base UI's provider available through the shared component boundary so
 * custom managers can reuse the same renderer without importing primitives.
 */
function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />;
}

/**
 * Marks the portal in the DOM so composed toast renderers have a stable slot
 * while Base UI remains responsible for where the portal is mounted.
 */
function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}

/**
 * Positions the toast stack above application content and gives Base UI the
 * focusable notification region it needs for keyboard navigation.
 */
function ToastViewport({
  className,
  variant,
  ...props
}: ToastPrimitive.Viewport.Props & VariantProps<typeof toastViewportVariants>) {
  return (
    <ToastPrimitive.Viewport
      className={cn(toastViewportVariants({ className, variant }))}
      data-slot="toast-viewport"
      {...props}
    />
  );
}

/**
 * Owns the shared toast surface and Base UI's stack, transition, and swipe
 * variables so every notification uses one visual and interaction contract.
 */
function Toast({
  className,
  variant,
  ...props
}: ToastPrimitive.Root.Props & VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitive.Root
      className={cn(toastVariants({ className, variant }))}
      data-slot="toast"
      {...props}
    />
  );
}

/**
 * Clips stacked toast content while preserving the layout Base UI measures for
 * expansion, focus, and swipe animations.
 */
function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      className={cn(
        "flex h-full items-center gap-1.5 overflow-hidden p-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-expanded:opacity-100",
        className,
      )}
      data-slot="toast-content"
      {...props}
    />
  );
}

/**
 * Keeps toast labels out of the page's heading hierarchy while Base UI still
 * connects the rendered title to the dialog through aria-labelledby.
 */
function ToastTitle({
  className,
  render = DEFAULT_TOAST_TITLE_RENDER,
  ...props
}: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      className={cn("text-[13px] leading-normal font-medium", className)}
      data-slot="toast-title"
      render={render}
      {...props}
    />
  );
}

/**
 * Renders the primary toast message through Base UI so both visible content and
 * assistive-technology announcements use the same source.
 */
function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      className={cn("text-muted-foreground text-[13px] leading-[1.4]", className)}
      data-slot="toast-description"
      {...props}
    />
  );
}

/**
 * Uses the shared button for optional toast actions while Base UI supplies the
 * action label and handler from the manager entry.
 */
function ToastAction({
  className,
  render = DEFAULT_TOAST_ACTION_RENDER,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      className={cn("shrink-0", className)}
      data-slot="toast-action"
      render={render}
      {...props}
    />
  );
}

/**
 * Keeps every toast dismissible by pointer or keyboard with the same compact
 * shared button and a larger invisible hit target.
 */
function ToastClose({
  className,
  children,
  render = DEFAULT_TOAST_CLOSE_RENDER,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      aria-label="Close toast"
      className={cn(
        "text-muted-foreground hover:text-foreground -mr-1 size-5 shrink-0 after:absolute after:-inset-2 after:content-['']",
        className,
      )}
      data-slot="toast-close"
      render={render}
      {...props}
    >
      {children ?? <XIcon aria-hidden="true" />}
    </ToastPrimitive.Close>
  );
}

/**
 * Maps the manager's status string to the icon language used throughout Zoonk
 * without coupling notification producers to visual React elements.
 */
function getToastIcon(type: string | undefined): ReactNode {
  if (type === "success") {
    return <CircleCheckIcon aria-hidden="true" />;
  }

  if (type === "info") {
    return <InfoIcon aria-hidden="true" />;
  }

  if (type === "warning") {
    return <TriangleAlertIcon aria-hidden="true" />;
  }

  if (type === "error") {
    return <OctagonXIcon aria-hidden="true" className="text-destructive" />;
  }

  if (type === "loading") {
    return <Loader2Icon aria-hidden="true" className="animate-spin" />;
  }

  return null;
}

/**
 * Reserves one compact leading slot for recognized statuses and omits the slot
 * entirely for neutral notifications such as keyboard guidance.
 */
function ToastIcon({ type }: { type: string | undefined }) {
  const icon = getToastIcon(type);

  if (!icon) {
    return null;
  }

  return (
    <span
      className="shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
      data-slot="toast-icon"
    >
      {icon}
    </span>
  );
}

/**
 * Turns the current manager entries into the compound toast structure while
 * allowing an explicit renderer variant to adjust only the root positioning.
 */
function ToastList({ variant }: { variant: ToasterVariant }) {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem} variant={variant}>
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose />
      </ToastContent>
    </Toast>
  ));
}

/**
 * Composes a manager, provider, viewport, and renderer once so position
 * variants cannot drift in their toast markup or behavior.
 */
function ToastRegion({
  children,
  toastManager,
  variant,
  ...props
}: ToastPrimitive.Provider.Props & { variant: ToasterVariant }) {
  return (
    <ToastProvider toastManager={toastManager} {...props}>
      {children}
      <ToastPortal>
        <ToastViewport variant={variant}>
          <ToastList variant={variant} />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}

/**
 * Mounts every supported toast region behind one application-level component
 * so the layout does not need to know how notification variants are routed.
 */
function Toaster(props: Omit<ToastPrimitive.Provider.Props, "children" | "toastManager">) {
  return (
    <>
      <ToastRegion toastManager={toast} variant="default" {...props} />
      <ToastRegion toastManager={centeredToast} variant="centered" {...props} />
    </>
  );
}

const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  showErrorToast,
  showSuccessToast,
  showToast,
  toast,
  toastVariants,
  toastViewportVariants,
  useToastManager,
};
