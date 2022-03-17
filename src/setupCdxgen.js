const fs = require("fs");
const exec = require("./exec");
module.exports = async function () {
  if (!fs.existsSync("./cdxgen")) {
    await exec(
      [
        `wget https://github.com/AppThreat/cdxgen/releases/download/v4.0.6/cdxgen-node16-dist.zip`,
        `unzip -p cdxgen-node16-dist.zip cdxgen-linux-x64 > cdxgen`,
        `chmod +x cdxgen`,
      ].join(" && ")
    );
  }
};
