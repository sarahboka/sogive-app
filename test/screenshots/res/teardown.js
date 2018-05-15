const chalk = require('chalk');
const puppeteer = require('puppeteer');
const {takeScreenshot} = require('./UtilityFunctions');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');

//This actually seems to be the place to setup screenshotting. 
//Still have access to the browser object via the temporary directory
//Very interesting technique. Can this be used to pass objects around in general?
//No. Specific WebSocket-related thing
module.exports = async function() {
  const wsEndpoint = fs.readFileSync(path.join(DIR, 'wsEndpoint'), 'utf8');
  if (!wsEndpoint) {
    throw new Error('wsEndpoint not found');
  }
  const __BROWSER__ = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
  });

  const pages = await __BROWSER__.pages();

  //forEach is apparently unreliable when used with await
  for(let i=0; i<pages.length; i++) {
    let page = pages[i];
    await takeScreenshot(page);    
  }
  
  await __BROWSER__.close();
};
