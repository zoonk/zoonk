import { requiredEnv } from "./config.mts";
import { assertCurrentPreview, cancelPreviews, deploy } from "./deployment.mts";

const command = process.argv[2] ?? "";

switch (command) {
  case "check-preview":
    await assertCurrentPreview();
    break;
  case "cancel-previews":
    await cancelPreviews();
    break;
  case "cancel-run":
    await cancelPreviews({
      runId: `${requiredEnv("GITHUB_RUN_ID")}-${requiredEnv("GITHUB_RUN_ATTEMPT")}`,
    });

    break;
  case "preview":
  case "staging":
  case "production":
    await deploy(command);
    break;
  default:
    throw new Error("Expected check-preview, cancel-previews, preview, staging, or production");
}
