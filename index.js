const {
    knownCapabilities,
    pluginName,
    platformName,
    pluginVersion
} = require("./lib/Constants");

const myUtils = require('./lib/MyUtils');
const st_api = require('./lib/STApi');
const express = require('express');
const bodyParser = require('body-parser');
// const os = require('os');
const logger = require('./lib/Logger.js').Logger;
const webApp = express();
let Service,
    Characteristic,
    Accessory,
    uuid,
    ST_Accessory;

module.exports = function(homebridge) {
    console.log(`Homebridge Version: ${homebridge.version}`);
    console.log(`${platformName} Plugin Version: ${pluginVersion}`);
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.platformAccessory; //homebridge.hap.Accessory;
    uuid = homebridge.hap.uuid;
    ST_Accessory = require('./accessories/STAccessories')(Accessory, Service, Characteristic, uuid);
    homebridge.registerPlatform(pluginName, platformName, ST_Platform, true);
};

function ST_Platform(log, config, api) {
    if (config === undefined || config === null || config.app_url === undefined || config.app_url === null || config.app_id === undefined || config.app_id === null) {
        log.debug(platformName + " Plugin not configured. Skipping");
        return;
    }
    this.app_url = config['app_url'];
    this.app_id = config['app_id'];
    this.access_token = config['access_token'];
    this.excludedAttributes = config["excluded_attributes"] || [];
    this.excludedCapabilities = config["excluded_capabilities"] || [];

    // This is how often it does a full refresh
    this.polling_seconds = config['polling_seconds'] || 3600;

    // This is how often it polls for subscription data.
    this.update_method = config['update_method'] || 'direct';
    this.temperature_unit = 'F';
    this.local_commands = false;
    this.local_hub_ip = undefined;

    // 30 seconds is the new default
    this.update_seconds = config['update_seconds'] || 30;
    this.myUtils = new myUtils(this);
    this.direct_port = config['direct_port'] || 8000;
    this.direct_ip = config['direct_ip'] || this.myUtils.getIPAddress();
    this.config = config;
    this.api = st_api;
    this.homekit_api = api;
    this.log = log;
    this.logFile = logger.withPrefix(`${this.config['name']} ${pluginVersion}`);
    this.deviceLookup = {};
    this.firstpoll = true;
    this.attributeLookup = {};
    this.knownCapabilities = knownCapabilities;
    this.unknownCapabilities = [];

    this.homekit_api.on('didFinishLaunching', function() {
        this.log("Plugin - DidFinishLaunching");

        // Start the refresh from the server
        this.accessories(this.processAccessoryCallback);
    }.bind(this));
}

