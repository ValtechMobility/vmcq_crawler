const fs = require("fs");
const fetch = require("isomorphic-fetch");
const child_process = require("child_process");

function exec(cmd) {
  return new Promise((resolve) => {
    let code = undefined;
    child_process
      .exec(cmd, (error, stdout, stderr) => {
        if (error) {
          // console.warn(error);
        }
        resolve({ code, error, stdout, stderr });
      })
      .on("exit", (c) => {
        code = c;
      });
  });
}

const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const BASIC_AUTH = `Basic ${Buffer.from(USERNAME + ":" + PASSWORD).toString(
  "base64"
)}`;
const SERVER_URL = process.env.SERVER_URL;
const API_KEY = process.env.API_KEY;
const BB_URL = process.env.BB_URL;
const FETCH_LICENSE = process.env.FETCH_LICENSE;
const SCAN_DEBUG_MODE = process.env.SCAN_DEBUG_MODE;
const IGNORE_OLD_PROJECTS = process.env.IGNORE_OLD_PROJECTS;
const OLD_PROJECT_LIMIT = process.env.OLD_PROJECT_LIMIT;
const TIMEOUT = process.env.TIMEOUT;

const blacklist = new Set();
blacklist.add("ACMLCM/infotainment-acceptance-tests");
blacklist.add("ACMLCM/sc3_jira_abgleich");

