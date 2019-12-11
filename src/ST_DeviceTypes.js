// const debounce = require('debounce-promise');
var Service, Characteristic;

module.exports = class DeviceTypes {
    constructor(accessories, srvc, char) {
        this.platform = accessories;
        this.log = accessories.log;
        this.logConfig = accessories.logConfig;
        this.accessories = accessories;
        this.client = accessories.client;
        this.myUtils = accessories.myUtils;
        this.CommunityTypes = accessories.CommunityTypes;
        Service = srvc;
        Characteristic = char;
        this.homebridge = accessories.homebridge;
    }

    log_change(attr, char, acc, chgObj) {
        if (this.logConfig.debug === true)
            this.log.notice(`[CHARACTERISTIC (${char}) CHANGE] ${attr} (${acc.displayName}) | LastUpdate: (${acc.context.lastUpdate}) | NewValue: (${chgObj.newValue}) | OldValue: (${chgObj.oldValue})`);
    }

    log_get(attr, char, acc, val) {
        if (this.logConfig.debug === true)
            this.log.good(`[CHARACTERISTIC (${char}) GET] ${attr} (${acc.displayName}) | LastUpdate: (${acc.context.lastUpdate}) | Value: (${val})`);
    }

    log_set(attr, char, acc, val) {
        if (this.logConfig.debug === true)
            this.log.warn(`[CHARACTERISTIC (${char}) SET] ${attr} (${acc.displayName}) | LastUpdate: (${acc.context.lastUpdate}) | Value: (${val})`);
    }

    alarm_system(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .on("get", (callback) => {
                this.log_get('alarmSystemStatus', 'SecuritySystemCurrentState', accessory, accessory.context.deviceData.attributes.alarmSystemStatus);
                callback(null, this.accessories.attributeStateTransform('alarmSystemStatus', accessory.context.deviceData.attributes.alarmSystemStatus));
            });
        this.accessories.storeCharacteristicItem("alarmSystemStatus", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on("get", (callback) => {
                this.log_get('alarmSystemStatus', 'SecuritySystemTargetState', accessory, accessory.context.deviceData.attributes.alarmSystemStatus.toLowerCase());
                callback(null, this.accessories.attributeStateTransform('alarmSystemStatus', accessory.context.deviceData.attributes.alarmSystemStatus.toLowerCase()));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, this.myUtils.convertAlarmState(value, false, Characteristic));
                this.log_set('alarmSystemStatus', 'SecuritySystemTargetState', accessory, this.myUtils.convertAlarmState(value, false, Characteristic));
                accessory.context.deviceData.attributes.alarmSystemStatus = this.myUtils.convertAlarmState(value, false, Characteristic);
            });
        this.accessories.storeCharacteristicItem("alarmSystemStatus", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    battery(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.BatteryService)
            .getCharacteristic(Characteristic.BatteryLevel)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('battery', accessory.context.deviceData.attributes.battery, 'Battery Level'));
            });
        this.accessories.storeCharacteristicItem("battery", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.BatteryService)
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('battery', accessory.context.deviceData.attributes.battery, 'Status Low Battery'));
            });
        this.accessories.storeCharacteristicItem("battery", accessory.context.deviceData.deviceid, thisChar);
        thisChar = accessory
            .getOrAddService(Service.BatteryService)
            .getCharacteristic(Characteristic.ChargingState)
            .on("get", (callback) => {
                let status = Characteristic.ChargingState.NOT_CHARGING;
                if (accessory.hasAttribute('batteryStatus') && accessory.context.deviceData.attributes.batteryStatus === "USB Cable") {
                    status = Characteristic.ChargingState.CHARGING;
                }
                callback(null, status);
            });
        this.accessories.storeCharacteristicItem("battery", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    button(accessory) {
        // New STATELESS BUTTON LOGIC (By @shnhrrsn)
        let validValues = [];
        if (typeof accessory.context.deviceData.attributes.supportedButtonValues === "string") {
            for (const value of JSON.parse(accessory.context.deviceData.attributes.supportedButtonValues)) {
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
                        this.log.info("Button: (" + accessory.name + ") unsupported button value: " + value);
                }
            }
        }
        let thisChar = accessory
            .getOrAddService(Service.StatelessProgrammableSwitch)
            .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
            .setProps({
                validValues
            })
            .on("get", (callback) => {
                // Reset value to force `change` to fire for repeated presses
                this.value = -1;
                callback(null, this.accessories.attributeStateTransform('button', accessory.context.deviceData.attributes.button));
            });

        // Turned on by default for Characteristic.ProgrammableSwitchEvent, required to emit `change`
        thisChar.eventOnlyCharacteristic = false;
        this.accessories.storeCharacteristicItem("button", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    carbon_dioxide(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.CarbonDioxideSensor)
            .getCharacteristic(Characteristic.CarbonDioxideDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('carbonDioxideMeasurement', accessory.context.deviceData.attributes.carbonDioxideMeasurement, 'Carbon Dioxide Detected'));
            });
        this.accessories.storeCharacteristicItem("carbonDioxideMeasurement", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.CarbonDioxideSensor)
            .getCharacteristic(Characteristic.CarbonDioxideLevel)
            .on("get", (callback) => {
                if (accessory.context.deviceData.attributes.carbonDioxideMeasurement >= 0) {
                    callback(null, accessory.context.deviceData.attributes.carbonDioxideMeasurement);
                }
            });
        this.accessories.storeCharacteristicItem("carbonDioxideMeasurement", accessory.context.deviceData.deviceid, thisChar);

        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.CarbonDioxideSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    carbon_monoxide(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.CarbonMonoxideSensor)
            .getCharacteristic(Characteristic.CarbonMonoxideDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('carbonMonoxide', accessory.context.deviceData.attributes.carbonMonoxide));
            });
        this.accessories.storeCharacteristicItem("carbonMonoxide", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.CarbonMonoxideSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    contact_sensor(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.ContactSensor)
            .getCharacteristic(Characteristic.ContactSensorState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('contact', accessory.context.deviceData.attributes.contact));
            });
        this.accessories.storeCharacteristicItem("contact", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.ContactSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    energy_meter(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Outlet)
            .addCharacteristic(this.CommunityTypes.KilowattHours)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('energy', accessory.context.deviceData.attributes.energy));
            });
        this.accessories.storeCharacteristicItem("energy", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    fan(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Fanv2)
            .getCharacteristic(Characteristic.Active)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', accessory.context.deviceData.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("switch", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Fanv2)
            .getCharacteristic(Characteristic.CurrentFanState)
            .on("get", (callback) => {
                let curState = (accessory.context.deviceData.attributes.switch === "off") ? Characteristic.CurrentFanState.IDLE : Characteristic.CurrentFanState.BLOWING_AIR;
                callback(null, curState);
            });
        this.accessories.storeCharacteristicItem("switch", accessory.context.deviceData.deviceid, thisChar);

        let spdSteps = 1;
        if (accessory.hasDeviceFlag('fan_3_spd')) spdSteps = 33;
        if (accessory.hasDeviceFlag('fan_4_spd')) spdSteps = 25;
        if (accessory.hasAttribute('fanSpeed') && accessory.hasCommand('setFanSpeed')) {
            //Uses the fanSpeed Attribute and Command instead of level when avail
            thisChar = accessory
                .getOrAddService(Service.Fanv2)
                .getCharacteristic(Characteristic.RotationSpeed)
                .setProps({
                    minSteps: spdSteps
                })
                .on("get", (callback) => {
                    switch (parseInt(accessory.context.deviceData.attributes.fanSpeed)) {
                        case 0:
                            callback(null, 0);
                            break;
                        case 1:
                            callback(null, 33);
                            break;
                        case 2:
                            callback(null, 66);
                            break;
                        case 3:
                            callback(null, 100);
                            break;
                    }
                })
                .on("set", (value, callback) => {
                    let spd;
                    if (value >= 0 && value <= 100) {
                        if (value === 0) {
                            spd = 0;
                        } else if (value < 34) {
                            spd = 1;
                        } else if (value < 67) {
                            spd = 2;
                        } else {
                            spd = 3;
                        }
                        this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setFanSpeed", {
                            value1: spd
                        });
                        accessory.context.deviceData.attributes.fanSpeed = spd;
                    }
                });
            this.accessories.storeCharacteristicItem('fanSpeed', accessory.context.deviceData.deviceid, thisChar);
        } else if (accessory.hasAttribute('level')) {

            thisChar = accessory
                .getOrAddService(Service.Fanv2)
                .getCharacteristic(Characteristic.RotationSpeed)
                .setProps({
                    minSteps: spdSteps
                })
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform("level", accessory.context.deviceData.attributes.level));
                })
                .on("set", (value, callback) => {
                    if (value >= 0 && value <= 100) {
                        this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setLevel", {
                            value1: parseInt(value)
                        });
                        accessory.context.deviceData.attributes.level = value;
                    }
                });
            this.accessories.storeCharacteristicItem("level", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    garage_door(accessory) {
        let char = accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.TargetDoorState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('door', accessory.context.deviceData.attributes.door, 'Target Door State'));
            })
            .on("set", (value, callback) => {
                if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "open");
                    accessory.context.deviceData.attributes.door = "opening";
                } else if (value === Characteristic.TargetDoorState.CLOSED || value === 1) {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "close");
                    accessory.context.deviceData.attributes.door = "closing";
                }
            });
        this.accessories.storeCharacteristicItem("door", accessory.context.deviceData.deviceid, char);

        char = accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.CurrentDoorState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('door', accessory.context.deviceData.attributes.door, 'Current Door State'));
            });
        this.accessories.storeCharacteristicItem("door", accessory.context.deviceData.deviceid, char);
        accessory
            .getOrAddService(Service.GarageDoorOpener)
            .setCharacteristic(Characteristic.ObstructionDetected, false);

        return accessory;
    }

    humidity_sensor(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.HumiditySensor)
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('humidity', accessory.context.deviceData.attributes.humidity));
            });
        this.accessories.storeCharacteristicItem("humidity", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.HumiditySensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    illuminance_sensor(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.LightSensor)
            .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('illuminance', accessory.context.deviceData.attributes.illuminance));
            });
        this.accessories.storeCharacteristicItem("illuminance", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    light_bulb(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', accessory.context.deviceData.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("switch", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    light_color(accessory) {
        let thisChar;
        if (accessory.hasAttribute('hue')) {
            thisChar = accessory
                .getOrAddService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Hue)
                .setProps({
                    minValue: 1,
                    maxValue: 30000
                })
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('hue', accessory.context.deviceData.attributes.hue));
                })
                .on("set", (value, callback) => {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setHue", {
                        value1: Math.round(value / 3.6)
                    });
                });
            this.accessories.storeCharacteristicItem("hue", accessory.context.deviceData.deviceid, thisChar);
        }
        if (accessory.hasAttribute('saturation')) {
            thisChar = accessory
                .getOrAddService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Saturation)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('saturation', accessory.context.deviceData.attributes.saturation));
                })
                .on("set", (value, callback) => {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setSaturation", {
                        value1: value
                    });
                });
            this.accessories.storeCharacteristicItem("saturation", accessory.context.deviceData.deviceid, thisChar);
        }
        if (accessory.hasAttribute('colorTemperature')) {
            thisChar = accessory
                .getOrAddService(Service.Lightbulb)
                .getCharacteristic(Characteristic.ColorTemperature)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('colorTemperature', accessory.context.deviceData.attributes.colorTemperature));
                })
                .on("set", (value, callback) => {
                    let temp = this.myUtils.colorTempToK(value);
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setColorTemperature", {
                        value1: temp
                    });
                    accessory.context.deviceData.attributes.colorTemperature = temp;
                });
            this.accessories.storeCharacteristicItem("colorTemperature", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    light_level(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Brightness)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('level', accessory.context.deviceData.attributes.level));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setLevel", {
                    value1: value
                });
            });
        this.accessories.storeCharacteristicItem("level", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    lock(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockCurrentState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('lock', accessory.context.deviceData.attributes.lock));
            });
        this.accessories.storeCharacteristicItem("lock", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockTargetState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('lock', accessory.context.deviceData.attributes.lock));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, (value === 1 || value === true) ? "lock" : "unlock");
                accessory.context.deviceData.attributes.lock = (value === 1 || value === true) ? "locked" : "unlocked";
            });
        this.accessories.storeCharacteristicItem("lock", accessory.context.deviceData.deviceid, thisChar);

        let relockSeconds = accessory.context.deviceData.attributes.relockSeconds || 300;
        accessory.context.deviceData.attributes.relockSeconds = relockSeconds;
        thisChar = accessory
            .getOrAddService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockManagementAutoSecurityTimeout)
            .on("get", (callback) => {
                callback(null, relockSeconds);
            })
            .on("set", (value, callback) => {
                callback(null);
                accessory.context.deviceData.attributes.relockSeconds = value;
            });
        // this.accessories.storeCharacteristicItem("relockSeconds", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    motion_sensor(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.MotionSensor)
            .getCharacteristic(Characteristic.MotionDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('motion', accessory.context.deviceData.attributes.motion));
            });
        this.accessories.storeCharacteristicItem("motion", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.MotionSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    power_meter(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Outlet)
            .addCharacteristic(this.CommunityTypes.Watts)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('power', accessory.context.deviceData.attributes.power));
            });
        this.accessories.storeCharacteristicItem("power", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    presence_sensor(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.OccupancySensor)
            .getCharacteristic(Characteristic.OccupancyDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('presence', accessory.context.deviceData.attributes.presence));
            });
        this.accessories.storeCharacteristicItem("presence", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.OccupancySensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    smoke_detector(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.SmokeSensor)
            .getCharacteristic(Characteristic.SmokeDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('smoke', accessory.context.deviceData.attributes.smoke));
            });
        this.accessories.storeCharacteristicItem("smoke", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.SmokeSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    sonos_speaker(accessory) {
        let thisChar;
        if (accessory.hasCapability('Audio Volume')) {
            let sonosVolumeTimeout = null;
            let lastVolumeWriteValue = null;
            thisChar = accessory
                .getOrAddService(Service.Speaker)
                .getCharacteristic(Characteristic.Volume)
                .on("get", (callback) => {
                    this.log.debug("Reading sonos volume " + accessory.context.deviceData.attributes.volume);
                    callback(null, this.accessories.attributeStateTransform('volume', accessory.context.deviceData.attributes.volume));
                })
                .on("set", (value, callback) => {
                    if (value > 0 && value !== lastVolumeWriteValue) {
                        lastVolumeWriteValue = value;
                        this.log.debug(`Existing volume: ${accessory.context.deviceData.attributes.volume}, set to ${value}`);

                        // Smooth continuous updates to make more responsive
                        sonosVolumeTimeout = this.accessories.clearAndSetTimeout(sonosVolumeTimeout, () => {
                            this.log.debug(`Existing volume: ${accessory.context.deviceData.attributes.volume}, set to ${lastVolumeWriteValue}`);
                            this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setVolume", {
                                value1: lastVolumeWriteValue
                            });
                        }, 1000);
                    }
                });
            this.accessories.storeCharacteristicItem("volume", accessory.context.deviceData.deviceid, thisChar);
        }

        if (accessory.hasCapability('Audio Mute')) {
            thisChar = accessory
                .getOrAddService(Service.Speaker)
                .getCharacteristic(Characteristic.Mute)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('mute', accessory.context.deviceData.attributes.mute));
                })
                .on("set", (value, callback) => {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, (value === "muted") ? "mute" : "unmute");
                });
            this.accessories.storeCharacteristicItem("mute", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    speaker_device(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Speaker)
            .getCharacteristic(Characteristic.Volume)
            .on("get", (callback) => {
                callback(null, parseInt(accessory.context.deviceData.attributes.level || accessory.context.deviceData.attributes.volume || 0));
            })
            .on("set", (value, callback) => {
                if (value > 0) {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setLevel", {
                        value1: value
                    });
                }
            });
        this.accessories.storeCharacteristicItem("volume", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Speaker)
            .getCharacteristic(Characteristic.Mute)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('mute', accessory.context.deviceData.attributes.mute));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, (value === "muted") ? "mute" : "unmute");
            });
        this.accessories.storeCharacteristicItem("mute", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    switch_device(accessory) {
        let char = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', accessory.context.deviceData.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("switch", accessory.context.deviceData.deviceid, char);
        return accessory;
    }

    temperature_sensor(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 200
            })
            .on("get", (callback) => {
                callback(null, this.myUtils.tempConversion(accessory.context.deviceData.attributes.temperature));
            });
        this.accessories.storeCharacteristicItem("temperature", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.TemperatureSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    thermostat(accessory) {
        //TODO:  Still seeing an issue when setting mode from OFF to HEAT.  It's setting the temp to 40 but if I change to cool then back to heat it sets the correct value.
        let validModes = [];
        if (typeof accessory.context.deviceData.attributes.supportedThermostatModes === "string") {
            if (accessory.context.deviceData.attributes.supportedThermostatModes.includes("off")) {
                validModes.push(Characteristic.TargetHeatingCoolingState.OFF);
            }
            if (accessory.context.deviceData.attributes.supportedThermostatModes.includes("heat") || accessory.context.deviceData.attributes.supportedThermostatModes.includes("emergency heat")) {
                validModes.push(Characteristic.TargetHeatingCoolingState.HEAT);
            }
            if (accessory.context.deviceData.attributes.supportedThermostatModes.includes("cool")) {
                validModes.push(Characteristic.TargetHeatingCoolingState.COOL);
            }
            if (accessory.context.deviceData.attributes.supportedThermostatModes.includes("auto")) {
                validModes.push(Characteristic.TargetHeatingCoolingState.AUTO);
            }
        }

        let thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('thermostatOperatingState', accessory.context.deviceData.attributes.thermostatOperatingState));
            });
        this.accessories.storeCharacteristicItem("thermostatOperatingState", accessory.context.deviceData.deviceid, thisChar);

        // Handle the Target State
        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({
                validValues: validModes
            })
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('thermostatMode', accessory.context.deviceData.attributes.thermostatMode));
            })
            .on("set", (value, callback) => {
                let state;
                switch (value) {
                    case Characteristic.TargetHeatingCoolingState.COOL:
                        state = "cool";
                        break;
                    case Characteristic.TargetHeatingCoolingState.HEAT:
                        state = "heat";
                        break;
                    case Characteristic.TargetHeatingCoolingState.AUTO:
                        state = "auto";
                        break;
                    case Characteristic.TargetHeatingCoolingState.OFF:
                        state = "off";
                        break;
                }
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setThermostatMode", {
                    value1: state
                });
                accessory.context.deviceData.attributes.thermostatMode = state;
            });

        this.accessories.storeCharacteristicItem("thermostatMode", accessory.context.deviceData.deviceid, thisChar);

        if (accessory.hasCapability('Relative Humidity Measurement')) {
            thisChar = accessory
                .getOrAddService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .on("get", (callback) => {
                    callback(null, parseInt(accessory.context.deviceData.attributes.humidity));
                });
            this.accessories.storeCharacteristicItem("humidity", accessory.context.deviceData.deviceid, thisChar);
        }
        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: this.myUtils.thermostatTempConversion(40),
                maxValue: this.myUtils.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            })
            .on("get", (callback) => {
                callback(null, this.myUtils.thermostatTempConversion(accessory.context.deviceData.attributes.temperature));
            });
        this.accessories.storeCharacteristicItem("temperature", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: this.myUtils.thermostatTempConversion(40),
                maxValue: this.myUtils.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            })
            .on("get", (callback) => {
                let temp;
                switch (accessory.context.deviceData.attributes.thermostatMode) {
                    case 'cool':
                    case 'cooling':
                        temp = accessory.context.deviceData.attributes.coolingSetpoint;
                        break;
                    case 'emergency heat':
                    case 'heat':
                    case 'heating':
                        temp = accessory.context.deviceData.attributes.heatingSetpoint;
                        break;
                    default:
                        switch (accessory.context.deviceData.attributes.thermostatOperatingState) {
                            case 'cooling':
                            case 'cool':
                                temp = accessory.context.deviceData.attributes.coolingSetpoint;
                                break;
                            default:
                                temp = accessory.context.deviceData.attributes.heatingSetpoint;
                                break;
                        }
                        break;
                }
                callback(null, temp ? this.myUtils.thermostatTempConversion(temp) : "Unknown");
            })
            .on("set", (value, callback) => {
                // Convert the Celsius value to the appropriate unit for Smartthings
                let temp = this.myUtils.thermostatTempConversion(value, true);
                switch (accessory.context.deviceData.attributes.thermostatMode) {
                    case "cool":
                        this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setCoolingSetpoint", {
                            value1: temp
                        });
                        accessory.context.deviceData.attributes.coolingSetpoint = temp;
                        accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                        break;
                    case "emergency heat":
                    case "heat":
                        this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setHeatingSetpoint", {
                            value1: temp
                        });
                        accessory.context.deviceData.attributes.heatingSetpoint = temp;
                        accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                        break;
                    default:
                        this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setThermostatSetpoint", {
                            value1: temp
                        });
                        accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                }
            });
        this.accessories.storeCharacteristicItem("thermostatMode", accessory.context.deviceData.deviceid, thisChar);
        this.accessories.storeCharacteristicItem("coolingSetpoint", accessory.context.deviceData.deviceid, thisChar);
        this.accessories.storeCharacteristicItem("heatingSetpoint", accessory.context.deviceData.deviceid, thisChar);
        this.accessories.storeCharacteristicItem("thermostatSetpoint", accessory.context.deviceData.deviceid, thisChar);
        this.accessories.storeCharacteristicItem("temperature", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on("get", (callback) => {
                callback(null, (this.platform.getTempUnit() === 'F') ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS);
            });
        this.accessories.storeCharacteristicItem("temperature_unit", "platform", thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                minValue: this.myUtils.thermostatTempConversion(40),
                maxValue: this.myUtils.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            })
            .on("get", (callback) => {
                callback(null, this.myUtils.thermostatTempConversion(accessory.context.deviceData.attributes.heatingSetpoint));
            })
            .on("set", (value, callback) => {
                // Convert the Celsius value to the appropriate unit for Smartthings
                let temp = this.myUtils.thermostatTempConversion(value, true);
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setHeatingSetpoint", {
                    value1: temp
                });
                accessory.context.deviceData.attributes.heatingSetpoint = temp;
            });
        this.accessories.storeCharacteristicItem("heatingSetpoint", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .setProps({
                minValue: this.myUtils.thermostatTempConversion(40),
                maxValue: this.myUtils.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            })
            .on("get", (callback) => {
                callback(null, this.myUtils.thermostatTempConversion(accessory.context.deviceData.attributes.coolingSetpoint));
            })
            .on("set", (value, callback) => {
                // Convert the Celsius value to the appropriate unit for Smartthings
                let temp = this.myUtils.thermostatTempConversion(value, true);
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setCoolingSetpoint", {
                    value1: temp
                });
                accessory.context.deviceData.attributes.coolingSetpoint = temp;
            });
        this.accessories.storeCharacteristicItem("coolingSetpoint", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    valve(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.InUse)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('valve', accessory.context.deviceData.attributes.valve));
            });
        this.accessories.storeCharacteristicItem("valve", accessory.context.deviceData.deviceid, thisChar);

        //Defines Valve State (opened/closed)
        thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.Active)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('valve', accessory.context.deviceData.attributes.valve));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("valve", accessory.context.deviceData.deviceid, thisChar);

        //Defines the valve type (irrigation or generic)
        thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.ValveType)
            .on("get", (callback) => {
                callback(null, 0);
            });
        // this.accessories.storeCharacteristicItem("valve", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    virtual_mode(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', accessory.context.deviceData.attributes.switch));
            })
            .on("set", (value, callback) => {
                if (value && (accessory.context.deviceData.attributes.switch === "off")) {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "mode");
                }
            });
        this.accessories.storeCharacteristicItem("switch", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    virtual_routine(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', accessory.context.deviceData.attributes.switch));
            })
            .on("set", (value, callback) => {
                if (value) {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "routine");
                    setTimeout(() => {
                        console.log("routineOff...");
                        accessory.context.deviceData.attributes.switch = "off";
                        accessory
                            .getOrAddService(Service.Switch)
                            .getCharacteristic(Characteristic.On)
                            .updateValue(false);
                    }, 2000);
                }
            });
        this.accessories.storeCharacteristicItem("switch", accessory.context.deviceData.deviceid, thisChar);
        return accessory;
    }

    water_sensor(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.LeakSensor)
            .getCharacteristic(Characteristic.LeakDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('water', accessory.context.deviceData.attributes.water));
            });
        this.accessories.storeCharacteristicItem("water", accessory.context.deviceData.deviceid, thisChar);
        if (accessory.hasCapability('Tamper Alert')) {
            thisChar = accessory
                .getOrAddService(Service.LeakSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', accessory.context.deviceData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", accessory.context.deviceData.deviceid, thisChar);
        }
        return accessory;
    }

    window_shade(accessory) {
        let thisChar = accessory
            .getOrAddService(Service.WindowCovering)
            .getCharacteristic(Characteristic.TargetPosition)
            .on("get", (callback) => {
                callback(null, parseInt(accessory.context.deviceData.attributes.level));
            })
            .on("set", (value, callback) => {
                if (accessory.hasCommand('close') && value === 0) {
                    // setLevel: 0, not responding on spring fashion blinds
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "close");
                } else {
                    this.client.sendDeviceCommand(callback, accessory.context.deviceData.deviceid, "setLevel", {
                        value1: value
                    });
                }
            });
        this.accessories.storeCharacteristicItem("level", accessory.context.deviceData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.WindowCovering)
            .getCharacteristic(Characteristic.CurrentPosition)
            .on("get", (callback) => {
                callback(null, parseInt(accessory.context.deviceData.attributes.level));
            });
        this.accessories.storeCharacteristicItem("level", accessory.context.deviceData.deviceid, thisChar);
        accessory
            .getOrAddService(Service.WindowCovering)
            .setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
        return accessory;
    }
};