const log = require("./log");
const fs = require("fs");
const exec = require("./exec");
module.exports = async function (project, repo, directoryName) {
  log("generating gitleaks report");
  const reportsDir = `reports/${project.key}/${repo.slug}`;
  fs.mkdirSync(reportsDir, { recursive: true });
  await exec(
    `./gitleaks \
        detect \
        --source "${directoryName}" \
        --no-git \
        -v \
        -r "${reportsDir}/report.json" \
        --redact`
  );
};
