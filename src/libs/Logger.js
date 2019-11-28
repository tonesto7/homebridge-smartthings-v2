/* eslint-disable no-unused-vars */
const chalk = require('chalk'),
    util = require('util'),
    winston = require('winston');

require('winston-logrotate');

module.exports = {
    Logger: Logger,
    setDebugEnabled: setDebugEnabled,
    setTimestampEnabled: setTimestampEnabled,
    forceColor: forceColor,
    _system: new Logger() // system logger, for internal use only
};

var DEBUG_ENABLED = false;
var TIMESTAMP_ENABLED = true;

// Turns on debug level logging
function setDebugEnabled(enabled) {
    DEBUG_ENABLED = enabled;
}

// Turns off timestamps in log messages
function setTimestampEnabled(timestamp) {
    TIMESTAMP_ENABLED = timestamp;
}

// Force color in log messages, even when output is redirected
function forceColor() {
    chalk.enabled = true;
    chalk.level = 1;
}

// global cache of logger instances by plugin name
var loggerCache = {};
var loggerBuffer = [];
var winstonLogger = null;
/**
 * Logger class
 */

function Logger(prefix, debug = false, config = null) {
    let level = 'good';
    if (debug === true) {
        level = 'debug';
        DEBUG_ENABLED = true;
    }
    this.prefix = prefix;
    let that = this;
    this.logger = new(winston.Logger)({
        transports: [
            new winston.transports.Console({
                level: level,
                handleExceptions: true,
                json: false,
                colorize: true,
                formatter: function(params) {
                    let msg = params.message;

                    switch (params.level) {
                        case 'debug':
                            if (DEBUG_ENABLED === false) return;
                            msg = chalk.gray(msg);
                            break;
                        case 'warn':
                            msg = chalk.keyword('orange').bold(msg);
                            // func = console.error;
                            break;
                        case 'error':
                            msg = chalk.bold.red(msg);
                            // func = console.error;
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

                    // prepend prefix if applicable
                    if (that.prefix) msg = chalk.cyan("[" + that.prefix + "]") + " " + msg;

                    // prepend timestamp
                    if (TIMESTAMP_ENABLED) msg = chalk.white("[" + new Date().toLocaleString() + "]") + " " + msg;
                    return msg;
                }
            })
        ],
        colors: {
            error: 'red',
            warn: 'yellow',
            good: 'green',
            debug: 'grey',
            notice: 'blue',
            alert: 'yellow'
        },
        levels: {
            error: 0,
            warn: 2,
            info: 3,
            notice: 4,
            alert: 5,
            good: 6,
            debug: 7
        },
        exitOnError: false
    });
    winstonLogger = this.logger;
    if (config) {
        this.logger.add(winston.transports.Rotate, {
            file: `${config.path}/${config.file}`,
            colorize: false,
            timestamp: true,
            json: false,
            size: config.size,
            keep: config.keep,
            compress: config.compress,
            formatter: function(params) {
                return params.message;
            },
            level: level
        });
    }
}

Logger.prototype.debug = function(_msg) {
    //this.logger.log('debug', msg, {prefix: this.prefix});
    this.log.apply(this, ['debug'].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.good = function(_msg) {
    //this.logger.log('good', msg, {prefix: this.prefix});
    this.log.apply(this, ['good'].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.info = function(_msg) {
    this.log.apply(this, ["info"].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.warn = function(_msg) {
    this.log.apply(this, ["warn"].concat(Array.prototype.slice.call(arguments)));
};
Logger.prototype.notice = function(_msg) {
    this.log.apply(this, ["notice"].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.alert = function(_msg) {
    this.log.apply(this, ["alert"].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.error = function(_msg) {
    //this.logger.log('error', msg, {prefix: this.prefix});
    this.log.apply(this, ['error'].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.setDebug = function(enabled) {
    if (winstonLogger) {
        for (const it in winstonLogger.transports) {
            if (enabled) {
                winstonLogger.transports[it].level = 'debug';
                DEBUG_ENABLED = true;
            } else {
                winstonLogger.transports[it].level = 'good';
                DEBUG_ENABLED = false;
            }
        }
    }
};

Logger.prototype.log = function(level, msg) {
    msg = util.format.apply(util, Array.prototype.slice.call(arguments, 1));
    if (this.logger) {
        loggerBuffer.forEach(line => {
            this.logger.log(line.level, line.message, { prefix: this.prefix });
        });
        loggerBuffer = [];
        this.logger.log(level, msg, { prefix: this.prefix });
    } else {
        loggerBuffer.push({ level: level, message: msg });
    }
};

Logger.withPrefix = function(prefix, debug = false, config = null) {
    if (!loggerCache[prefix]) {
        // create a class-like logger thing that acts as a function as well
        // as an instance of Logger.
        let logger = new Logger(prefix, debug, config);
        let log = logger.info.bind(logger);
        log.debug = logger.debug;
        log.info = logger.info;
        log.warn = logger.warn;
        log.error = logger.error;
        log.log = logger.log;
        log.prefix = logger.prefix;
        log.good = logger.good;
        log.alert = logger.alert;
        log.notice = logger.notice;
        log.setDebug = logger.setDebug;
        loggerCache[prefix] = log;
    }
    return loggerCache[prefix];
};