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
        let pre = prefix;
        if (this.logConfig) {
            if (this.logConfig.debug === true) {
                this.logLevel = 'debug';
                DEBUG_ENABLED = (this.logConfig.debug === true);
            }
            TIMESTAMP_ENABLED = (this.logConfig.hideTimestamp === false);
            pre = (this.logConfig.hideNamePrefix === true) ? '' : pre;
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
                    prettyPrint: false,
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
                    return `[${new Date().toLocaleString()}] [${params.level.toUpperCase()}]: ${this.removeAnsi(params.message)}`;
                },
                levels: this.options.levels
            });
        }
        return logger;
    }

    msgFmt(params) {
        let msg = (TIMESTAMP_ENABLED === true) ? chalk.white("[" + new Date().toLocaleString() + "]") : '';
        msg += this.prefix ? chalk.cyan("[" + this.prefix + "]") : '';
        msg += `${this.levelColor(params.level.toUpperCase())}`;
        msg += ': ' + this.colorMsgLevel(params.level, params.message);
        return msg;
    };

    // console.log(chalk`There are {bold 5280 feet} in a mile. In {bold ${miles} miles}, there are {green.bold ${calculateFeet(miles)} feet}.`);
    removeAnsi(msg) {
        // eslint-disable-next-line no-control-regex
        return msg.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    }

    levelColor(lvl) {
        switch (lvl) {
            case 'DEBUG':
                if (DEBUG_ENABLED)
                    return chalk.bold.gray(lvl);
                break;
            case 'WARN':
                return chalk.bold.keyword('orange')(lvl);
            case 'ERROR':
                return chalk.bold.red(lvl);
            case 'GOOD':
                return chalk.bold.green(lvl);
            case 'INFO':
                return chalk.bold.whiteBright(lvl);
            case 'ALERT':
                return chalk.bold.yellow(lvl);
            case 'NOTICE':
                return chalk.bold.blueBright(lvl);
            case 'CUSTOM':
                return '';
            default:
                return lvl;
        }
    }

    colorMsgLevel(lvl, msg) {
        if (msg.startsWith('chalk')) return msg;
        switch (lvl) {
            case 'debug':
                if (DEBUG_ENABLED)
                    return chalk.gray(msg);
                break;
            case 'warn':
                return chalk.keyword('orange').bold(msg);
            case 'error':
                return chalk.bold.red(msg);
            case 'good':
                return chalk.green(msg);
            case 'info':
                return chalk.white(msg);
            case 'alert':
                return chalk.yellow(msg);
            case 'notice':
                return chalk.blueBright(msg);
            case 'custom':
                return chalk `${msg}`;
            default:
                return msg;
        }
    }

    enabledDebug() {
        DEBUG_ENABLED = true;
    }

    disableDebug() {
        DEBUG_ENABLED = false;
    }

    enabledTimestamp() {
        TIMESTAMP_ENABLED = true;
    }

    disableTimestamp() {
        TIMESTAMP_ENABLED = false;
    }
};