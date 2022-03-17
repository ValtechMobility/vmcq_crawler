const child_process = require("child_process");
module.exports = function exec(cmd) {
  return new Promise((resolve) => {
    let code = undefined;
    child_process
      .exec(cmd, (error, stdout, stderr) => {
        if (error) {
          // console.warn(error);
        }
        resolve({ code, error, stdout, stderr });
      })
      .on("exit", (c) => {
        code = c;
      });
  });
};
