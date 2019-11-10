const {
    knownCapabilities,
    pluginName,
    platformName,
    pluginVersion
} = require("./Constants");
const myUtils = require('./MyUtils'),
    SmartThingsApi = require('./ST_Api'),
    SmartThingsAccessories = require('./Accessories/ST_Accessories'),
    express = require('express'),
    bodyParser = require('body-parser'),
    logger = require('./Logger.js').Logger,
    webApp = express();
var Service,
    Characteristic,
    Accessory,
    uuid,
    AccessoryDevice;

module.exports = class ST_Platform {
    constructor(log, config, api) {
        this.config = config;
        this.homebridge = api;
        this.log = log;
        this.logFile = logger.withPrefix(`${this.config['name']} ${pluginVersion}`);
        console.log(`Homebridge Version: ${api.version}`);
        console.log(`${platformName} Plugin Version: ${pluginVersion}`);
        Service = api.hap.Service;
        Characteristic = api.hap.Characteristic;
        Accessory = api.platformAccessory; //homebridge.hap.Accessory;
        uuid = api.hap.uuid;
        AccessoryDevice = SmartThingsAccessories(Accessory, Service, Characteristic, uuid);
        if (config === undefined || config === null || config.app_url === undefined || config.app_url === null || config.app_id === undefined || config.app_id === null) {
            log.debug(platformName + " Plugin not configured. Skipping");
            return;
        }
        this.polling_seconds = config['polling_seconds'] || 3600;
        this.excludedAttributes = this.config["excluded_attributes"] || [];
        this.excludedCapabilities = this.config["excluded_capabilities"] || [];
        this.update_method = this.config['update_method'] || 'direct';
        this.temperature_unit = 'F';
        this.local_commands = false;
        this.local_hub_ip = undefined;
        this.myUtils = new myUtils(this);
        this.configItems = this.getConfigItems();

        this.deviceLookup = {};
        this.firstpoll = true;
        this.attributeLookup = {};
        this.knownCapabilities = knownCapabilities;
        this.unknownCapabilities = [];
        this.smartthings = new SmartThingsApi(this);
        this.homebridge.on('didFinishLaunching', function() {
            // Start the refresh from the server
            this.smartthings.init();
            this.didFinishLaunching();
        }.bind(this));
        this.asyncCallWait = 0;
    }

    getConfigItems() {
        return {
            app_url: this.config['app_url'],
            app_id: this.config['app_id'],
            access_token: this.config['access_token'],
            update_seconds: this.config['update_seconds'] || 30,
            direct_port: this.config['direct_port'] || 8000,
            direct_ip: this.config['direct_ip'] || this.myUtils.getIPAddress()
        };
    }
    didFinishLaunching() {
        if (this.asyncCallWait !== 0) {
            this.log.debug("Configuration of cached accessories not done, wait for a bit...", that.asyncCallWait);
            setTimeout(this.didFinishLaunching.bind(that), 1000);
            return;
        }
        this.log('Fetching ' + platformName + ' devices. This can take a while depending on the number of devices are configured!');
        let starttime = new Date();
        let that = this;
        that.reloadData((foundAccessories) => {
            let timeElapsedinSeconds = Math.round((new Date() - starttime) / 1000);
            if (timeElapsedinSeconds >= that.polling_seconds) {
                that.log(`It took ${timeElapsedinSeconds} seconds to get all data | polling_seconds is set to ${that.polling_seconds}`);
                that.log(' Changing polling_seconds to ' + (timeElapsedinSeconds * 2) + ' seconds');
                that.polling_seconds = timeElapsedinSeconds * 2;
            } else if (that.polling_seconds < 30) {
                that.log('polling_seconds really shouldn\'t be smaller than 30 seconds. Setting it to 30 seconds');
                that.polling_seconds = 30;
            }
            that.processAccessoryCallback(foundAccessories || []);
            setInterval(that.reloadData.bind(that), that.polling_seconds * 1000);
            that.log('Unknown Capabilities: ' + JSON.stringify(that.unknownCapabilities));
            // callback.bind(that)(foundAccessories);
            that.log('update_method: ' + that.configItems.update_method);
            setInterval(that.reloadData.bind(that), that.polling_seconds * 1000);
            // Initialize Update Mechanism for realtime-ish updates.
            that.WebServerInit(that)
                .catch((err) => that.log('WebServerInit Error: ', err))
                .then((resp) => {
                    if (resp === 'OK')
                        that.smartthings.startDirect(null);
                });
        });
    }
    reloadData(callback) {
        let that = this;
        // that.log('config: ', JSON.stringify(this.config));
        console.log(that);
        let foundAccessories = [];
        that.log.debug('Refreshing All Device Data');
        that.smartthings.getDevices(function(myList) {
            that.log('Received All Device Data');
            // success
            if (myList && myList.deviceList && myList.deviceList instanceof Array) {
                let populateDevices = (devices) => {
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
                            accessory = new AccessoryDevice(that, device);
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
                        that.smartthings.updateGlobals(that.local_hub_ip, that.local_commands);
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
    }

    addAttributeUsage(attribute, deviceid, mycharacteristic) {
        if (!this.attributeLookup[attribute]) {
            this.attributeLookup[attribute] = {};
        }
        if (!this.attributeLookup[attribute][deviceid]) {
            this.attributeLookup[attribute][deviceid] = [];
        }
        this.attributeLookup[attribute][deviceid].push(mycharacteristic);
    }

    doIncrementalUpdate() {
        let that = this;
        that.smartthings.getUpdates(function(data) {
            that.processIncrementalUpdate(data, that);
        });
    }

    processIncrementalUpdate(data, that) {
        that.log.debug('new data: ' + data);
        if (data && data.attributes && data.attributes instanceof Array) {
            for (let i = 0; i < data.attributes.length; i++) {
                that.processFieldUpdate(data.attributes[i], that);
            }
        }
    }

    processFieldUpdate(attributeSet, that) {
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
    }

    processAccessoryCallback(foundAccessories) {
        // loop through accessories adding them to the list and registering them
        console.log(foundAccessories);
        let that = this;
        for (let i = 0; i < foundAccessories.length; i++) {
            let accessoryInstance = foundAccessories[i];
            let accessoryName = accessoryInstance.name; // assume this property was set

            that.log("Initializing platform accessory '%s'...", accessoryName);
            this.homebridge.registerPlatformAccessories(pluginName, platformName, [accessoryInstance]);
        }
    };
    // removeAccessory(accessory) {
    //     var that = this;
    //     return new Promise(function(resolve, reject) {
    //         if (accessory instanceof AccessoryDevice) {
    //             that.api.unregisterPlatformAccessories(pluginName, platformName, [accessory.accessory]);
    //             if (that.deviceLookup[accessory.accessory.UUID]) {
    //                 that.log.warn("Device Removed - Name " + that.deviceLookup[accessory.accessory.UUID].name + ', ID ' + that.deviceLookup[accessory.accessory.UUID].deviceid);
    //                 that.removeDeviceAttributeUsage(that.deviceLookup[accessory.accessory.UUID].deviceid);
    //                 if (that.deviceLookup.hasOwnProperty(accessory.accessory.UUID))
    //                     delete that.deviceLookup[accessory.accessory.UUID];
    //             }
    //         } else {
    //             that.log.warn("Remove stale cache device " + that.deviceLookup[accessory.UUID].displayName);
    //             that.api.unregisterPlatformAccessories(pluginName, platformName, [that.deviceLookup[accessory.UUID]]);
    //             delete that.deviceLookup[accessory.UUID];
    //         }
    //         resolve('');
    //     });
    // }

    // removeOldDevices(devices) {
    //     var that = this;
    //     return new Promise(function(resolve, reject) {
    //         var accessories = [];
    //         Object.keys(that.deviceLookup).forEach(function(key) {
    //             if (!(that.deviceLookup[key] instanceof HE_AccessoryDevice)) {
    //                 that.removeAccessory(that.deviceLookup[key]).catch(function(error) {});
    //             }
    //         });
    //         Object.keys(that.deviceLookup).forEach(function(key) {
    //             if (that.deviceLookup[key].deviceGroup === 'reboot')
    //                 return;
    //             var unregister = true;
    //             for (var i = 0; i < devices.length; i++) {
    //                 if (that.deviceLookup[key].accessory.UUID === uuidGen(devices[i].id)) {
    //                     unregister = false;
    //                 }
    //             }
    //             if (unregister) {
    //                 that.removeAccessory(that.deviceLookup[key]).catch(function(error) {});
    //             }
    //         });
    //         resolve(devices);
    //     });
    // }

    // populateDevices(devices) {
    //     var that = this;
    //     return new Promise(function(resolve, reject) {
    //         for (var i = 0; i < devices.length; i++) {
    //             let device = devices[i];
    //             // let group = "device";
    //             // if (device.type) {
    //             //     group = device.type;
    //             // }
    //             // let deviceData = null;
    //             // if (device.data) {
    //             //     deviceData = device.data;
    //             // }
    //             that.addUpdateAccessory(device.id, 'populateDevices', null, device)
    //                 .catch(function(error) {
    //                     that.log.error(error);
    //                 });
    //         }
    //         resolve(devices);
    //     });
    // }

    // updateDevices() {
    //     var that = this;
    //     return new Promise(function(resolve, reject) {
    //         if (!that.firstpoll) {
    //             var updateAccessories = [];
    //             Object.keys(that.deviceLookup).forEach(function(key) {
    //                 if (that.deviceLookup[key] instanceof HE_AccessoryDevice)
    //                     updateAccessories.push(that.deviceLookup[key].accessory);
    //             });
    //             if (updateAccessories.length)
    //                 that.api.updatePlatformAccessories(updateAccessories);
    //         }
    //         resolve('');
    //     });
    // }

    // reloadData(callback) {
    //     var that = this;
    //     // that.log('config: ', JSON.stringify(this.config));
    //     var foundAccessories = [];
    //     that.log('Loading All Device Data');
    //     he_st_api.getDevices()
    //         .then((myList) => {
    //             // console.log(myList);
    //             that.log('Received All Device Data...'); //, util.inspect(myList, false, null, true));
    //             if (myList && myList.location) {
    //                 that.temperature_unit = myList.location.temperature_scale;
    //                 if (myList.location.hubIP) {
    //                     that.local_hub_ip = myList.location.hubIP;
    //                     he_st_api.updateGlobals(that.local_hub_ip, that.local_commands);
    //                 }
    //             }
    //             return myList.deviceList;
    //         })
    //         .then((myList) => {
    //             return that.removeOldDevices(myList);
    //         })
    //         .then((myList) => {
    //             console.log(`populateDevices: (${Object.keys(myList).length} devices)`);
    //             return that.populateDevices(myList);
    //         })
    //         .then((myList) => {
    //             return that.updateDevices();
    //         })
    //         .then((myList) => {
    //             if (callback) {
    //                 callback(foundAccessories);
    //             }
    //             that.firstpoll = false;
    //         })
    //         .catch((error) => {
    //             if (error.hasOwnProperty('statusCode')) {
    //                 if (error.statusCode === 404) {
    //                     that.log.error('Hubitat tells me that the MakerAPI instance you have configured is not available (code 404).');
    //                 } else if (error.statusCode === 401) {
    //                     that.log.error('Hubitat tells me that your access code is wrong. Please check and correct it.');
    //                 } else if (error.statusCode === 500) {
    //                     that.log.error('Looks like your MakerAPI instance is disabled. Got code 500');
    //                 } else {
    //                     that.log.error('Got an unknown error code, ' + error.statusCode + ' tell dan.t in the hubitat forums and give him the following dump', error);
    //                 }
    //             } else {
    //                 that.log.error('Received an error trying to get the device summary information from Hubitat.', error);
    //             }
    //             that.log.error('I am stopping my reload here and hope eveything fixes themselves (e.g. a firmware update of HE is rebooting the hub');
    //         });
    // }

    configureAccessory(accessory) {
        this.log("Configure Cached Accessory: " + accessory.displayName + ", UUID: " + accessory.UUID);

        AccessoryDevice.prototype.CreateFromCachedAccessory(accessory, this);
        this.deviceLookup[accessory.deviceid] = accessory;
    };

    webServerInit() {
        let that = this;
        // Get the IP address that we will send to the SmartApp. This can be overridden in the config file.
        return new Promise(function(resolve) {
            try {
                let ip = that.configItems.direct_ip || that.myUtils.getIPAddress();
                // Start the HTTP Server
                webApp.listen(that.configItems.direct_port, function() {
                    that.log(`Direct Connect is Listening On ${ip}:${that.configItems.direct_port}`);
                });
                webApp.use(bodyParser.urlencoded({
                    extended: false
                }));
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
                        that.smartthings.updateGlobals(that.local_hub_ip, that.local_commands);
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
    };
};