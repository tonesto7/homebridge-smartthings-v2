const {
    platformName,
    platformDesc
} = require("./Constants"),
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
    }

    sendAsLocalCmd() {
        return (this.useLocal === true && this.hubIp !== undefined);
    }

    updateGlobals(hubIp, useLocal = false) {
        this.platform.log(`Updating Global Values | HubIP: ${hubIp} | UseLocal: ${useLocal}`);
        this.hubIp = hubIp;
        this.useLocal = (useLocal === true);
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
                .then((body) => {
                    resolve(body);
                })
                .catch((err) => {
                    that.log.debug("reqPromise Error: ", err.message);
                    resolve(undefined);
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
                .then((body) => {
                    resolve(body);
                })
                .catch((err) => {
                    that.log.error("reqPromise Error: ", err.message);
                    resolve(undefined);
                });
        });
    }

    sendDeviceCommand(callback, devid, cmd, vals) {
        let that = this;
        let sendLocal = this.sendAsLocalCmd();
        let config = {
            method: 'POST',
            uri: `${this.configItems.app_url}${this.configItems.app_id}/${devid}/command/${cmd}`,
            qs: {
                access_token: this.configItems.access_token
            },
            headers: {
                evtSource: `Homebridge_${platformName}`,
                evtType: "hkCommand"
            },
            body: vals,
            json: true
        };
        if (sendLocal) {
            config.uri = `http://${this.hubIp}:39500/event`;
            delete config.qs;
            config.body = {
                deviceid: devid,
                command: cmd,
                values: vals
            };
        }
        return new Promise((resolve) => {
            that.log.notice(`Sending Device Command: ${cmd} | Value: ${JSON.stringify(vals) || "Nothing"} | DeviceID: (${devid}) | SendToLocalHub: (${sendLocal})`);
            rp(config)
                .then((body) => {
                    that.log.debug('sendDeviceCommand Resp:', body);
                    callback(undefined);
                    resolve(body);
                })
                .catch((err) => {
                    that.log.error("sendDeviceCommand Error: ", err.message);
                    callback(undefined);
                    resolve(undefined);
                });
        });
    }

    sendStartDirect() {
        let that = this;
        let sendLocal = this.sendAsLocalCmd();
        let config = {
            method: 'POST',
            uri: `${this.configItems.app_url}${this.configItems.app_id}/startDirect/${this.configItems.direct_ip}/${this.configItems.direct_port}`,
            qs: {
                access_token: this.configItems.access_token
            },
            headers: {
                evtSource: `Homebridge_${platformName}`,
                evtType: 'enableDirect'
            },
            body: {
                ip: that.configItems.direct_ip,
                port: that.configItems.direct_port
            },
            json: true
        };
        if (sendLocal) {
            config.uri = `http://${this.hubIp}:39500/event`;
            delete config.qs;
        }
        return new Promise((resolve) => {
            that.log(`Sending StartDirect Request to ${platformDesc} | SendToLocalHub: (${sendLocal})`);
            rp(config)
                .then((body) => {
                    // that.log('sendStartDirect Resp:', body);
                    resolve(body);
                })
                .catch((err) => {
                    that.log.error("sendStartDirect Error: ", err.message);
                    resolve(undefined);
                });
        });
    }
};