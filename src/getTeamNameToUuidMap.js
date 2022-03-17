const fetch = require("isomorphic-fetch");
module.exports = (SERVER_URL, API_KEY) =>
  async function () {
    const teamsRes = await fetch(`${SERVER_URL}/api/v1/team?searchText=`, {
      headers: { ["x-api-key"]: API_KEY },
    });
    const teams = await teamsRes.json();
    const teamNameToUuid = new Map();
    for (let team of teams) {
      teamNameToUuid.set(team.name, team.uuid);
    }
    return teamNameToUuid;
  };
