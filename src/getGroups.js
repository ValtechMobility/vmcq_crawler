const fetch = require("isomorphic-fetch");
module.exports = (BB_URL, BASIC_AUTH) =>
  async function (project) {
    const groupsRes = await fetch(
      `https://${BB_URL}/bb/rest/api/1.0/projects/${project.key}/permissions/groups?limit=1000`,
      {
        headers: {
          Authorization: BASIC_AUTH,
        },
      }
    );
    if (!groupsRes.ok) {
      return [];
    }
    const groupValues = await groupsRes.json();
    return groupValues.values;
  };
