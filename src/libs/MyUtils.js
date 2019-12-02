const {
    platformName,
    // platformDesc,
    packageFile
} = require("./Constants"),
    _ = require("lodash"),
    fs = require("fs"),
    childProcess = require("child_process"),
    compareVersions = require("compare-versions"),
    os = require("os");

module.exports = class MyUtils {
    constructor(platform) {
        this.platform = platform;
        this.log = platform.log;
        this.homebridge = platform.homebridge;
        this.temperature_unit = platform.temperature_unit;
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

    tempConversion(tempVal) {
        if (this.temperature_unit === "C") {
            return Math.round(parseFloat(((tempVal - 32) / 1.8) * 10) / 10, 2);
        } else {
            return Math.round(parseFloat(tempVal), 2);
        }
    }

    tempConversionFrom_F(tempVal) {
        if (this.temperature_unit === "C") {
            return Math.round(parseFloat(tempVal * 10) / 10, 0);
        } else {
            return Math.round(parseFloat(((tempVal - 32) / 1.8) * 10) / 10, 2);
        }
    }

    tempConversionFrom_C(tempVal) {
        if (this.temperature_unit === "C") {
            return tempVal;
        } else {
            return tempVal * 1.8 + 32;
        }
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

    convertAlarmState(value, valInt = false, Characteristic) {
        switch (value) {
            case "stay":
            case "armHome":
            case "armedHome":
            case "armhome":
            case "armedhome":
            case 0:
                return valInt ?
                    Characteristic.SecuritySystemCurrentState.STAY_ARM :
                    platformName === "Hubitat" ?
                    "armHome" :
                    "stay";
            case "away":
            case "armaway":
            case "armAway":
            case "armedaway":
            case "armedAway":
            case 1:
                return valInt ?
                    Characteristic.SecuritySystemCurrentState.AWAY_ARM :
                    platformName === "Hubitat" ?
                    "armAway" :
                    "away";
            case "night":
            case "armnight":
            case "armNight":
            case "armednight":
            case 2:
                return valInt ?
                    Characteristic.SecuritySystemCurrentState.NIGHT_ARM :
                    platformName === "Hubitat" ?
                    "armNight" :
                    "night";
            case "off":
            case "disarm":
            case "disarmed":
            case 3:
                return valInt ?
                    Characteristic.SecuritySystemCurrentState.DISARMED :
                    platformName === "Hubitat" ?
                    "disarm" :
                    "off";
            case "alarm_active":
            case 4:
                return valInt ?
                    Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED :
                    "alarm_active";
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
        childProcess.exec(
            `npm view ${packageFile.name} version`,
            (error, stdout) => {
                const newVer = stdout && stdout.trim();
                if (newVer && compareVersions(stdout.trim(), packageFile.version) > 0) {
                    this.log.warn(`---------------------------------------------------------------`);
                    this.log.warn(`NOTICE: New version of ${packageFile.name} available: ${newVer}`);
                    this.log.warn(`---------------------------------------------------------------`);
                } else {
                    this.log.info(`INFO: Your plugin version is up-to-date`);
                }
            }
        );
    }
};