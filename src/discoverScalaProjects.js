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
    log("checking for scala projects");
    for (let proj of await getFsProjects(directoryName, "build.sbt")) {
      const dir = proj.split("/").slice(0, -1).join("/");
      let needsLock = false;
      if (fs.existsSync(dir + "/build.sbt.lock")) {
        log("build.sbt.lock exists");
      } else {
        needsLock = true;
        await exec(
          `cd ${dir} && sbt -batch -addPluginSbtFile=../../../dep-plugins.sbt dependencyLockWrite`
        );
      }
      const name = proj.split("/").slice(-2, -1);
      log(`scala project: ${name}`);
      const code = await handleProject(
        adGroupCns,
        "scala",
        project,
        repo,
        name,
        branchName,
        dir,
        teamId
      );

      if (code === 0 && needsLock && fs.existsSync(dir + "/build.sbt.lock")) {
        fs.rmSync(dir + "/build.sbt.lock");
      }
    }
  };
