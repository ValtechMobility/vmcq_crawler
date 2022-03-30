const fs = require("fs");

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
const SONAR_LOGIN = process.env.SONAR_LOGIN;
const SONAR_HOST_URL = process.env.SONAR_HOST_URL;
const BLACKLIST = process.env.BLACKLIST;

const log = require("./log");
const setupCdxgen = require("./setupCdxgen");
const setupGitleaks = require("./setupGitleaks");
const setupSonarScanner = require("./setupSonarScanner");
const handleProject = require("./handleProject")(
  SONAR_HOST_URL,
  SONAR_LOGIN,
  SCAN_DEBUG_MODE,
  FETCH_LICENSE,
  SERVER_URL,
  API_KEY
);
const getProjects = require("./getProjects")(BB_URL, BASIC_AUTH);
const getGroups = require("./getGroups")(BB_URL, BASIC_AUTH);
const getRepos = require("./getRepos")(BB_URL, BASIC_AUTH);
const getTeamNameToUuidMap = require("./getTeamNameToUuidMap")(
  SERVER_URL,
  API_KEY
);
const createDtrackTeam = require("./createDtrackTeam")(SERVER_URL, API_KEY);
const setupSonarqube = require("./setupSonarqube")(SONAR_HOST_URL, SONAR_LOGIN);
const handleBitbucketAdGroups = require("./handleBitbucketAdGroups")(
  SERVER_URL,
  API_KEY,
  SONAR_HOST_URL,
  SONAR_LOGIN
);
const checkNeedsUpdate = require("./checkNeedsUpdate")(
  TIMEOUT,
  USERNAME,
  PASSWORD,
  BB_URL,
  IGNORE_OLD_PROJECTS,
  OLD_PROJECT_LIMIT
);
const discoverGoProjects = require("./discoverGoProjects")(handleProject);
const discoverGradleProjects = require("./discoverGradleProjects")(
  handleProject
);
const discoverJavaProjects = require("./discoverJavaProjects")(handleProject);
const discoverJavascriptProjects = require("./discoverJavascriptProjects")(
  handleProject
);
const discoverPythonProjects = require("./discoverPythonProjects")(
  handleProject
);
const discoverScalaProjects = require("./discoverScalaProjects")(handleProject);
const generateGitleaksReport = require("./generateGitleaksReport");

const blacklist = new Set(BLACKLIST.split(","));

(async () => {
  log("start");
  // download cdxgen if not available yet
  await setupCdxgen();
  // download gitleaks if not available yet
  await setupGitleaks();
  // download sonar scanner cli
  await setupSonarScanner();
  // set sonar global settings
  await setupSonarqube();

  // get all teams from dependency track and create a associative array with the team name as key and team uuid as value
  const teamNameToUuid = await getTeamNameToUuidMap();

  const currDate = Date.now() / 1000;

  // create necessary directories
  fs.mkdirSync("repos", { recursive: true });
  fs.mkdirSync("reports", { recursive: true });

  // get all accessible projects from bitbucket
  for (let project of await getProjects()) {
    log(project.key);

    // get all ad groups configured for the project
    const groups = await getGroups(project);

    if (groups.length === 0) {
      log("didnt find any groups");
      continue;
    }

    // check if team exists in dependency track, if not create it with the BB name and required permissions
    const teamId = teamNameToUuid.has(project.key)
      ? teamNameToUuid.get(project.key)
      : await createDtrackTeam(project);

    const adGroupCns = [];

    // link the new team to the ad groups from bitbucket
    await handleBitbucketAdGroups(groups, teamId, adGroupCns);

    // get all accessible repositories from the bitbucket project
    for (let repo of await getRepos(project)) {
      log(repo.slug);
      if (blacklist.has(`${project.key}/${repo.slug}`)) {
        log("blacklisted repo");
        continue;
      }
      const directoryName = `repos/${project.key}/${repo.slug}`;

      const branchName = await checkNeedsUpdate(
        currDate,
        directoryName,
        project,
        repo
      );
      if (!branchName) {
        continue;
      }

      // find javascript projects and upload them to dependency track and link the project to the team
      await discoverJavascriptProjects(
        directoryName,
        adGroupCns,
        project,
        repo,
        branchName,
        teamId
      );
      // find scala projects and upload them to dependency track and link the project to the team
      await discoverScalaProjects(
        directoryName,
        adGroupCns,
        project,
        repo,
        branchName,
        teamId
      );
      // find java projects and upload them to dependency track and link the project to the team
      await discoverJavaProjects(
        directoryName,
        adGroupCns,
        project,
        repo,
        branchName,
        teamId
      );
      // find gradle projects and upload them to dependency track and link the project to the team
      await discoverGradleProjects(
        directoryName,
        adGroupCns,
        project,
        repo,
        branchName,
        teamId
      );
      // find python projects and upload them to dependency track and link the project to the team
      await discoverPythonProjects(
        directoryName,
        adGroupCns,
        project,
        repo,
        branchName,
        teamId
      );
      // find go projects and upload them to dependency track and link the project to the team
      await discoverGoProjects(
        directoryName,
        adGroupCns,
        project,
        repo,
        branchName,
        teamId
      );
      // run gitleaks and generate a report per repository
      await generateGitleaksReport(project, repo, directoryName);
    }
  }
  log("end");
})();
