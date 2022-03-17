const fs = require("fs");
const exec = require("./exec");
module.exports = async function () {
  if (!fs.existsSync("./sonar-scanner-cli")) {
    await exec(
      [
        `wget https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-4.7.0.2747-linux.zip`,
        `unzip sonar-scanner-cli-4.7.0.2747-linux.zip`,
        `mv sonar-scanner-4.7.0.2747-linux sonar-scanner-cli`,
      ].join(" && ")
    );
  }
};
