const fs=require('fs');
const os=require('os');
const path=require('path');
// const util=require('util');

var puppeteer=null;
var launchOptions={
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
}
if(process.argv.includes('--headless')) {
    launchOptions["headless"]=true
}
try {
    puppeteer=require('puppeteer');
    // launchOptions['executablePath']='C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
    // launchOptions['executablePath']='/usr/bin/google-chrome';
    console.log('using puppeteer');
    console.log('using puppeteer' + ' ' + launchOptions['executablePath']);
}
catch (e) {
    // if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    // }
    // puppeteer=require('puppeteer-core');
    // launchOptions['executablePath']='C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
    // console.log('using puppeteer-core' + ' ' + launchOptions['executablePath']);
}

// 負債を収集する
async function liability(browser, page) {
    var click_selector=null;
    var next_selector='a[href$="/bs/portfolio"';

    console.info('click asset');
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
    console.info('click bs liability');
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

    console.info('check ttl');
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


    console.info('check breakdown');
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

    console.info('check detail');
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

    console.info('output');
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

    // console.log(JSON.stringify(outdict,null,2));
    fs.writeFileSync('./data_liability/data_liability_'+dt_str+'.json', JSON.stringify(outdict,null,2));

    console.info('done');
}


//資産CSVダウンロード
async function bs_history(browser, page) {
    var click_selector='a[href$="/bs/portfolio"';
    var next_selector='.functions-menu-container a[href$="/bs/history"'; // 20230216- header-container内の展開しないといけないメニューは非展開時はクリックできないので、厳密にfunctions-menu-container内のメニューを選択する
    await Promise.all([
        page.waitForSelector(click_selector, {timeout:30000}),
    ]);

    console.log('click asset');
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
    console.log('click bs history');
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
    console.log('click download');
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
    console.log(tmpdir);
    // const download_dir='~/Downloads';
    client = await page.target().createCDPSession();
    // client = page._client;
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow', // ダウンロードを許可
        downloadPath: tmpdir, // ダウンロード先のフォルダを指定
    });

    console.log('click download csv');
    await page.click(next_selector)

    console.log('find file');
    let filename = await ((async () => {
        let filename;
        while ( ! filename || filename.endsWith('.crdownload')) {
            filename = fs.readdirSync(tmpdir)[0];
            await new Promise(resolve=>{setTimeout(resolve,1000)});
        }
        return filename
    })());
    const old_path=path.resolve(tmpdir+path.sep+filename)
    console.log(old_path);
    console.log('move file');
    const new_path=path.resolve('.'+path.sep+filename)
    console.log(new_path);
    // fs.renameSync(old_path,new_path);//クロスデバイスでエラーになるので。どうせディレクトリもろとも消すので元は残ってもいいし
    fs.copyFileSync(old_path,new_path);
    // console.log(filename);
    fs.rmSync(tmpdir,{recursive:true});
}

//一括更新
async function aggregation_queue(browser, page) {
    //TODO .lodingは常にhiddenで存在している。(けど。このスクリプトでは見つけられていない。けど、DevToolだと拾えるが？)
    var eye_selector='#header .global-menu a[href$="/"]';
    var target_selector='a[href$="/aggregation_queue"';
    var loding_selector='.loding"';

    // 更新ボタンがある画面にいるか。なければ移動。
    const qq1=await page.waitForSelector(target_selector,{timeout:1000}).catch(()=>{});
    if(qq1){
        console.log('更新ボタンあり')
        //nop
    }else{
        console.log('更新ボタンなし')
        await Promise.all([
            page.waitForNavigation({waitUntil: ['load','networkidle2']}),
            page.click(eye_selector),
            page.waitForSelector(target_selector, {timeout:30000}),
        ]);//.then(()=>{
        //     console.log('done');
        // }).error((err)=>{
        //     console.log('error');
        //     console.log(err);
        // });
    }

    const lb=await page.waitForSelector(loding_selector,{timeout:1000}).catch(()=>{});
    if(lb){
        console.info('ローディング中なのでスキップ'); //　TODO　これをエラーとするか。
        return;
    }

    await Promise.all([
        page.waitForSelector(target_selector, {timeout:30000}),
    ]);

    console.log('click aggregation_queue');
    await Promise.all([
        page.click(target_selector),
    ]);//.then(()=>{
    //     console.log('done');
    // }).error((err)=>{
    //     console.log('error');
    //     console.log(err);
    // });

    // const la=await page.waitForSelector(loding_selector,{timeout:30000}).catch(()=>{});
    // if(la){
    //     console.info('done');
    // }else{
    //     console.info('ローディングになりませんでしたあきらめます。。。。');
    // }
}

async function touch(fname) {
    try{
        const dt=new Date()
        fs.utimesSync(fname,dt,dt)
    }catch{
        fs.closeSync(fs.openSync(fname,'w'))
    }
}

