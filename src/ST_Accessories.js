const knownCapabilities = require("./libs/Constants").knownCapabilities,
    _ = require("lodash"),
    DeviceTypes = require('./ST_DeviceTypes'),
    ServiceTypes = require('./ST_ServiceTypes');
var Service, Characteristic;

module.exports = class ST_Accessories {
    constructor(platform) {
        this.platform = platform;
        this.logConfig = platform.logConfig;
        this.configItems = platform.getConfigItems();
        this.myUtils = platform.myUtils;
        this.log = platform.log;
        this.hap = platform.hap;
        this.uuid = platform.uuid;
        Service = platform.Service;
        Characteristic = platform.Characteristic;
        this.CommunityTypes = require("./libs/CommunityTypes")(Service, Characteristic);
        this.client = platform.client;
        this.comparator = this.comparator.bind(this);
        this.serviceTypes = new ServiceTypes(this, Service);
        this.device_types = new DeviceTypes(this, Service, Characteristic);
        this._accessories = {};
        this._ignored = {};
        this._attributeLookup = {};
    }

    PopulateAccessory(accessory, deviceData) {
        try {
            accessory.deviceid = deviceData.deviceid;
            accessory.name = deviceData.name;
            // accessory.state = {};
            //Removing excluded capabilities from config
            deviceData.excludedCapabilities.forEach(cap => {
                if (cap !== undefined) {
                    this.log.debug(`Removing capability: ${cap} from Device: ${deviceData.name}`);
                    delete deviceData.capabilities[cap];
                }
            });
            accessory.context.deviceData = deviceData;
            accessory.context.name = deviceData.name;
            accessory.context.deviceid = deviceData.deviceid;
            this.initializeAccessory(accessory);
            return this.configureCharacteristics(accessory);
        } catch (ex) {
            this.log.error('PopulateAccessory Error: ' + ex);
            return accessory;
        }
    }

    CreateAccessoryFromCache(accessory) {
        try {
            let deviceid = accessory.context.deviceid;
            let name = accessory.context.name;
            this.log.debug(`Initializing Cached Device ${deviceid}`);
            accessory.deviceid = deviceid;
            accessory.name = name;
            this.initializeAccessory(accessory);
            return this.configureCharacteristics(accessory);
        } catch (err) {
            this.log.error('CreateAccessoryFromCache Error:', err.message, err);
            return accessory;
        }
    }

    initializeAccessory(accessory) {
        accessory.context.uuid = accessory.UUID || this.uuid.generate(`smartthings_v2_${accessory.deviceid}`);
        accessory.getOrAddService = this.getOrAddService.bind(accessory);
        accessory.getOrAddCharacteristic = this.getOrAddCharacteristic.bind(accessory);
        accessory.hasCapability = this.hasCapability.bind(accessory);
        accessory.getCapabilities = this.getCapabilities.bind(accessory);
        accessory.hasAttribute = this.hasAttribute.bind(accessory);
        accessory.hasCommand = this.hasCommand.bind(accessory);
        accessory.hasDeviceFlag = this.hasDeviceFlag.bind(accessory);
        accessory.hasService = this.hasService.bind(accessory);
        accessory.hasCharacteristic = this.hasCharacteristic.bind(accessory);
        accessory.updateDeviceAttr = this.updateDeviceAttr.bind(accessory);
        accessory.updateCharacteristicVal = this.updateCharacteristicVal.bind(accessory);
        accessory.manageGetCharacteristic = this.manageGetCharacteristic.bind(accessory);
        accessory.manageGetSetCharacteristic = this.manageGetSetCharacteristic.bind(accessory);
    }

    configureCharacteristics(accessory) {
        for (let index in accessory.context.deviceData.capabilities) {
            if (knownCapabilities.indexOf(index) === -1 && this.platform.unknownCapabilities.indexOf(index) === -1) this.platform.unknownCapabilities.push(index);
        }

        accessory.context.deviceGroups = [];
        accessory.servicesToKeep = [];
        accessory.reachable = true;
        accessory.context.lastUpdate = new Date();

        let accessoryInformation = accessory
            .getOrAddService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.FirmwareRevision, accessory.context.deviceData.firmwareVersion)
            .setCharacteristic(Characteristic.Manufacturer, accessory.context.deviceData.manufacturerName)
            .setCharacteristic(Characteristic.Model, `${this.myUtils.toTitleCase(accessory.context.deviceData.modelName)}`)
            .setCharacteristic(Characteristic.Name, accessory.context.deviceData.name);

        if (!accessoryInformation.listeners("identify")) {
            accessoryInformation
                .on('identify', function(paired, callback) {
                    this.log.info("%s - identify", accessory.displayName);
                    callback();
                });
        }

        // let serviceType = this.serviceTypes.determineServiceTypes(accessory);
        let svcTypes = this.serviceTypes.getServiceTypes(accessory);
        if (svcTypes) {
            svcTypes.forEach((svc) => {
                accessory.servicesToKeep.push(svc.type.UUID);
                this.device_types[svc.name](accessory, svc.type);
            });
        } else {
            throw "Unable to determine the service type of " + accessory.deviceid;
        }

        // TODO: loadAccessoryData shouldn't be necessary any more.
        // return this.loadAccessoryData(accessory, accessory.context.deviceData) || accessory;
        accessory = this.removeUnusedServices(accessory);

        return accessory;
    }


    // loadAccessoryData(accessory, deviceData) {
    //     //TODO: scan the results returned by detection and add remove services and characteristics using the devicetypes
    //     let that = this;
    //     if (deviceData !== undefined) {
    //         this.log.debug("Setting device data from existing data");
    //         accessory.context.deviceData = deviceData;
    //         for (let i = 0; i < accessory.services.length; i++) {
    //             for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
    //                 accessory.services[i].characteristics[j].getValue();
    //             }
    //         }
    //         return accessory;
    //     } else {
    //         this.log.debug("Fetching Device Data");
    //         this.client
    //             .getDevice(accessory.deviceid)
    //             .then(data => {
    //                 if (data === undefined) {
    //                     return accessory;
    //                 }
    //                 accessory.context.deviceData = data;
    //                 for (let i = 0; i < accessory.services.length; i++) {
    //                     for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
    //                         accessory.services[i].characteristics[j].getValue();
    //                     }
    //                 }
    //                 return accessory;
    //             })
    //             .catch(err => {
    //                 that.log.error(`Failed to get Device Data for ${accessory.deviceid}: `, err);
    //                 return accessory;
    //             });
    //     }
    // }

    processDeviceAttributeUpdate(change) {
        let that = this;
        return new Promise((resolve) => {
            let characteristics = that.getAttributeStoreItem(change.attribute, change.deviceid);
            let accessory = that.getAccessoryFromCache(change);
            if (!characteristics || !accessory) return;
            if (characteristics instanceof Array) {
                characteristics.forEach(char => {
                    accessory.context.deviceData.attributes[change.attribute] = change.value;
                    accessory.context.lastUpdate = new Date().toLocaleString();
                    char.updateValue(that.transformAttributeState(change.attribute, change.value, char.displayName));
                    // char.getValue();
                });
                resolve(that.addAccessoryToCache(accessory));
            }
            resolve(false);
        });
    }

    manageGetCharacteristic(svc, char, attr, opts = {}) {
        console.dir(svc);
        if (!this.hasCharacteristic(svc, char)) {
            let c = this.getOrAddService(svc).getCharacteristic(char)
                .on("get", (callback) => {
                    if (attr === 'status' && char === Characteristic.StatusActive) {
                        callback(null, this.context.deviceData.status === 'Online');
                    } else {
                        callback(null, this.transformAttributeState(opts.get.altAttr || attr, this.context.deviceData.attributes[opts.get.altValAttr || attr], opts.charName || undefined));
                    }
                });
            if (opts.props && Object.keys(opts.props).length) c.setProps(opts.props);
            if (opts.evtOnly !== undefined) c.eventOnlyCharacteristic = opts.evtOnly;
            c.getValue();
            this.storeCharacteristicItem(attr, this.context.deviceData.deviceid, c);
        } else {
            if (attr === 'status' && char === Characteristic.StatusActive) {
                this.getOrAddService(svc).getCharacteristic(char).updateValue(this.context.deviceData.status === 'Online');
            } else {
                this.getOrAddService(svc).getCharacteristic(char).updateValue(this.accessories.transformAttributeState(opts.get.altAttr || attr, this.context.deviceData.attributes[opts.get.altValAttr || attr], opts.charName || undefined));
            }
        }
    }

    manageGetSetCharacteristic(svc, char, attr, opts = {}) {
        console.dir(svc);
        if (!this.hasCharacteristic(svc, char)) {
            let c = this.getOrAddService(svc).getCharacteristic(char)
                .on("get", (callback) => {
                    callback(null, this.accessories.transformAttributeState(opts.get.altAttr || attr, this.context.deviceData.attributes[opts.get.altValAttr || attr], opts.charName || undefined));
                })
                .on("set", (value, callback) => {
                    let cmdName = this.transformCommandName(opts.set.altAttr || attr, value);
                    if (opts.cmdHasVal === true) {
                        let cVal = this.transformCommandValue(opts.set.altAttr || attr, value);
                        this.client.sendDeviceCommand(callback, this.context.deviceData.deviceid, cmdName, {
                            value1: cVal
                        });
                    } else {
                        this.client.sendDeviceCommand(callback, this.context.deviceData.deviceid, cmdName);
                    }
                    if (opts.updAttrVal) this.context.deviceData.attributes[attr] = this.transformAttributeState(opts.set.altAttr || attr, this.context.deviceData.attributes[opts.set.altValAttr || attr], opts.charName || undefined);
                });
            if (opts.props && Object.keys(opts.props).length) c.setProps(opts.props);
            if (opts.evtOnly !== undefined) c.eventOnlyCharacteristic = opts.evtOnly;
            c.getValue();
            this.storeCharacteristicItem(attr, this.context.deviceData.deviceid, c);
        } else {
            this.getOrAddService(svc).getCharacteristic(char).updateValue(this.accessories.transformAttributeState(opts.get.altAttr || attr, this.context.deviceData.attributes[opts.get.altValAttr || attr], opts.charName || undefined));
        }
    }

    transformAttributeState(attr, val, charName) {
        switch (attr) {
            case "switch":
                return (val === 'on');
            case "door":
                switch (val) {
                    case "open":
                        return Characteristic.TargetDoorState.OPEN;
                    case "opening":
                        return charName && charName === "Target Door State" ? Characteristic.TargetDoorState.OPEN : Characteristic.TargetDoorState.OPENING;
                    case "closed":
                        return Characteristic.TargetDoorState.CLOSED;
                    case "closing":
                        return charName && charName === "Target Door State" ? Characteristic.TargetDoorState.CLOSED : Characteristic.TargetDoorState.CLOSING;
                    default:
                        return charName && charName === "Target Door State" ? Characteristic.TargetDoorState.OPEN : Characteristic.TargetDoorState.STOPPED;
                }

            case "lock":
                switch (val) {
                    case "locked":
                        return Characteristic.LockCurrentState.SECURED;
                    case "unlocked":
                        return Characteristic.LockCurrentState.UNSECURED;
                    default:
                        return Characteristic.LockCurrentState.UNKNOWN;
                }

            case "button":
                // case "supportButtonValues":
                switch (val) {
                    case "pushed":
                        return Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
                    case "held":
                        return Characteristic.ProgrammableSwitchEvent.LONG_PRESS;
                    case "double":
                        return Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS;
                    default:
                        return undefined;
                }
            case "supportButtonValues":
                {
                    let validValues = [];
                    if (typeof val === "string") {
                        for (const v of JSON.parse(val)) {
                            switch (v) {
                                case "pushed":
                                    validValues.push(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
                                    continue;
                                case "held":
                                    validValues.push(Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
                                    continue;
                                case "double":
                                    validValues.push(Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
                                    continue;
                            }
                        }
                    }
                    return validValues;
                }
            case "fanState":
                return (val === "off") ? Characteristic.CurrentFanState.IDLE : Characteristic.CurrentFanState.BLOWING_AIR;
            case "valve":
                return (val === "open") ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE;
            case "mute":
                return (val === 'muted');
            case "smoke":
                return (val === "clear") ? Characteristic.SmokeDetected.SMOKE_NOT_DETECTED : Characteristic.SmokeDetected.SMOKE_DETECTED;
            case "carbonMonoxide":
                return (val === "clear") ? Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL : Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL;
            case "carbonDioxideMeasurement":
                switch (charName) {
                    case "Carbon Dioxide Detected":
                        return (val < 2000) ? Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL : Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL;
                    default:
                        return parseInt(val);
                }
            case "tamper":
                return (val === "detected") ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED;
            case "motion":
                return (val === "active");
            case "water":
                return (val === "dry") ? Characteristic.LeakDetected.LEAK_NOT_DETECTED : Characteristic.LeakDetected.LEAK_DETECTED;
            case "contact":
                return (val === "closed") ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
            case "presence":
                return (val === "present");
            case "battery":
                if (charName === "Status Low Battery") {
                    return (val < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                } else {
                    return Math.round(val);
                }
            case "batteryStatus":
                return (val === "USB Cable") ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGING;
            case "hue":
                return Math.round(val * 3.6);
            case "colorTemperature":
                return this.myUtils.colorTempFromK(val);
            case "temperature":
                return this.myUtils.tempConversion(val);
            case "heatingSetpoint":
            case "coolingSetpoint":
            case "thermostatSetpoint":
                return this.myUtils.thermostatTempConversion(val);
            case "fanSpeed":
                return this.myUtils.fanSpeedIntToLevel(val);
            case "level":
            case "saturation":
            case "volume":
                return parseInt(val) || 0;
            case "illuminance":
                return Math.round(Math.ceil(parseFloat(val)), 0);

            case "energy":
            case "humidity":
            case "power":
                return Math.round(val);
            case "thermostatOperatingState":
                switch (val) {
                    case "pending cool":
                    case "cooling":
                        return Characteristic.CurrentHeatingCoolingState.COOL;
                    case "pending heat":
                    case "heating":
                        return Characteristic.CurrentHeatingCoolingState.HEAT;
                    default:
                        // The above list should be inclusive, but we need to return something if they change stuff.
                        // TODO: Double check if Smartthings can send "auto" as operatingstate. I don't think it can.
                        return Characteristic.CurrentHeatingCoolingState.OFF;
                }
            case "thermostatMode":
                switch (val) {
                    case "cool":
                        return Characteristic.TargetHeatingCoolingState.COOL;
                    case "emergency heat":
                    case "heat":
                        return Characteristic.TargetHeatingCoolingState.HEAT;
                    case "auto":
                        return Characteristic.TargetHeatingCoolingState.AUTO;
                    default:
                        return Characteristic.TargetHeatingCoolingState.OFF;
                }
            case "supportedThermostatModes":
                {
                    let validModes = [];
                    if (typeof val === "string") {
                        if (val.includes("off"))
                            validModes.push(Characteristic.TargetHeatingCoolingState.OFF);

                        if (val.includes("heat") || val.includes("emergency heat"))
                            validModes.push(Characteristic.TargetHeatingCoolingState.HEAT);

                        if (val.includes("cool"))
                            validModes.push(Characteristic.TargetHeatingCoolingState.COOL);

                        if (val.includes("auto"))
                            validModes.push(Characteristic.TargetHeatingCoolingState.AUTO);
                    }
                    return validModes;
                }
            case "alarmSystemStatus":
                return this.myUtils.convertAlarmState(val);

            default:
                return val;
        }
    }

    transformCommandName(attr, val) {
        switch (val) {
            case "valve":
                return (val === true) ? "open" : "close";
            case "switch":
                return (val === true) ? "on" : "off";
            case "door":
                if (val === Characteristic.TargetDoorState.OPEN || val === 0) {
                    return "open";
                } else {
                    return "close";
                }
            case "hue":
                return "setHue";
            case "colorTemperature":
                return "setColorTemperature";
            case "lock":
                return (val === 1 || val === true) ? "lock" : "unlock";
            case "mute":
                return (val === "muted") ? "mute" : "unmute";
            case "fanSpeed":
                return "setFanSpeed";
            case "level":
                return "setLevel";
            case "volume":
                return "setVolume";
            case "thermostatMode":
                return "setThermostatMode";
            default:
                return val;
        }
    }

    transformCommandValue(attr, val) {
        switch (val) {
            case "valve":
                return (val === true) ? "open" : "close";
            case "switch":
                return (val === true) ? "on" : "off";
            case "door":
                if (val === Characteristic.TargetDoorState.OPEN || val === 0) {
                    return "open";
                } else if (val === Characteristic.TargetDoorState.CLOSED || val === 1) {
                    return "close";
                }
                return 'closing';
            case "hue":
                return Math.round(val / 3.6);
            case "colorTemperature":
                return this.myUtils.colorTempToK(val);
            case "lock":
                return (val === 1 || val === true) ? "lock" : "unlock";
            case "mute":
                return (val === "muted") ? "mute" : "unmute";
            case "alarmSystemStatus":
                return this.myUtils.convertAlarmCmd(val, false, Characteristic);
            case "fanSpeed":
                if (val === 0) {
                    return 0;
                } else if (val < 34) {
                    return 1;
                } else if (val < 67) {
                    return 2;
                } else {
                    return 3;
                }
            case "thermostatMode":
                switch (val) {
                    case Characteristic.TargetHeatingCoolingState.COOL:
                        return "cool";
                    case Characteristic.TargetHeatingCoolingState.HEAT:
                        return "heat";
                    case Characteristic.TargetHeatingCoolingState.AUTO:
                        return "auto";
                    case Characteristic.TargetHeatingCoolingState.OFF:
                        return "off";
                    default:
                        return undefined;
                }
            default:
                return val;
        }
    }

    loadAccessoryData(accessory, deviceData) {
        let that = this;
        // return new Promise((resolve, reject) => {
        if (deviceData !== undefined) {
            this.log.debug("Setting device data from existing data");
            accessory.context.deviceData = deviceData;
            for (let i = 0; i < accessory.services.length; i++) {
                for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
                    accessory.services[i].characteristics[j].getValue();
                }
            }
            return accessory;
        } else {
            this.log.debug("Fetching Device Data");
            this.client
                .getDevice(accessory.deviceid)
                .then(data => {
                    if (data === undefined) {
                        return accessory;
                    }
                    accessory.context.deviceData = data;
                    for (let i = 0; i < accessory.services.length; i++) {
                        for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
                            accessory.services[i].characteristics[j].getValue();
                        }
                    }
                    return accessory;
                })
                .catch(err => {
                    that.log.error(`Failed to get Device Data for ${accessory.deviceid}: `, err);
                    return accessory;
                });
        }
        // });
    }

    hasCapability(obj) {
        let keys = Object.keys(this.context.deviceData.capabilities);
        if (keys.includes(obj) || keys.includes(obj.toString().replace(/\s/g, ""))) return true;
        return false;
    }

    getCapabilities() {
        return Object.keys(this.context.deviceData.capabilities);
    }

    hasAttribute(attr) {
        return Object.keys(this.context.deviceData.attributes).includes(attr) || false;
    }

    hasCommand(cmd) {
        return Object.keys(this.context.deviceData.commands).includes(cmd) || false;
    }

    getCommands() {
        return Object.keys(this.context.deviceData.commands);
    }

    hasService(service) {
        return this.services.map(s => s.UUID).includes(service.UUID) || false;
    }

    hasCharacteristic(svc, char) {
        let s = this.getService(svc) || undefined;
        return (s && s.getCharacteristic(char) !== undefined) || false;
    }

    updateCharacteristicVal(svc, char, val) {
        this.getOrAddService(svc).setCharacteristic(char, val);
    }

    updateCharacteristicProps(svc, char, props) {
        this.getOrAddService(svc).getCharacteristic(char).setProps(props);
    }

    hasDeviceFlag(flag) {
        return Object.keys(this.context.deviceData.deviceflags).includes(flag) || false;
    }

    updateDeviceAttr(attr, val) {
        this.context.deviceData.attributes[attr] = val;
    }

    getOrAddService(svc) {
        return (this.getService(svc) || this.addService(svc));
    }

    getOrAddCharacteristic(service, characteristic) {
        return (service.getCharacteristic(characteristic) || service.addCharacteristic(characteristic));
    }

    getServices() {
        return this.services;
    }

    removeUnusedServices(acc) {
        console.log('servicesToKeep:', acc.servicesToKeep);
        let newSvcUuids = acc.servicesToKeep || [];
        let svcs2rmv = acc.services.filter(s => !newSvcUuids.includes(s.UUID));
        if (Object.keys(svcs2rmv).length) {
            this.log.info('removeServices:', svcs2rmv);
        }
        // svcs2rmv.forEach(s => acc.removeService(s));
        return acc;
    }

    storeCharacteristicItem(attr, devid, char) {
        if (!this._attributeLookup[attr]) {
            this._attributeLookup[attr] = {};
        }
        if (!this._attributeLookup[attr][devid]) {
            this._attributeLookup[attr][devid] = [];
        }
        this._attributeLookup[attr][devid].push(char);
    }

    getAttributeStoreItem(attr, devid) {
        if (!this._attributeLookup[attr] || !this._attributeLookup[attr][devid]) {
            return undefined;
        }
        return this._attributeLookup[attr][devid] || undefined;
    }

    removeAttributeStoreItem(attr, devid) {
        if (!this._attributeLookup[attr] || !this._attributeLookup[attr][devid]) return;
        delete this._attributeLookup[attr][devid];
    }

    getDeviceAttributeValueFromCache(device, attr) {
        const key = this.getAccessoryId(device);
        let result = this._accessories[key] ? this._accessories[key].context.deviceData.attributes[attr] : undefined;
        this.log.info(`Attribute (${attr}) Value From Cache: [${result}]`);
        return result;
    }

    getAccessoryId(accessory) {
        const id = accessory.deviceid || accessory.context.deviceid || undefined;
        return id;
    }

    getAccessoryFromCache(device) {
        const key = this.getAccessoryId(device);
        return this._accessories[key];
    }

    getAllAccessoriesFromCache() {
        return this._accessories;
    }

    clearAccessoryCache() {
        this.log.alert("CLEARING ACCESSORY CACHE AND FORCING DEVICE RELOAD");
        this._accessories = {};
    }

    addAccessoryToCache(accessory) {
        const key = this.getAccessoryId(accessory);
        this._accessories[key] = accessory;
        return true;
    }

    removeAccessoryFromCache(accessory) {
        const key = this.getAccessoryId(accessory);
        const _accessory = this._accessories[key];
        delete this._accessories[key];
        return _accessory;
    }

    forEach(fn) {
        return _.forEach(this._accessories, fn);
    }

    intersection(devices) {
        const accessories = _.values(this._accessories);
        return _.intersectionWith(devices, accessories, this.comparator);
    }

    diffAdd(devices) {
        const accessories = _.values(this._accessories);
        return _.differenceWith(devices, accessories, this.comparator);
    }

    diffRemove(devices) {
        const accessories = _.values(this._accessories);
        return _.differenceWith(accessories, devices, this.comparator);
    }

    comparator(accessory1, accessory2) {
        return this.getAccessoryId(accessory1) === this.getAccessoryId(accessory2);
    }

    clearAndSetTimeout(timeoutReference, fn, timeoutMs) {
        if (timeoutReference) clearTimeout(timeoutReference);
        return setTimeout(fn, timeoutMs);
    }
};