ST_Platform.prototype = {
    reloadData: function(callback) {
        let that = this;
        // that.log('config: ', JSON.stringify(this.config));
        let foundAccessories = [];
        that.log('Refreshing All Device Data');
        st_api.getDevices(function(myList) {
            that.log('Received All Device Data');
            // success
            if (myList && myList.deviceList && myList.deviceList instanceof Array) {
                let populateDevices = function(devices) {
                    for (let i = 0; i < devices.length; i++) {
                        let device = devices[i];
                        device.excludedCapabilities = that.excludedCapabilities[device.deviceid] || ["None"];
                        let accessory;

                        that.log.debug("Processing device id: " + device.deviceid);

                        if (that.deviceLookup[device.deviceid]) {
                            that.log("Existing device, loading...");
                            accessory = that.deviceLookup[device.deviceid];
                            accessory.loadData(devices[i]);
                        } else {
                            that.log.debug("New Device, initializing...");
                            accessory = new ST_Accessory(that, device);
                            // that.log(accessory);
                            if (accessory !== undefined) {
                                if (accessory.services.length <= 1 || accessory.deviceGroup === 'unknown') {
                                    if (that.firstpoll) {
                                        that.log.debug('Device Skipped - Group ' + accessory.deviceGroup + ', Name ' + accessory.name + ', ID ' + accessory.deviceid + ', JSON: ' + JSON.stringify(device));
                                    }
                                } else {
                                    // that.log("Device Added - Group " + accessory.deviceGroup + ", Name " + accessory.name + ", ID " + accessory.deviceid); //+", JSON: "+ JSON.stringify(device));
                                    that.deviceLookup[device.deviceid] = accessory;
                                    foundAccessories.push(accessory);
                                }
                            }
                        }
                    }
                };
                if (myList && myList.location) {
                    that.temperature_unit = myList.location.temperature_scale;
                    if (myList.location.hubIP) {
                        that.local_hub_ip = myList.location.hubIP;
                        st_api.updateGlobals(that.local_hub_ip, that.local_commands);
                    }
                }
                populateDevices(myList.deviceList);
            } else if (!myList || !myList.error) {
                that.log('Invalid Response from API call');
            } else if (myList.error) {
                that.log('Error received type ' + myList.type + ' - ' + myList.message);
            } else {
                that.log('Invalid Response from API call');
            }
            if (callback) callback(foundAccessories);
            that.firstpoll = false;
        });
    },
    accessories: function(callback) {
        this.log('Fetching ' + platformName + ' devices.');

        let that = this;
        st_api.init(this.app_url, this.app_id, this.access_token, this.local_hub_ip, this.local_commands, this.log);
        this.reloadData(function(foundAccessories) {
            that.log('Unknown Capabilities: ' + JSON.stringify(that.unknownCapabilities));
            callback.bind(that)(foundAccessories);
            that.log('update_method: ' + that.update_method);
            setInterval(that.reloadData.bind(that), that.polling_seconds * 1000);
            // Initialize Update Mechanism for realtime-ish updates.
            if (that.update_method === 'api') {
                setInterval(that.doIncrementalUpdate.bind(that), that.update_seconds * 1000);
            } else if (that.update_method === 'direct') {
                // The Hub sends updates to this module using http
                // st_api_SetupHTTPServer(that);
                // st_api.startDirect(null, that.direct_ip, that.direct_port);
                that.WebServerInit()
                    .catch((err) => that.log('WebServerInit Error: ', err))
                    .then((resp) => {
                        if (resp === 'OK')
                            st_api.startDirect(null, that.direct_ip, that.direct_port);
                    });
            }
        });
    },
    addAttributeUsage: function(attribute, deviceid, mycharacteristic) {
        if (!this.attributeLookup[attribute]) {
            this.attributeLookup[attribute] = {};
        }
        if (!this.attributeLookup[attribute][deviceid]) {
            this.attributeLookup[attribute][deviceid] = [];
        }
        this.attributeLookup[attribute][deviceid].push(mycharacteristic);
    },

    doIncrementalUpdate: () => {
        let that = this;
        st_api.getUpdates(function(data) {
            that.processIncrementalUpdate(data, that);
        });
    },

    processIncrementalUpdate: (data, that) => {
        that.log.debug('new data: ' + data);
        if (data && data.attributes && data.attributes instanceof Array) {
            for (let i = 0; i < data.attributes.length; i++) {
                that.processFieldUpdate(data.attributes[i], that);
            }
        }
    },

    processFieldUpdate: (attributeSet, that) => {
        // this.log(attributeSet);
        if (!(that.attributeLookup[attributeSet.attribute] && that.attributeLookup[attributeSet.attribute][attributeSet.device])) {
            return;
        }
        let myUsage = that.attributeLookup[attributeSet.attribute][attributeSet.device];
        if (myUsage instanceof Array) {
            for (let j = 0; j < myUsage.length; j++) {
                let accessory = that.deviceLookup[attributeSet.device];
                if (accessory) {
                    accessory.device.attributes[attributeSet.attribute] = attributeSet.value;
                    myUsage[j].getValue();
                }
            }
        }
    },

    processAccessoryCallback: (foundAccessories) => {
        // loop through accessories adding them to the list and registering them
        for (let i = 0; i < foundAccessories.length; i++) {
            let accessoryInstance = foundAccessories[i];
            let accessoryName = accessoryInstance.name; // assume this property was set

            this.log("Initializing platform accessory '%s'...", accessoryName);
            this.homekit_api.registerPlatformAccessories(pluginName, platformName, [accessoryInstance]);
        }
    },

    WebServerInit: () => {
        let that = this;
        // Get the IP address that we will send to the SmartApp. This can be overridden in the config file.
        return new Promise(function(resolve) {
            try {
                let ip = that.direct_ip || this.myUtils.getIPAddress();
                // Start the HTTP Server
                webApp.listen(that.direct_port, function() {
                    that.log(`Direct Connect is Listening On ${ip}:${that.direct_port}`);
                });
                webApp.use(bodyParser.urlencoded({ extended: false }));
                webApp.use(bodyParser.json());
                webApp.use(function(req, res, next) {
                    res.header("Access-Control-Allow-Origin", "*");
                    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    next();
                });

                webApp.get('/', function(req, res) {
                    res.send('WebApp is running...');
                });

                webApp.get('/restart', function(req, res) {
                    console.log('restart...');
                    let delay = (10 * 1000);
                    that.log('Received request from ' + platformName + ' to restart homebridge service in (' + (delay / 1000) + ' seconds) | NOTICE: If you using PM2 or Systemd the Homebridge Service should start back up');
                    setTimeout(function() {
                        process.exit(1);
                    }, parseInt(delay));
                    res.send('OK');
                });

                webApp.post('/updateprefs', function(req, res) {
                    that.log(platformName + ' Hub Sent Preference Updates');
                    let data = JSON.parse(req.body);
                    let sendUpd = false;
                    if (data.local_commands && that.local_commands !== data.local_commands) {
                        sendUpd = true;
                        that.log(platformName + ' Updated Local Commands Preference | Before: ' + that.local_commands + ' | Now: ' + data.local_commands);
                        that.local_commands = data.local_commands;
                    }
                    if (data.local_hub_ip && that.local_hub_ip !== data.local_hub_ip) {
                        sendUpd = true;
                        that.log(platformName + ' Updated Hub IP Preference | Before: ' + that.local_hub_ip + ' | Now: ' + data.local_hub_ip);
                        that.local_hub_ip = data.local_hub_ip;
                    }
                    if (sendUpd) {
                        st_api.updateGlobals(that.local_hub_ip, that.local_commands);
                    }
                    res.send('OK');
                });

                webApp.get('/initial', function(req, res) {
                    that.log(platformName + ' Hub Communication Established');
                    res.send('OK');
                });

                webApp.post('/update', function(req, res) {
                    if (req.body.length < 3)
                        return;
                    let data = JSON.parse(JSON.stringify(req.body));
                    // console.log('update: ', data);
                    if (Object.keys(data).length > 3) {
                        let newChange = {
                            device: data.change_device,
                            attribute: data.change_attribute,
                            value: data.change_value,
                            date: data.change_date
                        };
                        that.log('Change Event:', '(' + data.change_name + ') [' + (data.change_attribute ? data.change_attribute.toUpperCase() : 'unknown') + '] is ' + data.change_value);
                        that.processFieldUpdate(newChange, that);
                    }
                    res.send('OK');
                });
                resolve('OK');
            } catch (ex) {
                resolve('');
            }
        });
    }
};

