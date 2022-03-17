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
    log("checking for python projects");
    for (let proj of await getFsProjects(directoryName, "requirements.txt")) {
      const dir = proj.split("/").slice(0, -1).join("/");
      const name = proj.split("/").slice(-2, -1);
      log(`python project: ${name}`);
      await handleProject(
        adGroupCns,
        "python",
        project,
        repo,
        name,
        branchName,
        dir,
        teamId
      );
    }
  };
