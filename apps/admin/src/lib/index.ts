import { isProduction } from "@zoonk/utils";

const localBaseUrl = "http://localhost:3001";
const productionBaseUrl = "https://admin.zoonk.com";
const defaultBaseUrl = isProduction ? productionBaseUrl : localBaseUrl;

export const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || defaultBaseUrl;

export const authCallbackUrl = `${baseUrl}`;
export const authErrorCallbackUrl = `${baseUrl}/login`;
export const authNewUserCallbackUrl = `${baseUrl}/learn`;
