'use strict;'

const mf_url = "https://www.moneyforward.com/"
const mf_selector_loggedin='a[href$="/sign_out"';
const mf_cookie_path = './mf_cookies.json';

async function is_mf_loggedin(page, puppeteer) {
    const foundSelector1 = await page.waitForSelector(mf_selector_loggedin,{timeout:10000}).catch((e)=>{
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
    is_mf_loggedin,
};
