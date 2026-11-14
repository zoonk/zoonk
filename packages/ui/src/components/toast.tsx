"use client";

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
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
const DEFAULT_TOAST_ACTION_RENDER = <Button size="xs" variant="outline" />;
const DEFAULT_TOAST_CLOSE_RENDER = <Button size="icon-xs" variant="ghost" />;
const DEFAULT_TOAST_TITLE_RENDER = <div />;

const TOAST_CLASS =
  "group/toast bg-popover text-popover-foreground focus-visible:border-ring focus-visible:ring-ring/50 pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] h-(--height) w-full origin-bottom transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-lg border shadow-[0_4px_12px_rgb(0_0_0/0.1)] will-change-transform outline-none select-none [--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] focus-visible:ring-[3px] data-expanded:h-(--toast-height) data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))] data-limited:opacity-0 data-starting-style:transform-[translateY(150%)] data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))] data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(150%)]";

/**
 * A margin, not `bottom`, lifts toasts above a bottom tab bar and a page's bottom bar, since it adds
 * to `bottom` at every width: a toast over the bar would cover its main action until it leaves.
 */
const TOAST_VIEWPORT_CLASS =
  "pointer-events-none fixed inset-x-4 bottom-4 z-60 mx-auto mb-[calc(var(--toast-over-tabs)+var(--toast-over-bar))] w-auto max-w-[356px] outline-none [--toast-over-bar:0px] [--toast-over-tabs:0px] sm:right-8 sm:bottom-8 sm:left-auto sm:mx-0 sm:w-full in-[body:has([data-slot=bottom-bar])]:[--toast-over-bar:calc(4.75rem+env(safe-area-inset-bottom))] sm:in-[body:has([data-slot=bottom-bar])]:[--toast-over-bar:5.75rem] max-lg:in-[body:has([data-bottom-bar])]:[--toast-over-tabs:calc(4rem+env(safe-area-inset-bottom))]";

/** `action` is the one thing to do about what just happened, such as Undo. */
function showSuccessToast(title: ReactNode, action?: { label: ReactNode; onClick: () => void }) {
  return toast.add({
    actionProps: action && { children: action.label, onClick: action.onClick },
    title,
    type: "success",
  });
}

function showErrorToast(title: ReactNode) {
  return toast.add({ priority: "high", title, type: "error" });
}

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />;
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      className={cn(TOAST_VIEWPORT_CLASS, className)}
      data-slot="toast-viewport"
      {...props}
    />
  );
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root className={cn(TOAST_CLASS, className)} data-slot="toast" {...props} />
  );
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      className={cn(
        "text-compact flex h-full items-start gap-1.5 overflow-hidden p-4 leading-5 transition-opacity duration-250 ease-out data-behind:opacity-0 data-expanded:opacity-100",
        className,
      )}
      data-slot="toast-content"
      {...props}
    />
  );
}

function ToastTitle({
  className,
  render = DEFAULT_TOAST_TITLE_RENDER,
  ...props
}: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      className={cn("text-compact leading-5 font-medium", className)}
      data-slot="toast-title"
      render={render}
      {...props}
    />
  );
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      className={cn("text-muted-foreground text-compact leading-[1.4]", className)}
      data-slot="toast-description"
      {...props}
    />
  );
}

function ToastAction({
  className,
  render = DEFAULT_TOAST_ACTION_RENDER,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      className={cn("-my-0.5 shrink-0", className)}
      data-slot="toast-action"
      render={render}
      {...props}
    />
  );
}

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
        "text-muted-foreground hover:text-foreground edge -me-(--edge-pull) shrink-0 [--control-size:--spacing(5)] after:absolute after:-inset-2 after:content-['']",
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
    return <OctagonXIcon aria-hidden="true" className="text-destructive-text" />;
  }

  if (type === "loading") {
    return <Loader2Icon aria-hidden="true" className="animate-spin" />;
  }

  return null;
}

function ToastIcon({ type }: { type: string | undefined }) {
  const icon = getToastIcon(type);

  if (!icon) {
    return null;
  }

  return (
    <LineMarker
      className="[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
      data-slot="toast-icon"
    >
      {icon}
    </LineMarker>
  );
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((toastItem) => (
    <Toast key={toastItem.id} toast={toastItem}>
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

/** Mount it once per app. */
function Toaster(props: Omit<ToastPrimitive.Provider.Props, "children" | "toastManager">) {
  return (
    <ToastProvider toastManager={toast} {...props}>
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
}

export { Toaster, showErrorToast, showSuccessToast };
