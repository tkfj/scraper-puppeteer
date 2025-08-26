'use strict;'

const logger = require("@pkg/logger").getLogger("scraper-mf-liability")
const mf_base = require("@pkg/mf-base");
const fs = require("fs");

// 負債を収集する
async function scraper_mf_liability() {
    const {
        puppeteer,
        browser,
        page,
    } = await mf_base.launch_and_loggin();

    var click_selector=null;
    var next_selector='a[href$="/bs/portfolio"';

    logger.info('click asset');
    click_selector=next_selector;
    next_selector='.functions-menu-container a[href$="/bs/liability"'; // 20230216- header-container内の展開しないといけないメニューは非展開時はクリックできないので、厳密にfunctions-menu-container内のメニューを選択する
    await Promise.all([
        page.waitForNavigation({waitUntil: ['load','networkidle2']}),
        page.click(click_selector),
        page.waitForSelector(next_selector, {timeout:30000}),
    ]);//.then(()=>{
    //     console.log('done');
    // }).error((err)=>{
    //     console.log('error');
    //     console.log(err);
    // });
    logger.info('click bs liability');
    click_selector=next_selector;
    next_selector='#bs-liability';
    await Promise.all([
        page.waitForNavigation({waitUntil: ['load','networkidle2']}),
        page.click(click_selector),
        page.waitForSelector(next_selector, {timeout:30000}),
    ]);//.then(()=>{
    //     console.log('done');
    // }).error((err)=>{
    //     console.log('error');
    //     console.log(err);
    // });

    logger.info('check ttl');
    next_selector='#bs-liability div.heading-radius-box';
    await Promise.all([
        page.waitForSelector(next_selector, {timeout:30000}), 
    ]);//.then(()=>{
    //     console.log('done');
    // }).error((err)=>{
    //     console.log('error');
    //     console.log(err);
    // });
    let n_ttl_amount=await page.$(next_selector);
    let v_ttl_amount=await (await n_ttl_amount.getProperty('textContent')).jsonValue();
    v_ttl_amount=v_ttl_amount.trim().replace(/\s+/g, ' ');
    // console.log(v_ttl_amount);


    logger.info('check breakdown');
    next_selector='#bs-liability .bs-total-assets table tbody';
    await Promise.all([
        page.waitForSelector(next_selector, {timeout:30000}), 
    ]);//.then(()=>{
    //     console.log('done');
    // }).error((err)=>{
    //     console.log('error');
    //     console.log(err);
    // });
    let n_break_down=await page.$(next_selector);
    let n_break_down_line=await n_break_down.$$('tr');
    let v_break_downs=[];
    for (n of n_break_down_line) {
        let n_th=await n.$('th')
        let n_td1=await n.$('td:nth-of-type(1)');
        // let n_td2=await n.$('td:nth-of-type(2)');
        let v_break_down_k=await (await n_th.getProperty('textContent')).jsonValue();
        let v_break_down_v=await (await n_td1.getProperty('textContent')).jsonValue();
        v_break_down_k=v_break_down_k.trim();
        v_break_down_v=v_break_down_v.trim();
        // console.log(v_break_down_k);
        // console.log(v_break_down_v);
        v_break_downs.push({
            "k":v_break_down_k,
            "v":v_break_down_v,
        });
    }

    logger.info('check detail');
    next_selector='#bs-liability #liability_det table tbody';
    await Promise.all([
        page.waitForSelector(next_selector, {timeout:30000}), 
    ]);//.then(()=>{
    //     console.log('done');
    // }).error((err)=>{
    //     console.log('error');
    //     console.log(err);
    // });
    let n_detail=await page.$(next_selector);
    let n_detail_line=await n_detail.$$('tr');
    let v_details=[];
    for (n of n_detail_line) {
        let n_td1=await n.$('td:nth-of-type(1)');
        let n_td2=await n.$('td:nth-of-type(2)');
        let n_td3=await n.$('td:nth-of-type(3)');
        let n_td4=await n.$('td:nth-of-type(4)');
        let v_details_t=await (await n_td1.getProperty('textContent')).jsonValue();
        let v_details_n=await (await n_td2.getProperty('textContent')).jsonValue();
        let v_details_v=await (await n_td3.getProperty('textContent')).jsonValue();
        let v_details_w=await (await n_td4.getProperty('textContent')).jsonValue();
        v_details_t=v_details_t.trim();
        v_details_n=v_details_n.trim();
        v_details_v=v_details_v.trim();
        v_details_w=v_details_w.trim();
        // console.log(v_details_t);
        // console.log(v_details_n);
        // console.log(v_details_v);
        // console.log(v_details_w);
        v_details.push({
            "t":v_details_t,
            "n":v_details_n,
            "v":v_details_v,
            "w":v_details_w,
        });
    }

    logger.info('output');
    var dt=new Date();
    dt.setTime(dt.getTime() - (dt.getTimezoneOffset()*60*1000));
    var dt_str=dt.toISOString(); // yyyy-MM-dd'T'HH:mm:ss.SSS'Z'
    dt_str=dt_str.replace(/(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+).(\d+)Z/,'$1$2$3')
    // console.log(dt_str)

    var outdict={
        "date":dt_str,
        "total_amount":v_ttl_amount,
        "break_down":v_break_downs,
        "detail":v_details,
    }

    logger.info(JSON.stringify(outdict,null,2));
    //fs.writeFileSync('./data_liability/data_liability_'+dt_str+'.json', JSON.stringify(outdict,null,2));

    logger.info('done');
}
const scraper_key_mf_liability = "mf-liability";

if (require.main === module) {
    (async ()=>{
        logger.info("start");
        await scraper_mf_liability(
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
    scraper_mf_liability,
    scraper_key_mf_liability,
};
