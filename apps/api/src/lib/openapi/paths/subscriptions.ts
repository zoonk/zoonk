import {
  appleSubscriptionNotificationSchema,
  appleSubscriptionRequestSchema,
} from "@zoonk/core/subscriptions/apple-contract";
import { badRequestResponse, conflictResponse, unauthorizedResponse } from "../schemas/responses";
import { appleSubscriptionResponseSchema } from "../schemas/subscriptions";
import { AUTHENTICATED_SECURITY, PUBLIC_SECURITY } from "../security";

export const subscriptionPaths = {
  "/me/subscriptions/apple": {
    post: {
      operationId: "createAppleSubscription",
      requestBody: {
        content: { "application/json": { schema: appleSubscriptionRequestSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: appleSubscriptionResponseSchema } },
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
};
