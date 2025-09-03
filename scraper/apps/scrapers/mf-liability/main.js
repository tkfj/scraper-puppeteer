'use strict;'

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require("@pkg/logger").getLogger("scraper-mf-liability")
const mf_base = require("@pkg/mf-base");

async function pre_mf_liability(ctx) {
    return {}
}
async function scraper_mf_liability(ctx,preData) {
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
        let v_break_down_t=await (await n_th.getProperty('textContent')).jsonValue();
        let v_break_down_v=await (await n_td1.getProperty('textContent')).jsonValue();
        v_break_down_t=v_break_down_t.trim();
        v_break_down_v=v_break_down_v.trim();
        // console.log(v_break_down_t);
        // console.log(v_break_down_v);
        v_break_downs.push({
            "t":v_break_down_t,
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

    const outdict={
        "date":dt_str,
        "total_amount":v_ttl_amount,
        "break_down":v_break_downs,
        "detail":v_details,
    }
    // logger.info(JSON.stringify(outdict,null,2));
    //fs.writeFileSync('./data_liability/data_liability_'+dt_str+'.json', JSON.stringify(outdict,null,2));
    logger.info('done');
    await page.close();
    await browser.close();
    return outdict;
}
async function post_mf_liability(ctx,preData,data) {
    const bucketName = "scrpu-dev-dwh" //FIXME
    const keyPrefix = "" //"test/" //FIXME
    const s3 = new S3Client();

    logger.info("store start")

    const jst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000); //TODO スクレイピングでdate作ってるところと合わせよう
    const YYYY = jst.getUTCFullYear();
    const MM   = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const DD   = String(jst.getUTCDate()).padStart(2, '0');
    const hh   = String(jst.getUTCHours()).padStart(2, '0');
    const mm   = String(jst.getUTCMinutes()).padStart(2, '0');
    const ss   = String(jst.getUTCSeconds()).padStart(2, '0');
    const mmm  = String(jst.getUTCMilliseconds()).padStart(3, '0');
    s_ingest = `${YYYY}${MM}${DD}_${hh}${mm}${ss}_${mmm}`; // 例: 20250828_153012_047
    s_asof = data['date']

    const body = Buffer.from(JSON.stringify(data));
    const key = `${keyPrefix}ly0/liabilities/ingest=${s_ingest}/asof=${s_asof}/liabilities_${s_asof}.json`
    const s3fullpath = `s3://${bucketName}/${key}`
    logger.info(s3fullpath)
    const metadata = {
        'key': ctx['key'],
        'ingest': s_ingest,
        'asof': s_asof,
    }
    if (ctx['executionName']) {
        metadata['scrpu-execution-name'] = ctx['executionName'];
    } 
    const res = await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: 'application/json; charset=utf-8',
        Metadata: metadata,
    }));
    if (res['ETag']) {
        logger.debug(`ETag: ${res["ETag"]}`);
    }
    else {
        throw new Error(`S3アップロード失敗 ${s3fullpath}`);
    }
    logger.info("store done")
}
const scraper_key_mf_liability = "mf-liability";

if (require.main === module) {
    (async ()=>{
        logger.info("start");
        await scraper_mf_liability(
        ).then((r)=>{
            logger.info(JSON.stringify(r,null,2))
            logger.info("done");
            process.exit(0); //TODO　これがなくてもきちんと終了させる(browser.closeが返ってこないのでどこかで何かを無限にwaitForなんちゃらしてるかも。)
        }).catch((e)=>{
            logger.error("error:", e);
            process.exit(1);
        });
    })();

}

module.exports = {
    pre_mf_liability,
    scraper_mf_liability,
    post_mf_liability,
    scraper_key_mf_liability,
};
