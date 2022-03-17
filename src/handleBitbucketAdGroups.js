const fetch = require("isomorphic-fetch");
const log = require("./log");
module.exports = (SERVER_URL, API_KEY, SONAR_HOST_URL, SONAR_LOGIN) =>
  async function (groups, teamId, adGroupCns) {
    for (let group of groups) {
      const adGroupsRes = await fetch(
        `${SERVER_URL}/api/v1/ldap/groups?searchText=${encodeURIComponent(
          group.group.name
        )}&pageSize=1&pageNumber=1`,
        {
          method: "GET",
          headers: {
            ["x-api-key"]: API_KEY,
          },
        }
      );
      const adGroups = await adGroupsRes.json();
      if (adGroups.length === 0) {
        log("no group with name found", group.group.name);
        continue;
      }
      await fetch(`${SERVER_URL}/api/v1/ldap/mapping`, {
        method: "PUT",
        headers: {
          ["x-api-key"]: API_KEY,
          ["Content-Type"]: "application/json",
        },
        body: JSON.stringify({ team: teamId, dn: adGroups[0] }),
      });
      const cnEl = adGroups[0]
        .split(",")
        .map((el) => el.split("="))
        .find((el) => el[0] === "CN");
      if (!cnEl) {
        continue;
      }
      const cn = cnEl[1];
      adGroupCns.push(cn);
      // create sonar group
      await fetch(`${SONAR_HOST_URL}/api/user_groups/create`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " + Buffer.from(SONAR_LOGIN + ":").toString("base64"),
        },
        body: `description=&name=${cn}`,
        method: "POST",
      });
    }
  };
