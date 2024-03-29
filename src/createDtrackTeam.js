const log = require("./log");
const fetch = require("isomorphic-fetch");
module.exports = (SERVER_URL, API_KEY) =>
  async function (project) {
    log("creating team");
    const teamRes = await fetch(`${SERVER_URL}/api/v1/team`, {
      method: "PUT",
      headers: {
        ["x-api-key"]: API_KEY,
        ["Content-Type"]: "application/json",
      },
      body: JSON.stringify({ name: project.key }),
    });
    const team = await teamRes.json();
    await Promise.all(
      [
        "BOM_UPLOAD",
        "POLICY_VIOLATION_ANALYSIS",
        "PROJECT_CREATION_UPLOAD",
        "VIEW_POLICY_VIOLATION",
        "VIEW_PORTFOLIO",
        "VIEW_VULNERABILITY",
        "VULNERABILITY_ANALYSIS",
      ].map((permission) =>
        fetch(
          `${SERVER_URL}/api/v1/permission/${permission}/team/${team.uuid}`,
          {
            method: "POST",
            headers: {
              ["x-api-key"]: API_KEY,
            },
          }
        )
      )
    );
    return team.uuid;
  };
