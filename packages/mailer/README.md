# Zoonk Mailer

This package contains our mailer service, which is responsible for sending emails. We're using [ZeptoMail](https://zeptomail.com/) as our email service provider.

## Usage

```ts
import { sendEmail } from "@zoonk/mailer";

await sendEmail({
  to: "<recipient@example.com>",
  subject: "Hello from Zoonk",
  text: "Email content goes here",
});
```