ST_Platform.prototype.configureAccessory = (accessory) => {
    this.log("Configure Cached Accessory: " + accessory.displayName + ", UUID: " + accessory.UUID);

    ST_Accessory.prototype.CreateFromCachedAccessory(accessory, this);
    this.deviceLookup[accessory.deviceid] = accessory;
};




// function st_api_SetupHTTPServer(my_st_api) {
//     // Get the IP address that we will send to the SmartApp. This can be overridden in the config file.
//     let ip = my_st_api.direct_ip || getIPAddress();
//     // Start the HTTP Server
//     const server = http.createServer(function(request, response) {
//         st_api_HandleHTTPResponse(request, response, my_st_api);
//     });

//     server.listen(my_st_api.direct_port, err => {
//         if (err) {
//             my_st_api.log('something bad happened', err);
//             return '';
//         }
//         my_st_api.log(`Direct Connect Is Listening On ${ip}:${my_st_api.direct_port}`);
//     });
//     return 'good';
// }

// function st_api_HandleHTTPResponse(request, response, my_st_api) {
//     if (request.url === '/restart') {
//         let delay = (10 * 1000);
//         my_st_api.log('Received request from ' + platformName + ' to restart homebridge service in (' + (delay / 1000) + ' seconds) | NOTICE: If you using PM2 or Systemd the Homebridge Service should start back up');
//         setTimeout(function() {
//             process.exit(1);
//         }, parseInt(delay));
//     }
//     if (request.url === '/updateprefs') {
//         my_st_api.log(platformName + ' Hub Sent Preference Updates');
//         let body = [];
//         request.on('data', (chunk) => {
//             body.push(chunk);
//         }).on('end', () => {
//             body = Buffer.concat(body).toString();
//             let data = JSON.parse(body);
//             let sendUpd = false;
//             if (data.local_commands && my_st_api.local_commands !== data.local_commands) {
//                 sendUpd = true;
//                 my_st_api.log(platformName + ' Updated Local Commands Preference | Before: ' + my_st_api.local_commands + ' | Now: ' + data.local_commands);
//                 my_st_api.local_commands = data.local_commands;
//             }
//             if (data.local_hub_ip && my_st_api.local_hub_ip !== data.local_hub_ip) {
//                 sendUpd = true;
//                 my_st_api.log(platformName + ' Updated Hub IP Preference | Before: ' + my_st_api.local_hub_ip + ' | Now: ' + data.local_hub_ip);
//                 my_st_api.local_hub_ip = data.local_hub_ip;
//             }
//             if (sendUpd) {
//                 st_api.updateGlobals(my_st_api.local_hub_ip, my_st_api.local_commands);
//             }
//         });
//     }
//     if (request.url === '/initial') {
//         my_st_api.log(platformName + ' Hub Communication Established');
//     }
//     if (request.url === '/update') {
//         let body = [];
//         request.on('data', (chunk) => {
//             body.push(chunk);
//         }).on('end', () => {
//             body = Buffer.concat(body).toString();
//             if (body.length < 3)
//                 return;
//             let data = JSON.parse(body);
//             if (Object.keys(data).length > 3) {
//                 let newChange = {
//                     device: data.change_device,
//                     attribute: data.change_attribute,
//                     value: data.change_value,
//                     date: data.change_date
//                 };
//                 my_st_api.log('Change Event:', '(' + data.change_name + ') [' + (data.change_attribute ? data.change_attribute.toUpperCase() : 'unknown') + '] is ' + data.change_value);
//                 my_st_api.processFieldUpdate(newChange, my_st_api);
//             }
//         });
//     }
//     response.end('OK');
// }