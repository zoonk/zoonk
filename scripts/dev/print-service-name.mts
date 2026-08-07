import { getProjectName, getServiceName } from "./config.mts";

/** Converts the optional process argument into the required service name before it is captured by the printing function. */
function getRequiredServiceName(): string {
  const serviceName = process.argv[2];

  if (!serviceName) {
    throw new Error("A service name is required to resolve a development route.");
  }

  return serviceName;
}

const serviceName = getRequiredServiceName();

/** Prints one shell-safe DNS name so package scripts can make Portless their direct process under Turbo. */
function printServiceName(): void {
  const projectName = getProjectName({ currentDirectory: process.cwd() });
  const name = getServiceName({ projectName, serviceName });

  process.stdout.write(name);
}

printServiceName();
