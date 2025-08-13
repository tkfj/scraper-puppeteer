'use strict;'

const logger = require("@pkg/logger").getLogger("scraper-mf-aggregation_queue")
const puppeteer_base = require("@pkg/puppeteer-base");
const mf_base = require("@pkg/mf-base");
const fs = require("fs");

async function scraper_mf_aggregation_queue() {
    //TODO mf_baseでログイン後のpageまで作ってもらう
    const launchOptions = puppeteer_base.getDefaultLaunchOptions();
    const {
        puppeteer,
        browser,
        page,
    } = await puppeteer_base.launch(launchOptions);
    logger.info('read cookies');
    if (fs.existsSync(mf_base.mf_cookie_path)) {
      const readcookies=JSON.parse(fs.readFileSync(mf_base.mf_cookie_path, 'utf-8'));
      for (let cookie of readcookies) {
        await page.setCookie(cookie);
      }
      logger.info('cookies found');
    }
    else {
      logger.warn('cookies not found');
    }

    await Promise.all([
        page.goto(mf_base.mf_url, {waitUntil: ['load','networkidle2']})
    ]);

    if(await mf_base.is_mf_loggedin(page, puppeteer)) {
        //nop
    } else {
        throw Error("ログインしていません。mf-loginでログインしてCookieを保存してください。")
    }


    var eye_selector='#header .global-menu a[href$="/"]';
    var target_selector='a[href$="/aggregation_queue"';
    var loding_selector='.loding"';

    // 更新ボタンがある画面にいるか。なければ移動。
    const qq1 = await page.waitForSelector(target_selector,{timeout:1000}).catch(()=>{});
    if(qq1){
        logger.info('更新ボタンあり')
        //nop
    }else{
        logger.warn('更新ボタンなし')
        await Promise.all([
            page.waitForNavigation({waitUntil: ['load','networkidle2']}),
            page.click(eye_selector),
            page.waitForSelector(target_selector, {timeout:30000}),
        ]);//.then(()=>{
        //     console.log('done');
        // }).catch((err)=>{
        //     console.log('error');
        //     console.log(err);
        // });
    }

    const lb = await page.waitForSelector(loding_selector,{timeout:1000}).catch(()=>{});
    if(lb){
        logger.warn('ローディング中なのでスキップ');
        return;
    }

    await Promise.all([
        page.waitForSelector(target_selector, {timeout:30000}),
    ]);

    logger.info('click aggregation_queue');
    await Promise.all([
        page.click(target_selector, {timeout:10000}),
    ]).then(()=>{
        logger.info('done');
    }).catch((err)=>{
        logger.error('error:',err);
    });

    const la=await page.waitForSelector(loding_selector,{timeout:30000}).catch(()=>{});
    if(la){
        logger.info('done');
    }else{
        logger.warn('ローディングになりませんでしたあきらめます。。。。');
    }

    await page.close();
    // await browser.close();
};
const scraper_key_mf_aggregation_queue = "mf-aggregation_queue";

if (require.main === module) {
    (async ()=>{
        logger.info("start");
        await scraper_mf_aggregation_queue(
        ).then(()=>{
            logger.info("done");
            process.exit(0); //TODO　これがなくてもきちんと終了させる(browser.closeが返ってこないのでどこかで何かを無限にwaitForなんちゃらしてるかも。)
        }).catch((e)=>{
            logger.error("error:", e);
            process.exit(1);
        });
    })();

}


module.exports = {
    scraper_mf_aggregation_queue,
    scraper_key_mf_aggregation_queue,
};
