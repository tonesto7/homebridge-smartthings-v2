const {
    platformName,
    platformDesc,
    pluginVersion
} = require("./libs/Constants"),
    axios = require('axios').default,
    url = require("url"),
    EventSource = require('eventsource');

module.exports = class ST_Client {
    constructor(platform) {
        this.platform = platform;
        this.log = platform.log;
        this.appEvts = platform.appEvts;
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
        this.registerEvtListeners();
    }

    registerEvtListeners() {
        this.appEvts.on("event:device_command", async(devData, cmd, vals) => {
            await this.sendDeviceCommand(devData, cmd, vals);
        });
        this.appEvts.on("event:plugin_upd_status", async() => {
            await this.sendUpdateStatus();
        });
        this.appEvts.on("event:plugin_start_direct", async() => {
            await this.sendStartDirect();
        });
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

    sendDeviceCommand(devData, cmd, vals) {
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
                        that.localHubErr(false);
                        resolve(true);
                    })
                    .catch((err) => {
                        that.handleError('sendDeviceCommand', err, true);
                        resolve(false);
                    });
            } catch (err) {
                resolve(false);
            }
        });
    }

    sendUpdateStatus() {
        return new Promise((resolve) => {
            this.platform.myUtils.checkVersion()
                .then((res) => {
                    this.log.notice(`Sending Plugin Status to SmartThings | UpdateAvailable: ${res.hasUpdate}${res.newVersion ?  ' | newVersion: ' + res.newVersion : ''}`);
                    axios({
                            method: 'post',
                            url: `${this.configItems.app_url}${this.configItems.app_id}/pluginStatus`,
                            params: {
                                access_token: this.configItems.access_token
                            },
                            data: {
                                hasUpdate: res.hasUpdate,
                                newVersion: res.newVersion,
                                version: pluginVersion
                            },
                            timeout: 10000
                        })
                        .then((response) => {
                            // console.log(response.data);
                            if (response.data) {
                                this.log.debug(`sendUpdateStatus Resp: ${JSON.stringify(response.data)}`);
                                resolve(response.data);
                            } else {
                                resolve(null);
                            }
                        })
                        .catch((err) => {
                            this.handleError('sendUpdateStatus', err, true);
                            resolve(undefined);
                        });
                });
        });
    }

    sendStartDirect() {
        let that = this;
        return new Promise((resolve) => {
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
            that.log.info(`Sending StartDirect Request to ${platformDesc} | SendToLocalHub: (${sendLocal})`);
            try {
                axios(config)
                    .then((response) => {
                        // that.log.info('sendStartDirect Resp:', body);
                        if (response.data) {
                            this.log.debug(`sendStartDirect Resp: ${JSON.stringify(response.data)}`);
                            resolve(response.data);
                            that.localHubErr(false);
                        } else {
                            resolve(null);
                        }
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

    initializeWebsocket() {
        let that = this;
        return new Promise((resolve) => {
            if (this.configItems.cloud_token === undefined) {
                resolve(false);
            }
            const eventTypes = [
                "CONTROL_EVENT",
                "DEVICE_EVENT",
                "DEVICE_LIFECYCLE_EVENT",
                "DEVICE_JOIN_EVENT",
                "MODE_EVENT",
                "SMART_APP_EVENT",
                "SECURITY_ARM_STATE_EVENT",
                "SECURITY_ARM_FAILURE_EVENT",
                "HUB_HEALTH_EVENT",
                "DEVICE_HEALTH_EVENT",
                "LOCATION_LIFECYCLE_EVENT",
                // "INSTALLED_APP_LIFECYCLE_EVENT",
                "PAID_SUBSCRIPTIONS_EVENT",
                "HUB_LIFECYCLE_EVENT",
                // "EXECUTION_RESULT_EVENT",
                "HUB_ZWAVE_STATUS",
                "HUB_ZWAVE_EXCEPTION",
                "HUB_ZWAVE_S2_AUTH_REQUEST",
                "HUB_ZWAVE_SECURE_JOIN_RESULT"
            ];
            const cfg1 = {
                method: 'post',
                url: `https://api.smartthings.com/subscriptions`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.configItems.cloud_token}`
                },
                data: {
                    name: "locationSub",
                    version: 1,
                    subscriptionFilters: [{
                        type: "LOCATIONIDS", // Options are "LOCATIONIDS","ROOMIDS","DEVICEIDS","INSTALLEDSMARTAPPIDS","SMARTAPPIDS"
                        value: ["ALL"],
                        eventType: null, // This can be array of the events
                        attribute: null, // This can be array of the attributes
                        capability: null, // This can be array of the capabilities
                        component: null
                    }]
                },
                timeout: 10000
            };
            that.log.info(`Initializing Websocket Stage 1...`);
            try {
                axios(cfg1)
                    .then((response) => {
                        // that.log.info('sendStartDirect Resp:', body);
                        if (response.data) {
                            console.log(response.data);
                            // const rd = JSON.parse(response.data);
                            this.log.debug(`websocketInit_1 Resp: ${response.data}`);
                            if (response.data && response.data.registrationUrl) {
                                try {
                                    const opts = {
                                        initialRetryDelayMillis: 2000, // sets initial retry delay to 2 seconds
                                        maxBackoffMillis: 30000, // enables backoff, with a maximum of 30 seconds
                                        retryResetIntervalMillis: 60000, // backoff will reset to initial level if stream got an event at least 60 seconds before failing
                                        jitterRatio: 0.5,
                                        withCredentials: true,
                                        headers: { Authorization: `Bearer ${this.configItems.cloud_token}` },
                                        skipDefaultHeaders: true
                                    };
                                    var es = new EventSource(response.data.registrationUrl, opts);
                                    eventTypes.forEach((evtType) => {
                                        es.addEventListener(evtType, function(evt) {
                                            console.log(evt);
                                            let data = evt.data;
                                            try {
                                                data = JSON.parse(data);
                                                console.log(data);
                                            } catch (e) {
                                                // some events like CONTROL_EVENT don't send json
                                            }
                                        });
                                    });
                                    es.addEventListener("error", function(e) {
                                        console.log("Close: " + JSON.stringify(e));
                                    });
                                    es.addEventListener("open", function(e) {
                                        console.log("Open: " + JSON.stringify(e));
                                        resolve(true);
                                    });
                                } catch (ex) {
                                    console.error(`Error creating subscription:`, ex);
                                    resolve(false);
                                };
                            } else {
                                resolve(false);
                            }
                        } else {
                            resolve(false);
                        }
                    })
                    .catch((err) => {
                        console.log("websocketInit_1 Error:", err.message);
                        resolve(false);
                    });
            } catch (err) {
                resolve(err);
            }
        });
    }
};