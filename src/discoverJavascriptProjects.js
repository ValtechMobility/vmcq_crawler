const log = require("./log");
const getFsProjects = require("./getFsProjects");
const fs = require("fs");
const exec = require("./exec");
module.exports = (handleProject) =>
  async function (
    directoryName,
    adGroupCns,
    project,
    repo,
    branchName,
    teamId
  ) {
    log("checking for js projects");
    for (let proj of await getFsProjects(directoryName, "package.json")) {
      if (proj.includes("node_modules")) {
        continue;
      }
      const dir = proj.split("/").slice(0, -1).join("/");
      if (fs.existsSync(dir + "/node_modules")) {
        continue;
      }
      let needsLock = false;
      if (fs.existsSync(dir + "/package-lock.json")) {
        log("package-lock.json exists");
      } else if (fs.existsSync(dir + "/yarn.lock")) {
        log("yarn.lock exists");
      } else {
        needsLock = true;
        await exec(`cd ${dir} && npm -f i`);
        if (fs.existsSync(dir + "/node_modules")) {
          fs.rmSync(dir + "/node_modules", { recursive: true });
        }
      }
      const { stdout: nameOut } = await exec(`cat "${proj}" | jq -r .name`);
      const name = nameOut.trim();
      log(`js project: ${name}`);
      const code = await handleProject(
        adGroupCns,
        "js",
        project,
        repo,
        name,
        branchName,
        dir,
        teamId
      );

      if (
        code === 0 &&
        needsLock &&
        fs.existsSync(dir + "/package-lock.json")
      ) {
        fs.rmSync(dir + "/package-lock.json");
      }
    }
  };
