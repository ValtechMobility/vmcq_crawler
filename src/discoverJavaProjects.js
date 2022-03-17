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
    log("checking for java projects");
    for (let proj of await getFsProjects(directoryName, "pom.xml")) {
      const dir = proj.split("/").slice(0, -1).join("/");
      const { stdout: nameOut } = await exec(
        `cat "${proj}" | xq -r .project.artifactId`
      );
      const name = nameOut.trim();
      log(`java project: ${name}`);
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
