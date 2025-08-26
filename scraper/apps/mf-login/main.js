const fs=require('fs');
const puppeteer_base = require("@pkg/puppeteer-base");
const mf_base = require("@pkg/mf-base");
const logger = require("@pkg/logger").getLogger("mf-login");

async function main() {
    const launchOptions = puppeteer_base.getDefaultLaunchOptions();
    const {
        puppeteer,
        browser,
        page,
    } = await puppeteer_base.launch(launchOptions);

    await Promise.all([
        page.goto(mf_base.mf_url, {waitUntil: ['load','networkidle2']})
    ]);

    while(true) {
        logger.info("waiting for loggin");
        if(await mf_base.is_mf_loggedin(page, puppeteer)) {
            logger.info("logged-in");
            break;
        }
    }
    logger.info('saving cookies');
    const cookiepath = './mf_cookies.json';
    const after_cookies=await page.cookies(); //TODO deprecated
    fs.writeFileSync(cookiepath, JSON.stringify(after_cookies));
    logger.info(`cookies saved: ${cookiepath}`);
    await browser.close();
};

if (require.main === module) {
    (async ()=>{
        try {
            logger.info("start");
            await main();
            logger.info("done");
        } catch (e) {
            logger.error("error: ", e);
            process.exit(1);
            // throw e;
        }
    })();

}
