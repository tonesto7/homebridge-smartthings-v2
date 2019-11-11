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

    PopulateAccessory(accessory, deviceData) {
        // console.log("AccessoryDevice: ", accessory, deviceData);
        accessory.deviceid = deviceData.deviceid;
        accessory.name = deviceData.name;
        accessory.state = {};
        accessory.device = deviceData;
        let that = this;

        //Removing excluded capabilities from config
        for (let i = 0; i < deviceData.excludedCapabilities.length; i++) {
            let excludedCapability = deviceData.excludedCapabilities[i];
            if (deviceData.capabilities[excludedCapability] !== undefined) {
                this.log.debug("Removing capability: " + excludedCapability + " for deviceData: " + deviceData.name);
                delete deviceData.capabilities[excludedCapability];
            }
        }

        this.getOrAddService.bind(accessory);


        // accessory.getOrAddService(that.CommunityTypes.SmartThingsDeviceIdService, "SmartThings Device ID", "smartthings_device_id").setCharacteristic(that.CommunityTypes.DeviceId, deviceData.deviceid);
        accessory.context.name = deviceData.name;
        accessory.context.deviceid = deviceData.deviceid;
        accessory.context.deviceData = deviceData;

        accessory.getOrAddService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Identify, (deviceData.capabilities['Switch'] !== undefined))
            .setCharacteristic(Characteristic.FirmwareRevision, deviceData.firmwareVersion)
            .setCharacteristic(Characteristic.Manufacturer, deviceData.manufacturerName)
            .setCharacteristic(Characteristic.Model, `${that.myUtils.toTitleCase(deviceData.modelName)}`)
            .setCharacteristic(Characteristic.Name, that.name)
            .setCharacteristic(Characteristic.SerialNumber, deviceData.serialNumber);
        accessory = this.initializeDeviceCharacteristics(accessory, deviceData);
        // console.log(accessory)
        return accessory;
    }

    getOrAddService(accsvc) {
        let s = this.getService(svc);
        if (!s) { s = this.addService(svc); }
        return s;
    };

    CreateFromCachedAccessory(accessory) {
        let deviceid = accessory.context.deviceid;
        let name = accessory.context.name;
        // console.log(accessory);
        this.log.debug("Initializing Cached Device " + deviceid);
        accessory.deviceid = deviceid;
        accessory.name = name;
        accessory.state = {};
        accessory = this.initializeDeviceCharacteristics(accessory, accessory.context.deviceData)
        return accessory
    }

    getServices() {
        return this.services;
    }

    initializeDeviceCharacteristics(accessory, deviceData) {
        // Get the Capabilities List
        for (let index in deviceData.capabilities) {
            if (knownCapabilities.indexOf(index) === -1 && this.platform.unknownCapabilities.indexOf(index) === -1) {
                this.platform.unknownCapabilities.push(index);
            }
        }
        let that = this;
        // return new Promise((resolve, reject) => {
        let deviceGroup = 'unknown';
        let deviceGroups = []

        let thisCharacteristic;
        // log(JSON.stringify(deviceData));
        let isMode = (deviceData.capabilities['Mode'] !== undefined);
        let isRoutine = (deviceData.capabilities['Routine'] !== undefined);
        let isFan = (deviceData.capabilities['Fan'] !== undefined || deviceData.capabilities['Fan Light'] !== undefined || deviceData.capabilities['FanLight'] !== undefined || deviceData.capabilities['Fan Speed'] || deviceData.commands.lowSpeed !== undefined);
        let isWindowShade = (deviceData.capabilities['WindowShade'] !== undefined || deviceData.capabilities['Window Shade'] !== undefined);
        let isLight = (deviceData.capabilities['LightBulb'] !== undefined || deviceData.capabilities['Light Bulb'] !== undefined || deviceData.capabilities['Bulb'] !== undefined || deviceData.capabilities['Fan Light'] !== undefined || deviceData.capabilities['FanLight'] !== undefined || deviceData.name.includes('light'));
        let isSpeaker = (deviceData.capabilities['Speaker'] !== undefined);
        let isSonos = (deviceData.manufacturerName === 'Sonos');

        if (deviceData && deviceData.capabilities) {
            if ((deviceData.capabilities['Switch Level'] !== undefined || deviceData.capabilities['SwitchLevel'] !== undefined) && !isSpeaker && !isFan && !isMode && !isRoutine) {
                if (isWindowShade || deviceData.commands.levelOpenClose || deviceData.commands.presetPosition) {
                    // This is a Window Shade
                    deviceGroup = 'window_shades';
                    deviceGroups.push('Window_Shades');
                    thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).getCharacteristic(Characteristic.TargetPosition)
                        .on('get', function(callback) {
                            callback(null, parseInt(deviceData.attributes.level));
                        })
                        .on('set', function(value, callback) {
                            if (deviceData.commands.close && value === 0) {
                                // setLevel: 0, not responding on spring fashion blinds
                                that.client.runCommand(callback, deviceData.deviceid, 'close');
                            } else {
                                that.client.runCommand(callback, deviceData.deviceid, 'setLevel', {
                                    value1: value
                                });
                            }
                        });
                    that.platform.addAttributeUsage('level', deviceData.deviceid, thisCharacteristic);
                    thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).getCharacteristic(Characteristic.CurrentPosition)
                        .on('get', function(callback) {
                            callback(null, parseInt(deviceData.attributes.level));
                        });
                    that.platform.addAttributeUsage('level', deviceData.deviceid, thisCharacteristic);

                    thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
                } else if (isLight === true || deviceData.commands.setLevel) {
                    deviceGroup = 'lights';
                    deviceGroups.push('Lights');
                    thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.On)
                        .on('get', function(callback) {
                            callback(null, deviceData.attributes.switch === 'on');
                        })
                        .on('set', function(value, callback) {
                            if (value) {
                                that.client.runCommand(callback, deviceData.deviceid, 'on');
                            } else {
                                that.client.runCommand(callback, deviceData.deviceid, 'off');
                            }
                        });
                    console.log('light')
                    that.platform.addAttributeUsage('switch', deviceData.deviceid, thisCharacteristic);
                    thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness)
                        .on('get', function(callback) {
                            callback(null, parseInt(deviceData.attributes.level));
                        })
                        .on('set', function(value, callback) {
                            that.client.runCommand(callback, deviceData.deviceid, 'setLevel', {
                                value1: value
                            });
                        });
                    that.platform.addAttributeUsage('level', deviceData.deviceid, thisCharacteristic);
                    if (deviceData.capabilities['Color Control'] || deviceData.capabilities['ColorControl']) {
                        thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.Hue)
                            .on('get', function(callback) {
                                callback(null, Math.round(deviceData.attributes.hue * 3.6));
                            })
                            .on('set', function(value, callback) {
                                that.client.runCommand(callback, deviceData.deviceid, 'setHue', {
                                    value1: Math.round(value / 3.6)
                                });
                            });
                        that.platform.addAttributeUsage('hue', deviceData.deviceid, thisCharacteristic);
                        thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.Saturation)
                            .on('get', function(callback) {
                                callback(null, parseInt(deviceData.attributes.saturation));
                            })
                            .on('set', function(value, callback) {
                                that.client.runCommand(callback, deviceData.deviceid, 'setSaturation', {
                                    value1: value
                                });
                            });
                        that.platform.addAttributeUsage('saturation', deviceData.deviceid, thisCharacteristic);
                    }
                }
            }
            // if (platformName === 'Hubitat' && isWindowShade) {
            //     deviceGroup = 'window_shades';
            //     thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).getCharacteristic(Characteristic.TargetPosition)
            //         .on('get', function(callback) {
            //             let curPos = parseInt(deviceData.attributes.position);
            //             if (curPos > 98) {
            //                 curPos = 100;
            //             } else if (curPos < 2) {
            //                 curPos = 0;
            //             }
            //             callback(null, curPos);
            //         })
            //         .on('set', function(value, callback) {
            //             that.log('setPosition(HE): ' + value);
            //             that.client.runCommand(callback, deviceData.deviceid, 'setPosition', {
            //                 value1: value
            //             });
            //         });
            //     that.platform.addAttributeUsage('position', deviceData.deviceid, thisCharacteristic);
            //     thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).getCharacteristic(Characteristic.CurrentPosition)
            //         .on('get', function(callback) {
            //             let curPos = parseInt(deviceData.attributes.position);
            //             if (curPos > 98) {
            //                 curPos = 100;
            //             } else if (curPos < 2) {
            //                 curPos = 0;
            //             }
            //             callback(null, curPos);
            //         });
            //     that.platform.addAttributeUsage('position', deviceData.deviceid, thisCharacteristic);

            //     thisCharacteristic = accessory.getOrAddService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
            // }
            if (deviceData.capabilities['Garage Door Control'] !== undefined || deviceData.capabilities['GarageDoorControl'] !== undefined) {
                deviceGroup = 'garage_doors';
                deviceGroups.push('Garage_Doors');
                thisCharacteristic = accessory.getOrAddService(Service.GarageDoorOpener).getCharacteristic(Characteristic.TargetDoorState)
                    .on('get', function(callback) {
                        if (deviceData.attributes.door === 'closed' || deviceData.attributes.door === 'closing') {
                            callback(null, Characteristic.TargetDoorState.CLOSED);
                        } else if (deviceData.attributes.door === 'open' || deviceData.attributes.door === 'opening') {
                            callback(null, Characteristic.TargetDoorState.OPEN);
                        }
                    })
                    .on('set', function(value, callback) {
                        if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                            that.client.runCommand(callback, deviceData.deviceid, 'open');
                            deviceData.attributes.door = 'opening';
                        } else if (value === Characteristic.TargetDoorState.CLOSED || value === 1) {
                            that.client.runCommand(callback, deviceData.deviceid, 'close');
                            deviceData.attributes.door = 'closing';
                        }
                    });
                that.platform.addAttributeUsage('door', deviceData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.GarageDoorOpener).getCharacteristic(Characteristic.CurrentDoorState)
                    .on('get', function(callback) {
                        switch (deviceData.attributes.door) {
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
                that.platform.addAttributeUsage('door', deviceData.deviceid, thisCharacteristic);
                accessory.getOrAddService(Service.GarageDoorOpener).setCharacteristic(Characteristic.ObstructionDetected, false);
            }
            if (deviceData.capabilities['Lock'] !== undefined && !deviceData.capabilities['Thermostat']) {
                deviceGroup = 'locks';
                deviceGroups.push('Locks');
                thisCharacteristic = accessory.getOrAddService(Service.LockMechanism).getCharacteristic(Characteristic.LockCurrentState)
                    .on('get', function(callback) {
                        switch (deviceData.attributes.lock) {
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
                that.platform.addAttributeUsage('lock', deviceData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.LockMechanism).getCharacteristic(Characteristic.LockTargetState)
                    .on('get', function(callback) {
                        switch (deviceData.attributes.lock) {
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
                    .on('set', function(value, callback) {
                        if (value === 1 || value === true) {
                            that.client.runCommand(callback, deviceData.deviceid, 'lock');
                            deviceData.attributes.lock = 'locked';
                        } else {
                            that.client.runCommand(callback, deviceData.deviceid, 'unlock');
                            deviceData.attributes.lock = 'unlocked';
                        }
                    });
                that.platform.addAttributeUsage('lock', deviceData.deviceid, thisCharacteristic);
            }
            if (deviceData.capabilities["Valve"] !== undefined) {
                that.log("valve: " + deviceData.attributes.valve);
                deviceGroup = "valve";
                deviceGroups.push('Valve');
                let valveType = (deviceData.capabilities['Irrigation'] !== undefined ? 0 : 0);

                //Gets the inUse Characteristic
                thisCharacteristic = accessory.getOrAddService(Service.Valve).getCharacteristic(Characteristic.InUse)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.valve === 'open' ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE);
                    });
                that.platform.addAttributeUsage('inUse', deviceData.deviceid, thisCharacteristic);

                //Defines the valve type (irrigation or generic)
                thisCharacteristic = accessory.getOrAddService(Service.Valve).getCharacteristic(Characteristic.ValveType)
                    .on('get', function(callback) {
                        callback(null, valveType);
                    });
                that.platform.addAttributeUsage('valveType', deviceData.deviceid, thisCharacteristic);

                //Defines Valve State (opened/closed)
                thisCharacteristic = accessory.getOrAddService(Service.Valve).getCharacteristic(Characteristic.Active)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.valve === 'open' ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE);
                    })
                    .on('set', function(value, callback) {
                        // if (deviceData.attributes.inStandby !== 'true') {
                        if (value) {
                            that.client.runCommand(callback, deviceData.deviceid, 'on');
                        } else {
                            that.client.runCommand(callback, deviceData.deviceid, 'off');
                        }
                        // }
                    });
                that.platform.addAttributeUsage('valve', deviceData.deviceid, thisCharacteristic);
            }

            //Defines Speaker Device
            if (isSpeaker === true) {
                deviceGroup = 'speakers';
                thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Volume)
                    .on('get', function(callback) {
                        callback(null, parseInt(deviceData.attributes.level || 0));
                    })
                    .on('set', function(value, callback) {
                        if (value > 0) {
                            that.client.runCommand(callback, deviceData.deviceid, 'setLevel', {
                                value1: value
                            });
                        }
                    });
                that.platform.addAttributeUsage('volume', deviceData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Mute)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.mute === 'muted');
                    })
                    .on('set', function(value, callback) {
                        if (value) {
                            that.client.runCommand(callback, deviceData.deviceid, 'mute');
                        } else {
                            that.client.runCommand(callback, deviceData.deviceid, 'unmute');
                        }
                    });
                that.platform.addAttributeUsage('mute', deviceData.deviceid, thisCharacteristic);
            }
            //Handles Standalone Fan with no levels
            if (isFan === true && (deviceData.capabilities['Fan Light'] !== undefined || deviceData.capabilities['FanLight'] !== undefined || deviceGroup === 'unknown')) {
                deviceGroup = 'fans';
                thisCharacteristic = accessory.getOrAddService(Service.Fanv2).getCharacteristic(Characteristic.Active)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.switch === 'on');
                    })
                    .on('set', function(value, callback) {
                        if (value) {
                            that.client.runCommand(callback, deviceData.deviceid, 'on');
                        } else {
                            that.client.runCommand(callback, deviceData.deviceid, 'off');
                        }
                    });
                that.platform.addAttributeUsage('switch', deviceData.deviceid, thisCharacteristic);

                if (deviceData.attributes.level !== undefined || deviceData.attributes.fanSpeed !== undefined) {
                    // let fanLvl = deviceData.attributes.fanSpeed ? that.myUtils.fanSpeedConversionInt(deviceData.attributes.fanSpeed, (deviceData.commands['medHighSpeed'] !== undefined)) : parseInt(deviceData.attributes.level);
                    let fanLvl = parseInt(deviceData.attributes.level);
                    // that.log("Fan with (" + deviceData.attributes.fanSpeed ? "fanSpeed" : "level" + ') | value: ' + fanLvl);
                    that.log("Fan with level at " + fanLvl);
                    // let waitTimer;
                    thisCharacteristic = accessory.getOrAddService(Service.Fanv2).getCharacteristic(Characteristic.RotationSpeed)
                        .on('get', function(callback) {
                            callback(null, fanLvl);
                        })
                        .on('set', function(value, callback) {
                            if (value >= 0 && value <= 100) {

                                // clearTimeout(waitTimer);
                                // that.log('Sending Fan value of ' + value);
                                that.client.runCommand(callback, deviceData.deviceid, 'setLevel', {
                                    value1: parseInt(value)
                                });

                            }
                        });
                    that.platform.addAttributeUsage('level', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (isMode === true) {
                deviceGroup = 'mode';
                that.log('Mode: (' + that.name + ')');
                thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.switch === 'on');
                    })
                    .on('set', function(value, callback) {
                        if (value && deviceData.attributes.switch === 'off') {
                            that.client.runCommand(callback, deviceData.deviceid, 'mode', {
                                value1: that.name.toString()
                            });
                        }
                    });
                that.platform.addAttributeUsage('switch', deviceData.deviceid, thisCharacteristic);
            }
            if (isRoutine === true) {
                deviceGroup = 'routine';
                that.log('Routine: (' + that.name + ')');
                thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.switch === 'on');
                    })
                    .on('set', function(value, callback) {
                        if (value) {
                            that.client.runCommand(callback, deviceData.deviceid, 'routine', {
                                value1: that.name.toString()
                            });
                            setTimeout(
                                function() {
                                    console.log("routineOff...");
                                    accessory.getOrAddService(Service.Switch).setCharacteristic(Characteristic.On, false);
                                }, 2000);
                        }
                    });
                that.platform.addAttributeUsage('switch', deviceData.deviceid, thisCharacteristic);
            }
            if (deviceData.capabilities['Button'] !== undefined) {
                deviceGroup = 'button';
                that.log('Button: (' + that.name + ')');
                //Old Button Logic
                // thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                //     .on('get', function(callback) {
                //         callback(null, deviceData.attributes.switch === 'on');
                //     })
                //     .on('set', function(value, callback) {
                //         if (value && deviceData.attributes.switch === 'off') {
                //             that.client.runCommand(callback, deviceData.deviceid, 'button');
                //         }
                //     });
                // that.platform.addAttributeUsage('switch', deviceData.deviceid, thisCharacteristic);

                // New STATELESS BUTTON LOGIC (By @shnhrrsn)
                thisCharacteristic = accessory.getOrAddService(Service.StatelessProgrammableSwitch).getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                    .on('get', function(callback) {
                        // Reset value to force `change` to fire for repeated presses
                        this.value = -1;

                        switch (deviceData.attributes.button) {
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

                if (typeof deviceData.attributes.supportedButtonValues === 'string') {
                    for (const value of JSON.parse(deviceData.attributes.supportedButtonValues)) {
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
                                that.log('Button: (' + that.name + ') unsupported button value: ' + value);
                        }
                    }

                    thisCharacteristic.setProps({
                        validValues
                    });
                }

                // Turned on by default for Characteristic.ProgrammableSwitchEvent, required to emit `change`
                thisCharacteristic.eventOnlyCharacteristic = false;

                that.platform.addAttributeUsage('button', deviceData.deviceid, thisCharacteristic);
            }

            // This should catch the remaining switch devices that are specially defined
            if (deviceData.capabilities['Switch'] !== undefined && (deviceData.capabilities['Fan Light'] !== undefined || deviceData.capabilities['FanLight'] !== undefined || deviceGroup === 'unknown')) {
                //Handles Standalone Fan with no levels
                if (isLight === true) {
                    deviceGroup = 'light';
                    if (deviceData.capabilities['Fan Light'] || deviceData.capabilities['FanLight']) {
                        that.log('FanLight: ' + deviceData.name);
                    }
                    thisCharacteristic = accessory.getOrAddService(Service.Lightbulb).getCharacteristic(Characteristic.On)
                        .on('get', function(callback) {
                            callback(null, deviceData.attributes.switch === 'on');
                        })
                        .on('set', function(value, callback) {
                            if (value) {
                                that.client.runCommand(callback, deviceData.deviceid, 'on');
                            } else {
                                that.client.runCommand(callback, deviceData.deviceid, 'off');
                            }
                        });
                    that.platform.addAttributeUsage('switch', deviceData.deviceid, thisCharacteristic);
                } else {
                    deviceGroup = 'switch';
                    thisCharacteristic = accessory.getOrAddService(Service.Switch).getCharacteristic(Characteristic.On)
                        .on('get', function(callback) {
                            callback(null, deviceData.attributes.switch === 'on');
                        })
                        .on('set', function(value, callback) {
                            if (value) {
                                that.client.runCommand(callback, deviceData.deviceid, 'on');
                            } else {
                                that.client.runCommand(callback, deviceData.deviceid, 'off');
                            }
                        });
                    that.platform.addAttributeUsage('switch', deviceData.deviceid, thisCharacteristic);

                    // if (deviceData.capabilities['Energy Meter'] || deviceData.capabilities['EnergyMeter']) {
                    //     thisCharacteristic = accessory.getOrAddService(Service.Switch).addCharacteristic(this.CommunityTypes.Watts)
                    //         .on('get', function(callback) {
                    //             callback(null, Math.round(deviceData.attributes.power));
                    //         });
                    //     that.platform.addAttributeUsage('energy', deviceData.deviceid, thisCharacteristic);
                    // }
                }
            }
            // Smoke Detectors
            if ((deviceData.capabilities['Smoke Detector'] !== undefined || deviceData.capabilities['SmokeDetector'] !== undefined) && deviceData.attributes.smoke) {
                deviceGroup = 'detectors';
                thisCharacteristic = accessory.getOrAddService(Service.SmokeSensor).getCharacteristic(Characteristic.SmokeDetected)
                    .on('get', function(callback) {
                        if (deviceData.attributes.smoke === 'clear') {
                            callback(null, Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
                        } else {
                            callback(null, Characteristic.SmokeDetected.SMOKE_DETECTED);
                        }
                    });
                that.platform.addAttributeUsage('smoke', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] || deviceData.capabilities['TamperAlert']) {
                    thisCharacteristic = accessory.getOrAddService(Service.SmokeSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if ((deviceData.capabilities['Carbon Monoxide Detector'] !== undefined || deviceData.capabilities['CarbonMonoxideDetector'] !== undefined) && deviceData.attributes.carbonMonoxide) {
                deviceGroup = 'detectors';
                thisCharacteristic = accessory.getOrAddService(Service.CarbonMonoxideSensor).getCharacteristic(Characteristic.CarbonMonoxideDetected)
                    .on('get', function(callback) {
                        if (deviceData.attributes.carbonMonoxide === 'clear') {
                            callback(null, Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL);
                        } else {
                            callback(null, Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL);
                        }
                    });
                that.platform.addAttributeUsage('carbonMonoxide', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.CarbonMonoxideSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if ((deviceData.capabilities['Carbon Dioxide Measurement'] !== undefined || deviceData.capabilities['CarbonDioxideMeasurement'] !== undefined) && deviceData.attributes.carbonDioxideMeasurement) {
                deviceGroup = 'carbonDioxide';
                thisCharacteristic = accessory.getOrAddService(Service.CarbonDioxideSensor).getCharacteristic(Characteristic.CarbonDioxideDetected)
                    .on('get', function(callback) {
                        if (deviceData.attributes.carbonDioxideMeasurement < 2000) {
                            callback(null, Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
                        } else {
                            callback(null, Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL);
                        }
                    });
                that.platform.addAttributeUsage('carbonDioxide', deviceData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.CarbonDioxideSensor).getCharacteristic(Characteristic.CarbonDioxideLevel)
                    .on('get', function(callback) {
                        if (deviceData.attributes.carbonDioxideMeasurement >= 0) {
                            callback(null, deviceData.attributes.carbonDioxideMeasurement);
                        }
                    });
                that.platform.addAttributeUsage('carbonDioxideLevel', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.CarbonDioxideSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (deviceData.capabilities['Motion Sensor'] !== undefined || deviceData.capabilities['MotionSensor'] !== undefined) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
                thisCharacteristic = accessory.getOrAddService(Service.MotionSensor).getCharacteristic(Characteristic.MotionDetected)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.motion === 'active');
                    });
                that.platform.addAttributeUsage('motion', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.MotionSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (deviceData.capabilities['Water Sensor'] !== undefined || deviceData.capabilities['WaterSensor'] !== undefined) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
                thisCharacteristic = accessory.getOrAddService(Service.LeakSensor).getCharacteristic(Characteristic.LeakDetected)
                    .on('get', function(callback) {
                        let reply = Characteristic.LeakDetected.LEAK_DETECTED;
                        if (deviceData.attributes.water === 'dry') {
                            reply = Characteristic.LeakDetected.LEAK_NOT_DETECTED;
                        }
                        callback(null, reply);
                    });
                that.platform.addAttributeUsage('water', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.LeakSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (deviceData.capabilities['Presence Sensor'] !== undefined || deviceData.capabilities['PresenceSensor'] !== undefined) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
                thisCharacteristic = accessory.getOrAddService(Service.OccupancySensor).getCharacteristic(Characteristic.OccupancyDetected)
                    .on('get', function(callback) {
                        callback(null, deviceData.attributes.presence === 'present');
                    });
                that.platform.addAttributeUsage('presence', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.OccupancySensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (deviceData.capabilities['Relative Humidity Measurement'] !== undefined || deviceData.capabilities['RelativeHumidityMeasurement'] !== undefined) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
                thisCharacteristic = accessory.getOrAddService(Service.HumiditySensor).getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .on('get', function(callback) {
                        callback(null, Math.round(deviceData.attributes.humidity));
                    });
                that.platform.addAttributeUsage('humidity', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.HumiditySensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (deviceData.capabilities['Temperature Measurement'] !== undefined || deviceData.capabilities['TemperatureMeasurement'] !== undefined) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
                thisCharacteristic = accessory.getOrAddService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature)
                    .setProps({
                        minValue: parseFloat(-50),
                        maxValue: parseFloat(100)
                    })
                    .on('get', function(callback) {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, deviceData.attributes.temperature));
                    });
                that.platform.addAttributeUsage('temperature', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.TemperatureSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (deviceData.capabilities['Illuminance Measurement'] !== undefined || deviceData.capabilities['IlluminanceMeasurement'] !== undefined) {
                // console.log(deviceData);
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
                thisCharacteristic = accessory.getOrAddService(Service.LightSensor).getCharacteristic(Characteristic.CurrentAmbientLightLevel)
                    .on('get', function(callback) {
                        callback(null, Math.ceil(deviceData.attributes.illuminance));
                    });
                that.platform.addAttributeUsage('illuminance', deviceData.deviceid, thisCharacteristic);
            }
            if ((deviceData.capabilities['Contact Sensor'] !== undefined && deviceData.capabilities['Garage Door Control'] === undefined) || (deviceData.capabilities['ContactSensor'] !== undefined && deviceData.capabilities['GarageDoorControl'] === undefined)) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
                thisCharacteristic = accessory.getOrAddService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState)
                    .on('get', function(callback) {
                        if (deviceData.attributes.contact === 'closed') {
                            callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
                        } else {
                            callback(null, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
                        }
                    });
                that.platform.addAttributeUsage('contact', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Tamper Alert'] !== undefined || deviceData.capabilities['TamperAlert'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.ContactSensor).getCharacteristic(Characteristic.StatusTampered)
                        .on('get', function(callback) {
                            callback(null, (deviceData.attributes.tamperAlert === 'detected') ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
                        });
                    that.platform.addAttributeUsage('tamper', deviceData.deviceid, thisCharacteristic);
                }
            }
            if (deviceData.capabilities['Battery'] !== undefined) {
                thisCharacteristic = accessory.getOrAddService(Service.BatteryService).getCharacteristic(Characteristic.BatteryLevel)
                    .on('get', function(callback) {
                        callback(null, Math.round(deviceData.attributes.battery));
                    });
                that.platform.addAttributeUsage('battery', deviceData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.BatteryService).getCharacteristic(Characteristic.StatusLowBattery)
                    .on('get', function(callback) {
                        let battStatus = (deviceData.attributes.battery < 20) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
                        callback(null, battStatus);
                    });
                accessory.getOrAddService(Service.BatteryService).setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGING);
                that.platform.addAttributeUsage('battery', deviceData.deviceid, thisCharacteristic);
            }
            if (deviceData.capabilities['Energy Meter'] !== undefined && !deviceData.capabilities.Switch && deviceGroup === 'unknown') {
                deviceGroup = 'EnergyMeter';
                thisCharacteristic = accessory.getOrAddService(Service.Outlet).addCharacteristic(this.CommunityTypes.KilowattHours)
                    .on('get', function(callback) {
                        callback(null, Math.round(deviceData.attributes.energy));
                    });
                that.platform.addAttributeUsage('energy', deviceData.deviceid, thisCharacteristic);
            }
            if (deviceData.capabilities['Power Meter'] !== undefined && !deviceData.capabilities.Switch && deviceGroup === 'unknown') {
                thisCharacteristic = accessory.getOrAddService(Service.Outlet).addCharacteristic(this.CommunityTypes.Watts)
                    .on('get', function(callback) {
                        callback(null, Math.round(deviceData.attributes.power));
                    });
                that.platform.addAttributeUsage('power', deviceData.deviceid, thisCharacteristic);
            }
            if (deviceData.capabilities['Acceleration Sensor'] !== undefined || deviceData.capabilities['AccelerationSensor'] !== undefined) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
            }
            if (deviceData.capabilities['Three Axis'] !== undefined || deviceData.capabilities['ThreeAxis'] !== undefined) {
                if (deviceGroup === 'unknown') {
                    deviceGroup = 'sensor';
                }
            }
            if (deviceData.capabilities['Air Quality Sensor'] !== undefined || deviceData.capabilities['AirQualitySensor'] !== undefined) {
                // deviceGroup = 'air_quality_sensor';
                // thisCharacteristic = accessory.getOrAddService(Service.AirQualitySensor).getCharacteristic(Characteristic.AirQuality)
                //     .on('get', function(callback) {
                //         switch (deviceData.attributes.airQuality) {
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
                // that.platform.addAttributeUsage('thermostatOperatingState', deviceData.deviceid, thisCharacteristic);
            }
            if (deviceData.capabilities['Thermostat'] !== undefined) {
                deviceGroup = 'thermostats';
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .on('get', function(callback) {
                        switch (deviceData.attributes.thermostatOperatingState) {
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
                that.platform.addAttributeUsage('thermostatOperatingState', deviceData.deviceid, thisCharacteristic);
                // Handle the Target State
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.TargetHeatingCoolingState)
                    .on('get', function(callback) {
                        switch (deviceData.attributes.thermostatMode) {
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
                    .on('set', function(value, callback) {
                        switch (value) {
                            case Characteristic.TargetHeatingCoolingState.COOL:
                                that.client.runCommand(callback, deviceData.deviceid, 'cool');
                                deviceData.attributes.thermostatMode = 'cool';
                                break;
                            case Characteristic.TargetHeatingCoolingState.HEAT:
                                that.client.runCommand(callback, deviceData.deviceid, 'heat');
                                deviceData.attributes.thermostatMode = 'heat';
                                break;
                            case Characteristic.TargetHeatingCoolingState.AUTO:
                                that.client.runCommand(callback, deviceData.deviceid, 'auto');
                                deviceData.attributes.thermostatMode = 'auto';
                                break;
                            case Characteristic.TargetHeatingCoolingState.OFF:
                                that.client.runCommand(callback, deviceData.deviceid, 'off');
                                deviceData.attributes.thermostatMode = 'off';
                                break;
                        }
                    });
                if (typeof deviceData.attributes.supportedThermostatModes === 'string') {
                    let validValuesArray = [];
                    if (deviceData.attributes.supportedThermostatModes.includes("off")) {
                        validValuesArray.push(0);
                    }
                    if ((deviceData.attributes.supportedThermostatModes.includes("heat")) || (deviceData.attributes.supportedThermostatModes.includes("emergency heat"))) {
                        validValuesArray.push(1);
                    }
                    if (deviceData.attributes.supportedThermostatModes.includes("cool")) {
                        validValuesArray.push(2);
                    }
                    if (deviceData.attributes.supportedThermostatModes.includes("auto")) {
                        validValuesArray.push(3);
                    }
                    let validValues = {
                        validValues: validValuesArray
                    };
                    thisCharacteristic.setProps(validValues);
                }
                that.platform.addAttributeUsage('thermostatMode', deviceData.deviceid, thisCharacteristic);
                if (deviceData.capabilities['Relative Humidity Measurement'] !== undefined) {
                    thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CurrentRelativeHumidity)
                        .on('get', function(callback) {
                            callback(null, parseInt(deviceData.attributes.humidity));
                        });
                    that.platform.addAttributeUsage('humidity', deviceData.deviceid, thisCharacteristic);
                }
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CurrentTemperature)
                    .on('get', function(callback) {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, deviceData.attributes.temperature));
                    });
                that.platform.addAttributeUsage('temperature', deviceData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.TargetTemperature)
                    .on('get', function(callback) {
                        let temp;
                        switch (deviceData.attributes.thermostatMode) {
                            case 'cool':
                                temp = deviceData.attributes.coolingSetpoint;
                                break;
                            case 'emergency heat':
                            case 'heat':
                                temp = deviceData.attributes.heatingSetpoint;
                                break;
                            default:
                                // This should only refer to auto
                                // Choose closest target as single target
                                let high = deviceData.attributes.coolingSetpoint;
                                let low = deviceData.attributes.heatingSetpoint;
                                let cur = deviceData.attributes.temperature;
                                temp = Math.abs(high - cur) < Math.abs(cur - low) ? high : low;
                                break;
                        }
                        if (!temp) {
                            callback('Unknown');
                        } else {
                            callback(null, that.myUtils.tempConversion(that.temperature_unit, temp));
                        }
                    })
                    .on('set', function(value, callback) {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === 'C') {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        // Set the appropriate temperature unit based on the mode
                        switch (deviceData.attributes.thermostatMode) {
                            case 'cool':
                                that.client.runCommand(callback, deviceData.deviceid, 'setCoolingSetpoint', {
                                    value1: temp
                                });
                                deviceData.attributes.coolingSetpoint = temp;
                                break;
                            case 'emergency heat':
                            case 'heat':
                                that.client.runCommand(callback, deviceData.deviceid, 'setHeatingSetpoint', {
                                    value1: temp
                                });
                                deviceData.attributes.heatingSetpoint = temp;
                                break;
                            default:
                                // This should only refer to auto
                                // Choose closest target as single target
                                let high = deviceData.attributes.coolingSetpoint;
                                let low = deviceData.attributes.heatingSetpoint;
                                let cur = deviceData.attributes.temperature;
                                let isHighTemp = Math.abs(high - cur) < Math.abs(cur - low);
                                if (isHighTemp) {
                                    that.client.runCommand(callback, deviceData.deviceid, 'setCoolingSetpoint', {
                                        value1: temp
                                    });
                                } else {
                                    that.client.runCommand(null, deviceData.deviceid, 'setHeatingSetpoint', {
                                        value1: temp
                                    });
                                }
                                break;
                        }
                    });
                that.platform.addAttributeUsage('thermostatMode', deviceData.deviceid, thisCharacteristic);
                that.platform.addAttributeUsage('coolingSetpoint', deviceData.deviceid, thisCharacteristic);
                that.platform.addAttributeUsage('heatingSetpoint', deviceData.deviceid, thisCharacteristic);
                that.platform.addAttributeUsage('temperature', deviceData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.TemperatureDisplayUnits)
                    .on('get', function(callback) {
                        if (that.temperature_unit === 'C') {
                            callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS);
                        } else {
                            callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
                        }
                    });
                // that.platform.addAttributeUsage("temperature_unit", "platform", thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.HeatingThresholdTemperature)
                    .on('get', function(callback) {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, deviceData.attributes.heatingSetpoint));
                    })
                    .on('set', function(value, callback) {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === 'C') {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        that.client.runCommand(callback, deviceData.deviceid, 'setHeatingSetpoint', {
                            value1: temp
                        });
                        deviceData.attributes.heatingSetpoint = temp;
                    });
                that.platform.addAttributeUsage('heatingSetpoint', deviceData.deviceid, thisCharacteristic);
                thisCharacteristic = accessory.getOrAddService(Service.Thermostat).getCharacteristic(Characteristic.CoolingThresholdTemperature)
                    .on('get', function(callback) {
                        callback(null, that.myUtils.tempConversion(that.temperature_unit, deviceData.attributes.coolingSetpoint));
                    })
                    .on('set', function(value, callback) {
                        // Convert the Celsius value to the appropriate unit for Smartthings
                        let temp = value;
                        if (that.temperature_unit === 'C') {
                            temp = value;
                        } else {
                            temp = value * 1.8 + 32;
                        }
                        that.client.runCommand(callback, deviceData.deviceid, 'setCoolingSetpoint', {
                            value1: temp
                        });
                        deviceData.attributes.coolingSetpoint = temp;
                    });
                that.platform.addAttributeUsage('coolingSetpoint', deviceData.deviceid, thisCharacteristic);
            }
            // Alarm System Control/Status
            if (deviceData.attributes['alarmSystemStatus'] !== undefined) {
                deviceGroup = 'alarm';
                thisCharacteristic = accessory.getOrAddService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .on('get', function(callback) {
                        // that.log('alarm1: ' + deviceData.attributes.alarmSystemStatus + ' | ' + that.myUtils.convertAlarmState(deviceData.attributes.alarmSystemStatus, true, Characteristic));
                        callback(null, that.myUtils.convertAlarmState(deviceData.attributes.alarmSystemStatus, true, Characteristic));
                    });
                that.platform.addAttributeUsage('alarmSystemStatus', deviceData.deviceid, thisCharacteristic);

                thisCharacteristic = accessory.getOrAddService(Service.SecuritySystem).getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .on('get', function(callback) {
                        // that.log('alarm2: ' + deviceData.attributes.alarmSystemStatus + ' | ' + that.myUtils.convertAlarmState(deviceData.attributes.alarmSystemStatus, true, Characteristic));
                        callback(null, that.myUtils.convertAlarmState(deviceData.attributes.alarmSystemStatus.toLowerCase(), true, Characteristic));
                    })
                    .on('set', function(value, callback) {
                        // that.log('setAlarm: ' + value + ' | ' + that.myUtils.convertAlarmState(value, false, Characteristic));
                        that.client.runCommand(callback, deviceData.deviceid, that.myUtils.convertAlarmState(value, false, Characteristic));
                        deviceData.attributes.alarmSystemStatus = that.myUtils.convertAlarmState(value, false, Characteristic);
                    });
                that.platform.addAttributeUsage('alarmSystemStatus', deviceData.deviceid, thisCharacteristic);
            }

            // Sonos Speakers
            if (isSonos && deviceGroup === 'unknown') {
                deviceGroup = 'speakers';

                if (deviceData.capabilities['Audio Volume']) {
                    let sonosVolumeTimeout = null;
                    let lastVolumeWriteValue = null;

                    thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Volume)
                        .on('get', function(callback) {
                            that.log.debug("Reading sonos volume " + deviceData.attributes.volume);
                            callback(null, parseInt(deviceData.attributes.volume || 0));
                        })
                        .on('set', function(value, callback) {
                            if (value > 0 && value !== lastVolumeWriteValue) {
                                lastVolumeWriteValue = value;
                                that.log.debug("Existing volume: " + deviceData.attributes.volume + ", set to " + value);

                                // Smooth continuous updates to make more responsive
                                sonosVolumeTimeout = clearAndSetTimeout(sonosVolumeTimeout, function() {
                                    that.log.debug("Existing volume: " + deviceData.attributes.volume + ", set to " + lastVolumeWriteValue);

                                    that.client.runCommand(callback, deviceData.deviceid, 'setVolume', {
                                        value1: lastVolumeWriteValue
                                    });
                                }, 1000);
                            }
                        });

                    that.platform.addAttributeUsage('volume', deviceData.deviceid, thisCharacteristic);
                }

                if (deviceData.capabilities['Audio Mute']) {
                    thisCharacteristic = accessory.getOrAddService(Service.Speaker).getCharacteristic(Characteristic.Mute)
                        .on('get', function(callback) {
                            callback(null, deviceData.attributes.mute === 'muted');
                        })
                        .on('set', function(value, callback) {
                            if (value === 'muted') {
                                that.client.runCommand(callback, deviceData.deviceid, 'mute');
                            } else {
                                that.client.runCommand(callback, deviceData.deviceid, 'unmute');
                            }
                        });
                    that.platform.addAttributeUsage('mute', deviceData.deviceid, thisCharacteristic);
                }
            }
            accessory.context.deviceGroups = deviceGroups;
            console.log(deviceGroups)
        }
        that.loadData(accessory, deviceData)
            .then((b) => {
                accessory = b;
                resolve(accessory);
            })
            .catch((err) => {
                resolve(accessory);
            })
            // return accessory
            // });
    }

    loadData(accessory, deviceData) {
        let that = this;
        return new Promise((resolve, reject) => {
            if (deviceData !== undefined) {
                accessory.device = deviceData;
                for (let i = 0; i < accessory.services.length; i++) {
                    for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
                        accessory.services[i].characteristics[j].getValue();
                    }
                }
            } else {
                this.log.debug('Fetching Device Data');
                this.client.getDevice(accessory.deviceid)
                    .then((data) => {
                        if (data === undefined) {
                            resolve(accessory);
                        }
                        accessory.device = data;
                        for (let i = 0; i < accessory.services.length; i++) {
                            for (let j = 0; j < accessory.services[i].characteristics.length; j++) {
                                accessory.services[i].characteristics[j].getValue();
                            }
                        }
                        resolve(accessory);
                    })
                    .catch((err) => {
                        that.log.error('Failed to get Device Data for ' + accessory.deviceid, err);
                        resolve(undefined);
                    });
            }
        });
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