const fetch = require("isomorphic-fetch");
module.exports = (SONAR_HOST_URL, SONAR_LOGIN) =>
  async function () {
    await fetch(`${SONAR_HOST_URL}/api/projects/update_default_visibility`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(SONAR_LOGIN + ":").toString("base64"),
      },
      body: "projectVisibility=private",
      method: "POST",
    });
    const templatesRes = await fetch(
      `${SONAR_HOST_URL}/api/permissions/search_templates`,
      {
        headers: {
          Authorization:
            "Basic " + Buffer.from(SONAR_LOGIN + ":").toString("base64"),
        },
      }
    );
    const templates = await templatesRes.json();
    const defaultTemplateId = templates.defaultTemplates[0].templateId;
    await fetch(`${SONAR_HOST_URL}/api/permissions/add_group_to_template`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(SONAR_LOGIN + ":").toString("base64"),
      },
      body: `templateId=${defaultTemplateId}&groupName=sonar-administrators&permission=user`,
      method: "POST",
    });
    await Promise.all(
      ["user", "codeviewer", "issueadmin", "securityhotspotadmin"].map((role) =>
        fetch(`${SONAR_HOST_URL}/api/permissions/remove_group_from_template`, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " + Buffer.from(SONAR_LOGIN + ":").toString("base64"),
          },
          body: `templateId=${defaultTemplateId}&groupName=sonar-users&permission=${role}`,
          method: "POST",
        })
      )
    );
  };
