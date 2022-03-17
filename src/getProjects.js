const fetch = require("isomorphic-fetch");
module.exports = (BB_URL, BASIC_AUTH) =>
  async function () {
    const projectsRes = await fetch(
      `https://${BB_URL}/bb/rest/api/1.0/projects?limit=1000`,
      { headers: { Authorization: BASIC_AUTH } }
    );
    const projectValues = await projectsRes.json();
    return projectValues.values;
  };
