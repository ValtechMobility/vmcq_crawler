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
        log("no ldap group with name found", group.group.name);
        return;
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
        return;
      }
      const cn = cnEl[1];
      adGroupCns.push(cn);
      // create dtrack oidc group
      const createOidcTeamRes = await fetch(`${SERVER_URL}/api/v1/oidc/group`, {
        method: "PUT",
        headers: {
          ["x-api-key"]: API_KEY,
          ["Content-Type"]: "application/json",
        },
        body: JSON.stringify({ name: cn }),
      });
      const oidcGroupsRes = await fetch(
        `${SERVER_URL}/api/v1/oidc/group?searchText=${encodeURIComponent(
          group.group.name
        )}&pageSize=1&pageNumber=1`,
        {
          method: "GET",
          headers: {
            ["x-api-key"]: API_KEY,
          },
        }
      );
      const oidcGroups = await oidcGroupsRes.json();
      if (oidcGroups.length === 0) {
        log("no oidc group with name found", group.group.name);
        return;
      }
      await fetch(`${SERVER_URL}/api/v1/oidc/mapping`, {
        method: "PUT",
        headers: {
          ["x-api-key"]: API_KEY,
          ["Content-Type"]: "application/json",
        },
        body: JSON.stringify({ team: teamId, group: oidcGroups[0].uuid }),
      });
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
