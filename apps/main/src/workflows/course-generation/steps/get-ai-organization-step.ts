import { getAIOrganization } from "@/data/orgs/get-ai-organization";

type AIOrganization = {
  id: number;
};

export async function getAIOrganizationStep(): Promise<AIOrganization> {
  "use step";

  return getAIOrganization();
}
