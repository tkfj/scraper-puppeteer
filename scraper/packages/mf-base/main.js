'use strict;'

const puppeteer_base = require("@pkg/puppeteer-base");
const logger = require("@pkg/logger").getLogger("mf-base")
const fs = require("fs");

const mf_url = "https://www.moneyforward.com/"
const mf_selector_loggedin='a[href$="/sign_out"';
const mf_cookie_path = './mf_cookies.json';

async function launch_and_loggin(launchOptions = undefined) {
    if ( launchOptions === undefined ) {
        launchOptions = puppeteer_base.getDefaultLaunchOptions()
    }
    const {
        puppeteer,
        browser,
        page,
    } = await puppeteer_base.launch(launchOptions);
    logger.info('read cookies');
    if (fs.existsSync(mf_cookie_path)) { //TODO ファイルチェックしないで読みにいく。特定エラーが返ってきたらファイルは存在しない判断
      const readcookies=JSON.parse(fs.readFileSync(mf_cookie_path, 'utf-8'));
      for (let cookie of readcookies) {
        await page.setCookie(cookie);
      }
      logger.info('cookies found');
    }
    else {
      logger.warn('cookies not found');
    }
    await Promise.all([
        page.goto(mf_url, {waitUntil: ['load','networkidle2']})
    ]);
    if(await is_mf_loggedin(page, puppeteer)) {
        //nop
    } else {
        throw Error("ログインしていません。mf-loginでログインしてCookieを保存してください。")
    }
    return {
        puppeteer,
        browser,
        page,
    }
}


async function is_mf_loggedin(page, puppeteer, timeout = 10000) {
    const foundSelector1 = await page.waitForSelector(mf_selector_loggedin,{timeout:timeout}).catch((e)=>{
        if (e instanceof puppeteer.TimeoutError) {
            //nop
        } else {
            throw e;
        }
    });
    if(foundSelector1) {
        return true;
    }
    else {
        return false;
    }
}



module.exports = {
    mf_url,
    // mf_selector_loggedin,
    mf_cookie_path,
    launch_and_loggin,
    is_mf_loggedin,
};
