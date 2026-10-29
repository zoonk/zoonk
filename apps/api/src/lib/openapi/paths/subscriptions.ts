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
  unauthorizedResponse,
} from "../schemas/responses";
import { freePlanResponseSchema, storeSubscriptionResponseSchema } from "../schemas/subscriptions";
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