async function main() {
    // console.log(process.argv)
    tmpuserdir=fs.mkdtempSync(os.tmpdir()+path.sep);
    console.log(tmpuserdir);
    launchOptions['args'].push('--user-data-dir='+tmpuserdir)

    // TODO 一括更新ボタンを押す。(待てるのかな？)
    const browser=await puppeteer.launch(launchOptions);

    console.log(await browser.version())
    const page=await browser.newPage();
    await page.setViewport({
        width: 1280,
        height: 700,
        deviceScaleFactor: 1,
    });
    const ua_org=await page.evaluate(()=>{
        return navigator.userAgent;
    })
    console.log(ua_org);
    const ua_set=ua_org.replace(/\bHeadlessChrome\b/,'Chrome');
    await page.setUserAgent(ua_set);
    const ua_ver=await page.evaluate(()=>{
        return navigator.userAgent;
    })
    console.log(ua_ver);

    console.log('read cookies');
    if (fs.existsSync('./cookies.json')) {
      const readcookies=JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));
      for (let cookie of readcookies) {
        await page.setCookie(cookie);
      }
      console.log('cookies found');
    }
    else {
      console.log('cookies not found');
    }

    console.log('goto mf');
    await Promise.all([
        page.goto('https://www.google.com/', {waitUntil: ['load','networkidle2']})
    ]);


    

    console.log('login');
    // console.log('check logged in');

    // const s_landing='a[href$="/sign_in"]';
    // const s_login_email='a[href*="/sign_in/email?"]';
    // const s_enter_id='input[name="mfid_user[email]"]';
    // const s_enter_pw='input[name="mfid_user[password]"]';
    // const s_loggedin='a[href$="/sign_out"';

    // //#ログインループ
    // while(true) {
    //     console.log(1);
    //     const qq1=await page.waitForSelector(s_loggedin,{timeout:1000}).catch(()=>{});
    //     if(qq1) break;
    //     console.log(999);
    //     const qqz=await page.waitForSelector(s_enter_id,{timeout:1000}).catch(()=>{});
    //     if(qqz) {
    //         console.log("next -> "+s_enter_id)
    //         console.log('type email');
    //         await page.type(s_enter_id, 'f2000p@gmail.com');
    //         console.log('click next');
    //         await Promise.all([
    //             page.waitForNavigation({waitUntil: ['load','networkidle2']}),
    //             page.click('input[type="submit"][value="同意してログインする"]'),
    //         ]);
    //     }
    //     console.log(4);
    //     const qq4=await page.waitForSelector(s_enter_pw,{timeout:1000}).catch(()=>{});
    //     if(qq4) {
    //         console.log("next -> "+s_enter_pw)
    //         console.log('type password');
    //         await page.type(s_enter_pw, 'VS#^Zzv88z4zsrMQg*wx')
    //         console.log('click next');
    //         await Promise.all([
    //             page.waitForNavigation({waitUntil: ['load','networkidle2']}),
    //             page.click('input[type="submit"][value="ログインする"]'),
    //         ]);
    //     }
    //     console.log(2);
    //     const qq2=await page.waitForSelector(s_login_email,{timeout:1000}).catch(()=>{});
    //     if(qq2) {
    //         console.log('at login email')
    //         console.log("next -> "+s_login_email)
    //         await Promise.all([
    //             page.waitForNavigation({waitUntil: ['load','networkidle2']}),
    //             page.click(s_login_email),
    //         ]);
    //     }
    //     console.log(0);
    //     const qq0=await page.waitForSelector(s_landing,{timeout:1000}).catch(()=>{});
    //     if(qq0) {
    //         console.log('at landing')
    //         console.log("next -> "+s_landing)
    //         await Promise.all([
    //             page.waitForNavigation({waitUntil: ['load','networkidle2']}),
    //             page.click(s_landing),
    //         ]);
    //     }
    // }
    // console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    // console.log('save cookies');
    // const after_cookies=await page.cookies();
    // fs.writeFileSync('./cookies.json', JSON.stringify(after_cookies));


    // if(process.argv.includes('--bs_history')) {
    //     try {
    //         await bs_history(browser, page);
    //         send_slack(log_channel,'mf bs_history')
    //     }
    //     catch (e) {
    //         if(e instanceof Error){
    //             send_slack(log_channel,'mf bs_history error:' + e.toString())
    //         }
    //         else {
    //             send_slack(log_channel,'mf bs_history unknown error:' + e.toString())
    //         }
    //         throw e;
    //     }
    // }
    // if(process.argv.includes('--liability')) {
    //     try {
    //         await liability(browser, page);
    //         send_slack(log_channel,'mf liability')
    //     }
    //     catch (e) {
    //         if(e instanceof Error){
    //             send_slack(log_channel,'mf liability error:' + e.toString())
    //         }
    //         else {
    //             send_slack(log_channel,'mf liability unknown error:' + e.toString())
    //         }
    //         throw e;
    //     }
    // }
    // if(process.argv.includes('--aggregation_queue')) {
    //     try {
    //         await aggregation_queue(browser, page);
    //         send_slack(log_channel,'mf aggregation_queue')
    //     }
    //     catch (e) {
    //         if(e instanceof Error){
    //             send_slack(log_channel,'mf aggregation_queue error:' + e.toString())
    //         }
    //         else {
    //             send_slack(log_channel,'mf aggregation_queue unknown error:' + e.toString())
    //         }
    //         throw e;
    //     }
    // }
    // await touch('./touch')


    // await browser.close();
    // console.log('complete');
};

main()
fs.rmSync(tmpuserdir,{recursive:true});
