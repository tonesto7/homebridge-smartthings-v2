const {
    knownCapabilities
} = require('../Constants');
const autoBind = require('auto-bind');
const _ = require("lodash");
var Service, Characteristic;

module.exports = class ST_Accessories {
    constructor(platform) {
        // const { uuid } = this.api.hap;
        this.platform = platform;
        this.configItems = platform.getConfigItems();
        this.temperature_unit = platform.temperature_unit;
        this.myUtils = platform.myUtils;
        this.log = platform.log;
        this.hap = platform.hap;
        this.uuid = platform.uuid;
        Service = platform.Service;
        Characteristic = platform.Characteristic;
        this.CommunityTypes = require('../CommunityTypes')(Service, Characteristic);
        this.client = platform.client;
        this.comparator = this.comparator.bind(this);
        this._accessories = {};
        this._ignored = {};
    }

    async PopulateAccessory(accessory, deviceData) {
        // console.log("AccessoryDevice: ", accessory, deviceData);
        accessory.deviceid = deviceData.deviceid;
        accessory.name = deviceData.name;
        accessory.state = {};
        accessory.device = deviceData;
        accessory.deviceGroups = [];
        let that = this;

        //Removing excluded capabilities from config
        for (let i = 0; i < deviceData.excludedCapabilities.length; i++) {
            let excludedCapability = deviceData.excludedCapabilities[i];
            if (deviceData.capabilities[excludedCapability] !== undefined) {
                this.log.debug("Removing capability: " + excludedCapability + " for deviceData: " + deviceData.name);
                delete deviceData.capabilities[excludedCapability];
            }
        }

        // Attach helper to accessory
        accessory.getOrAddService = this.getOrAddService.bind(accessory);
        accessory.hasDeviceGroup = this.hasDeviceGroup.bind(accessory);
        accessory.hasAttribute = this.hasAttribute.bind(accessory);
        accessory.hasCapability = this.hasCapability.bind(accessory);
        accessory.hasCommand = this.hasCommand.bind(accessory);

        accessory.context.name = deviceData.name;
        accessory.context.deviceid = deviceData.deviceid;
        accessory.context.deviceData = deviceData;

        accessory.getOrAddService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Identify, (deviceData.capabilities['Switch'] !== undefined))
            .setCharacteristic(Characteristic.FirmwareRevision, deviceData.firmwareVersion)
            .setCharacteristic(Characteristic.Manufacturer, deviceData.manufacturerName)
            .setCharacteristic(Characteristic.Model, `${that.myUtils.toTitleCase(deviceData.modelName)}`)
            .setCharacteristic(Characteristic.Name, deviceData.name)
            .setCharacteristic(Characteristic.SerialNumber, deviceData.serialNumber);
        return await this.initializeDeviceCharacteristics(accessory);
        // console.log(accessory)
        // return accessory;
    }

    getOrAddService(svc) {
        let s = this.getService(svc);
        if (!s) { s = this.addService(svc); }
        return s;
    };

    hasDeviceGroup(grp) {
        return (this.deviceGroups.includes(grp))
    };
    hasCapability(val) {
        val = val.replace(/\s/g, '');
        return (this.context.deviceData.capabilities.includes(val))
    };
    hasAttribute(val) {
        return (this.context.deviceData.attributes.includes(val))
    };
    hasCommand(val) {
        return (this.context.deviceData.commands.includes(val))
    };
    getServices() {
        return this.services;
    }

    async CreateFromCachedAccessory(accessory) {
        let deviceid = accessory.context.deviceid;
        let name = accessory.context.name;
        this.log.debug("Initializing Cached Device " + deviceid);
        accessory.deviceid = deviceid;
        accessory.name = name;
        accessory.state = {};
        accessory.deviceGroups = []
        accessory.getOrAddService = this.getOrAddService.bind(accessory);
        accessory.hasDeviceGroup = this.hasDeviceGroup.bind(accessory);
        accessory.hasAttribute = this.hasAttribute.bind(accessory);
        accessory.hasCapability = this.hasCapability.bind(accessory);
        accessory.hasCommand = this.hasCommand.bind(accessory);
        return await this.initializeDeviceCharacteristics(accessory)
    }

    initializeDeviceCharacteristics(accessory) {
        // Get the Capabilities List
        for (let index in accessory.context.deviceData.capabilities) {
            if (knownCapabilities.indexOf(index) === -1 && this.platform.unknownCapabilities.indexOf(index) === -1) {
                this.platform.unknownCapabilities.push(index);
            }
        }
        let that = this;
        // return new Promise((resolve, reject) => {
        let deviceGroups = []
        let thisCharacteristic;
        // log(JSON.stringify(accessory.context.deviceData));

        let attributes = accessory.context.deviceData.attributes;
        let capabilities = accessory.context.deviceData.capabilities;
        let commands = accessory.context.deviceData.commands;
        let devData = accessory.context.deviceData;
        let isMode = (capabilities['Mode'] !== undefined);
        let isRoutine = (capabilities['Routine'] !== undefined);
        let isFan = (capabilities['Fan'] !== undefined || capabilities['Fan Light'] !== undefined || capabilities['FanLight'] !== undefined || capabilities['Fan Speed'] || commands.lowSpeed !== undefined);
        let isWindowShade = (capabilities['WindowShade'] !== undefined || capabilities['Window Shade'] !== undefined);
        let isLight = (capabilities['LightBulb'] !== undefined || capabilities['Light Bulb'] !== undefined || capabilities['Bulb'] !== undefined || capabilities['Fan Light'] !== undefined || capabilities['FanLight'] !== undefined || devData.name.includes('light'));
        let isSpeaker = (capabilities['Speaker'] !== undefined);
        let isSonos = (devData.manufacturerName === 'Sonos');


        if (devData && capabilities) {
            if ((capabilities['Switch Level'] !== undefined || capabilities['SwitchLevel'] !== undefined) && !isSpeaker && !isFan && !isMode && !isRoutine) {
                if (isWindowShade || commands.levelOpenClose || commands.presetPosition) {
                    // This is a Window Shade
                    deviceGroups.push('window_shades');
                    thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).getCharacteristic(Characteristic.TargetPosition)
                        .on('get', (callback) => {
                            callback(null, parseInt(attributes.level));
                        })
                        .on('set', (value, callback) => {
                            if (commands.close && value === 0) {
                                // setLevel: 0, not responding on spring fashion blinds
                                that.client.runCommand(callback, devData.deviceid, 'close');
                            } else {
                                that.client.runCommand(callback, devData.deviceid, 'setLevel', {
                                    value1: value
                                });
                            }
                        });
                    that.platform.addAttributeUsage('level', devData.deviceid, thisCharacteristic);
                    thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).getCharacteristic(Characteristic.CurrentPosition)
                        .on('get', (callback) => {
                            callback(null, parseInt(attributes.level));
                        });
                    that.platform.addAttributeUsage('level', devData.deviceid, thisCharacteristic);

                    thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                } else if (isLight === true || commands.setLevel) {
                    deviceGroups.push('lights');
                    thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.On)
                        .on('get', (callback) => {
                            callback(null, attributes.switch === 'on');
                        })
                        .on('set', (value, callback) => {
                            if (value) {
                                that.client.runCommand(callback, devData.deviceid, 'on');
                            } else {
                                that.client.runCommand(callback, devData.deviceid, 'off');
                            }
                        });
                    console.log('light')
                    that.platform.addAttributeUsage('switch', devData.deviceid, thisCharacteristic);
                    thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness)
                        .on('get', (callback) => {
                            callback(null, parseInt(attributes.level));
                        })
                        .on('set', (value, callback) => {
                            that.client.runCommand(callback, devData.deviceid, 'setLevel', {
                                value1: value
                            });
                        });
                    that.platform.addAttributeUsage('level', devData.deviceid, thisCharacteristic);
                    if (capabilities['Color Control'] || capabilities['ColorControl']) {
                        thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.Hue)
                            .on('get', (callback) => {
                                callback(null, Math.round(attributes.hue * 3.6));
                            })
                            .on('set', (value, callback) => {
                                that.client.runCommand(callback, devData.deviceid, 'setHue', {
                                    value1: Math.round(value / 3.6)
                                });
                            });
                        that.platform.addAttributeUsage('hue', devData.deviceid, thisCharacteristic);
                        thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.Saturation)
                            .on('get', (callback) => {
                                callback(null, parseInt(attributes.saturation));
                            })
                            .on('set', (value, callback) => {
                                that.client.runCommand(callback, devData.deviceid, 'setSaturation', {
                                    value1: value
                                });
                            });
                        that.platform.addAttributeUsage('saturation', devData.deviceid, thisCharacteristic);
                    }
                }
            }

            if (capabilities['Garage Door Control'] !== undefined || capabilities['GarageDoorControl'] !== undefined) {
                deviceGroups.push('garage_doors');
                thisCharacteristic = accessory.getOrAddService(Service.GarageDoorOpener).getCharacteristic(Characteristic.TargetDoorState)
                    .on('get', (callback) => {
                        if (attributes.door === 'closed' || attributes.door === 'closing') {
                            callback(null, Characteristic.TargetDoorState.CLOSED);
                        } else if (attributes.door === 'open' || attributes.door === 'opening') {
                            callback(null, Characteristic.TargetDoorState.OPEN);
                        }
                    })
                    .on('set', (value, callback) => {
                        if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                            that.client.runCommand(callback, devData.deviceid, 'open');
                            attributes.door = 'opening';
                        } else if (value === Characteristic.TargetDoorState.CLOSED || value === 1) {
                            that.client.runCommand(callback, devData.deviceid, 'close');
                            attributes.door = 'closing';
                        }
                    });
                that.platform.addAttributeUsage('door', devData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.GarageDoorOpener).getCharacteristic(Characteristic.CurrentDoorState)
                    .on('get', (callback) => {
                        switch (attributes.door) {
                            case 'open':
                                callback(null, Characteristic.TargetDoorState.OPEN);
                                break;
                            case 'opening':
                                callback(null, Characteristic.TargetDoorState.OPENING);
                                break;
                            case 'closed':
                                callback(null, Characteristic.TargetDoorState.CLOSED);
                                break;
                            case 'closing':
                                callback(null, Characteristic.TargetDoorState.CLOSING);
                                break;
                            default:
                                callback(null, Characteristic.TargetDoorState.STOPPED);
                                break;
                        }
                    });
                that.platform.addAttributeUsage('door', devData.deviceid, thisCharacteristic);
                accessory.getOrAddService(Service.GarageDoorOpener).setCharacteristic(Characteristic.ObstructionDetected, false);
            }
            if (capabilities['Lock'] !== undefined && !capabilities['Thermostat']) {
                deviceGroups.push('locks');
                thisCharacteristic = accessory.getOrAddService(Service.LockMechanism).getCharacteristic(Characteristic.LockCurrentState)
                    .on('get', (callback) => {
                        switch (attributes.lock) {
                            case 'locked':
                                callback(null, Characteristic.LockCurrentState.SECURED);
                                break;
                            case 'unlocked':
                                callback(null, Characteristic.LockCurrentState.UNSECURED);
                                break;
                            default:
                                callback(null, Characteristic.LockCurrentState.UNKNOWN);
                                break;
                        }
                    });
                that.platform.addAttributeUsage('lock', devData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.LockMechanism).getCharacteristic(Characteristic.LockTargetState)
                    .on('get', (callback) => {
                        switch (attributes.lock) {
                            case 'locked':
                                callback(null, Characteristic.LockCurrentState.SECURED);
                                break;
                            case 'unlocked':
                                callback(null, Characteristic.LockCurrentState.UNSECURED);
                                break;
                            default:
                                callback(null, Characteristic.LockCurrentState.UNKNOWN);
                                break;
                        }
                    })
                    .on('set', (value, callback) => {
                        if (value === 1 || value === true) {
                            that.client.runCommand(callback, devData.deviceid, 'lock');
                            attributes.lock = 'locked';
                        } else {
                            that.client.runCommand(callback, devData.deviceid, 'unlock');
                            attributes.lock = 'unlocked';
                        }
                    });
                that.platform.addAttributeUsage('lock', devData.deviceid, thisCharacteristic);
            }

            if (capabilities["Valve"] !== undefined) {
                that.log("valve: " + attributes.valve);
                deviceGroups.push('valve');
                let valveType = (capabilities['Irrigation'] !== undefined ? 0 : 0);

                //Gets the inUse Characteristic
                thisCharacteristic = accessory.getOrAddService(Service.Valve).getCharacteristic(Characteristic.InUse)
                    .on('get', (callback) => {
                        callback(null, attributes.valve === 'open' ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE);
                    });
                that.platform.addAttributeUsage('inUse', devData.deviceid, thisCharacteristic);

                //Defines the valve type (irrigation or generic)
                thisCharacteristic = accessory.getOrAddService(Service.Valve).getCharacteristic(Characteristic.ValveType)
                    .on('get', (callback) => {
                        callback(null, valveType);
                    });
                that.platform.addAttributeUsage('valveType', devData.deviceid, thisCharacteristic);

                //Defines Valve State (opened/closed)
                thisCharacteristic = accessory.getOrAddService(Service.Valve).getCharacteristic(Characteristic.Active)
                    .on('get', (callback) => {
                        callback(null, attributes.valve === 'open' ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE);
                    })
                    .on('set', (value, callback) => {
                        // if (attributes.inStandby !== 'true') {
                        if (value) {
                            that.client.runCommand(callback, devData.deviceid, 'on');
                        } else {
                            that.client.runCommand(callback, devData.deviceid, 'off');
                        }
                        // }
                    });
                that.platform.addAttributeUsage('valve', devData.deviceid, thisCharacteristic);
            }

            //Defines Speaker Device
            if (isSpeaker === true) {
                accessory.deviceGroups.push('speakers');
                thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Volume)
                    .on('get', (callback) => {
                        callback(null, parseInt(attributes.level || 0));
                    })
                    .on('set', (value, callback) => {
                        if (value > 0) {
                            that.client.runCommand(callback, devData.deviceid, 'setLevel', {
                                value1: value
                            });
                        }
                    });
                that.platform.addAttributeUsage('volume', devData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Mute)
                    .on('get', (callback) => {
                        callback(null, attributes.mute === 'muted');
                    })
                    .on('set', (value, callback) => {
                        if (value) {
                            that.client.runCommand(callback, devData.deviceid, 'mute');
                        } else {
                            that.client.runCommand(callback, devData.deviceid, 'unmute');
                        }
                    });
                that.platform.addAttributeUsage('mute', devData.deviceid, thisCharacteristic);
            }
            //Handles Standalone Fan with no levels
            if (isFan === true && (capabilities['Fan Light'] !== undefined || capabilities['FanLight'] !== undefined || !accessory.deviceGroups.length)) {
                deviceGroups.push('fans');
                thisCharacteristic = accessory.getOrAddService(Service.Fanv2).getCharacteristic(Characteristic.Active)
                    .on('get', (callback) => {
                        callback(null, attributes.switch === 'on');
                    })
                    .on('set', (value, callback) => {
                        if (value) {
                            that.client.runCommand(callback, devData.deviceid, 'on');
                        } else {
                            that.client.runCommand(callback, devData.deviceid, 'off');
                        }
                    });
                that.platform.addAttributeUsage('switch', devData.deviceid, thisCharacteristic);

                if (attributes.level !== undefined || attributes.fanSpeed !== undefined) {
                    // let fanLvl = attributes.fanSpeed ? that.myUtils.fanSpeedConversionInt(attributes.fanSpeed, (commands['medHighSpeed'] !== undefined)) : parseInt(attributes.level);
                    let fanLvl = parseInt(attributes.level);
                    // that.log("Fan with (" + attributes.fanSpeed ? "fanSpeed" : "level" + ') | value: ' + fanLvl);
                    that.log("Fan with level at " + fanLvl);
                    // let waitTimer;
                    thisCharacteristic = accessory.getOrAddService(Service.Fanv2).getCharacteristic(Characteristic.RotationSpeed)
                        .on('get', (callback) => {
                            callback(null, fanLvl);
                        })
                        .on('set', (value, callback) => {
                            if (value >= 0 && value <= 100) {

                                // clearTimeout(waitTimer);
                                // that.log('Sending Fan value of ' + value);
                                that.client.runCommand(callback, devData.deviceid, 'setLevel', {
                                    value1: parseInt(value)
                                });

                            }
                        });
                    that.platform.addAttributeUsage('level', devData.deviceid, thisCharacteristic);
                }
            }
            if (isMode === true) {
                deviceGroups.push('mode');
                that.log('Mode: (' + accessory.name + ')');
                thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                    .on('get', (callback) => {
                        callback(null, attributes.switch === 'on');
                    })
                    .on('set', (value, callback) => {
                        if (value && attributes.switch === 'off') {
                            that.client.runCommand(callback, devData.deviceid, 'mode', {
                                value1: accessory.name.toString()
                            });
                        }
                    });
                that.platform.addAttributeUsage('switch', devData.deviceid, thisCharacteristic);
            }
            if (isRoutine === true) {
                deviceGroups.push('routine');
                that.log('Routine: (' + accessory.name + ')');
                thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                    .on('get', (callback) => {
                        callback(null, attributes.switch === 'on');
                    })
                    .on('set', (value, callback) => {
                        if (value) {
                            that.client.runCommand(callback, devData.deviceid, 'routine', {
                                value1: accessory.name.toString()
                            });
                            setTimeout(
                                () => {
                                    console.log("routineOff...");
                                    accessory.getOrAddService(Service.Switch).setCharacteristic(Characteristic.On, false);
                                }, 2000);
                        }
                    });
                that.platform.addAttributeUsage('switch', devData.deviceid, thisCharacteristic);
            }
            if (capabilities['Button'] !== undefined) {
                deviceGroups.push('button');
                that.log('Button: (' + accessory.name + ')');
                //Old Button Logic
                // thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                //     .on('get', (callback)=>{
                //         callback(null, attributes.switch === 'on');
                //     })
                //     .on('set', (value, callback) =>{
                //         if (value && attributes.switch === 'off') {
                //             that.client.runCommand(callback, devData.deviceid, 'button');
                //         }
                //     });
                // that.platform.addAttributeUsage('switch', devData.deviceid, thisCharacteristic);

                // New STATELESS BUTTON LOGIC (By @shnhrrsn)
                thisCharacteristic = accessory.getOrAddService(Service.StatelessProgrammableSwitch).getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                    .on('get', (callback) => {
                        // Reset value to force `change` to fire for repeated presses
                        this.value = -1;

                        switch (attributes.button) {
                            case 'pushed':
                                return callback(null, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
                            case 'held':
                                return callback(null, Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
                            case 'double':
                                return callback(null, Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
                            default:
                                return callback(null, null);
                        }
                    });

                const validValues = [];

                if (typeof attributes.supportedButtonValues === 'string') {
                    for (const value of JSON.parse(attributes.supportedButtonValues)) {
                        switch (value) {
                            case 'pushed':
                                validValues.push(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
                                continue;
                            case 'held':
                                validValues.push(Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
                                continue;
                            case 'double':
                                validValues.push(Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);
                                continue;
                            default:
                                that.log('Button: (' + accessory.name + ') unsupported button value: ' + value);
                        }
                    }

                    thisCharacteristic.setProps({
                        validValues
                    });
                }

                // Turned on by default for Characteristic.ProgrammableSwitchEvent, required to emit `change`
                thisCharacteristic.eventOnlyCharacteristic = false;

                that.platform.addAttributeUsage('button', devData.deviceid, thisCharacteristic);
            }

            // This should catch the remaining switch devices that are specially defined
            if (capabilities['Switch'] !== undefined && (capabilities['Fan Light'] !== undefined || capabilities['FanLight'] !== undefined || !accessory.deviceGroups.length)) {
                //Handles Standalone Fan with no levels
                if (isLight === true) {
                    deviceGroups.push('light');
                    if (capabilities['Fan Light'] || capabilities['FanLight']) {
                        that.log('FanLight: ' + devData.name);
                    }
                    thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.On)
                        .on('get', (callback) => {
                            callback(null, attributes.switch === 'on');
                        })
                        .on('set', (value, callback) => {
                            if (value) {
                                that.client.runCommand(callback, devData.deviceid, 'on');
                            } else {
                                that.client.runCommand(callback, devData.deviceid, 'off');
                            }
                        });
                    that.platform.addAttributeUsage('switch', devData.deviceid, thisCharacteristic);
                } else {
                    deviceGroups.push('switch')
                    thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                        .on('get', (callback) => {
                            callback(null, attributes.switch === 'on');
                        })
                        .on('set', (value, callback) => {
                            if (value) {
                                that.client.runCommand(callback, devData.deviceid, 'on');
                            } else {
                                that.client.runCommand(callback, devData.deviceid, 'off');
                            }
                        });
                    that.platform.addAttributeUsage('switch', devData.deviceid, thisCharacteristic);

                    // if (capabilities['Energy Meter'] || capabilities['EnergyMeter']) {
                    //     thisCharacteristic = accessory.getOrAddService(Service.Switch).addCharacteristic(this.CommunityTypes.Watts)
                    //         .on('get', (callback)=>{
                    //             callback(null, Math.round(attributes.power));
                    //         });
                    //     that.platform.addAttributeUsage('energy', devData.deviceid, thisCharacteristic);
                    // }
                }
            }
            // Smoke Detectors
            if ((capabilities['Smoke Detector'] !== undefined || capabilities['SmokeDetector'] !== undefined) && attributes.smoke) {
                deviceGroups.push('smoke_detector')
                thisCharacteristic = accessory.getOrAddService(Service.SmokeSensor).getCharacteristic(Characteristic.SmokeDetected)
                    .on('get', (callback) => {
                        if (attributes.smoke === 'clear') {
                            callback(null, Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
                        } else {
                            callback(null, Characteristic.SmokeDetected.SMOKE_DETECTED);
                        }
                    });
                that.platform.addAttributeUsage('smoke', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] || capabilities['TamperAlert']) {
                    thisCharacteristic = accessory.getOrAddService(Service.SmokeSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if ((capabilities['Carbon Monoxide Detector'] !== undefined || capabilities['CarbonMonoxideDetector'] !== undefined) && attributes.carbonMonoxide) {
                deviceGroups.push('carbon_monoxide_detector')
                thisCharacteristic = accessory.getOrAddService(Service.CarbonMonoxideSensor).getCharacteristic(Characteristic.CarbonMonoxideDetected)
                    .on('get', (callback) => {
                        if (attributes.carbonMonoxide === 'clear') {
                            callback(null, Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL);
                        } else {
                            callback(null, Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL);
                        }
                    });
                that.platform.addAttributeUsage('carbonMonoxide', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.CarbonMonoxideSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if ((capabilities['Carbon Dioxide Measurement'] !== undefined || capabilities['CarbonDioxideMeasurement'] !== undefined) && attributes.carbonDioxideMeasurement) {
                deviceGroups.push('carbon_dioxide_measure')
                thisCharacteristic = accessory.getOrAddService(Service.CarbonDioxideSensor).getCharacteristic(Characteristic.CarbonDioxideDetected)
                    .on('get', (callback) => {
                        if (attributes.carbonDioxideMeasurement < 2000) {
                            callback(null, Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
                        } else {
                            callback(null, Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL);
                        }
                    });
                that.platform.addAttributeUsage('carbonDioxide', devData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.CarbonDioxideSensor).getCharacteristic(Characteristic.CarbonDioxideLevel)
                    .on('get', (callback) => {
                        if (attributes.carbonDioxideMeasurement >= 0) {
                            callback(null, attributes.carbonDioxideMeasurement);
                        }
                    });
                that.platform.addAttributeUsage('carbonDioxideLevel', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.CarbonDioxideSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if (capabilities['Motion Sensor'] !== undefined || capabilities['MotionSensor'] !== undefined) {
                deviceGroups.push('motion_sensor')
                thisCharacteristic = accessory.getOrAddService(Service.MotionSensor).getCharacteristic(Characteristic.MotionDetected)
                    .on('get', (callback) => {
                        callback(null, attributes.motion === 'active');
                    });
                that.platform.addAttributeUsage('motion', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.MotionSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if (capabilities['Water Sensor'] !== undefined || capabilities['WaterSensor'] !== undefined) {
                deviceGroups.push('water_sensor')
                thisCharacteristic = accessory.getOrAddService(Service.LeakSensor).getCharacteristic(Characteristic.LeakDetected)
                    .on('get', (callback) => {
                        let reply = Characteristic.LeakDetected.LEAK_DETECTED;
                        if (attributes.water === 'dry') {
                            reply = Characteristic.LeakDetected.LEAK_NOT_DETECTED;
                        }
                        callback(null, reply);
                    });
                that.platform.addAttributeUsage('water', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.LeakSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if (capabilities['Presence Sensor'] !== undefined || capabilities['PresenceSensor'] !== undefined) {
                deviceGroups.push('presence_sensor')
                thisCharacteristic = accessory.getOrAddService(Service.OccupancySensor).getCharacteristic(Characteristic.OccupancyDetected)
                    .on('get', (callback) => {
                        callback(null, attributes.presence === 'present');
                    });
                that.platform.addAttributeUsage('presence', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.OccupancySensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if (capabilities['Relative Humidity Measurement'] !== undefined || capabilities['RelativeHumidityMeasurement'] !== undefined) {
                deviceGroups.push('humidity_sensor')
                thisCharacteristic = accessory.getOrAddService(Service.HumiditySensor).getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .on('get', (callback) => {
                        callback(null, Math.round(attributes.humidity));
                    });
                that.platform.addAttributeUsage('humidity', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.HumiditySensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if (capabilities['Temperature Measurement'] !== undefined || capabilities['TemperatureMeasurement'] !== undefined) {
                deviceGroups.push('temp_sensor')
                thisCharacteristic = accessory.getOrAddService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({
                        minValue: parseFloat(-50),
                        maxValue: parseFloat(100)
                    })
                    .on('get', (callback) => {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, attributes.temperature));
                    });
                that.platform.addAttributeUsage('temperature', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.TemperatureSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if (capabilities['Illuminance Measurement'] !== undefined || capabilities['IlluminanceMeasurement'] !== undefined) {
                // console.log(devData);
                deviceGroups.push('illuminance_sensor')
                thisCharacteristic = accessory.getOrAddService(Service.LightSensor).getCharacteristic(Characteristic.CurrentAmbientLightLevel)
                    .on('get', (callback) => {
                        callback(null, Math.ceil(attributes.illuminance));
                    });
                that.platform.addAttributeUsage('illuminance', devData.deviceid, thisCharacteristic);
            }
            if ((capabilities['Contact Sensor'] !== undefined && capabilities['Garage Door Control'] === undefined) || (capabilities['ContactSensor'] !== undefined && capabilities['GarageDoorControl'] === undefined)) {
                deviceGroups.push('contact_sensor')
                thisCharacteristic = accessory.getOrAddService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState)
                    .on('get', (callback) => {
                        if (attributes.contact === 'closed') {
                            callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
                        } else {
                            callback(null, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
                        }
                    });
                that.platform.addAttributeUsage('contact', devData.deviceid, thisCharacteristic);
                if (capabilities['Tamper Alert'] !== undefined || capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.ContactSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', (callback) => {
                            callback(null, (attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', devData.deviceid, thisCharacteristic);
                }
            }
            if (capabilities['Battery'] !== undefined) {
                deviceGroups.push('battery_level')
                thisCharacteristic = accessory.getOrAddService(Service.BatteryService).getCharacteristic(Characteristic.BatteryLevel)
                    .on('get', (callback) => {
                        callback(null, Math.round(attributes.battery));
                    });
                that.platform.addAttributeUsage('battery', devData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.BatteryService).getCharacteristic(Characteristic.StatusLowBattery)
                    .on('get', (callback) => {
                        let battStatus = (attributes.battery < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                        callback(null, battStatus);
                    });
                accessory.getOrAddService(Service.BatteryService).setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGING);
                that.platform.addAttributeUsage('battery', devData.deviceid, thisCharacteristic);
            }
            if (capabilities['Energy Meter'] !== undefined && !capabilities.Switch && !accessory.deviceGroups.length) {
                deviceGroups.push('energy_meter')
                thisCharacteristic = accessory.getOrAddService(Service.Outlet).addCharacteristic(this.CommunityTypes.KilowattHours)
                    .on('get', (callback) => {
                        callback(null, Math.round(attributes.energy));
                    });
                that.platform.addAttributeUsage('energy', devData.deviceid, thisCharacteristic);
            }
            if (capabilities['Power Meter'] !== undefined && !capabilities.Switch && !deviceGroups.length) {
                deviceGroups.push('power_meter')
                thisCharacteristic = accessory.getOrAddService(Service.Outlet).addCharacteristic(this.CommunityTypes.Watts)
                    .on('get', (callback) => {
                        callback(null, Math.round(attributes.power));
                    });
                that.platform.addAttributeUsage('power', devData.deviceid, thisCharacteristic);
            }
            if (capabilities['Acceleration Sensor'] !== undefined || capabilities['AccelerationSensor'] !== undefined) {
                // deviceGroups.push('accel_sensor')
            }
            if (capabilities['Three Axis'] !== undefined || capabilities['ThreeAxis'] !== undefined) {
                // deviceGroups.push('3_axis_sensor')
            }
            if (capabilities['Air Quality Sensor'] !== undefined || capabilities['AirQualitySensor'] !== undefined) {
                // deviceGroups.push('air_quality_sensor')
                // thisCharacteristic = accessory.getOrAddService(Service.AirQualitySensor).getCharacteristic(Characteristic.AirQuality)
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
                // that.platform.addAttributeUsage('thermostatOperatingState', devData.deviceid, thisCharacteristic);
            }
            if (capabilities['Thermostat'] !== undefined) {
                deviceGroups.push('thermostat')
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .on('get', (callback) => {
                        switch (attributes.thermostatOperatingState) {
                            case 'pending cool':
                            case 'cooling':
                                callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
                                break;
                            case 'pending heat':
                            case 'heating':
                                callback(null, Characteristic.CurrentHeatingCoolingState.HEAT);
                                break;
                            default:
                                // The above list should be inclusive, but we need to return something if they change stuff.
                                // TODO: Double check if Smartthings can send "auto" as operatingstate. I don't think it can.
                                callback(null, Characteristic.CurrentHeatingCoolingState.OFF);
                                break;
                        }
                    });
                that.platform.addAttributeUsage('thermostatOperatingState', devData.deviceid, thisCharacteristic);
                // Handle the Target State
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.TargetHeatingCoolingState)
                    .on('get', (callback) => {
                        switch (attributes.thermostatMode) {
                            case 'cool':
                                callback(null, Characteristic.TargetHeatingCoolingState.COOL);
                                break;
                            case 'emergency heat':
                            case 'heat':
                                callback(null, Characteristic.TargetHeatingCoolingState.HEAT);
                                break;
                            case 'auto':
                                callback(null, Characteristic.TargetHeatingCoolingState.AUTO);
                                break;
                            default:
                                // The above list should be inclusive, but we need to return something if they change stuff.
                                callback(null, Characteristic.TargetHeatingCoolingState.OFF);
                                break;
                        }
                    })
                    .on('set', (value, callback) => {
                        switch (value) {
                            case Characteristic.TargetHeatingCoolingState.COOL:
                                that.client.runCommand(callback, devData.deviceid, 'cool');
                                attributes.thermostatMode = 'cool';
                                break;
                            case Characteristic.TargetHeatingCoolingState.HEAT:
                                that.client.runCommand(callback, devData.deviceid, 'heat');
                                attributes.thermostatMode = 'heat';
                                break;
                            case Characteristic.TargetHeatingCoolingState.AUTO:
                                that.client.runCommand(callback, devData.deviceid, 'auto');
                                attributes.thermostatMode = 'auto';
                                break;
                            case Characteristic.TargetHeatingCoolingState.OFF:
                                that.client.runCommand(callback, devData.deviceid, 'off');
                                attributes.thermostatMode = 'off';
                                break;
                        }
                    });
                if (typeof attributes.supportedThermostatModes === 'string') {
                    let validValuesArray = [];
                    if (attributes.supportedThermostatModes.includes("off")) {
                        validValuesArray.push(0);
                    }
                    if ((attributes.supportedThermostatModes.includes("heat")) || (attributes.supportedThermostatModes.includes("emergency heat"))) {
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
                    thisCharacteristic.setProps(validValues);
                }
                that.platform.addAttributeUsage('thermostatMode', devData.deviceid, thisCharacteristic);
                if (capabilities['Relative Humidity Measurement'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CurrentRelativeHumidity)
                        .on('get', (callback) => {
                            callback(null, parseInt(attributes.humidity));
                        });
                    that.platform.addAttributeUsage('humidity', devData.deviceid, thisCharacteristic);
                }
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CurrentTemperature)
                    .on('get', (callback) => {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, attributes.temperature));
                    });
                that.platform.addAttributeUsage('temperature', devData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.TargetTemperature)
                    .on('get', (callback) => {
                        let temp;
                        switch (attributes.thermostatMode) {
                            case 'cool':
                                temp = attributes.coolingSetpoint;
                                break;
                            case 'emergency heat':
                            case 'heat':
                                temp = attributes.heatingSetpoint;
                                break;
                            default:
                                // This should only refer to auto
                                // Choose closest target as single target
                                let high = attributes.coolingSetpoint;
                                let low = attributes.heatingSetpoint;
                                let cur = attributes.temperature;
                                temp = Math.abs(high - cur) < Math.abs(cur - low) ? high : low;
                                break;
                        }
                        if (!temp) {
                            callback('Unknown');
                        } else {
                            callback(null, that.myUtils.tempConversion(that.temperature_unit, temp));
                        }
                    })
                    .on('set', (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === 'C') {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        // Set the appropriate temperature unit based on the mode
                        switch (attributes.thermostatMode) {
                            case 'cool':
                                that.client.runCommand(callback, devData.deviceid, 'setCoolingSetpoint', {
                                    value1: temp
                                });
                                attributes.coolingSetpoint = temp;
                                break;
                            case 'emergency heat':
                            case 'heat':
                                that.client.runCommand(callback, devData.deviceid, 'setHeatingSetpoint', {
                                    value1: temp
                                });
                                attributes.heatingSetpoint = temp;
                                break;
                            default:
                                // This should only refer to auto
                                // Choose closest target as single target
                                let high = attributes.coolingSetpoint;
                                let low = attributes.heatingSetpoint;
                                let cur = attributes.temperature;
                                let isHighTemp = Math.abs(high - cur) < Math.abs(cur - low);
                                if (isHighTemp) {
                                    that.client.runCommand(callback, devData.deviceid, 'setCoolingSetpoint', {
                                        value1: temp
                                    });
                                } else {
                                    that.client.runCommand(null, devData.deviceid, 'setHeatingSetpoint', {
                                        value1: temp
                                    });
                                }
                                break;
                        }
                    });
                that.platform.addAttributeUsage('thermostatMode', devData.deviceid, thisCharacteristic);
                that.platform.addAttributeUsage('coolingSetpoint', devData.deviceid, thisCharacteristic);
                that.platform.addAttributeUsage('heatingSetpoint', devData.deviceid, thisCharacteristic);
                that.platform.addAttributeUsage('temperature', devData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.TemperatureDisplayUnits)
                    .on('get', (callback) => {
                        if (that.temperature_unit === 'C') {
                            callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS);
                        } else {
                            callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
                        }
                    });
                // that.platform.addAttributeUsage("temperature_unit", "platform", thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.HeatingThresholdTemperature)
                    .on('get', (callback) => {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, attributes.heatingSetpoint));
                    })
                    .on('set', (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === 'C') {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        that.client.runCommand(callback, devData.deviceid, 'setHeatingSetpoint', {
                            value1: temp
                        });
                        attributes.heatingSetpoint = temp;
                    });
                that.platform.addAttributeUsage('heatingSetpoint', devData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CoolingThresholdTemperature)
                    .on('get', (callback) => {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, attributes.coolingSetpoint));
                    })
                    .on('set', (value, callback) => {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === 'C') {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        that.client.runCommand(callback, devData.deviceid, 'setCoolingSetpoint', {
                            value1: temp
                        });
                        attributes.coolingSetpoint = temp;
                    });
                that.platform.addAttributeUsage('coolingSetpoint', devData.deviceid, thisCharacteristic);
            }
            // Alarm System Control/Status
            if (attributes['alarmSystemStatus'] !== undefined) {
                deviceGroups.push('alarm')
                thisCharacteristic = accessory.getOrAddService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .on('get', (callback) => {
                        // that.log('alarm1: ' + attributes.alarmSystemStatus + ' | ' + that.myUtils.convertAlarmState(attributes.alarmSystemStatus, true, Characteristic));
                        callback(null, that.myUtils.convertAlarmState(attributes.alarmSystemStatus, true, Characteristic));
                    });
                that.platform.addAttributeUsage('alarmSystemStatus', devData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .on('get', (callback) => {
                        // that.log('alarm2: ' + attributes.alarmSystemStatus + ' | ' + that.myUtils.convertAlarmState(attributes.alarmSystemStatus, true, Characteristic));
                        callback(null, that.myUtils.convertAlarmState(attributes.alarmSystemStatus.toLowerCase(), true, Characteristic));
                    })
                    .on('set', (value, callback) => {
                        // that.log('setAlarm: ' + value + ' | ' + that.myUtils.convertAlarmState(value, false, Characteristic));
                        that.client.runCommand(callback, devData.deviceid, that.myUtils.convertAlarmState(value, false, Characteristic));
                        attributes.alarmSystemStatus = that.myUtils.convertAlarmState(value, false, Characteristic);
                    });
                that.platform.addAttributeUsage('alarmSystemStatus', devData.deviceid, thisCharacteristic);
            }

            // Sonos Speakers
            if (isSonos && !deviceGroups.length) {
                deviceGroups.push('speakers')
                if (capabilities['Audio Volume']) {
                    let sonosVolumeTimeout = null;
                    let lastVolumeWriteValue = null;

                    thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Volume)
                        .on('get', (callback) => {
                            that.log.debug("Reading sonos volume " + attributes.volume);
                            callback(null, parseInt(attributes.volume || 0));
                        })
                        .on('set', (value, callback) => {
                            if (value > 0 && value !== lastVolumeWriteValue) {
                                lastVolumeWriteValue = value;
                                that.log.debug("Existing volume: " + attributes.volume + ", set to " + value);

                                // Smooth continuous updates to make more responsive
                                sonosVolumeTimeout = clearAndSetTimeout(sonosVolumeTimeout, () => {
                                    that.log.debug("Existing volume: " + attributes.volume + ", set to " + lastVolumeWriteValue);

                                    that.client.runCommand(callback, devData.deviceid, 'setVolume', {
                                        value1: lastVolumeWriteValue
                                    });
                                }, 1000);
                            }
                        });

                    that.platform.addAttributeUsage('volume', devData.deviceid, thisCharacteristic);
                }

                if (capabilities['Audio Mute']) {
                    thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Mute)
                        .on('get', (callback) => {
                            callback(null, attributes.mute === 'muted');
                        })
                        .on('set', (value, callback) => {
                            if (value === 'muted') {
                                that.client.runCommand(callback, devData.deviceid, 'mute');
                            } else {
                                that.client.runCommand(callback, devData.deviceid, 'unmute');
                            }
                        });
                    that.platform.addAttributeUsage('mute', devData.deviceid, thisCharacteristic);
                }
            }
            accessory.context.deviceGroups = deviceGroups;
            console.log(deviceGroups)
        }

        return that.loadData(accessory, devData) || accessory;
        // .then((b) => {
        //     accessory = b;
        //     return accessory;
        // })
        // .catch((err) => {
        //     return accessory;
        // })
        // });
    }

    loadData(accessory, deviceData) {
        let that = this;
        // return new Promise((resolve, reject) => {
        if (deviceData !== undefined) {
            this.log.debug('Setting device data from existing data');
            accessory.context.deviceData = deviceData;
            for (let i = 0; i < accessory.services.length; i++) {
                for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
                    accessory.services[i].characteristics[j].getValue();
                }
            }
            return accessory;
        } else {
            this.log.debug('Fetching Device Data');
            this.client.getDevice(accessory.deviceid)
                .then((data) => {
                    if (data === undefined) {
                        return accessory;
                    }
                    accessory.device = data;
                    for (let i = 0; i < accessory.services.length; i++) {
                        for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
                            accessory.services[i].characteristics[j].getValue();
                        }
                    }
                    return accessory;
                })
                .catch((err) => {
                    that.log.error('Failed to get Device Data for ' + accessory.deviceid, err);
                    return accessory;
                });
        }
        // });
    }

    getAccessoryKey(accessory) {
        const context = accessory.context || accessory;
        return `${context.object_type}/${context.object_id}`;
    }

    get(device) {
        const key = this.getAccessoryKey(device);
        return this._accessories[key];
    }

    ignore(device) {
        const key = this.getAccessoryKey(device);
        if (this._ignored[key]) {
            return false;
        }

        this._ignored[key] = device;
        return true;
    }

    add(accessory) {
        const key = this.getAccessoryKey(accessory);
        return (this._accessories[key] = accessory);
    }

    remove(accessory) {
        const key = this.getAccessoryKey(accessory);
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
        return (
            this.getAccessoryKey(accessory1) === this.getAccessoryKey(accessory2)
        );
    }
};

function clearAndSetTimeout(timeoutReference, fn, timeoutMs) {
    if (timeoutReference) {
        clearTimeout(timeoutReference);
    }
    return setTimeout(fn, timeoutMs);
}