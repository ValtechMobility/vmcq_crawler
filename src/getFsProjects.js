const exec = require("./exec");
module.exports = async function (directoryName, fileName) {
  const { stdout: projectsOut } = await exec(
    `find "${directoryName}" -type f -iname "${fileName}" -print0`
  );
  return projectsOut
    .trim()
    .split("\0")
    .filter((s) => s !== "");
};