(async () => {
  console.log("start");
  // download cdxgen if not available yet
  if (!fs.existsSync("./cdxgen")) {
    await exec(
      [
        `wget https://github.com/AppThreat/cdxgen/releases/download/v4.0.6/cdxgen-node16-dist.zip`,
        `unzip -p cdxgen-node16-dist.zip cdxgen-linux-x64 > cdxgen`,
        `chmod +x cdxgen`,
      ].join(" && ")
    );
  }
  // download gitleaks if not available yet
  if (!fs.existsSync("./gitleaks")) {
    await exec(
      [
        `wget https://github.com/zricethezav/gitleaks/releases/download/v8.3.0/gitleaks_8.3.0_linux_x64.tar.gz`,
        `tar -xvzf gitleaks_8.3.0_linux_x64.tar.gz gitleaks > gitleaks`,
        `chmod +x gitleaks`,
      ].join(" && ")
    );
  }

  // get all teams from dependency track and create a associative array with the team name as key and team uuid as value
  const teamsRes = await fetch(`${SERVER_URL}/api/v1/team?searchText=`, {
    headers: { ["x-api-key"]: API_KEY },
  });
  const teams = await teamsRes.json();
  const teamNameToUuid = new Map();
  for (let team of teams) {
    teamNameToUuid.set(team.name, team.uuid);
  }

  const currDate = Date.now() / 1000;

  // create necessary directories
  fs.mkdirSync("repos", { recursive: true });
  fs.mkdirSync("reports", { recursive: true });

  // get all accessible projects from bitbucket
  const projectsRes = await fetch(
    `https://${BB_URL}/bb/rest/api/1.0/projects?limit=1000`,
    { headers: { Authorization: BASIC_AUTH } }
  );
  const projectValues = await projectsRes.json();
  const projects = projectValues.values;

  for (let project of projects) {
    console.log(project.key);

    // get all ad groups configured for the project
    const groupsRes = await fetch(
      `https://${BB_URL}/bb/rest/api/1.0/projects/${project.key}/permissions/groups?limit=1000`,
      {
        headers: {
          Authorization: BASIC_AUTH,
        },
      }
    );
    if (!groupsRes.ok) {
      continue;
    }
    const groupValues = await groupsRes.json();
    const groups = groupValues.values;

    if (groups.length === 0) {
      console.log("didnt find any groups");
      continue;
    }

    // check if team exists in dependency track, if not create it with the BB name and required permissions
    let teamId;
    if (!teamNameToUuid.has(project.key)) {
      console.log("creating team");
      const teamRes = await fetch(`${SERVER_URL}/api/v1/team`, {
        method: "PUT",
        headers: {
          ["x-api-key"]: API_KEY,
          ["Content-Type"]: "application/json",
        },
        body: JSON.stringify({ name: project.key }),
      });
      const team = await teamRes.json();
      teamId = team.uuid;
      await Promise.all(
        [
          "VIEW_PORTFOLIO",
          "POLICY_VIOLATION_ANALYSIS",
          "VULNERABILITY_ANALYSIS",
          "VIEW_VULNERABILITY",
        ].map((permission) =>
          fetch(
            `${SERVER_URL}/api/v1/permission/${permission}/team/${teamId}`,
            {
              method: "POST",
              headers: {
                ["x-api-key"]: API_KEY,
              },
            }
          )
        )
      );
    }

    // link the new team to the ad groups from bitbucket
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
      await fetch(`${SERVER_URL}/api/v1/ldap/mapping`, {
        method: "PUT",
        headers: {
          ["x-api-key"]: API_KEY,
          ["Content-Type"]: "application/json",
        },
        body: JSON.stringify({ team: teamId, dn: adGroups[0] }),
      });
    }

    // get all accessible repositories from the bitbucket project
    const reposRes = await fetch(
      `https://${BB_URL}/bb/rest/api/1.0/projects/${project.key}/repos?limit=1000`,
      {
        headers: {
          Authorization: BASIC_AUTH,
        },
      }
    );
    const repoValues = await reposRes.json();
    const repos = repoValues.values;
    for (let repo of repos) {
      console.log(repo.slug);
      if (blacklist.has(`${project.key}/${repo.slug}`)) {
        continue;
      }
      const directoryname = `repos/${project.key}/${repo.slug}`;
      // check if the directory already exists and wether it is up to date
      if (fs.existsSync(directoryname)) {
        const head = await exec(`cd ${directoryname} && git rev-parse HEAD`);
        const local = await exec(
          `cd ${directoryname} && git ls-remote $(git rev-parse --abbrev-ref @{u} | sed 's/\\// /g') | grep "refs/heads/" | cut -f1`
        );
        if (head.stdout === local.stdout) {
          console.log("up to date");
          continue;
        } else {
          console.log("not up to date");
          await exec(`cd ${directoryname} && git pull`);
        }
      } else {
        fs.mkdirSync(directoryname, { recursive: true });
        const clone = await exec(
          `timeout "${TIMEOUT}" git clone --depth 1 "https://${USERNAME}:${PASSWORD}@${BB_URL}/bb/scm/${project.key}/${repo.slug}.git" "${directoryname}"`
        );
        if (clone.code === 124) {
          if (fs.existsSync(directoryname)) {
            fs.rmSync(directoryname, { recursive: true });
          }
          console.log("Process Timed Out!");
          continue;
        }
      }

      // get the branch name and commit time from the repo
      const { stdout: commitdateout } = await exec(
        `cd ${directoryname} && date --date "$(git show -s --format=%ci)" '+%s'`
      );
      const commitdate = parseInt(commitdateout.trim(), 10);
      const { stdout: branchnameout } = await exec(
        `cd ${directoryname} && git symbolic-ref --short -q HEAD`
      );
      const branchname = branchnameout.trim();

      // ignore old projects
      if (IGNORE_OLD_PROJECTS === "true") {
        const diff = currDate - commitdate;
        if (diff > parseInt(OLD_PROJECT_LIMIT, 10)) {
          console.log("repo wasnt touched in a year");
          continue;
        }
      }

      // find javascript projects and upload them to dependency track and link the project to the team
      console.log("checking for jsprojects");
      for (let jsproject of await getProjects(directoryname, "package.json")) {
        if (jsproject.includes("node_modules")) {
          continue;
        }
        const dir = jsproject.split("/").slice(0, -1).join("/");
        if (fs.existsSync(dir + "/node_modules")) {
          continue;
        }
        let needslock = false;
        if (fs.existsSync(dir + "/package-lock.json")) {
          console.log("package-lock.json exists");
        } else {
          needslock = true;
          await exec(`cd ${dir} && npm -f i`);
          if (fs.existsSync(dir + "/node_modules")) {
            fs.rmSync(dir + "/node_modules", { recursive: true });
          }
        }
        const { stdout: nameout } = await exec(
          `cat "${jsproject}" | jq -r .name`
        );
        const name = nameout.trim();
        console.log(`jsproject: ${name}`);
        const code = await cdxgen(
          "js",
          project,
          repo,
          name,
          branchname,
          dir,
          teamId
        );

        if (
          code === 0 &&
          needslock &&
          fs.existsSync(dir + "/package-lock.json")
        ) {
          fs.rmSync(dir + "/package-lock.json");
        }
      }
      // find scala projects and upload them to dependency track and link the project to the team
      console.log("checking for scalaprojects");
      for (let scalaproject of await getProjects(directoryname, "build.sbt")) {
        const dir = scalaproject.split("/").slice(0, -1).join("/");
        let needslock = false;
        if (fs.existsSync(dir + "/build.sbt.lock")) {
          console.log("build.sbt.lock exists");
        } else {
          needslock = true;
          await exec(
            `cd ${dir} && sbt -batch -addPluginSbtFile=../../../dep-plugins.sbt dependencyLockWrite`
          );
        }
        const name = scalaproject.split("/").slice(-2, -1);
        console.log(`scalaproject: ${name}`);
        const code = await cdxgen(
          "scala",
          project,
          repo,
          name,
          branchname,
          dir,
          teamId
        );

        if (code === 0 && needslock && fs.existsSync(dir + "/build.sbt.lock")) {
          fs.rmSync(dir + "/build.sbt.lock");
        }
      }
      // find java projects and upload them to dependency track and link the project to the team
      console.log("checking for javaprojects");
      for (let javaproject of await getProjects(directoryname, "pom.xml")) {
        const dir = javaproject.split("/").slice(0, -1).join("/");
        const { stdout: nameout } = await exec(
          `cat "${javaproject}" | xq -r .project.artifactId`
        );
        const name = nameout.trim();
        console.log(`javaproject: ${name}`);
        await cdxgen("java", project, repo, name, branchname, dir, teamId);
      }
      // find gradle projects and upload them to dependency track and link the project to the team
      console.log("checking for gradleprojects");
      for (let gradleproject of await getProjects(
        directoryname,
        "build.gradle"
      )) {
        const dir = gradleproject.split("/").slice(0, -1).join("/");
        const name = gradleproject.split("/").slice(-2, -1);
        console.log(`gradleproject: ${name}`);
        await cdxgen("java", project, repo, name, branchname, dir, teamId);
      }
      // find python projects and upload them to dependency track and link the project to the team
      console.log("checking for pythonprojects");
      for (let pythonproject of await getProjects(
        directoryname,
        "requirements.txt"
      )) {
        const dir = pythonproject.split("/").slice(0, -1).join("/");
        const name = pythonproject.split("/").slice(-2, -1);
        console.log(`pythonproject: ${name}`);
        await cdxgen("python", project, repo, name, branchname, dir, teamId);
      }
      // find go projects and upload them to dependency track and link the project to the team
      console.log("checking for goprojects");
      for (let goproject of await getProjects(directoryname, "go.mod")) {
        const dir = goproject.split("/").slice(0, -1).join("/");
        const { stdout: nameout } = await exec(
          `cat "${goproject}" | sed -n "s/^module //p"`
        );
        const name = nameout.trim();
        console.log(`goproject: ${name}`);
        await cdxgen("go", project, repo, name, branchname, dir, teamId);
      }
      // run gitleaks and generate a report per repository
      console.log("generating gitleaks report");
      const reportsdir = `reports/${project.key}/${repo.slug}`;
      fs.mkdirSync(reportsdir, { recursive: true });
      await exec(
        `./gitleaks detect --source "${directoryname}" --no-git -v -r "${reportsdir}/report.json" --redact`
      );
    }
  }
})();

async function cdxgen(type, project, repo, name, branchName, dir, teamId) {
  const { stdout: out, code } = await exec(
    `SCAN_DEBUG_MODE=${SCAN_DEBUG_MODE} FETCH_LICENSE=${FETCH_LICENSE} ./cdxgen --type ${type} --server-url "${SERVER_URL}" --project-name "${project.key}/${repo.slug}/${name}" --api-key "${API_KEY}" --project-version "${branchName}" "${dir}"`
  );
  console.log(code, out);

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
    console.log(
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
}

async function getProjects(directoryName, fileName) {
  const { stdout: projectsOut } = await exec(
    `find "${directoryName}" -type f -iname "${fileName}" -print0`
  );
  return projectsOut
    .trim()
    .split("\0")
    .filter((s) => s !== "");
}
