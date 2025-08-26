const log4js = require('log4js');
const yaml = require('js-yaml');
const fs = require('fs');
try {
    const logconfig = yaml.load(fs.readFileSync('./logger.yaml'), 'utf-8');
    log4js.configure(logconfig);
    const logger = log4js.getLogger("logger");
    logger.info("log4js configured(logger.yaml)")
} catch (e) {
    if (e.code === "ENOENT") {
        const logger = log4js.getLogger("logger");
        log4js.configure({
            "appenders": {"console": {"type": "console", "level": "all"}},
            "categories": {"default": {"appenders": ["console"], "level": "all"}},
        });
        logger.info("log4js configured(default)");
    }
    else {
        console.error("log4js configure error:", e);
        throw e
    }
}

module.exports = log4js;
