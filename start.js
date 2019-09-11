#!/bin/node

const fs = require("fs");
const fsPromises = require("fs").promises;
const util = require("util");
const exec = util.promisify(require("child_process").exec);

/**
 * Signage startup script
 * ----------------------------------------------------------------------
 * This script should run at startup and on given intervals to handle 
 * updating of software and configuration files.
 */

async function gitPull(workingDir) {
  const { stdout, stderr } = await exec("git pull", { cwd: workingDir });
  if (stderr) {
    throw stderr;
  }
  return stdout;
}

function log(msg) {
  let time = new Date();
  let prefix = "[" + time.getFullYear() + "-" + 
    time.getMonth().toString().padStart(2,"0") + "-" + 
    time.getDate().toString().padStart(2,"0") + "]";
  let fullMessage = `${prefix} ${msg}`;
  console.log(fullMessage);
  fs.appendFileSync("tmp/log", fullMessage, { encoding: "utf-8" });
}

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
    state = await fsPromises.readFile("tmp/state.json", 
      { encoding: "utf-8" });
  } catch (e) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }

  // Check for new software versions.
  await gitPull(__dirname);

  // Check for new configurations.


  // Parse current configuration and start application.
  let sourceConfig = await fsPromises.readFile("../config/cls.json", 
    { encoding: "utf-8" });

}

main().catch(e => log(`Encountered error: ${e}`));
