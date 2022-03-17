const exec = require("./exec");
const fs = require("fs");
const fetch = require("isomorphic-fetch");
const log = require("./log");
module.exports = (
  SONAR_HOST_URL,
  SONAR_LOGIN,
  SCAN_DEBUG_MODE,
  FETCH_LICENSE,
  SERVER_URL,
  API_KEY
) =>
  async function (
    adGroupCns,
    type,
    project,
    repo,
    name,
    branchName,
    dir,
    teamId
  ) {
    const projectKey = `${project.key}:${repo.slug}:${name}`;
    await exec(
      `./sonar-scanner-cli/bin/sonar-scanner \
    -Dsonar.projectBaseDir=${dir} \
    -Dsonar.sources=. \
    -Dsonar.projectKey=${projectKey} \
    -Dsonar.host.url=${SONAR_HOST_URL} \
    -Dsonar.login=${SONAR_LOGIN}`
    );
    if (fs.existsSync(dir + "/.scannerwork")) {
      fs.rmSync(dir + "/.scannerwork", { recursive: true });
    }

    for (let adGroupCn of adGroupCns) {
      await Promise.all(
        ["user", "codeviewer", "issueadmin", "securityhotspotadmin"].map(
          (role) =>
            fetch(`${SONAR_HOST_URL}/api/permissions/add_group`, {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization:
                  "Basic " + Buffer.from(SONAR_LOGIN + ":").toString("base64"),
              },
              body: `projectKey=${encodeURIComponent(
                projectKey
              )}&groupName=${adGroupCn}&permission=${role}`,
              method: "POST",
            })
        )
      );
    }

    const { stdout: out, code } = await exec(
      `SCAN_DEBUG_MODE=${SCAN_DEBUG_MODE} \
     FETCH_LICENSE=${FETCH_LICENSE} \
     ./cdxgen \
     --type ${type} \
     --server-url "${SERVER_URL}" \
     --project-name "${project.key}/${repo.slug}/${name}" \
     --api-key "${API_KEY}" \
     --project-version "${branchName}" \
     "${dir}"`
    );
    log(code, out);

    if (code === 1) {
      return code;
    }

    const escName = encodeURIComponent(`${project.key}/${repo.slug}/${name}`);
    const projectLookupRes = await fetch(
      `${SERVER_URL}/api/v1/project/lookup?name=${escName}&version=${branchName}`,
      {
        headers: {
          ["x-api-key"]: API_KEY,
        },
      }
    );
    if (!projectLookupRes.ok) {
      log(
        escName,
        branchName,
        projectLookupRes.status,
        await projectLookupRes.text()
      );
      return 1;
    }
    const projectLookup = await projectLookupRes.json();
    const projectId = projectLookup.uuid;
    await fetch(`${SERVER_URL}/api/v1/acl/mapping`, {
      method: "PUT",
      headers: {
        ["x-api-key"]: API_KEY,
        ["Content-Type"]: "application/json",
      },
      body: JSON.stringify({ team: teamId, project: projectId }),
    });

    return 0;
  };
