const log = require("./log");
const getFsProjects = require("./getFsProjects");
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
    log("checking for go projects");
    for (let proj of await getFsProjects(directoryName, "go.mod")) {
      const dir = proj.split("/").slice(0, -1).join("/");
      const { stdout: nameOut } = await exec(
        `cat "${proj}" | sed -n "s/^module //p"`
      );
      const name = nameOut.trim();
      log(`go project: ${name}`);
      await handleProject(
        adGroupCns,
        "go",
        project,
        repo,
        name,
        branchName,
        dir,
        teamId
      );
    }
  };
