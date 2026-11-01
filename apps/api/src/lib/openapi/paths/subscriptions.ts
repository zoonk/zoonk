import {
  appleSubscriptionNotificationSchema,
  appleSubscriptionRequestSchema,
} from "@zoonk/core/subscriptions/apple-contract";
import {
  googlePlayNotificationSchema,
  googlePlaySubscriptionRequestSchema,
} from "@zoonk/core/subscriptions/google-play-contract";
import {
  badRequestResponse,
  conflictResponse,
  internalErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
} from "../schemas/responses";
import {
  freePlanResponseSchema,
  storeSubscriptionResponseSchema,
  stripeSubscriptionCancellationReceiptSchema,
  stripeSubscriptionCancellationSchema,
} from "../schemas/subscriptions";
import { AUTHENTICATED_SECURITY, PUBLIC_SECURITY } from "../security";

export const subscriptionPaths = {
  "/free-plan": {
    get: {
      operationId: "getFreePlan",
      responses: {
        "200": {
          content: { "application/json": { schema: freePlanResponseSchema } },
          description: "The free plan's limits",
        },
        "500": internalErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Get the free plan",
      tags: ["Subscriptions"],
    },
  },
  "/me/subscriptions/apple": {
    post: {
      operationId: "createAppleSubscription",
      requestBody: {
        content: { "application/json": { schema: appleSubscriptionRequestSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: storeSubscriptionResponseSchema } },
          description: "Current account state after durable App Store reconciliation",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "409": conflictResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Reconcile an App Store subscription",
      tags: ["Subscriptions"],
    },
  },
  "/me/subscriptions/google": {
    post: {
      description:
        "The app sets the learner's user id as the purchase's obfuscatedAccountId; a purchase made for another account, or replacing one that belongs to another account, is refused, and one made in the Play Store, which names no account, becomes the learner's. Zoonk acknowledges the purchase, so the app doesn't.",
      operationId: "createGooglePlaySubscription",
      requestBody: {
        content: { "application/json": { schema: googlePlaySubscriptionRequestSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: storeSubscriptionResponseSchema } },
          description: "Current account state after durable Google Play reconciliation",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "409": conflictResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Reconcile a Google Play subscription",
      tags: ["Subscriptions"],
    },
  },
  "/me/subscriptions/stripe/cancellation": {
    delete: {
      description:
        "Keep Plus: turns a stopped renewal back on, so Plus renews as before. Only while the saved website state is ending.",
      operationId: "resumeStripeSubscription",
      responses: {
        "204": { description: "Plus renews again" },
        "401": unauthorizedResponse,
        "404": {
          ...notFoundResponse,
          description: "A signed-in guest has no website subscription",
        },
        "409": {
          ...conflictResponse,
          description: "Plus isn't set to end with its paid period; read the saved state again",
        },
        "500": internalErrorResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Keep a web subscription",
      tags: ["Subscriptions"],
    },
    get: {
      description:
        "The saved website subscription, including unpaid renewals and website billing alongside a newer store purchase. Store subscriptions are managed in their store.",
      operationId: "getStripeSubscriptionCancellation",
      responses: {
        "200": {
          content: { "application/json": { schema: stripeSubscriptionCancellationSchema } },
          description: "Saved website subscription state",
        },
        "401": unauthorizedResponse,
        "404": {
          ...notFoundResponse,
          description: "No website subscription, including signed-in guests",
        },
        "500": internalErrorResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Read a web subscription",
      tags: ["Subscriptions"],
    },
    post: {
      description:
        "Stops the renewal in Stripe. Plus stays until the end of the paid period. An unpaid or past-due renewal ends immediately to stop charge retries.",
      operationId: "cancelStripeSubscription",
      responses: {
        "200": {
          content: { "application/json": { schema: stripeSubscriptionCancellationReceiptSchema } },
          description: "Canceled",
        },
        "401": unauthorizedResponse,
        "404": {
          ...notFoundResponse,
          description: "A signed-in guest has no website subscription",
        },
        "409": {
          ...conflictResponse,
          description: "No renewing web subscription to cancel; read the saved state again",
        },
        "500": internalErrorResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Cancel a web subscription",
      tags: ["Subscriptions"],
    },
  },
  "/subscriptions/apple/notifications": {
    post: {
      operationId: "createAppleSubscriptionNotification",
      requestBody: {
        content: { "application/json": { schema: appleSubscriptionNotificationSchema } },
        required: true,
      },
      responses: {
        "204": { description: "Notification reconciled or acknowledged" },
        "400": badRequestResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Receive an App Store Server Notification",
      tags: ["Subscriptions"],
    },
  },
  "/subscriptions/google/notifications": {
    post: {
      description:
        "Pub/Sub push endpoint, authenticated by the Google-signed OIDC token in the Authorization header.",
      operationId: "createGooglePlayNotification",
      requestBody: {
        content: { "application/json": { schema: googlePlayNotificationSchema } },
        required: true,
      },
      responses: {
        "204": { description: "Notification reconciled or acknowledged" },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Receive a Google Play Real-time Developer Notification",
      tags: ["Subscriptions"],
    },
  },
};
