import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

const statement = {
  ...defaultStatements,
  course: ["create", "read", "update", "delete"],
} as const;

export type CoursePermission = (typeof statement.course)[number];

export const ac = createAccessControl(statement);

export const member = ac.newRole({
  course: ["read"],
  ...memberAc.statements,
});

export const admin = ac.newRole({
  course: ["create", "read", "update"],
  ...adminAc.statements,
});

export const owner = ac.newRole({
  course: ["create", "read", "update", "delete"],
  ...ownerAc.statements,
});
