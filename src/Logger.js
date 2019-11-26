/* eslint-disable no-unused-vars */
const chalk = require("chalk");
const util = require("util");

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

/**
 * Logger class
 */

function Logger(prefix) {
    this.prefix = prefix;
}

Logger.prototype.debug = function(_msg) {
    if (DEBUG_ENABLED)
        this.log.apply(this, ["debug"].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.good = function(_msg) {
    this.log.apply(this, ["good"].concat(Array.prototype.slice.call(arguments)));
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
    this.log.apply(this, ["error"].concat(Array.prototype.slice.call(arguments)));
};

Logger.prototype.log = function(level, msg) {
    let func = console.log;
    msg = util.format.apply(util, Array.prototype.slice.call(arguments, 1));
    switch (level) {
        case 'debug':
            msg = chalk.gray(msg);
            break;
        case 'warn':
            msg = chalk.keyword('orange').bold(msg);
            func = console.error;
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
        case 'error':
            msg = chalk.bold.red(msg);
            func = console.error;
            break;
        case 'good':
            msg = chalk.green(msg);
            break;
    }

    // prepend prefix if applicable
    if (this.prefix) msg = chalk.cyan("[" + this.prefix + "]") + " " + msg;

    // prepend timestamp
    if (TIMESTAMP_ENABLED) {
        let date = new Date();
        msg = chalk.white("[" + date.toLocaleString() + "]") + " " + msg;
    }

    func(msg);
};

Logger.withPrefix = function(prefix) {
    if (!loggerCache[prefix]) {
        // create a class-like logger thing that acts as a function as well
        // as an instance of Logger.
        let logger = new Logger(prefix);
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
        loggerCache[prefix] = log;
    }
    return loggerCache[prefix];
};