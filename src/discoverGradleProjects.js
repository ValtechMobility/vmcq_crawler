const log = require("./log");
const getFsProjects = require("./getFsProjects");
module.exports = (handleProject) =>
  async function (
    directoryName,
    adGroupCns,
    project,
    repo,
    branchName,
    teamId
  ) {
    log("checking for gradle projects");
    for (let proj of await getFsProjects(directoryName, "build.gradle")) {
      const dir = proj.split("/").slice(0, -1).join("/");
      const name = proj.split("/").slice(-2, -1);
      log(`gradle project: ${name}`);
      await handleProject(
        adGroupCns,
        "java",
        project,
        repo,
        name,
        branchName,
        dir,
        teamId
      );
    }
  };
