'use strict;'

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require("@pkg/logger").getLogger("scraper-mf-bs-history")
const mf_base = require("@pkg/mf-base");
const fs = require("fs");
const os = require("os");
const path = require("path");
const iconv = require("iconv-lite")

async function pre_mf_bs_history(ctx) {
    return {}
}
async function scraper_mf_bs_history(ctx,preData) {
    const {
        puppeteer,
        browser,
        page,
    } = await mf_base.launch_and_loggin();

    var click_selector='a[href$="/bs/portfolio"';
    var next_selector='.functions-menu-container a[href$="/bs/history"'; // 20230216- header-container内の展開しないといけないメニューは非展開時はクリックできないので、厳密にfunctions-menu-container内のメニューを選択する
    await Promise.all([
        page.waitForSelector(click_selector, {timeout:30000}),
    ]);

    logger.info('click asset');
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
    logger.info('click bs history');
    click_selector=next_selector;
    next_selector='.icon-download-alt';
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
    logger.info('click download');
    click_selector=next_selector;
    next_selector='a[href$="/bs/history/csv"';
    await Promise.all([
        // page.waitForNavigation({waitUntil: ['load','networkidle2']}),
        page.click(click_selector),
        page.waitForSelector(next_selector, {timeout:30000, visible:true}), //visible!!!
    ]);//.then(()=>{
    //     console.log('done');
    // }).error((err)=>{
    //     console.log('error');
    //     console.log(err);
    // });

    // console.log(os.tmpdir());
    tmpdir=fs.mkdtempSync(os.tmpdir()+path.sep);
    logger.info(tmpdir);
    // const download_dir='~/Downloads';
    client = await page.target().createCDPSession();
    // client = page._client;
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow', // ダウンロードを許可
        downloadPath: tmpdir, // ダウンロード先のフォルダを指定
    });

    logger.info('click download csv');
    await page.click(next_selector)

    logger.info('finding file');
    let filename = await ((async () => {
        let filename;
        while ( ! filename || filename.endsWith('.crdownload')) {
            filename = fs.readdirSync(tmpdir)[0];
            await new Promise(resolve=>{setTimeout(resolve,1000)});
        }
        return filename
    })());
    logger.info('file found');
    const old_path=path.resolve(tmpdir+path.sep+filename)
    logger.info(old_path);
    // logger.info('moveing file');
    // const new_path=path.resolve('.'+path.sep+filename)
    // logger.info(new_path);
    // // fs.renameSync(old_path,new_path);//クロスデバイスでエラーになるので。どうせディレクトリもろとも消すので元は残ってもいいし
    // fs.copyFileSync(old_path,new_path);
    // // console.log(filename);
    // fs.rmSync(tmpdir,{recursive:true});
    // logger.info('file moved');

    // logger.info('output');
    // var dt=new Date();
    // dt.setTime(dt.getTime() - (dt.getTimezoneOffset()*60*1000));
    // var dt_str=dt.toISOString(); // yyyy-MM-dd'T'HH:mm:ss.SSS'Z'
    // dt_str=dt_str.replace(/(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+).(\d+)Z/,'$1$2$3')
    // // console.log(dt_str)

    const outdict={
        "path":old_path,
    }
    // logger.info(JSON.stringify(outdict,null,2));
    //fs.writeFileSync('./data_liability/data_liability_'+dt_str+'.json', JSON.stringify(outdict,null,2));
    logger.info('done');
    await page.close();
    await browser.close();

    // const content = iconv.decode(fs.readFileSync(old_path), "cp932").replace(/\r\n/g, '\n');
    // logger.trace(content);
    // const lines = content.split(/\n/);
    // const s_asof = lines[1].split(",")[0].slice(1, -1).replace("/","");
    // logger.trace(s_asof)
    return outdict;
}
async function post_mf_bs_history(ctx,preData,data) {
    const bucketName = "scrpu-dev-dwh" //FIXME
    const keyPrefix = "test/" //FIXME
    const s3 = new S3Client();

    const b_content = fs.readFileSync(data['path']);
    const s_content = iconv.decode(b_content, "cp932");
    s_asof = s_content.split(/\r?\n/)[1].split(",")[0].slice(1, -1).replace(/\//g,"");
    logger.trace(s_asof)

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

    // const body = Buffer.from(b_content);
    const body = b_content;
    const key = `${keyPrefix}ly0/assets/ingest=${s_ingest}/asof=${s_asof}/assets_${s_asof}.csv`
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
        ContentType: 'text/csv; charset=cp932',
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
const scraper_key_mf_bs_history = "mf-bs_history";

if (require.main === module) {
    (async ()=>{
        logger.info("start");
        await scraper_mf_bs_history(
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
    pre_mf_bs_history,
    scraper_mf_bs_history,
    post_mf_bs_history,
    scraper_key_mf_bs_history,
};
