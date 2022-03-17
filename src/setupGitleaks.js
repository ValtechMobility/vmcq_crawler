const fs = require("fs");
const exec = require("./exec");
module.exports = async function () {
  if (!fs.existsSync("./gitleaks")) {
    await exec(
      [
        `wget https://github.com/zricethezav/gitleaks/releases/download/v8.3.0/gitleaks_8.3.0_linux_x64.tar.gz`,
        `tar -xvzf gitleaks_8.3.0_linux_x64.tar.gz gitleaks > gitleaks`,
        `chmod +x gitleaks`,
      ].join(" && ")
    );
  }
};
