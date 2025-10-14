import { zoonkAuth } from "@zoonk/auth";
import { sendVerificationOTP } from "./otp";

export const auth = zoonkAuth({ sendVerificationOTP });
