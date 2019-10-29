const util = require("util");
const childProcess = require("child_process");
const exec = util.promisify(childProcess.exec);
const axios = require("axios");
const xmlParser = require("fast-xml-parser");

async function main() {
  let videoUrls = [];
  process.argv = [ "asd", "asd", "https://play.chalmers.se/media/erccomics-cellslife-ch1/0_7myl5ba6" ]
  if (process.argv.length > 2) {
    for (var i=2; i<process.argv.length; i++) {
      let url = process.argv[i];
      let playChalmersRx = /^https:\/\/play\.chalmers\.se\/media\/[^\/]+\/(.+)/;
      if (playChalmersRx.test(url)) {
        let id = playChalmersRx.exec(url)[1];
        let response = await axios.get("https://streaming.kaltura.nordu.net" + 
            "/p/333/sp/33300/playManifest/entryId/" + id + "/protocol/https/flavorParamId/0");
        let jsonResponse = xmlParser.parse(response.data,
          {
            ignoreAttributes: false
          });
        videoUrls.push(jsonResponse.manifest.media["@_url"]);
      }
    }
  
    let videoIndex = 0;
    while (true) {
      await exec("omxplayer " + videoUrls[videoIndex]);
      videoIndex += 1;
      if (videoIndex > videoUrls.length) {
        videoIndex = 0;
      }
    }
  } else {
    console.error("No urls submitted.");
  }
}

main().catch(error => console.error("Major malfunction: ", error));