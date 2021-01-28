"use strict";

const chalk = require("chalk");
const JiraApi = require("jira-client");
const path = require("path");
const inquirer = require("inquirer");
const Configstore = require("configstore");
const config = new Configstore("gjira");
const pkg = require("./package.json");
const argv = require("minimist")(process.argv.slice(2));
const simpleGit = require("simple-git");

const action = argv._[0];

let BASE_BRANCH = config.get("defaultBranch") || "master";
let JIRAHOST = config.get("jiraHost");
let JIRAUSER = config.get("jiraUser");
let JIRAPASS = config.get("jiraPass");

const error = (error) => {
  console.log(chalk.red(error.message));
  process.exit(-1);
};

const Jira = () =>
  new JiraApi({
    protocol: "https",
    host: JIRAHOST,
    username: JIRAUSER,
    password: JIRAPASS,
    apiVersion: "2",
    strictSSL: false,
  });

const gitOptions = {
  baseDir: process.cwd(),
  binary: "git",
  maxConcurrentProcesses: 6,
};

const gitClient = () => simpleGit(gitOptions);

const configure = async () => {
  const input = await inquirer.prompt([
    {
      type: "input",
      name: "jiraHost",
      message: "JIRA host url i.e. jira.example.com",
      default: JIRAHOST || "",
      validate: function(value) {
        if (value.length && value.match(/^[^\/]+/)) {
          return true;
        } else {
          return "Please enter a valid JIRA host";
        }
      },
    },
    {
      type: "input",
      name: "jiraUser",
      message: "JIRA Username",
      default: JIRAUSER || "",
      validate: function(value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter a valid JIRA username";
        }
      },
    },
    {
      type: "input",
      name: "jiraPass",
      message: "JIRA password",
      default: "",
      validate: function(value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter a valid JIRA password";
        }
      },
    },
    {
      type: "input",
      name: "defaultBranch",
      message: "Default GIT branch",
      default: BASE_BRANCH || "",
      validate: function(value) {
        if (value.length) {
          return true;
        } else {
          return "Please enter a valid branch name";
        }
      },
    },
  ]);
  config.set(input);
  BASE_BRANCH = config.get("defaultBranch") || "master";
  JIRAHOST = config.get("jiraHost");
  JIRAUSER = config.get("jiraUser");
  JIRAPASS = config.get("jiraPass");
  console.log(chalk.green("Config saved"));
};

const checkConfig = async () => {
  if (!BASE_BRANCH || !JIRAHOST || !JIRAUSER || !JIRAPASS) {
    console.log(yellow.red("You need to setup GJIRA first"));
    return configure();
  }
  return true;
};

const getIssue = async (issueNumber) => {
  try {
    return await Jira().findIssue(issueNumber);
  } catch (error) {
    if (error.response.statusCode === 404) {
      return null;
    }
    console.error(error);
  }
};

const hasBranch = async (git, branch) => {
  const list = await git.branch(["-v"]).catch(error);
  return list && list.all && list.all.includes(branch);
};

const createBranch = async (branch) => {
  const issue = await getIssue(branch);
  if (!issue) {
    console.log(chalk.red(`Issue ${branch} not found`));
    return;
  }
  const git = gitClient();
  const status = await git.status().catch(error);
  if (status.current === branch) {
    console.log(chalk.blue(`Already on branch ${branch}`));
    return;
  }
  console.log(chalk.blue("Stashing local changes"));
  await git.stash().catch(error);

  if (await hasBranch(git, branch)) {
    console.log(chalk.blue(`Checkout out ${branch}`));
    await git.checkout(branch).catch(error);
  } else {
    console.log(chalk.blue(`Checking out ${BASE_BRANCH}`));
    await git.checkout(BASE_BRANCH).catch(error);
    console.log(chalk.blue(`Pulling out ${BASE_BRANCH} from origin`));
    await git.pull("origin", BASE_BRANCH).catch(error);
    console.log(chalk.blue(`Checkout out new ${branch}`));
    await git.checkoutLocalBranch(branch).catch(error);
  }
};

const push = async () => {
  const git = gitClient();
  const status = await git.status().catch(error);
  const branch = status.current;
  const issue = await getIssue(branch);
  if (!issue) {
    console.log(chalk.red(`Unknown issue ${branch}`));
    return;
  }
  const commitMessage = `${branch} - ${issue.fields.summary}`;
  console.log(chalk.blue(`Commiting ${commitMessage}`));
  await git.add(".").catch(error);
  await git.commit(commitMessage).catch(error);
  console.log(chalk.blue(`Pushing to origin ${branch}`));
  await git.push("origin", branch);
  console.log(chalk.green("DONE"));
};

console.log(chalk.yellow("GJIRA"), chalk.blue(`ver. ${pkg.version}`));

(async () => {
  switch (action) {
    case "configure": {
      configure();
      break;
    }
    case "push": {
      await checkConfig();
      push();
      break;
    }
    case undefined: {
      await checkConfig();
      console.log("menu");
      break;
    }
    default: {
      await checkConfig();
      createBranch(action);
      break;
    }
  }
})();
