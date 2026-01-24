import { getAIOrganization } from "@/data/orgs/get-ai-organization";

export async function getAIOrganizationStep(): Promise<{
  id: number;
}> {
  "use step";

  return getAIOrganization();
}
