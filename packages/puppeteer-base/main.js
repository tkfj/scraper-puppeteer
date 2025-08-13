'use strict;'

const fs=require("fs");
const os=require("os");
const path=require("path");
const puppeteer = require("puppeteer")
const logger = require("@pkg/logger").getLogger("puppeteer-base");

function getDefaultLaunchOptions() {
    return {
        headless: false,
        slowMo: 50,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--window-size=800,600',
            '--lang=ja',
            // '--disable-setuid-sandbox',
            // '--no-default-browser-check',
            '--disable-infobars',
            //'--guest',
            //'--incognito',
        ],
        // executablePath = "/usr/bin/google-chrome"
    }
}

async function launch(launchOptions) {
    // console.log(process.argv)
    // tmpuserdir=fs.mkdtempSync(os.tmpdir()+path.sep);
    // logger.debug(`temporary user dir: ${tmpuserdir}`);
    // launchOptions['args'].push('--user-data-dir='+tmpuserdir)

    const browser=await puppeteer.launch(launchOptions);

    logger.info(`browser version: ${await browser.version()}`)
//    const page=await browser.newPage();
    const page=(await browser.pages())[0];
    await page.setViewport({
        width: 1280,
        height: 700,
        deviceScaleFactor: 1,
    });
    const ua_org=await page.evaluate(()=>{
        return navigator.userAgent;
    })
    logger.debug(`original UA: ${ua_org}`);
    const ua_set=ua_org.replace(/\bHeadlessChrome\b/,'Chrome');
    await page.setUserAgent(ua_set); //TODO ページじゃなくてデフォルトのUAを変えたいんだ。。。。
    const ua_ver=await page.evaluate(()=>{
        return navigator.userAgent;
    })
    logger.info(`fixed UA: ${ua_ver}`);
    return {
        "puppeteer": puppeteer,
        "browser": browser,
        "page": page,
    }
};

if (require.main === module) {
    (async ()=>{ 
        const launchOptions = getDefaultLaunchOptions()
        const ctx = await launch(launchOptions);
        await Promise.all([
            ctx.page.goto('https://www.google.com/', {waitUntil: ['load','networkidle2']})
        ]);
        await ctx.browser.close();
    })()
}

module.exports = {
    launch,
    getDefaultLaunchOptions,
};
