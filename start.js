#!/usr/bin/env node

const os = require("os");
const fs = require("fs");
const fsPromises = require("fs").promises;
const util = require("util");
const childProcess = require("child_process");
const exec = util.promisify(childProcess.exec);
const crypto = require("crypto");

/**
 * Signage startup script
 * ----------------------------------------------------------------------
 * This script should run at startup and on given intervals to handle 
 * updating of software and configuration files.
 */

// Load dev config if suitable.
let debugConfig;
try {
  let config = require("./config.json");
  for (var prop in config) {
    if (config.hasOwnProperty(prop)) {
      if (prop === "CONFIG") {
        debugConfig = config[prop];
      } else {
        process.env[prop] = config[prop];
      }
    }
  }
} catch (err) {
  console.error("No local config present.");
}

async function main() {
  let exit = false;
  let configHash;
  let startedProcesses = [];
  while (!exit) {
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

    let latestSoftwareGitHash = "";
    if (!process.env.DEBUG) {
      // Check for new software versions.
      await gitPull(__dirname);
      latestSoftwareGitHash = await getLatestHash(__dirname);
    }
    if (!process.env.debug && state.softwareGitHash !== latestSoftwareGitHash) {
      state.softwareGitHash = latestSoftwareGitHash;
      await fsPromises.writeFile("tmp/state.json", JSON.stringify(state));
      log("Got new software. Restarting...");
      exit = true;
      await kill(startedProcesses);
      startedProcesses = [];
    } else {
      // Get the mac address.
      let mac;
      if (!process.env.DEBUG) {
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
      } else {
        mac = "FAKE MAC FOR DEBUGGING";
      }

      // Check for new configurations.
      let latestConfigGitHash = "";
      if (!process.env.DEBUG) {
        await gitPull(`${__dirname}/../config/`);
        latestConfigGitHash = await getLatestHash(`${__dirname}/../config/`);
      }
      if (state.configGitHash !== latestConfigGitHash) {
        state.configGitHash = latestConfigGitHash;
        await fsPromises.writeFile("tmp/state.json", JSON.stringify(state));
      }

      // Parse current configuration and start application.
      let sourceConfig;
      if (!process.env.DEBUG) {
        sourceConfig = JSON.parse(await fsPromises.readFile("../config/cls.json", "utf-8"));
      }
      if (mac) {
        let config;
        if (debugConfig) {
          config = debugConfig;
        } else {
          config = sourceConfig[mac];
        }
        if (config) {
          let newConfigHash = crypto.createHash("md5").update(JSON.stringify(config)).digest("hex");
          if (!configHash || newConfigHash !== configHash) {
            configHash = newConfigHash;

            if (!process.env.DEBUG) {
              await kill(startedProcesses);
            }
            startedProcesses = [];

            if (config.mode === "browser") {
              let electronPath = `${__dirname}/node_modules/electron/dist/electron`;
              let browserjsPath = `${__dirname}/browser.js`;
              let portraitArguments = "-config /etc/X11/rpi.conf";
              let args = [electronPath, browserjsPath, config.url];
              if (config.orientation === "portrait") {
                args.push("1080");
                args.push("1920");
                args.push("--");
                args.push(portraitArguments);
              } else {
                args.push("1920");
                args.push("1080");
                args.push("--");
              }
              args.push("-s 0");
              args.push("-nocursor");
              let process = childProcess.spawn("startx", args, { cwd: __dirname, stdio: "inherit" });
              startedProcesses.push(process);
            } else if (config.mode === "video") {
              let urls = config.url;
              let videoUrls = [];
              if (!Array.isArray(urls)) {
                urls = [ "video.js" ].concat(urls);
              }
              let process = childProcess.spawn("node", urls, { cwd: __dirname, stdio: "inherit" });
              startedProcesses.push(process);
            }
          }
        } else {
          log(`Failed to find config for ${mac}.`);
        }
      }

      await sleep(5 * 60 * 1000);
    }
  }
}

main().catch(e => log(`Encountered error: ${e}`));


async function kill(processes) {
  processes.forEach(process => {
    childProcess.spawn("kill", ["-9", process.pid, { cwd: __dirname, stdio: "inherit" }]);
  });
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

async function sleep(timeInMs) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeInMs)
  });
}