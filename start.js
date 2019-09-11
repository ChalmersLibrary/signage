#!/bin/node

const os = require("os");
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
    await restart();
  }

  // Get the mac address.
  let mac;
  let networkInterfaces = os.networkInterfaces();
  if (networkInterfaces["eth0"]) {
    let networkInterface = networkInterfaces["eth0"];
    let macs = networkInterface
      .filter(x => x.family.toLowerCase() === "ipv4")
      .map(x => x.mac);
    if (macs.length >= 1) {
      mac = macs[0];
      if (macs.length > 1) {
        log("Something is very wrong. Got multiple ipv4 mac addresses.");
      }
    } else {
      log("Couldn't find mac address.");
    }
  } else {
    log("Couldn't find eth0.");
  }

  // Check for new configurations.
  await gitPull(`${__dirname}/../config/`);
  let latestConfigGitHash = await getLatestHash(`${__dirname}/../config/`);
  if (state.configGitHash !== latestConfigGitHash) {
    state.configGitHash = latestConfigGitHash;
    await fsPromises.writeFile("tmp/state.json", JSON.stringify(state));
  }

  // Parse current configuration and start application.
  let sourceConfig = JSON.parse(await fsPromises.readFile("../config/cls.json", "utf-8"));
  if (mac) {
    let config = sourceConfig[mac];
    if (config.mode === "browser") {
      let electronPath = "node_modules/electron/dist/electron";
      if (config.orientation === "portrait") {
        exec(`startx ${electronPath} browser.js ${config.url} -- -config /etc/X11/rpi.conf`, 
          { cwd: __dirname });
      } else {
        exec(`startx ${electronPath} browser.js ${config.url}`, { cwd: __dirname });
      }
    }
  }
}

main().catch(e => log(`Encountered error: ${e}`));



async function restart() {
  log("Running npm install...");
  await exec("npm install", { cwd: __dirname });
  log("Setting up exit listener...");
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