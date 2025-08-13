const fs=require('fs');
const puppeteer_base = require("@pkg/puppeteer-base");

async function main() {
    const launchOptions = puppeteer_base.getDefaultLaunchOptions();
    const ctx = await puppeteer_base.launch(launchOptions);
    const { browser, page } = ctx;

    await Promise.all([
        page.goto('https://www.moneyforward.com/', {waitUntil: ['load','networkidle2']})
    ]);

    // ログイン完了の判定タグ=ログアウトのアンカー
    const s_loggedin='a[href$="/sign_out"';

    while(true) {
        const qq1=await ctx.page.waitForSelector(s_loggedin,{timeout:10000}).catch(()=>{});
        if(qq1) {
            console.log("ログインを検知しました")
            break;
        }
        console.info("ログイン完了を待機しています");
    }
    console.log('Cookieを保存します');
    const cookiepath = './cookies.json';
    const after_cookies=await page.cookies(); //TODO deprecated
    fs.writeFileSync(cookiepath, JSON.stringify(after_cookies));
    console.log(`Cookieを保存しました: ${cookiepath}`);
    await browser.close();
};

if (require.main === module) {
    (async ()=>{
        await main()
    })()
}
