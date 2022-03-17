const fetch = require("isomorphic-fetch");
module.exports = (BB_URL, BASIC_AUTH) =>
  async function (project) {
    const reposRes = await fetch(
      `https://${BB_URL}/bb/rest/api/1.0/projects/${project.key}/repos?limit=1000`,
      {
        headers: {
          Authorization: BASIC_AUTH,
        },
      }
    );
    const repoValues = await reposRes.json();
    return repoValues.values;
  };
