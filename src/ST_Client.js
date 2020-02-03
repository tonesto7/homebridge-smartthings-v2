const {
    platformName,
    platformDesc,
    pluginVersion
} = require("./libs/Constants"),
    axios = require('axios').default,
    url = require("url");
var timeouts = {};
var debounce = require('awesome-debounce-promise');
// const { throttle, debounce } = require('throttle-debounce');

module.exports = class ST_Client {
    constructor(platform) {
        this.platform = platform;
        this.log = platform.log;
        this.useLocal = false; //platform.local_commands;
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
        this.useLocal = false; //(useLocal === true);
    }

    handleError(src, err, allowLocal = false) {
        switch (err.status) {
            case 401:
                this.log.error(`${src} Error | SmartThings Token Error: ${err.response} | Message: ${err.message}`);
                break;
            case 403:
                this.log.error(`${src} Error | SmartThings Authentication Error: ${err.response} | Message: ${err.message}`);
                break;
            default:
                if (err.message.startsWith('getaddrinfo EAI_AGAIN')) {
                    this.log.error(`${src} Error | Possible Internet/Network/DNS Error | Unable to reach the uri | Message ${err.message}`);
                } else if (allowLocal && err.message.startsWith('Error: connect ETIMEDOUT ')) {
                    this.localHubErr(true);
                } else {
                    // console.error(err);
                    this.log.error(`${src} Error: ${err.response} | Message: ${err.message}`);
                    this.platform.sentryErrorEvent(err);
                }
                break;
        }
    }

    getDevices() {
        let that = this;
        return new Promise((resolve) => {
            axios({
                    method: 'get',
                    url: `${that.configItems.app_url}${that.configItems.app_id}/devices`,
                    params: {
                        access_token: that.configItems.access_token
                    },
                    timeout: 10000
                })
                .then((response) => {
                    resolve(response.data);
                })
                .catch((err) => {
                    this.handleError('getDevices', err);
                    resolve(undefined);
                });
        });
    }

    getDevice(deviceid) {
        let that = this;
        return new Promise((resolve) => {
            axios({
                    method: 'get',
                    url: `${that.configItems.app_url}${that.configItems.app_id}/${deviceid}/query`,
                    params: {
                        access_token: that.configItems.access_token
                    },
                    timeout: 10000
                })
                .then((response) => {
                    resolve(response.data);
                })
                .catch((err) => {
                    this.handleError('getDevice', err);
                    resolve(undefined);
                });
        });
    }

    debounceWithId(func, wait, id, immediate = false) {
        return function() {
            var context = this,
                args = arguments;
            var later = () => {
                timeouts[id] = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeouts[id];
            clearTimeout(timeouts[id]);
            timeouts[id] = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    sendDeviceCommand(callback, devData, cmd, vals) {
        switch (cmd) {
            case "setLevel":
            case "setVolume":
                // debounce(
                //     this.processDeviceCmd(callback, devData, cmd, vals),
                //     1000, {
                //         key: devData.deviceid + cmd,
                //         accumulate: false,
                //         leading: false
                //     }
                // );
                this.debounceWithId(this.processDeviceCmd(callback, devData, cmd, vals), 1000, devData.deviceid + cmd, false);
                break;
            default:
                this.debounceWithId(this.processDeviceCmd(callback, devData, cmd, vals), 200, devData.deviceid + cmd, true);
                // debounce(
                //     this.processDeviceCmd(callback, devData, cmd, vals),
                //     200, {
                //         key: devData.deviceid + cmd,
                //         accumulate: false,
                //         leading: true
                //     }
                // );
                break;
        }
        // this.processDeviceCmd(callback, devData, cmd, vals);
    }

    processDeviceCmd(callback, devData, cmd, vals) {
        return new Promise((resolve) => {
            let that = this;
            let sendLocal = this.sendAsLocalCmd();
            let config = {
                method: 'post',
                url: `${this.configItems.app_url}${this.configItems.app_id}/${devData.deviceid}/command/${cmd}`,
                params: {
                    access_token: this.configItems.access_token
                },
                headers: {
                    evtsource: `Homebridge_${platformName}_${this.configItems.app_id}`,
                    evttype: 'hkCommand'
                },
                data: vals,
                timeout: 5000
            };
            if (sendLocal) {
                config.url = `http://${this.hubIp}:39500/event`;
                delete config.params;
                config.data = {
                    deviceid: devData.deviceid,
                    command: cmd,
                    values: vals,
                    evtsource: `Homebridge_${platformName}_${this.configItems.app_id}`,
                    evttype: 'hkCommand'
                };
            }
            try {
                that.log.notice(`Sending Device Command: ${cmd}${vals ? ' | Value: ' + JSON.stringify(vals) : ''} | Name: (${devData.name}) | DeviceID: (${devData.deviceid}) | SendToLocalHub: (${sendLocal})`);
                axios(config)
                    .then((response) => {
                        // console.log('command response:', response.data);
                        this.log.debug(`sendDeviceCommand | Response: ${JSON.stringify(response.data)}`);
                        if (callback) {
                            callback();
                            callback = undefined;
                        }
                        that.localHubErr(false);
                        resolve(true);
                    })
                    .catch((err) => {
                        that.handleError('sendDeviceCommand', err, true);
                        if (callback) {
                            callback();
                            callback = undefined;
                        };
                        resolve(false);
                    });

            } catch (err) {
                resolve(false);
            }
        });
    }

    sendUpdateStatus(hasUpdate, newVersion = null) {
        return new Promise((resolve) => {
            this.log.notice(`Sending Plugin Status to SmartThings | UpdateAvailable: ${hasUpdate}${newVersion ?  ' | newVersion: ' + newVersion : ''}`);
            axios({
                    method: 'post',
                    url: `${this.configItems.app_url}${this.configItems.app_id}/pluginStatus`,
                    params: {
                        access_token: this.configItems.access_token
                    },
                    data: { hasUpdate: hasUpdate, newVersion: newVersion, version: pluginVersion },
                    timeout: 10000
                })
                .then((response) => {
                    // console.log(response.data);
                    if (response.data) {
                        this.log.debug(`sendUpdateStatus Resp: ${JSON.stringify(response.data)}`);
                        resolve(response.data);
                    } else { resolve(null); }
                })
                .catch((err) => {
                    this.handleError('sendUpdateStatus', err, true);
                    resolve(undefined);
                });

        });
    }

    sendStartDirect() {
        let that = this;
        let sendLocal = this.sendAsLocalCmd();
        let config = {
            method: 'post',
            url: `${this.configItems.app_url}${this.configItems.app_id}/startDirect/${this.configItems.direct_ip}/${this.configItems.direct_port}/${pluginVersion}`,
            params: {
                access_token: this.configItems.access_token
            },
            headers: {
                evtsource: `Homebridge_${platformName}_${this.configItems.app_id}`,
                evttype: 'enableDirect'
            },
            data: {
                ip: that.configItems.direct_ip,
                port: that.configItems.direct_port,
                version: pluginVersion,
                evtsource: `Homebridge_${platformName}_${this.configItems.app_id}`,
                evttype: 'enableDirect'
            },
            timeout: 10000
        };
        if (sendLocal) {
            config.url = `http://${this.hubIp}:39500/event`;
            delete config.params;
        }
        return new Promise((resolve) => {
            that.log.info(`Sending StartDirect Request to ${platformDesc} | SendToLocalHub: (${sendLocal})`);
            try {
                axios(config)
                    .then((response) => {
                        // that.log.info('sendStartDirect Resp:', body);
                        if (response.data) {
                            this.log.debug(`sendStartDirect Resp: ${JSON.stringify(response.data)}`);
                            resolve(response.data);
                            that.localHubErr(false);
                        } else { resolve(null); }
                    })
                    .catch((err) => {
                        that.handleError("sendStartDirect", err, true);
                        resolve(undefined);
                    });
            } catch (err) {
                resolve(err);
            }
        });
    }
};