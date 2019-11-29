const pluginName = require("./Constants").pluginName,
    winston = require('winston'),
    chalk = require('chalk');
require('winston-logrotate');
var DEBUG_ENABLED = false;
var TIMESTAMP_ENABLED = true;
var logger;

module.exports = class Logging {
    constructor(platform, prefix, config) {
        this.platform = platform;
        this.logConfig = config;
        this.homebridge = platform.homebridge;
        this.logLevel = 'good';
        console.log('path:', `${this.homebridge.user.storagePath()}/${pluginName}.log`);
        let pre = prefix;
        if (this.logConfig) {
            if (this.logConfig.debug === true) {
                this.logLevel = 'debug';
                DEBUG_ENABLED = (this.logConfig.debug === true);
            }
            TIMESTAMP_ENABLED = (this.logConfig.addTime !== false);
            pre = (this.logConfig.addName === false) ? '' : pre;
        }
        this.options = {
            colors: {
                error: 'red',
                warn: 'yellow',
                good: 'green',
                debug: 'grey',
                notice: 'blue',
                alert: 'yellow',
                info: 'white'
            },
            levels: {
                error: 0,
                warn: 1,
                info: 2,
                notice: 3,
                alert: 4,
                custom: 5,
                good: 6,
                debug: 7
            }
        };
        this.prefix = pre;
    }

    getLogger() {
        logger = new(winston.Logger)({
            levels: this.options.levels,
            colors: this.options.colors,
            transports: [
                new(winston.transports.Console)({
                    level: this.logLevel,
                    colorize: true,
                    handleExceptions: true,
                    json: false,
                    prettyPrint: true,
                    formatter: (params) => { return this.msgFmt(params); },
                    timestamp: () => { return new Date().toISOString(); }
                })
            ],
            exitOnError: false
        });

        if (this.logConfig && this.logConfig.file && this.logConfig.file.enabled) {
            logger.add(winston.transports.Rotate, {
                file: `${this.homebridge.user.storagePath()}/${pluginName}.log`,
                level: this.logLevel,
                colorize: false,
                handleExceptions: true,
                json: false,
                compress: (this.logConfig.file.compress !== false),
                keep: this.logConfig.file.daysToKeep || 5,
                size: this.logConfig.file.maxFilesize || '10m',
                formatter: (params) => {
                    return `[${new Date().toLocaleString()}] ${params.message}`;
                },
                levels: this.options.levels
            });
        }
        return logger;
    }
    msgFmt(params) {
        let msg;
        msg += (TIMESTAMP_ENABLED) ? chalk.white("[" + new Date().toLocaleString() + "]") + ' ' : '';
        msg += this.prefix ? chalk.cyan("[" + this.prefix + "]") + ' ' : msg;
        msg += this.colorByLevel(params.level, params.message);
        return msg;
    };

    colorByLevel(lvl, msg) {
        switch (lvl) {
            case 'debug':
                if (DEBUG_ENABLED)
                    msg = chalk.gray(msg);
                break;
            case 'warn':
                msg = chalk.keyword('orange').bold(msg);
                break;
            case 'error':
                msg = chalk.bold.red(msg);
                break;
            case 'good':
                msg = chalk.green(msg);
                break;
            case 'info':
                msg = chalk.white(msg);
                break;
            case 'alert':
                msg = chalk.yellow(msg);
                break;
            case 'notice':
                msg = chalk.blueBright(msg);
                break;
        }
        return msg;
    }
};