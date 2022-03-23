const fetch = require("isomorphic-fetch");
const log = require("./log");
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
      log("something went wrong fetching the groups");
      return [];
    }
    const groupValues = await groupsRes.json();
    return groupValues.values;
  };
