const {
    knownCapabilities
} = require("./Constants");
// const devices = require("./devices");
const _ = require("lodash");
const DeviceTypes = require('./Devices/types');
var Service, Characteristic;

module.exports = class ST_Accessories {
    constructor(platform) {
        this.platform = platform;
        this.configItems = platform.getConfigItems();
        this.temperature_unit = platform.temperature_unit;
        this.myUtils = platform.myUtils;
        this.log = platform.log;
        this.hap = platform.hap;
        this.uuid = platform.uuid;
        Service = platform.Service;
        Characteristic = platform.Characteristic;
        this.CommunityTypes = require("./CommunityTypes")(Service, Characteristic);
        this.client = platform.client;
        this.comparator = this.comparator.bind(this);
        this.device_types = new DeviceTypes(this, Service, Characteristic);
        this._accessories = {};
        this._ignored = {};
        this._attributeLookup = {};
    }

    PopulateAccessory(accessory, deviceData) {
        // console.log("AccessoryDevice: ", accessory, deviceData);
        try {
            accessory.deviceid = deviceData.deviceid;
            accessory.name = deviceData.name;
            accessory.state = {};
            let that = this;

            //Removing excluded capabilities from config
            deviceData.excludedCapabilities.forEach(cap => {
                if (cap !== undefined) {
                    this.log.debug(`Removing capability: ${cap} from Device: ${deviceData.name}`);
                    delete deviceData.capabilities[cap];
                }
            });

            // Attach helper to accessory
            accessory.getOrAddService = this.getOrAddService.bind(accessory);
            accessory.hasDeviceGroup = this.hasDeviceGroup.bind(accessory);
            accessory.hasAttribute = this.hasAttribute.bind(accessory);
            accessory.hasCapability = this.hasCapability.bind(accessory);
            accessory.hasCommand = this.hasCommand.bind(accessory);

            accessory.context.deviceData = deviceData;
            accessory.context.name = deviceData.name;
            accessory.context.deviceid = deviceData.deviceid;
            accessory.context.uuid = accessory.UUID || this.uuid.generate(`smartthings_v2_${accessory.deviceid}`);

            accessory
                .getOrAddService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Identify, deviceData.capabilities["Switch"] !== undefined)
                .setCharacteristic(Characteristic.FirmwareRevision, deviceData.firmwareVersion)
                .setCharacteristic(Characteristic.Manufacturer, deviceData.manufacturerName)
                .setCharacteristic(Characteristic.Model, `${that.myUtils.toTitleCase(deviceData.modelName)}`)
                .setCharacteristic(Characteristic.Name, deviceData.name)
                .setCharacteristic(Characteristic.SerialNumber, deviceData.serialNumber);

            return this.initializeDeviceCharacteristics(accessory);
        } catch (ex) {
            this.log.error(ex);
            return accessory;
        }
    }

    CreateFromCachedAccessory(accessory) {
        try {
            let deviceid = accessory.context.deviceid;
            let name = accessory.context.name;
            this.log.debug("Initializing Cached Device " + deviceid);
            accessory.deviceid = deviceid;
            accessory.name = name;
            accessory.context.uuid =
                accessory.UUID ||
                this.uuid.generate(`smartthings_v2_${accessory.deviceid}`);
            accessory.state = {};
            accessory.getOrAddService = this.getOrAddService.bind(accessory);
            accessory.hasDeviceGroup = this.hasDeviceGroup.bind(accessory);
            accessory.hasAttribute = this.hasAttribute.bind(accessory);
            accessory.hasCapability = this.hasCapability.bind(accessory);
            accessory.hasCommand = this.hasCommand.bind(accessory);
            return this.initializeDeviceCharacteristics(accessory);
        } catch (ex) {
            this.log.error(ex);
            return accessory;
        }
    }

    initializeDeviceCharacteristics(accessory) {
        // Get the Capabilities List
        for (let index in accessory.context.deviceData.capabilities) {
            if (knownCapabilities.indexOf(index) === -1 && this.platform.unknownCapabilities.indexOf(index) === -1) {
                this.platform.unknownCapabilities.push(index);
            }
        }
        let that = this;
        let deviceGroups = [];
        let thisChar;
        let attributes = accessory.context.deviceData.attributes;
        let capabilities = accessory.context.deviceData.capabilities;
        let commands = accessory.context.deviceData.commands;
        let devData = accessory.context.deviceData;

        let hasCapability = (obj) => {
            let keys = Object.keys(capabilities);
            if (obj instanceof Array) {
                obj.forEach(i => {
                    if (keys.includes(i) || keys.includes(i.toString().replace(/\s/g, ""))) return true;
                });
            } else {
                if (keys.includes(obj) || keys.includes(obj.toString().replace(/\s/g, ""))) return true;
            }
            return false;
        };
        let hasAttribute = (attr) => {
            return Object.keys(attributes).includes(attr);
        };
        let hasCommand = (cmd) => {
            return Object.keys(commands).includes(cmd);
        };

        let isMode = capabilities["Mode"] !== undefined;
        let isRoutine = capabilities["Routine"] !== undefined;
        let isFan = (hasCapability(['Fan', 'Fan Light', 'Fan Speed']) || hasCommand('lowSpeed'));
        let isWindowShade = (hasCapability('Window Shade') && (hasCommand('levelOpenClose') || hasCommand('presetPosition')));
        let isLight = (hasCapability(['Light Bulb', 'Fan Light', 'Bulb']) || devData.name.includes('light'));
        let isSpeaker = hasCapability(['Speaker']);
        let isSonos = (devData.manufacturerName === "Sonos");
        let isThermostat = (hasCapability('Thermostat'));
        if (devData && capabilities) {
            if (hasCapability('Switch Level') && !isSpeaker && !isFan && !isMode && !isRoutine) {

                if (isWindowShade) {
                    // This is a Window Shade
                    deviceGroups.push("window_shade");
                    thisChar = accessory
                        .getOrAddService(Service.WindowCovering)
                        .getCharacteristic(Characteristic.TargetPosition)
                        .on("get", (callback) => {
                            callback(null, parseInt(attributes.level));
                        })
                        .on("set", (value, callback) => {
                            if (commands.close && value === 0) {
                                // setLevel: 0, not responding on spring fashion blinds
                                that.client.sendDeviceCommand(callback, devData.deviceid, "close");
                            } else {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                                    value1: value
                                });
                            }
                        });
                    that.storeCharacteristicItem("level", devData.deviceid, thisChar);

                    thisChar = accessory
                        .getOrAddService(Service.WindowCovering)
                        .getCharacteristic(Characteristic.CurrentPosition)
                        .on("get", (callback) => {
                            callback(null, parseInt(attributes.level));
                        });
                    that.storeCharacteristicItem("level", devData.deviceid, thisChar);
                    thisChar = accessory
                        .getOrAddService(Service.WindowCovering)
                        .setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);

                } else if (isLight === true || commands.setLevel) {
                    deviceGroups.push("light");
                    thisChar = accessory
                        .getOrAddService(Service.Lightbulb)
                        .getCharacteristic(Characteristic.On)
                        .on("get", (callback) => {
                            callback(null, attributes.switch === "on");
                        })
                        .on("set", (value, callback) => {
                            if (value) {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "on");
                            } else {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "off");
                            }
                        });
                    that.storeCharacteristicItem("switch", devData.deviceid, thisChar);

                    thisChar = accessory
                        .getOrAddService(Service.Lightbulb)
                        .getCharacteristic(Characteristic.Brightness)
                        .on("get", (callback) => {
                            callback(null, parseInt(attributes.level));
                        })
                        .on("set", (value, callback) => {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                                value1: value
                            });
                        });
                    that.storeCharacteristicItem("level", devData.deviceid, thisChar);

                    if (hasCapability("Color Control")) {
                        thisChar = accessory
                            .getOrAddService(Service.Lightbulb)
                            .getCharacteristic(Characteristic.Hue)
                            .on("get", (callback) => {
                                callback(null, Math.round(attributes.hue * 3.6));
                            })
                            .on("set", (value, callback) => {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "setHue", {
                                    value1: Math.round(value / 3.6)
                                });
                            });
                        that.storeCharacteristicItem("hue", devData.deviceid, thisChar);

                        thisChar = accessory
                            .getOrAddService(Service.Lightbulb)
                            .getCharacteristic(Characteristic.Saturation)
                            .on("get", (callback) => {
                                callback(null, parseInt(attributes.saturation));
                            })
                            .on("set", (value, callback) => {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "setSaturation", {
                                    value1: value
                                });
                            });
                        that.storeCharacteristicItem("saturation", devData.deviceid, thisChar);
                    }
                }
            }

            if (hasCapability('Garage Door Control')) {
                deviceGroups.push("garage_door");
                thisChar = accessory
                    .getOrAddService(Service.GarageDoorOpener)
                    .getCharacteristic(Characteristic.TargetDoorState)
                    .on("get", (callback) => {
                        if (attributes.door === "closed" || attributes.door === "closing") {
                            callback(null, Characteristic.TargetDoorState.CLOSED);
                        } else if (
                            attributes.door === "open" ||
                            attributes.door === "opening"
                        ) {
                            callback(null, Characteristic.TargetDoorState.OPEN);
                        }
                    })
                    .on("set", (value, callback) => {
                        if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "open");
                            attributes.door = "opening";
                        } else if (
                            value === Characteristic.TargetDoorState.CLOSED ||
                            value === 1
                        ) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "close");
                            attributes.door = "closing";
                        }
                    });
                that.storeCharacteristicItem("door", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.GarageDoorOpener)
                    .getCharacteristic(Characteristic.CurrentDoorState)
                    .on("get", (callback) => {
                        switch (attributes.door) {
                            case "open":
                                callback(null, Characteristic.TargetDoorState.OPEN);
                                break;
                            case "opening":
                                callback(null, Characteristic.TargetDoorState.OPENING);
                                break;
                            case "closed":
                                callback(null, Characteristic.TargetDoorState.CLOSED);
                                break;
                            case "closing":
                                callback(null, Characteristic.TargetDoorState.CLOSING);
                                break;
                            default:
                                callback(null, Characteristic.TargetDoorState.STOPPED);
                                break;
                        }
                    });
                that.storeCharacteristicItem("door", devData.deviceid, thisChar);
                accessory
                    .getOrAddService(Service.GarageDoorOpener)
                    .setCharacteristic(Characteristic.ObstructionDetected, false);
            }
            if (hasCapability('Lock') && !hasCapability("Thermostat")) {
                deviceGroups.push("lock");
                thisChar = accessory
                    .getOrAddService(Service.LockMechanism)
                    .getCharacteristic(Characteristic.LockCurrentState)
                    .on("get", (callback) => {
                        switch (attributes.lock) {
                            case "locked":
                                callback(null, Characteristic.LockCurrentState.SECURED);
                                break;
                            case "unlocked":
                                callback(null, Characteristic.LockCurrentState.UNSECURED);
                                break;
                            default:
                                callback(null, Characteristic.LockCurrentState.UNKNOWN);
                                break;
                        }
                    });
                that.storeCharacteristicItem("lock", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.LockMechanism)
                    .getCharacteristic(Characteristic.LockTargetState)
                    .on("get", (callback) => {
                        switch (attributes.lock) {
                            case "locked":
                                callback(null, Characteristic.LockCurrentState.SECURED);
                                break;
                            case "unlocked":
                                callback(null, Characteristic.LockCurrentState.UNSECURED);
                                break;
                            default:
                                callback(null, Characteristic.LockCurrentState.UNKNOWN);
                                break;
                        }
                    })
                    .on("set", (value, callback) => {
                        if (value === 1 || value === true) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "lock");
                            attributes.lock = "locked";
                        } else {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "unlock");
                            attributes.lock = "unlocked";
                        }
                    });
                that.storeCharacteristicItem("lock", devData.deviceid, thisChar);
            }

            if (hasCapability('Valve')) {
                that.log("valve: " + attributes.valve);
                deviceGroups.push("valve");
                let valveType = capabilities["Irrigation"] !== undefined ? 0 : 0;

                //Gets the inUse Characteristic
                thisChar = accessory
                    .getOrAddService(Service.Valve)
                    .getCharacteristic(Characteristic.InUse)
                    .on("get", (callback) => {
                        callback(
                            null,
                            attributes.valve === "open" ?
                            Characteristic.InUse.IN_USE :
                            Characteristic.InUse.NOT_IN_USE
                        );
                    });
                that.storeCharacteristicItem("valve", devData.deviceid, thisChar);

                //Defines the valve type (irrigation or generic)
                thisChar = accessory
                    .getOrAddService(Service.Valve)
                    .getCharacteristic(Characteristic.ValveType)
                    .on("get", (callback) => {
                        callback(null, valveType);
                    });
                that.storeCharacteristicItem("valve", devData.deviceid, thisChar);

                //Defines Valve State (opened/closed)
                thisChar = accessory
                    .getOrAddService(Service.Valve)
                    .getCharacteristic(Characteristic.Active)
                    .on("get", (callback) => {
                        callback(
                            null,
                            attributes.valve === "open" ?
                            Characteristic.InUse.IN_USE :
                            Characteristic.InUse.NOT_IN_USE
                        );
                    })
                    .on("set", (value, callback) => {
                        // if (attributes.inStandby !== 'true') {
                        if (value) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "on");
                        } else {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "off");
                        }
                        // }
                    });
                that.storeCharacteristicItem("valve", devData.deviceid, thisChar);
            }

            //Defines Speaker Device
            if (isSpeaker) {
                deviceGroups.push("speakers");
                thisChar = accessory
                    .getOrAddService(Service.Speaker)
                    .getCharacteristic(Characteristic.Volume)
                    .on("get", (callback) => {
                        callback(null, parseInt(attributes.level || 0));
                    })
                    .on("set", (value, callback) => {
                        if (value > 0) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                                value1: value
                            });
                        }
                    });
                that.storeCharacteristicItem("volume", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.Speaker)
                    .getCharacteristic(Characteristic.Mute)
                    .on("get", (callback) => {
                        callback(null, attributes.mute === "muted");
                    })
                    .on("set", (value, callback) => {
                        if (value) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "mute");
                        } else {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "unmute");
                        }
                    });
                that.storeCharacteristicItem("mute", devData.deviceid, thisChar);
            }

            //Handles Standalone Fan with no levels
            if (isFan && (hasCapability('Fan Light') || Object.keys(deviceGroups).length < 1)) {
                deviceGroups.push("fans");
                thisChar = accessory
                    .getOrAddService(Service.Fanv2)
                    .getCharacteristic(Characteristic.Active)
                    .on("get", (callback) => {
                        callback(null, attributes.switch === "on");
                    })
                    .on("set", (value, callback) => {
                        if (value) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "on");
                        } else {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "off");
                        }
                    });
                that.storeCharacteristicItem("switch", devData.deviceid, thisChar);

                if (attributes.level !== undefined || attributes.fanSpeed !== undefined) {
                    // let fanLvl = attributes.fanSpeed ? that.myUtils.fanSpeedConversionInt(attributes.fanSpeed, (commands['medHighSpeed'] !== undefined)) : parseInt(attributes.level);
                    let fanLvl = parseInt(attributes.level);
                    // that.log("Fan with (" + attributes.fanSpeed ? "fanSpeed" : "level" + ') | value: ' + fanLvl);
                    that.log("Fan with level at " + fanLvl);
                    // let waitTimer;
                    thisChar = accessory
                        .getOrAddService(Service.Fanv2)
                        .getCharacteristic(Characteristic.RotationSpeed)
                        .on("get", (callback) => {
                            callback(null, fanLvl);
                        })
                        .on("set", (value, callback) => {
                            if (value >= 0 && value <= 100) {
                                // clearTimeout(waitTimer);
                                // that.log('Sending Fan value of ' + value);
                                that.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                                    value1: parseInt(value)
                                });
                            }
                        });
                    that.storeCharacteristicItem("level", devData.deviceid, thisChar);
                }
            }

            if (isMode) {
                deviceGroups.push("mode");
                // that.log('Mode: (' + accessory.name + ')');
                thisChar = accessory
                    .getOrAddService(Service.Switch)
                    .getCharacteristic(Characteristic.On)
                    .on("get", (callback) => {
                        callback(null, attributes.switch === "on");
                    })
                    .on("set", (value, callback) => {
                        if (value && attributes.switch === "off") {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "mode", {
                                value1: accessory.name.toString()
                            });
                        }
                    });
                that.storeCharacteristicItem("switch", devData.deviceid, thisChar);
            }

            if (isRoutine) {
                deviceGroups.push("routine");
                // that.log('Routine: (' + accessory.name + ')');
                thisChar = accessory
                    .getOrAddService(Service.Switch)
                    .getCharacteristic(Characteristic.On)
                    .on("get", (callback) => {
                        callback(null, attributes.switch === "on");
                    })
                    .on("set", (value, callback) => {
                        if (value) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "routine", {
                                value1: accessory.name.toString()
                            });
                            setTimeout(() => {
                                console.log("routineOff...");
                                accessory
                                    .getOrAddService(Service.Switch)
                                    .setCharacteristic(Characteristic.On, false);
                            }, 2000);
                        }
                    });
                that.storeCharacteristicItem("switch", devData.deviceid, thisChar);
            }

            if (hasCapability("Button")) {
                deviceGroups.push("button");
                that.log("Button: (" + accessory.name + ")");
                //Old Button Logic
                // thisChar = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                //     .on('get', (callback)=>{
                //         callback(null, attributes.switch === 'on');
                //     })
                //     .on('set', (value, callback) =>{
                //         if (value && attributes.switch === 'off') {
                //             that.client.sendDeviceCommand(callback, devData.deviceid, 'button');
                //         }
                //     });
                // that.storeCharacteristicItem('switch', devData.deviceid, thisChar);

                // New STATELESS BUTTON LOGIC (By @shnhrrsn)
                thisChar = accessory
                    .getOrAddService(Service.StatelessProgrammableSwitch)
                    .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                    .on("get", (callback) => {
                        // Reset value to force `change` to fire for repeated presses
                        this.value = -1;

                        switch (attributes.button) {
                            case "pushed":
                                return callback(
                                    null,
                                    Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
                                );
                            case "held":
                                return callback(
                                    null,
                                    Characteristic.ProgrammableSwitchEvent.LONG_PRESS
                                );
                            case "double":
                                return callback(
                                    null,
                                    Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS
                                );
                            default:
                                return callback(null, null);
                        }
                    });

                const validValues = [];

                if (typeof attributes.supportedButtonValues === "string") {
                    for (const value of JSON.parse(attributes.supportedButtonValues)) {
                        switch (value) {
                            case "pushed":
                                validValues.push(
                                    Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
                                );
                                continue;
                            case "held":
                                validValues.push(
                                    Characteristic.ProgrammableSwitchEvent.LONG_PRESS
                                );
                                continue;
                            case "double":
                                validValues.push(
                                    Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS
                                );
                                continue;
                            default:
                                that.log(
                                    "Button: (" +
                                    accessory.name +
                                    ") unsupported button value: " +
                                    value
                                );
                        }
                    }

                    thisChar.setProps({
                        validValues
                    });
                }

                // Turned on by default for Characteristic.ProgrammableSwitchEvent, required to emit `change`
                thisChar.eventOnlyCharacteristic = false;
                that.storeCharacteristicItem("button", devData.deviceid, thisChar);
            }

            // This should catch the remaining switch devices that are specially defined
            if (hasCapability("Switch") && (hasCapability('Fan Light') || Object.keys(deviceGroups).length < 1)) {
                //Handles Standalone Fan with no levels
                if (isLight) {
                    deviceGroups.push("light");
                    if (capabilities["Fan Light"] || capabilities["FanLight"]) {
                        that.log("FanLight: " + devData.name);
                    }
                    thisChar = accessory
                        .getOrAddService(Service.Lightbulb)
                        .getCharacteristic(Characteristic.On)
                        .on("get", (callback) => {
                            callback(null, attributes.switch === "on");
                        })
                        .on("set", (value, callback) => {
                            if (value) {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "on");
                            } else {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "off");
                            }
                        });
                    that.storeCharacteristicItem("switch", devData.deviceid, thisChar);
                } else {
                    deviceGroups.push("switch");
                    thisChar = accessory
                        .getOrAddService(Service.Switch)
                        .getCharacteristic(Characteristic.On)
                        .on("get", (callback) => {
                            callback(null, attributes.switch === "on");
                        })
                        .on("set", (value, callback) => {
                            if (value) {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "on");
                            } else {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "off");
                            }
                        });
                    that.storeCharacteristicItem("switch", devData.deviceid, thisChar);

                    // if (capabilities['Energy Meter'] || capabilities['EnergyMeter']) {
                    //     thisChar = accessory.getOrAddService(Service.Switch).addCharacteristic(this.CommunityTypes.Watts)
                    //         .on('get', (callback)=>{
                    //             callback(null, Math.round(attributes.power));
                    //         });
                    //     that.storeCharacteristicItem('energy', devData.deviceid, thisChar);
                    // }
                }
            }
            // Smoke Detectors
            if (hasCapability('Smoke Detector') && hasAttribute('smoke')) {
                deviceGroups.push("smoke_detector");
                thisChar = accessory
                    .getOrAddService(Service.SmokeSensor)
                    .getCharacteristic(Characteristic.SmokeDetected)
                    .on("get", (callback) => {
                        if (attributes.smoke === "clear") {
                            callback(null, Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
                        } else {
                            callback(null, Characteristic.SmokeDetected.SMOKE_DETECTED);
                        }
                    });
                that.storeCharacteristicItem("smoke", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.SmokeSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Carbon Monoxide Detector") && hasAttribute('carbonMonoxide')) {
                deviceGroups.push("carbon_monoxide_detector");
                thisChar = accessory
                    .getOrAddService(Service.CarbonMonoxideSensor)
                    .getCharacteristic(Characteristic.CarbonMonoxideDetected)
                    .on("get", (callback) => {
                        if (attributes.carbonMonoxide === "clear") {
                            callback(
                                null,
                                Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL
                            );
                        } else {
                            callback(
                                null,
                                Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
                            );
                        }
                    });
                that.storeCharacteristicItem("carbonMonoxide", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.CarbonMonoxideSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Carbon Dioxide Measurement") && hasAttribute('carbonDioxideMeasurement')) {
                deviceGroups.push("carbon_dioxide_measure");
                thisChar = accessory
                    .getOrAddService(Service.CarbonDioxideSensor)
                    .getCharacteristic(Characteristic.CarbonDioxideDetected)
                    .on("get", (callback) => {
                        if (attributes.carbonDioxideMeasurement < 2000) {
                            callback(
                                null,
                                Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL
                            );
                        } else {
                            callback(
                                null,
                                Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL
                            );
                        }
                    });
                that.storeCharacteristicItem("carbonDioxideMeasurement", devData.deviceid, thisChar);
                thisChar = accessory
                    .getOrAddService(Service.CarbonDioxideSensor)
                    .getCharacteristic(Characteristic.CarbonDioxideLevel)
                    .on("get", (callback) => {
                        if (attributes.carbonDioxideMeasurement >= 0) {
                            callback(null, attributes.carbonDioxideMeasurement);
                        }
                    });
                that.storeCharacteristicItem("carbonDioxideMeasurement", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.CarbonDioxideSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability('Motion Sensor')) {
                deviceGroups.push("motion_sensor");
                thisChar = accessory
                    .getOrAddService(Service.MotionSensor)
                    .getCharacteristic(Characteristic.MotionDetected)
                    .on("get", (callback) => {
                        callback(null, attributes.motion === "active");
                    });
                that.storeCharacteristicItem("motion", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.MotionSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Water Sensor")) {
                deviceGroups.push("water_sensor");
                thisChar = accessory
                    .getOrAddService(Service.LeakSensor)
                    .getCharacteristic(Characteristic.LeakDetected)
                    .on("get", (callback) => {
                        let reply = Characteristic.LeakDetected.LEAK_DETECTED;
                        if (attributes.water === "dry") {
                            reply = Characteristic.LeakDetected.LEAK_NOT_DETECTED;
                        }
                        callback(null, reply);
                    });
                that.storeCharacteristicItem("water", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.LeakSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Presence Sensor")) {
                deviceGroups.push("presence_sensor");
                thisChar = accessory
                    .getOrAddService(Service.OccupancySensor)
                    .getCharacteristic(Characteristic.OccupancyDetected)
                    .on("get", (callback) => {
                        callback(null, attributes.presence === "present");
                    });
                that.storeCharacteristicItem("presence", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.OccupancySensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Relative Humidity Measurement")) {
                deviceGroups.push("humidity_sensor");
                thisChar = accessory
                    .getOrAddService(Service.HumiditySensor)
                    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .on("get", (callback) => {
                        callback(null, Math.round(attributes.humidity));
                    });
                that.storeCharacteristicItem("humidity", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.HumiditySensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Temperature Measurement")) {
                deviceGroups.push("temp_sensor");
                thisChar = accessory
                    .getOrAddService(Service.TemperatureSensor)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({
                        minValue: parseFloat(-50),
                        maxValue: parseFloat(100)
                    })
                    .on("get", (callback) => {
                        callback(
                            null,
                            that.myUtils.tempConversion(
                                that.temperature_unit,
                                attributes.temperature
                            )
                        );
                    });
                that.storeCharacteristicItem("temperature", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.TemperatureSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Illuminance Measurement")) {
                // console.log(devData);
                deviceGroups.push("illuminance_sensor");
                thisChar = accessory
                    .getOrAddService(Service.LightSensor)
                    .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
                    .on("get", (callback) => {
                        callback(null, Math.ceil(attributes.illuminance));
                    });
                that.storeCharacteristicItem("illuminance", devData.deviceid, thisChar);
            }
            if (hasCapability('Contact Sensor') && !hasCapability('Garage Door Control')) {
                deviceGroups.push("contact_sensor");
                thisChar = accessory
                    .getOrAddService(Service.ContactSensor)
                    .getCharacteristic(Characteristic.ContactSensorState)
                    .on("get", (callback) => {
                        if (attributes.contact === "closed") {
                            callback(
                                null,
                                Characteristic.ContactSensorState.CONTACT_DETECTED
                            );
                        } else {
                            callback(
                                null,
                                Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
                            );
                        }
                    });
                that.storeCharacteristicItem("contact", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.ContactSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(
                                null,
                                attributes.tamper === "detected" ?
                                Characteristic.StatusTampered.TAMPERED :
                                Characteristic.StatusTampered.NOT_TAMPERED
                            );
                        });
                    that.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
                }
            }
            if (hasCapability("Battery")) {
                deviceGroups.push("battery_level");
                thisChar = accessory
                    .getOrAddService(Service.BatteryService)
                    .getCharacteristic(Characteristic.BatteryLevel)
                    .on("get", (callback) => {
                        callback(null, Math.round(attributes.battery));
                    });
                that.storeCharacteristicItem("battery", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.BatteryService)
                    .getCharacteristic(Characteristic.StatusLowBattery)
                    .on("get", (callback) => {
                        let battStatus =
                            attributes.battery < 20 ?
                            Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
                            Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                        callback(null, battStatus);
                    });
                accessory
                    .getOrAddService(Service.BatteryService)
                    .setCharacteristic(
                        Characteristic.ChargingState,
                        Characteristic.ChargingState.NOT_CHARGING
                    );
                that.storeCharacteristicItem("battery", devData.deviceid, thisChar);
            }

            if (hasCapability('Energy Meter') && !hasCapability('Switch') && Object.keys(deviceGroups).length < 1) {
                deviceGroups.push("energy_meter");
                thisChar = accessory
                    .getOrAddService(Service.Outlet)
                    .addCharacteristic(this.CommunityTypes.KilowattHours)
                    .on("get", (callback) => {
                        callback(null, Math.round(attributes.energy));
                    });
                that.storeCharacteristicItem("energy", devData.deviceid, thisChar);
            }

            if (hasCapability('Power Meter') && !hasCapability('Switch') && Object.keys(deviceGroups).length < 1) {
                deviceGroups.push("power_meter");
                thisChar = accessory
                    .getOrAddService(Service.Outlet)
                    .addCharacteristic(this.CommunityTypes.Watts)
                    .on("get", (callback) => {
                        callback(null, Math.round(attributes.power));
                    });
                that.storeCharacteristicItem("power", devData.deviceid, thisChar);
            }

            if (hasCapability("Acceleration Sensor")) {
                // deviceGroups.push('accel_sensor')
            }
            if (hasCapability('Three Axis')) {
                // deviceGroups.push('3_axis_sensor')
            }
            if (hasCapability("Air Quality Sensor")) {
                // deviceGroups.push('air_quality_sensor')
                // thisChar = accessory.getOrAddService(Service.AirQualitySensor).getCharacteristic(Characteristic.AirQuality)
                //     .on('get', (callback)=>{
                //         switch (attributes.airQuality) {
                //             case 'pending cool':
                //             case 'cooling':
                //                 callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
                //                 break;
                //             case 'pending heat':
                //             case 'heating':
                //                 callback(null, Characteristic.CurrentHeatingCoolingState.HEAT);
                //                 break;
                //             default:
                //                 // The above list should be inclusive, but we need to return something if they change stuff.
                //                 // TODO: Double check if Smartthings can send "auto" as operatingstate. I don't think it can.
                //                 callback(null, Characteristic.CurrentHeatingCoolingState.OFF);
                //                 break;
                //         }
                //     });
                // that.storeCharacteristicItem('thermostatOperatingState', devData.deviceid, thisChar);
            }
            if (isThermostat) {
                deviceGroups.push("thermostat");
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .on("get", (callback) => {
                        switch (attributes.thermostatOperatingState) {
                            case "pending cool":
                            case "cooling":
                                callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
                                break;
                            case "pending heat":
                            case "heating":
                                callback(null, Characteristic.CurrentHeatingCoolingState.HEAT);
                                break;
                            default:
                                // The above list should be inclusive, but we need to return something if they change stuff.
                                // TODO: Double check if Smartthings can send "auto" as operatingstate. I don't think it can.
                                callback(null, Characteristic.CurrentHeatingCoolingState.OFF);
                                break;
                        }
                    });
                that.storeCharacteristicItem("thermostatOperatingState", devData.deviceid, thisChar);
                // Handle the Target State
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                    .on("get", (callback) => {
                        switch (attributes.thermostatMode) {
                            case "cool":
                                callback(null, Characteristic.TargetHeatingCoolingState.COOL);
                                break;
                            case "emergency heat":
                            case "heat":
                                callback(null, Characteristic.TargetHeatingCoolingState.HEAT);
                                break;
                            case "auto":
                                callback(null, Characteristic.TargetHeatingCoolingState.AUTO);
                                break;
                            default:
                                // The above list should be inclusive, but we need to return something if they change stuff.
                                callback(null, Characteristic.TargetHeatingCoolingState.OFF);
                                break;
                        }
                    })
                    .on("set", (value, callback) => {
                        switch (value) {
                            case Characteristic.TargetHeatingCoolingState.COOL:
                                that.client.sendDeviceCommand(callback, devData.deviceid, "cool");
                                attributes.thermostatMode = "cool";
                                break;
                            case Characteristic.TargetHeatingCoolingState.HEAT:
                                that.client.sendDeviceCommand(callback, devData.deviceid, "heat");
                                attributes.thermostatMode = "heat";
                                break;
                            case Characteristic.TargetHeatingCoolingState.AUTO:
                                that.client.sendDeviceCommand(callback, devData.deviceid, "auto");
                                attributes.thermostatMode = "auto";
                                break;
                            case Characteristic.TargetHeatingCoolingState.OFF:
                                that.client.sendDeviceCommand(callback, devData.deviceid, "off");
                                attributes.thermostatMode = "off";
                                break;
                        }
                    });
                if (typeof attributes.supportedThermostatModes === "string") {
                    let validValuesArray = [];
                    if (attributes.supportedThermostatModes.includes("off")) {
                        validValuesArray.push(0);
                    }
                    if (
                        attributes.supportedThermostatModes.includes("heat") ||
                        attributes.supportedThermostatModes.includes("emergency heat")
                    ) {
                        validValuesArray.push(1);
                    }
                    if (attributes.supportedThermostatModes.includes("cool")) {
                        validValuesArray.push(2);
                    }
                    if (attributes.supportedThermostatModes.includes("auto")) {
                        validValuesArray.push(3);
                    }
                    let validValues = {
                        validValues: validValuesArray
                    };
                    thisChar.setProps(validValues);
                }
                that.storeCharacteristicItem("thermostatMode", devData.deviceid, thisChar);

                if (hasCapability("Relative Humidity Measurement")) {
                    thisChar = accessory
                        .getOrAddService(Service.Thermostat)
                        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                        .on("get", (callback) => {
                            callback(null, parseInt(attributes.humidity));
                        });
                    that.storeCharacteristicItem("humidity", devData.deviceid, thisChar);
                }
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .on("get", (callback) => {
                        callback(
                            null,
                            that.myUtils.tempConversion(
                                that.temperature_unit,
                                attributes.temperature
                            )
                        );
                    });
                that.storeCharacteristicItem("temperature", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.TargetTemperature)
                    .on("get", (callback) => {
                        let temp;
                        switch (attributes.thermostatMode) {
                            case "cool":
                                {
                                    temp = attributes.coolingSetpoint;
                                    break;
                                }
                            case "emergency heat":
                            case "heat":
                                {
                                    temp = attributes.heatingSetpoint;
                                    break;
                                }
                            default:
                                {
                                    // This should only refer to auto
                                    // Choose closest target as single target
                                    let high = attributes.coolingSetpoint;
                                    let low = attributes.heatingSetpoint;
                                    let cur = attributes.temperature;
                                    temp = Math.abs(high - cur) < Math.abs(cur - low) ? high : low;
                                    break;
                                }
                        }
                        if (!temp) {
                            callback("Unknown");
                        } else {
                            callback(
                                null,
                                that.myUtils.tempConversion(that.temperature_unit, temp)
                            );
                        }
                    })
                    .on("set", (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === "C") {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        // Set the appropriate temperature unit based on the mode
                        switch (attributes.thermostatMode) {
                            case "cool":
                                {
                                    that.client.sendDeviceCommand(
                                        callback,
                                        devData.deviceid,
                                        "setCoolingSetpoint", {
                                            value1: temp
                                        }
                                    );
                                    attributes.coolingSetpoint = temp;
                                    break;
                                }
                            case "emergency heat":
                            case "heat":
                                {
                                    that.client.sendDeviceCommand(
                                        callback,
                                        devData.deviceid,
                                        "setHeatingSetpoint", {
                                            value1: temp
                                        }
                                    );
                                    attributes.heatingSetpoint = temp;
                                    break;
                                }
                            default:
                                {
                                    // This should only refer to auto
                                    // Choose closest target as single target
                                    let high = attributes.coolingSetpoint;
                                    let low = attributes.heatingSetpoint;
                                    let cur = attributes.temperature;
                                    let isHighTemp = Math.abs(high - cur) < Math.abs(cur - low);
                                    if (isHighTemp) {
                                        that.client.sendDeviceCommand(
                                            callback,
                                            devData.deviceid,
                                            "setCoolingSetpoint", {
                                                value1: temp
                                            }
                                        );
                                    } else {
                                        that.client.sendDeviceCommand(
                                            null,
                                            devData.deviceid,
                                            "setHeatingSetpoint", {
                                                value1: temp
                                            }
                                        );
                                    }
                                    break;
                                }
                        }
                    });
                // that.storeCharacteristicItem("thermostatMode", devData.deviceid, thisChar);
                // that.storeCharacteristicItem("coolingSetpoint", devData.deviceid, thisChar);
                // that.storeCharacteristicItem("heatingSetpoint", devData.deviceid, thisChar);
                // that.storeCharacteristicItem("temperature", devData.deviceid, thisChar);
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.TemperatureDisplayUnits)
                    .on("get", (callback) => {
                        if (that.temperature_unit === "C") {
                            callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS);
                        } else {
                            callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
                        }
                    });
                // that.storeCharacteristicItem("temperature_unit", "platform", thisChar);
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                    .on("get", (callback) => {
                        callback(
                            null,
                            that.myUtils.tempConversion(
                                that.temperature_unit,
                                attributes.heatingSetpoint
                            )
                        );
                    })
                    .on("set", (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === "C") {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        that.client.sendDeviceCommand(
                            callback,
                            devData.deviceid,
                            "setHeatingSetpoint", {
                                value1: temp
                            }
                        );
                        attributes.heatingSetpoint = temp;
                    });
                that.storeCharacteristicItem("heatingSetpoint", devData.deviceid, thisChar);
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                    .on("get", (callback) => {
                        callback(
                            null,
                            that.myUtils.tempConversion(
                                that.temperature_unit,
                                attributes.coolingSetpoint
                            )
                        );
                    })
                    .on("set", (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === "C") {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        that.client.sendDeviceCommand(
                            callback,
                            devData.deviceid,
                            "setCoolingSetpoint", {
                                value1: temp
                            }
                        );
                        attributes.coolingSetpoint = temp;
                    });
                that.storeCharacteristicItem("coolingSetpoint", devData.deviceid, thisChar);
            }


            // Alarm System Control/Status
            if (hasAttribute("alarmSystemStatus")) {
                deviceGroups.push("alarm");
                thisChar = accessory
                    .getOrAddService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .on("get", (callback) => {
                        // that.log('alarm1: ' + attributes.alarmSystemStatus + ' | ' + that.myUtils.convertAlarmState(attributes.alarmSystemStatus, true, Characteristic));
                        callback(
                            null,
                            that.myUtils.convertAlarmState(
                                attributes.alarmSystemStatus,
                                true,
                                Characteristic
                            )
                        );
                    });
                that.storeCharacteristicItem("alarmSystemStatus", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .on("get", (callback) => {
                        // that.log('alarm2: ' + attributes.alarmSystemStatus + ' | ' + that.myUtils.convertAlarmState(attributes.alarmSystemStatus, true, Characteristic));
                        callback(
                            null,
                            that.myUtils.convertAlarmState(
                                attributes.alarmSystemStatus.toLowerCase(),
                                true,
                                Characteristic
                            )
                        );
                    })
                    .on("set", (value, callback) => {
                        // that.log('setAlarm: ' + value + ' | ' + that.myUtils.convertAlarmState(value, false, Characteristic));
                        that.client.sendDeviceCommand(
                            callback,
                            devData.deviceid,
                            that.myUtils.convertAlarmState(value, false, Characteristic)
                        );
                        attributes.alarmSystemStatus = that.myUtils.convertAlarmState(
                            value,
                            false,
                            Characteristic
                        );
                    });
                that.storeCharacteristicItem("alarmSystemStatus", devData.deviceid, thisChar);
            }

            // Sonos Speakers
            if (isSonos && Object.keys(deviceGroups).length < 1) {
                deviceGroups.push("speakers");
                if (hasCapability("Audio Volume")) {
                    let sonosVolumeTimeout = null;
                    let lastVolumeWriteValue = null;

                    thisChar = accessory
                        .getOrAddService(Service.Speaker)
                        .getCharacteristic(Characteristic.Volume)
                        .on("get", (callback) => {
                            that.log.debug("Reading sonos volume " + attributes.volume);
                            callback(null, parseInt(attributes.volume || 0));
                        })
                        .on("set", (value, callback) => {
                            if (value > 0 && value !== lastVolumeWriteValue) {
                                lastVolumeWriteValue = value;
                                that.log.debug(
                                    "Existing volume: " + attributes.volume + ", set to " + value
                                );

                                // Smooth continuous updates to make more responsive
                                sonosVolumeTimeout = clearAndSetTimeout(
                                    sonosVolumeTimeout,
                                    () => {
                                        that.log.debug(
                                            "Existing volume: " +
                                            attributes.volume +
                                            ", set to " +
                                            lastVolumeWriteValue
                                        );

                                        that.client.sendDeviceCommand(
                                            callback,
                                            devData.deviceid,
                                            "setVolume", {
                                                value1: lastVolumeWriteValue
                                            }
                                        );
                                    },
                                    1000
                                );
                            }
                        });

                    that.storeCharacteristicItem("volume", devData.deviceid, thisChar);
                }

                if (hasCapability("Audio Mute")) {
                    thisChar = accessory
                        .getOrAddService(Service.Speaker)
                        .getCharacteristic(Characteristic.Mute)
                        .on("get", (callback) => {
                            callback(null, attributes.mute === "muted");
                        })
                        .on("set", (value, callback) => {
                            if (value === "muted") {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "mute");
                            } else {
                                that.client.sendDeviceCommand(callback, devData.deviceid, "unmute");
                            }
                        });
                    that.storeCharacteristicItem("mute", devData.deviceid, thisChar);
                }
            }
            accessory.context.deviceGroups = deviceGroups;
            this.log.debug(deviceGroups);
        }

        return that.loadAccesoryData(accessory, devData) || accessory;
    }

    loadAccesoryData(accessory, deviceData) {
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
                        for (
                            let j = 0; j < accessory.services[i].characteristics.length; j++
                        ) {
                            accessory.services[i].characteristics[j].getValue();
                        }
                    }
                    return accessory;
                })
                .catch(err => {
                    that.log.error(
                        "Failed to get Device Data for " + accessory.deviceid,
                        err
                    );
                    return accessory;
                });
        }
        // });
    }

    getOrAddService(svc) {
        let s = this.getService(svc);
        if (!s) {
            s = this.addService(svc);
        }
        return s;
    }

    getOrAddCharacteristic(service, characteristic) {
        return (
            service.getCharacteristic(characteristic) ||
            service.addCharacteristic(characteristic)
        );
    }

    hasDeviceGroup(grp) {
        return this.deviceGroups.includes(grp);
    }
    hasCapability(obj, device) {
        if (obj instanceof Array && device && device.capabilities && Object.keys(device.capabilities).length) {
            obj.forEach(i => {
                if (device.capabilities.includes(i.toString()) || device.capabilities.includes(i.toString().replace(/\s/g, ""))) return true;
            });
        } else {
            if (device.capabilities.includes(obj.toString()) || device.capabilities.includes(obj.toString().replace(/\s/g, ""))) return true;
        }
        return false;
    }
    hasAttribute(val) {
        return this.context.deviceData.attributes.includes(val);
    }
    hasCommand(val) {
        return this.context.deviceData.commands.includes(val);
    }
    getServices() {
        return this.services;
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
        if (!this._attributeLookup[attr] || !this._attributeLookup[attr][devid])
            return undefined;
        return this._attributeLookup[attr][devid] || undefined;
    }

    getAccessoryId(accessory) {
        const id = accessory.deviceid || accessory.context.deviceid || undefined;
        return id;
    }

    get(device) {
        const key = this.getAccessoryId(device);
        return this._accessories[key];
    }
    getAll() {
        return this._accessories;
    }
    ignore(device) {
        const key = this.getAccessoryId(device);
        if (this._ignored[key]) {
            return false;
        }
        this._ignored[key] = device;
        return true;
    }

    add(accessory) {
        const key = this.getAccessoryId(accessory);
        return (this._accessories[key] = accessory);
    }

    remove(accessory) {
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
};

function clearAndSetTimeout(timeoutReference, fn, timeoutMs) {
    if (timeoutReference) {
        clearTimeout(timeoutReference);
    }
    return setTimeout(fn, timeoutMs);
}