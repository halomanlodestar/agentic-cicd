/** @format */

import { existsSync } from "fs";
import { join } from "path";

const TOOLS = "pytest flake8 black autopep8";

/**
 * Returns a shell command that installs project deps + test tools into the
 * current container. Called once in installDeps (for validation) and again
 * prepended to every runTests command, because each `docker run --rm`
 * container is ephemeral — packages don't persist between runs.
 */
export function buildPipInstallCmd(workspacePath: string): string {
  let projectInstall: string;

  if (existsSync(join(workspacePath, "requirements.txt"))) {
    projectInstall = "pip install --quiet -r requirements.txt";
  } else if (existsSync(join(workspacePath, "pyproject.toml"))) {
    projectInstall = "pip install --quiet .";
  } else if (existsSync(join(workspacePath, "setup.py"))) {
    projectInstall = "pip install --quiet -e .";
  } else {
    projectInstall = "";
  }

  const parts = [
    `pip install --quiet ${TOOLS}`,
    ...(projectInstall ? [projectInstall] : []),
  ];

  return parts.join(" && ");
}
