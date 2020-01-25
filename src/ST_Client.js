const {
    platformName,
    platformDesc,
    pluginVersion
} = require("./libs/Constants"),
    rp = require("request-promise-native"),
    url = require("url");

module.exports = class ST_Client {
    constructor(platform) {
        this.platform = platform;
        this.log = platform.log;
        this.useLocal = platform.local_commands;
        this.hubIp = platform.local_hub_ip;
        this.configItems = platform.getConfigItems();
        let appURL = url.parse(this.configItems.app_url);
        this.urlItems = {
            app_host: appURL.hostname || "graph.api.smartthings.com",
            app_port: appURL.port || 443,
            app_path: `${(appURL.path || "/api/smartapps/installations/")}${this.configItems.app_id}/`
        };
        this.localErrCnt = 0;
        this.localDisabled = false;
    }

    sendAsLocalCmd() {
        return (this.useLocal === true && this.hubIp !== undefined);
    }

    localHubErr(hasErr) {
        if (hasErr) {
            if (this.useLocal && !this.localDisabled) {
                this.log.error(`Unable to reach your SmartThing Hub Locally... You will not receive device events!!!`);
                this.useLocal = false;
                this.localDisabled = true;
            }
        } else {
            if (this.localDisabled) {
                this.useLocal = true;
                this.localDisabled = false;
                this.log.good(`Now able to reach local Hub... Restoring Local Commands!!!`);
                this.sendStartDirect();
            }
        }
    }

    updateGlobals(hubIp, useLocal = false) {
        this.log.notice(`Updating Global Values | HubIP: ${hubIp} | UseLocal: ${useLocal}`);
        this.hubIp = hubIp;
        this.useLocal = (useLocal === true);
    }

    handleError(src, err, allowLocal = false) {
        switch (err.statusCode) {
            case 401:
                this.log.error(`${src} Error | SmartThings Token Error: ${err.error.error} | Message: ${err.error.error_description}`);
                break;
            case 403:
                this.log.error(`${src} Error | SmartThings Authentication Error: ${err.error.error} | Message: ${err.error.error_description}`);
                break;
            default:
                if (err.message.startsWith('getaddrinfo EAI_AGAIN')) {
                    this.log.error(`${src} Error | Possible Internet/Network/DNS Error | Unable to reach the uri | Message ${err.message}`);
                } else if (allowLocal && err.message.startsWith('Error: connect ETIMEDOUT ')) {
                    this.localHubErr(true);
                } else {
                    console.error(err);
                    this.log.error(`${src} Error: ${err.error.error} | Message: ${err.error.error_description}`);
                    this.platform.sentryErrorEvent(err);
                }
                break;
        }
    }

    getDevices() {
        let that = this;
        return new Promise((resolve) => {
            rp({
                    uri: `${that.configItems.app_url}${that.configItems.app_id}/devices`,
                    qs: {
                        access_token: that.configItems.access_token
                    },
                    json: true
                })
                .catch((err) => {
                    this.handleError('getDevices', err);
                    resolve(undefined);
                })
                .then((body) => {
                    resolve(body);
                });
        });
    }

    getDevice(deviceid) {
        let that = this;
        return new Promise((resolve) => {
            rp({
                    uri: `${that.configItems.app_url}${that.configItems.app_id}/${deviceid}/query`,
                    qs: {
                        access_token: that.configItems.access_token
                    },
                    json: true
                })
                .catch((err) => {
                    that.handleError('getDevice', err);
                    resolve(undefined);
                })
                .then((body) => {
                    resolve(body);
                });
        });
    }

    sendDeviceCommand(callback, devData, cmd, vals) {
        let that = this;
        let sendLocal = this.sendAsLocalCmd();
        let config = {
            method: 'POST',
            uri: `${this.configItems.app_url}${this.configItems.app_id}/${devData.deviceid}/command/${cmd}`,
            qs: {
                access_token: this.configItems.access_token
            },
            headers: {
                evtSource: `Homebridge_${platformName}_${this.configItems.app_id}`,
                evtType: 'hkCommand'
            },
            body: vals,
            json: true
        };
        if (sendLocal) {
            config.uri = `http://${this.hubIp}:39500/event`;
            delete config.qs;
            config.body = {
                deviceid: devData.deviceid,
                command: cmd,
                values: vals,
                evtSource: `Homebridge_${platformName}_${this.configItems.app_id}`,
                evtType: 'hkCommand'
            };
        }
        return new Promise((resolve) => {
            try {
                that.log.notice(`Sending Device Command: ${cmd}${vals ? ' | Value: ' + JSON.stringify(vals) : ''} | Name: (${devData.name}) | DeviceID: (${devData.deviceid}) | SendToLocalHub: (${sendLocal})`);
                rp(config)
                    .catch((err) => {
                        that.handleError('sendDeviceCommand', err, true);
                        if (callback) {
                            callback();
                            callback = undefined;
                        };
                        resolve(undefined);
                    })
                    .then((body) => {
                        this.log.debug(`sendDeviceCommand | Response: ${JSON.stringify(body)}`);
                        if (callback) {
                            callback();
                            callback = undefined;
                        }
                        that.localHubErr(false);
                        resolve(body);
                    });
            } catch (err) {
                resolve(undefined);
            }
        });
    }

    sendUpdateStatus(hasUpdate, newVersion = null) {
        return new Promise((resolve) => {
            this.log.notice(`Sending Plugin Status to SmartThings | UpdateAvailable: ${hasUpdate}${newVersion ?  ' | newVersion: ' + newVersion : ''}`);
            rp({
                    method: 'POST',
                    uri: `${this.configItems.app_url}${this.configItems.app_id}/pluginStatus`,
                    qs: {
                        access_token: this.configItems.access_token
                    },
                    body: { hasUpdate: hasUpdate, newVersion: newVersion, version: pluginVersion },
                    json: true
                })
                .catch((err) => {
                    this.handleError('sendUpdateStatus', err, true);
                    resolve(undefined);
                })
                .then((body) => {
                    // console.log(body);
                    if (body) {
                        this.log.debug(`sendUpdateStatus Resp: ${JSON.stringify(body)}`);
                        resolve(body);
                    } else { resolve(null); }
                });
        });
    }

    sendStartDirect() {
        let that = this;
        let sendLocal = this.sendAsLocalCmd();
        let config = {
            method: 'POST',
            uri: `${this.configItems.app_url}${this.configItems.app_id}/startDirect/${this.configItems.direct_ip}/${this.configItems.direct_port}/${pluginVersion}`,
            qs: {
                access_token: this.configItems.access_token
            },
            headers: {
                evtSource: `Homebridge_${platformName}_${this.configItems.app_id}`,
                evtType: 'enableDirect'
            },
            body: {
                ip: that.configItems.direct_ip,
                port: that.configItems.direct_port,
                version: pluginVersion
            },
            json: true
        };
        if (sendLocal) {
            config.uri = `http://${this.hubIp}:39500/event`;
            delete config.qs;
        }
        return new Promise((resolve) => {
            that.log.info(`Sending StartDirect Request to ${platformDesc} | SendToLocalHub: (${sendLocal})`);
            try {
                rp(config)
                    .catch((err) => {
                        that.handleError("sendStartDirect", err, true);
                        resolve(undefined);
                    })
                    .then((body) => {
                        // that.log.info('sendStartDirect Resp:', body);
                        if (body) {
                            this.log.debug(`sendStartDirect Resp: ${JSON.stringify(body)}`);
                            resolve(body);
                            that.localHubErr(false);
                        } else { resolve(null); }
                    });
            } catch (err) {
                resolve(err);
            }
        });
    }
};