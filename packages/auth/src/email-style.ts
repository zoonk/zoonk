/**
 * Every email sets its own text style: a mail app draws unstyled HTML in its default face, which is
 * a serif in some (Outlook, the local mailbox). Mail apps can't load Geist, so the stack names the
 * device's own sans.
 */
export const EMAIL_TEXT_STYLE =
  "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:560px";

export const EMAIL_MONO_FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export const EMAIL_MUTED_COLOR = "#71717a";
