const {
    // platformName,
    // platformDesc,
    packageFile
} = require("./Constants"),
    _ = require("lodash"),
    fs = require("fs"),
    childProcess = require("child_process"),
    compareVersions = require("compare-versions"),
    os = require("os");

var Characteristic;

module.exports = class MyUtils {
    constructor(platform) {
        this.platform = platform;
        this.client = platform.client;
        Characteristic = platform.Characteristic;
        this.log = platform.log;
        this.homebridge = platform.homebridge;
    }

    cleanSpaces(str) {
        return String(str.replace(/ /g, ""));
    }
    toTitleCase(str) {
        return str.replace(
            /\w\S*/g,
            txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    debounce(a, b, c) {
        let d;
        return function() {
            let e = this,
                f = arguments;
            clearTimeout(d),
                (d = setTimeout(function() {
                    (d = null), c || a.apply(e, f);
                }, b)),
                c && !d && a.apply(e, f);
        };
    }

    thermostatTempConversion(temp, isSet = false) {
        if (isSet) {
            return (this.platform.getTempUnit() === 'C') ? Math.round(temp) : Math.round(temp * 1.8 + 32);
        } else {
            return (this.platform.getTempUnit() === 'C') ? Math.round(temp * 10) / 10 : Math.round((temp - 32) / 1.8 * 10) / 10;
        }
    }

    colorTempFromK(temp) {
        return (1000000 / temp).toFixed();
    }

    colorTempToK(temp) {
        return (1000000 / temp).toFixed();
    }

    tempConversion(temp, onlyC = false) {
        if (this.platform.getTempUnit() === 'C' || onlyC) {
            return (parseFloat(temp * 10) / 10);
        } else {
            return (parseFloat((temp - 32) / 1.8 * 10) / 10).toFixed(2);
        }
    }

    cToF(temp) {
        return (parseFloat(temp * 10) / 10);
    }

    fToC(temp) {
        return (parseFloat((temp - 32) / 1.8 * 10) / 10);
    }

    fanSpeedConversion(speedVal, has4Spd = false) {
        if (speedVal <= 0) {
            return "off";
        }
        if (has4Spd) {
            if (speedVal > 0 && speedVal <= 25) {
                return "low";
            } else if (speedVal > 25 && speedVal <= 50) {
                return "med";
            } else if (speedVal > 50 && speedVal <= 75) {
                return "medhigh";
            } else if (speedVal > 75 && speedVal <= 100) {
                return "high";
            }
        } else {
            if (speedVal > 0 && speedVal <= 33) {
                return "low";
            } else if (speedVal > 33 && speedVal <= 66) {
                return "medium";
            } else if (speedVal > 66 && speedVal <= 99) {
                return "high";
            }
        }
    }

    fanSpeedConversionInt(speedVal) {
        if (!speedVal || speedVal <= 0) {
            return "off";
        } else if (speedVal === 1) {
            return "low";
        } else if (speedVal === 2) {
            return "medium";
        } else if (speedVal === 3) {
            return "high";
        }
    }

    fanSpeedIntToLevel(speedVal) {
        switch (speedVal) {
            case 0:
                return 0;
            case 1:
                return 32;
            case 2:
                return 66;
            case 3:
                return 100;
            default:
                return 0;
        }
    }

    fanSpeedLevelToInt(val) {
        if (val > 0 && val < 33) {
            return 1;
        } else if (val >= 33 && val < 66) {
            return 2;
        } else if (val >= 66 && val <= 100) {
            return 3;
        } else {
            return 0;
        }
    }

    convertAlarmState(value) {
        switch (value) {
            case "stay":
            case "night":
                return Characteristic.SecuritySystemCurrentState.STAY_ARM;
            case "away":
                return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            case "off":
                return Characteristic.SecuritySystemCurrentState.DISARMED;
            case "alarm_active":
                return Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
        }
    }

    convertAlarmCmd(value) {
        switch (value) {
            case 0:
            case 2:
                return "stay";
            case 1:
                return "away";
            case 3:
                return "off";
            case 4:
                return "alarm_active";
        }
    }

    getIPAddress() {
        let interfaces = os.networkInterfaces();
        for (let devName in interfaces) {
            let iface = interfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                let alias = iface[i];
                if (
                    alias.family === "IPv4" &&
                    alias.address !== "127.0.0.1" &&
                    !alias.internal
                ) {
                    return alias.address;
                }
            }
        }
        return "0.0.0.0";
    }

    updateConfig(newConfig) {
        const configPath = this.homebridge.user.configPath();
        const file = fs.readFileSync(configPath);
        const config = JSON.parse(file);
        const platConfig = config.platforms.find(x => x.name === this.config.name);
        _.extend(platConfig, newConfig);
        const serializedConfig = JSON.stringify(config, null, "  ");
        fs.writeFileSync(configPath, serializedConfig, "utf8");
        _.extend(this.config, newConfig);
    }

    checkVersion() {
        this.log.info("Checking Package Version for Updates...");
        return new Promise((resolve) => {
            childProcess.exec(
                `npm view ${packageFile.name} version`,
                (error, stdout) => {
                    const newVer = stdout && stdout.trim();
                    if (newVer && compareVersions(stdout.trim(), packageFile.version) > 0) {
                        this.log.warn(`---------------------------------------------------------------`);
                        this.log.warn(`NOTICE: New version of ${packageFile.name} available: ${newVer}`);
                        this.log.warn(`---------------------------------------------------------------`);
                        resolve(true);
                    } else {
                        this.log.info(`INFO: Your plugin version is up-to-date`);
                        resolve(false);
                    }
                }
            );
        });
    }
};