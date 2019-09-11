#!/bin/node

const fs = require("fs");
const fsPromises = require("fs").promises;
const util = require("util");
const childProcess = require("child_process");
const exec = util.promisify(childProcess.exec);

/**
 * Signage startup script
 * ----------------------------------------------------------------------
 * This script should run at startup and on given intervals to handle 
 * updating of software and configuration files.
 */

async function main() {
  // Make sure needed folders and stuff exists.
  try {
    await fsPromises.mkdir("tmp");
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }

  let state;
  try {
    state = JSON.parse(await fsPromises.readFile("tmp/state.json", "utf-8"));
  } catch (e) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }
  if (!state) {
    state = {
      softwareGitHash: "",
      configGitHash: ""
    }
  }

  // Check for new software versions.
  await gitPull(__dirname);
  let latestSoftwareGitHash = await getLatestHash(__dirname);
  if (state.softwareGitHash !== latestSoftwareGitHash) {
    state.softwareGitHash = latestSoftwareGitHash;
    await fsPromises.writeFile("tmp/state.json", JSON.stringify(state));
    log("Got new software. Restarting...");
    restart();
  }

  // Check for new configurations.
  await gitPull(`${__dirname}/../config/`);

  // Parse current configuration and start application.
  let sourceConfig = await fsPromises.readFile("../config/cls.json", "utf-8");

}

main().catch(e => log(`Encountered error: ${e}`));



function restart() {
  setTimeout(() => {
    process.on("exit", () => {
      childProcess.spawn(process.argv.shift(), process.argv, {
        cwd: process.cwd(),
        detached: true,
        stdio: "inherit"
      });
    });
    process.exit();
  }, 5000);
}

async function getLatestHash(workingDir) {
  const { stdout, stderr } = await exec("git rev-parse HEAD", { cwd: workingDir });
  if (stderr) {
    throw `Failed to do git rev-parse in ${workingDir}: ${stderr}`;
  }
  return stdout.replace("\n", "");
}

async function gitPull(workingDir) {
  const { stdout, stderr } = await exec("git pull", { cwd: workingDir });
  if (stderr) {
    log(`Got output on STDERR when doing git pull in ${workingDir}: ${stderr}`);
  }
  return stdout;
}

function log(msg) {
  let time = new Date();
  let prefix = "[" + time.getFullYear() + "-" + 
    time.getMonth().toString().padStart(2,"0") + "-" + 
    time.getDate().toString().padStart(2,"0") + " " + 
    time.getHours().toString().padStart(2,"0") + ":" + 
    time.getMinutes().toString().padStart(2,"0") + "]";
  let fullMessage = `${prefix} ${msg}\n`;
  console.log(fullMessage);
  fs.appendFileSync("tmp/log", fullMessage);
}