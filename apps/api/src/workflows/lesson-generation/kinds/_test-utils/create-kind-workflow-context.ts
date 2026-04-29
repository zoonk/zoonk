import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { createLessonContext } from "../../steps/_test-utils/create-lesson-context";
import { type LessonContext } from "../../steps/get-lesson-step";

/**
 * Kind workflow tests only need a routing context because the workflow files
 * delegate real database and AI behavior to step modules. Keeping this helper
 * test-only lets each workflow test focus on its handoff sequence.
 */
export async function createKindWorkflowContext(): Promise<LessonContext> {
  const organization = await aiOrganizationFixture();

  return createLessonContext({
    organizationId: organization.id,
    position: 2,
    targetLanguage: "de",
    titlePrefix: "Kind Workflow",
  });
}
