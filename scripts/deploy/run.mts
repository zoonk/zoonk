import { deployBlog } from "./blog.mts";
import { requiredEnv } from "./config.mts";
import { assertPullRequestOpen, cancelBuilds, deploy } from "./deployment.mts";

const command = process.argv[2] ?? "";

switch (command) {
  case "check-preview":
    await assertPullRequestOpen();
    break;
  case "cancel-previews":
    await cancelBuilds();
    break;
  case "cancel-run":
    await cancelBuilds({
      runId: `${requiredEnv("GITHUB_RUN_ID")}-${requiredEnv("GITHUB_RUN_ATTEMPT")}`,
    });

    break;
  case "blog":
    await deployBlog();
    break;
  case "preview":
  case "staging":
  case "production":
    await deploy(command);
    break;
  default:
    throw new Error(
      "Expected blog, check-preview, cancel-previews, cancel-run, preview, staging, or production",
    );
}
