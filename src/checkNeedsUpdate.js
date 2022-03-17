const fs = require("fs");
const exec = require("./exec");
const log = require("./log");
module.exports = (
  TIMEOUT,
  USERNAME,
  PASSWORD,
  BB_URL,
  IGNORE_OLD_PROJECTS,
  OLD_PROJECT_LIMIT
) =>
  async function (currDate, directoryName, project, repo) {
    // check if the directory already exists and wether it is up to date
    if (fs.existsSync(directoryName)) {
      const head = await exec(`cd ${directoryName} && git rev-parse HEAD`);
      const local = await exec(
        `cd ${directoryName} && \
          git ls-remote $(git rev-parse --abbrev-ref @{u} | sed 's/\\// /g') | \
          grep "refs/heads/" | \
          cut -f1`
      );
      if (head.stdout === local.stdout) {
        log("up to date");
        return;
      } else {
        log("not up to date");
        await exec(`cd ${directoryName} && git pull`);
      }
    } else {
      fs.mkdirSync(directoryName, { recursive: true });
      const clone = await exec(
        `timeout \"${TIMEOUT}" \
          git clone \
          --depth 1 \
          "https://${USERNAME}:${PASSWORD}@${BB_URL}/bb/scm/${project.key}/${repo.slug}.git" \
          "${directoryName}"`
      );
      if (clone.code === 124) {
        if (fs.existsSync(directoryName)) {
          fs.rmSync(directoryName, { recursive: true });
        }
        log("Process Timed Out!");
        return;
      }
    }

    // get the branch name and commit time from the repo
    const { stdout: commitDateOut } = await exec(
      `cd ${directoryName} && date --date "$(git show -s --format=%ci)" '+%s'`
    );
    const commitDate = parseInt(commitDateOut.trim(), 10);

    // ignore old projects
    if (IGNORE_OLD_PROJECTS === "true") {
      const diff = currDate - commitDate;
      if (diff > parseInt(OLD_PROJECT_LIMIT, 10)) {
        log("repo wasn't touched in a year");
        return;
      }
    }
    const { stdout: branchNameOut } = await exec(
      `cd ${directoryName} && git symbolic-ref --short -q HEAD`
    );
    return branchNameOut.trim();
  };
