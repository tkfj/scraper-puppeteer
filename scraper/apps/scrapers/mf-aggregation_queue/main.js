'use strict;'

const logger = require("@pkg/logger").getLogger("scraper-mf-aggregation_queue")
const mf_base = require("@pkg/mf-base");

async function pre_mf_aggregation_queue(ctx) {
    return {}
}
async function scraper_mf_aggregation_queue(ctx,preData) {
    const {
        puppeteer,
        browser,
        page,
    } = await mf_base.launch_and_loggin();

    var eye_selector='#header .global-menu a[href$="/"]';
    var target_selector='a[href$="/aggregation_queue"';
    var loding_selector='li.loding';

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

    const lb = await page.waitForSelector(loding_selector,{visible: true, timeout:1000}).catch(()=>{});
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
        logger.info('click done');
    }).catch((err)=>{
        logger.error('click error:',err);
    });

    const la=await page.waitForSelector(loding_selector,{visible: true, timeout:30000}).catch(()=>{});
    if(la){
        logger.info('loading start');
    }else{
        logger.warn('ローディングになりませんでしたあきらめます。。。。');
    }

    await page.close();
    // await browser.close();
    return {}
};
async function post_mf_aggregation_queue(ctx,preData,data) {
}
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
    pre_mf_aggregation_queue,
    scraper_mf_aggregation_queue,
    post_mf_aggregation_queue,
    scraper_key_mf_aggregation_queue,
};
