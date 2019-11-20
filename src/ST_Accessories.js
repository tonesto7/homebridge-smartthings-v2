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
            accessory.context.deviceData = deviceData;
            accessory.context.name = deviceData.name;
            accessory.context.deviceid = deviceData.deviceid;
            accessory.context.uuid = accessory.UUID || this.uuid.generate(`smartthings_v2_${accessory.deviceid}`);

            accessory
                .getOrAddService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Identify, deviceData.capabilities["Switch"])
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

    CreateAccessoryFromHomebridgeCache(accessory) {
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
        accessory.reachable = true;
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

        let hasDeviceGroup = (grp) => {
            return (deviceGroups.indexOf(grp) > -1);
        };
        let hasDeviceGroups = () => {
            return (deviceGroups.length > 0);
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
                            callback(null, that.attributeStateTransform('switch', attributes.switch));
                        })
                        .on("set", (value, callback) => {
                            that.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
                        });
                    that.storeCharacteristicItem("switch", devData.deviceid, thisChar);

                    thisChar = accessory
                        .getOrAddService(Service.Lightbulb)
                        .getCharacteristic(Characteristic.Brightness)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('level', attributes.level));
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
                                callback(null, that.attributeStateTransform('hue', attributes.hue));
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
                                callback(null, that.attributeStateTransform('saturation', attributes.saturation));
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
                        callback(null, this.attributeStateTransform('door', attributes.door, 'Target Door State'));
                    })
                    .on("set", (value, callback) => {
                        if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "open");
                            accessory.context.deviceData.attributes.door = "opening";
                        } else if (value === Characteristic.TargetDoorState.CLOSED || value === 1) {
                            that.client.sendDeviceCommand(callback, devData.deviceid, "close");
                            accessory.context.deviceData.attributes.door = "closing";
                        }
                    });
                that.storeCharacteristicItem("door", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.GarageDoorOpener)
                    .getCharacteristic(Characteristic.CurrentDoorState)
                    .on("get", (callback) => {
                        callback(null, this.attributeStateTransform('door', attributes.door, 'Current Door State'));
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
                        callback(null, this.attributeStateTransform('lock', attributes.lock));
                    });
                that.storeCharacteristicItem("lock", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.LockMechanism)
                    .getCharacteristic(Characteristic.LockTargetState)
                    .on("get", (callback) => {
                        callback(null, this.attributeStateTransform('lock', attributes.lock));
                    })
                    .on("set", (value, callback) => {
                        that.client.sendDeviceCommand(callback, devData.deviceid, (value === 1 || value === true) ? "lock" : "unlock");
                        attributes.lock = (value === 1 || value === true) ? "locked" : "unlocked";
                    });
                that.storeCharacteristicItem("lock", devData.deviceid, thisChar);
            }

            if (hasCapability('Valve')) {
                that.log("valve: " + attributes.valve);
                deviceGroups.push("valve");
                //Gets the inUse Characteristic
                thisChar = accessory
                    .getOrAddService(Service.Valve)
                    .getCharacteristic(Characteristic.InUse)
                    .on("get", (callback) => {
                        callback(null, this.attributeStateTransform('valve', attributes.valve));
                    });
                that.storeCharacteristicItem("valve", devData.deviceid, thisChar);

                //Defines the valve type (irrigation or generic)
                thisChar = accessory
                    .getOrAddService(Service.Valve)
                    .getCharacteristic(Characteristic.ValveType)
                    .on("get", (callback) => {
                        callback(null, 0);
                    });
                that.storeCharacteristicItem("valve", devData.deviceid, thisChar);

                //Defines Valve State (opened/closed)
                thisChar = accessory
                    .getOrAddService(Service.Valve)
                    .getCharacteristic(Characteristic.Active)
                    .on("get", (callback) => {
                        callback(null, this.attributeStateTransform('valve', attributes.valve));
                    })
                    .on("set", (value, callback) => {
                        that.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
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
                        callback(null, (attributes.mute === "muted"));
                    })
                    .on("set", (value, callback) => {
                        that.client.sendDeviceCommand(callback, devData.deviceid, (value ? "mute" : "unmute"));
                    });
                that.storeCharacteristicItem("mute", devData.deviceid, thisChar);
            }

            //Handles Standalone Fan with no levels
            if (isFan && (hasCapability('Fan Light') || !hasDeviceGroups())) {
                deviceGroups.push("fans");
                thisChar = accessory
                    .getOrAddService(Service.Fanv2)
                    .getCharacteristic(Characteristic.Active)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('switch', attributes.switch));
                    })
                    .on("set", (value, callback) => {
                        that.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
                    });
                that.storeCharacteristicItem("switch", devData.deviceid, thisChar);

                if (attributes.level !== undefined || attributes.fanSpeed !== undefined) {
                    // let fanLvl = attributes.fanSpeed ? that.myUtils.fanSpeedConversionInt(attributes.fanSpeed, (commands['medHighSpeed'] !== undefined)) : parseInt(attributes.level);
                    let fanLvl = parseInt(attributes.level);
                    // that.log("Fan with (" + attributes.fanSpeed ? "fanSpeed" : "level" + ') | value: ' + fanLvl);
                    // that.log("Fan with level at " + fanLvl);
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
                        callback(null, that.attributeStateTransform('switch', attributes.switch));
                    })
                    .on("set", (value, callback) => {
                        if (value && (attributes.switch === "off")) {
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
                        callback(null, that.attributeStateTransform('switch', attributes.switch));
                    })
                    .on("set", (value, callback) => {
                        if (value && (attributes.switch === "off")) {
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
                // that.log("Button: (" + accessory.name + ")");
                // New STATELESS BUTTON LOGIC (By @shnhrrsn)
                thisChar = accessory
                    .getOrAddService(Service.StatelessProgrammableSwitch)
                    .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                    .on("get", (callback) => {
                        // Reset value to force `change` to fire for repeated presses
                        this.value = -1;
                        callback(null, that.attributeStateTransform('button', attributes.button));
                    });

                const validValues = [];

                if (typeof attributes.supportedButtonValues === "string") {
                    for (const value of JSON.parse(attributes.supportedButtonValues)) {
                        switch (value) {
                            case "pushed":
                                validValues.push(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
                                continue;
                            case "held":
                                validValues.push(Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
                                continue;
                            case "double":
                                validValues.push(Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
                                continue;
                            default:
                                that.log("Button: (" + accessory.name + ") unsupported button value: " + value);
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
            if (hasCapability("Switch") && (hasCapability('Fan Light') || !hasDeviceGroups())) {
                //Handles Standalone Fan with no levels
                if (isLight) {
                    deviceGroups.push("light");
                    if (hasCapability("Fan Light")) that.log("FanLight: " + devData.name);
                    thisChar = accessory
                        .getOrAddService(Service.Lightbulb)
                        .getCharacteristic(Characteristic.On)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('switch', attributes.switch));
                        })
                        .on("set", (value, callback) => {
                            that.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
                        });
                    that.storeCharacteristicItem("switch", devData.deviceid, thisChar);
                } else {
                    deviceGroups.push("switch");
                    thisChar = accessory
                        .getOrAddService(Service.Switch)
                        .getCharacteristic(Characteristic.On)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('switch', attributes.switch));
                        })
                        .on("set", (value, callback) => {
                            that.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
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
                        callback(null, that.attributeStateTransform('smoke', attributes.smoke));
                    });
                that.storeCharacteristicItem("smoke", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.SmokeSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.attributeStateTransform('carbonMonoxide', attributes.carbonMonoxide));
                    });
                that.storeCharacteristicItem("carbonMonoxide", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.CarbonMonoxideSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.attributeStateTransform('carbonDioxideMeasurement', attributes.carbonDioxideMeasurement, 'Carbon Dioxide Detected'));
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
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.attributeStateTransform('water', attributes.water));
                    });
                that.storeCharacteristicItem("water", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.LeakSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.attributeStateTransform('presence', attributes.presence));
                    });
                that.storeCharacteristicItem("presence", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.OccupancySensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.attributeStateTransform('humidity', attributes.humidity));
                    });
                that.storeCharacteristicItem("humidity", devData.deviceid, thisChar);
                if (hasCapability('Tamper Alert')) {
                    thisChar = accessory
                        .getOrAddService(Service.HumiditySensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.myUtils.tempConversionFrom_F(attributes.temperature));
                    });
                that.storeCharacteristicItem("temperature", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.TemperatureSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.attributeStateTransform('illuminance', attributes.illuminance));
                    });
                that.storeCharacteristicItem("illuminance", devData.deviceid, thisChar);
            }
            if (hasCapability('Contact Sensor') && !hasCapability('Garage Door Control')) {
                deviceGroups.push("contact_sensor");
                thisChar = accessory
                    .getOrAddService(Service.ContactSensor)
                    .getCharacteristic(Characteristic.ContactSensorState)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('contact', attributes.contact));
                    });
                that.storeCharacteristicItem("contact", devData.deviceid, thisChar);
                if (hasCapability("Tamper Alert")) {
                    thisChar = accessory
                        .getOrAddService(Service.ContactSensor)
                        .getCharacteristic(Characteristic.StatusTampered)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('tamper', attributes.tamper));
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
                        callback(null, that.attributeStateTransform('battery', attributes.battery, 'Battery Level'));
                    });
                that.storeCharacteristicItem("battery", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.BatteryService)
                    .getCharacteristic(Characteristic.StatusLowBattery)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('battery', attributes.battery, 'Status Low Battery'));
                    });
                accessory
                    .getOrAddService(Service.BatteryService)
                    .setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGING);
                that.storeCharacteristicItem("battery", devData.deviceid, thisChar);
            }

            if (hasCapability('Energy Meter') && !hasCapability('Switch') && !hasDeviceGroups()) {
                deviceGroups.push("energy_meter");
                thisChar = accessory
                    .getOrAddService(Service.Outlet)
                    .addCharacteristic(this.CommunityTypes.KilowattHours)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('energy', attributes.energy));
                    });
                that.storeCharacteristicItem("energy", devData.deviceid, thisChar);
            }

            if (hasCapability('Power Meter') && !hasCapability('Switch') && !hasDeviceGroups()) {
                deviceGroups.push("power_meter");
                thisChar = accessory
                    .getOrAddService(Service.Outlet)
                    .addCharacteristic(this.CommunityTypes.Watts)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('power', attributes.power));
                    });
                that.storeCharacteristicItem("power", devData.deviceid, thisChar);
            }

            if (isThermostat) {
                deviceGroups.push("thermostat");
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('thermostatOperatingState', attributes.thermostatOperatingState));
                    });
                that.storeCharacteristicItem("thermostatOperatingState", devData.deviceid, thisChar);
                // Handle the Target State
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('thermostatMode', attributes.thermostatMode));
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
                        callback(null, that.myUtils.tempConversionFrom_F(attributes.temperature));
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
                            callback(null, that.myUtils.tempConversionFrom_F(that.temperature_unit, temp));
                        }
                    })
                    .on("set", (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = that.myUtils.tempConversionFrom_C(value);
                        // Set the appropriate temperature unit based on the mode
                        switch (attributes.thermostatMode) {
                            case "cool":
                                {
                                    that.client.sendDeviceCommand(callback, devData.deviceid, "setCoolingSetpoint", {
                                        value1: temp
                                    });
                                    attributes.coolingSetpoint = temp;
                                    break;
                                }
                            case "emergency heat":
                            case "heat":
                                {
                                    that.client.sendDeviceCommand(callback, devData.deviceid, "setHeatingSetpoint", {
                                        value1: temp
                                    });
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
                                        that.client.sendDeviceCommand(callback, devData.deviceid, "setCoolingSetpoint", {
                                            value1: temp
                                        });
                                    } else {
                                        that.client.sendDeviceCommand(null, devData.deviceid, "setHeatingSetpoint", {
                                            value1: temp
                                        });
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
                        callback(null, (that.temperature_unit === 'C') ? Characteristic.TemperatureDisplayUnits.CELSIUS : Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
                    });
                that.storeCharacteristicItem("temperature_unit", "platform", thisChar);
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                    .on("get", (callback) => {
                        callback(null, that.myUtils.tempConversionFrom_F(attributes.heatingSetpoint));
                    })
                    .on("set", (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = that.myUtils.tempConversionFrom_C(value);
                        that.client.sendDeviceCommand(callback, devData.deviceid, "setHeatingSetpoint", {
                            value1: temp
                        });
                        attributes.heatingSetpoint = temp;
                    });
                that.storeCharacteristicItem("heatingSetpoint", devData.deviceid, thisChar);
                thisChar = accessory
                    .getOrAddService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                    .on("get", (callback) => {
                        callback(null, that.myUtils.tempConversionFrom_F(attributes.coolingSetpoint));
                    })
                    .on("set", (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = that.myUtils.tempConversionFrom_C(value);
                        that.client.sendDeviceCommand(callback, devData.deviceid, "setCoolingSetpoint", {
                            value1: temp
                        });
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
                        callback(null, that.attributeStateTransform('alarmSystemStatus', attributes.alarmSystemStatus));
                    });
                that.storeCharacteristicItem("alarmSystemStatus", devData.deviceid, thisChar);

                thisChar = accessory
                    .getOrAddService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .on("get", (callback) => {
                        callback(null, that.attributeStateTransform('alarmSystemStatus', attributes.alarmSystemStatus.toLowerCase()));
                    })
                    .on("set", (value, callback) => {
                        that.client.sendDeviceCommand(callback, devData.deviceid, that.myUtils.convertAlarmState(value, false, Characteristic));
                        attributes.alarmSystemStatus = that.myUtils.convertAlarmState(value, false, Characteristic);
                    });
                that.storeCharacteristicItem("alarmSystemStatus", devData.deviceid, thisChar);
            }

            // Sonos Speakers
            if (isSonos && !hasDeviceGroups()) {
                deviceGroups.push("speakers");
                if (hasCapability("Audio Volume")) {
                    let sonosVolumeTimeout = null;
                    let lastVolumeWriteValue = null;

                    thisChar = accessory
                        .getOrAddService(Service.Speaker)
                        .getCharacteristic(Characteristic.Volume)
                        .on("get", (callback) => {
                            that.log.debug("Reading sonos volume " + attributes.volume);
                            callback(null, that.attributeStateTransform('volume', attributes.volume));
                        })
                        .on("set", (value, callback) => {
                            if (value > 0 && value !== lastVolumeWriteValue) {
                                lastVolumeWriteValue = value;
                                that.log.debug(`Existing volume: ${attributes.volume}, set to ${value}`);

                                // Smooth continuous updates to make more responsive
                                sonosVolumeTimeout = clearAndSetTimeout(sonosVolumeTimeout, () => {
                                    that.log.debug(`Existing volume: ${attributes.volume}, set to ${lastVolumeWriteValue}`);
                                    that.client.sendDeviceCommand(callback, devData.deviceid, "setVolume", {
                                        value1: lastVolumeWriteValue
                                    });
                                }, 1000);
                            }
                        });

                    that.storeCharacteristicItem("volume", devData.deviceid, thisChar);
                }

                if (hasCapability("Audio Mute")) {
                    thisChar = accessory
                        .getOrAddService(Service.Speaker)
                        .getCharacteristic(Characteristic.Mute)
                        .on("get", (callback) => {
                            callback(null, that.attributeStateTransform('mute', attributes.mute));
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

        return that.loadAccessoryData(accessory, devData) || accessory;
    }

    processDeviceAttributeUpdate(change) {
        let attrObj = this.getAttributeStoreItem(change.attribute, change.deviceid);
        let accessory = this.getAccessoryFromCache(change);
        if (!attrObj || !accessory) return;
        if (attrObj instanceof Array) {
            attrObj.forEach(characteristic => {
                let newVal = this.attributeStateTransform(change.attribute, change.value, characteristic.displayName);
                accessory.context.deviceData.attributes[change.attribute] = change.value;
                characteristic.updateValue(newVal);
            });
        }
    }

    attributeStateTransform(attr, val, charName) {
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
            case "hue":
                return Math.round(val * 3.6);
            case "temperature":
            case "heatingSetpoint":
            case "coolingSetpoint":
                return this.myUtils.tempConversionFrom_F(val);
            case "level":
            case "fanSpeed":
            case "saturation":
            case "volume":
                return parseInt(val) || 0;
            case "illuminance":
                return Math.ceil(val);

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
            case "alarmSystemStatus":
                return this.myUtils.convertAlarmState(val, true, Characteristic);
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
            accessory
                .getOrAddService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.FirmwareRevision, deviceData.firmwareVersion)
                .setCharacteristic(Characteristic.Manufacturer, deviceData.manufacturerName)
                .setCharacteristic(Characteristic.Model, `${that.myUtils.toTitleCase(deviceData.modelName)}`)
                .setCharacteristic(Characteristic.Name, deviceData.name)
                .setCharacteristic(Characteristic.SerialNumber, deviceData.serialNumber);
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

    getAccessoryFromCache(device) {
        const key = this.getAccessoryId(device);
        return this._accessories[key];
    }

    getAllAccessoriesFromCache() {
        return this._accessories;
    }

    addAccessoryToCache(accessory) {
        const key = this.getAccessoryId(accessory);
        return (this._accessories[key] = accessory);
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
};

function clearAndSetTimeout(timeoutReference, fn, timeoutMs) {
    if (timeoutReference) {
        clearTimeout(timeoutReference);
    }
    return setTimeout(fn, timeoutMs);
}