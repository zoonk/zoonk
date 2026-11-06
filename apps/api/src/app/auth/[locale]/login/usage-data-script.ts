import { AUTH_LOGIN_USAGE_DATA_PARAM } from "@zoonk/utils/origin";
import {
  USAGE_DATA_COOKIE,
  USAGE_DATA_COOKIE_MAX_AGE,
  formatUsageDataCookie,
} from "@zoonk/utils/usage-data";

const CHOICES = [formatUsageDataCookie(true), formatUsageDataCookie(false)];

/**
 * Keeps the usage-data choice the main app passed in the address before the learner can sign up or
 * sign in here, where the main app's cookie never arrives. A script, not a `next.config` header: on
 * Vercel a response keeps only one header rule's `Set-Cookie`, and the locale's already takes it.
 */
export const USAGE_DATA_SCRIPT = `(function(){var v=new URLSearchParams(location.search).get(${JSON.stringify(AUTH_LOGIN_USAGE_DATA_PARAM)});if(${JSON.stringify(CHOICES)}.indexOf(v)>=0){document.cookie=${JSON.stringify(USAGE_DATA_COOKIE)}+"="+v+"; path=/; max-age=${USAGE_DATA_COOKIE_MAX_AGE}; samesite=lax"}})()`;
