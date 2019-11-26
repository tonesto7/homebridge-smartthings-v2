var Service, Characteristic;

module.exports = class MyUtils {
    constructor(accessories, srvc, char) {
        this.platform = accessories;
        this.log = accessories.log;
        this.accessories = accessories;
        this.client = accessories.client;
        this.myUtils = accessories.myUtils;
        this.CommunityTypes = accessories.CommunityTypes;
        Service = srvc;
        Characteristic = char;
        this.homebridge = accessories.homebridge;
    }

    alarm_system(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('alarmSystemStatus', devData.attributes.alarmSystemStatus));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] AlarmSystemStatus (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("alarmSystemStatus", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('alarmSystemStatus', devData.attributes.alarmSystemStatus.toLowerCase()));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, this.myUtils.convertAlarmState(value, false, Characteristic));
                accessory.context.deviceData.attributes.alarmSystemStatus = this.myUtils.convertAlarmState(value, false, Characteristic);
            });
        this.accessories.storeCharacteristicItem("alarmSystemStatus", devData.deviceid, thisChar);
        return accessory;
    }

    battery(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.BatteryService)
            .getCharacteristic(Characteristic.BatteryLevel)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('battery', devData.attributes.battery, 'Battery Level'));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Battery (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("battery", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.BatteryService)
            .getCharacteristic(Characteristic.StatusLowBattery)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('battery', devData.attributes.battery, 'Status Low Battery'));
            });
        accessory
            .getOrAddService(Service.BatteryService)
            .setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGING);
        this.accessories.storeCharacteristicItem("battery", devData.deviceid, thisChar);
        return accessory;
    }

    button(accessory, devData) {
        // New STATELESS BUTTON LOGIC (By @shnhrrsn)
        let thisChar = accessory
            .getOrAddService(Service.StatelessProgrammableSwitch)
            .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
            .on("get", (callback) => {
                // Reset value to force `change` to fire for repeated presses
                this.value = -1;
                callback(null, this.accessories.attributeStateTransform('button', devData.attributes.button));
            });

        const validValues = [];

        if (typeof devData.attributes.supportedButtonValues === "string") {
            for (const value of JSON.parse(devData.attributes.supportedButtonValues)) {
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
                        this.log("Button: (" + accessory.name + ") unsupported button value: " + value);
                }
            }

            thisChar.setProps({
                validValues
            });
        }

        // Turned on by default for Characteristic.ProgrammableSwitchEvent, required to emit `change`
        thisChar.eventOnlyCharacteristic = false;
        this.accessories.storeCharacteristicItem("button", devData.deviceid, thisChar);
        return accessory;
    }

    carbon_dioxide(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.CarbonDioxideSensor)
            .getCharacteristic(Characteristic.CarbonDioxideDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('carbonDioxideMeasurement', devData.attributes.carbonDioxideMeasurement, 'Carbon Dioxide Detected'));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Carbon Dioxide (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("carbonDioxideMeasurement", devData.deviceid, thisChar);
        thisChar = accessory
            .getOrAddService(Service.CarbonDioxideSensor)
            .getCharacteristic(Characteristic.CarbonDioxideLevel)
            .on("get", (callback) => {
                if (devData.attributes.carbonDioxideMeasurement >= 0) {
                    callback(null, devData.attributes.carbonDioxideMeasurement);
                }
            });
        this.accessories.storeCharacteristicItem("carbonDioxideMeasurement", devData.deviceid, thisChar);
        if (devData.capabilities['Tamper Alert']) {
            thisChar = accessory
                .getOrAddService(Service.CarbonDioxideSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    carbon_monoxide(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.CarbonMonoxideSensor)
            .getCharacteristic(Characteristic.CarbonMonoxideDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('carbonMonoxide', devData.attributes.carbonMonoxide));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Carbon Monoxide (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("carbonMonoxide", devData.deviceid, thisChar);
        if (devData.capabilities["Tamper Alert"]) {
            thisChar = accessory
                .getOrAddService(Service.CarbonMonoxideSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    contact_sensor(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.ContactSensor)
            .getCharacteristic(Characteristic.ContactSensorState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('contact', devData.attributes.contact));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Contact (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("contact", devData.deviceid, thisChar);
        if (devData.capabilities["Tamper Alert"]) {
            thisChar = accessory
                .getOrAddService(Service.ContactSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    energy_meter(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Outlet)
            .addCharacteristic(this.CommunityTypes.KilowattHours)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('energy', devData.attributes.energy));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Energy (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("energy", devData.deviceid, thisChar);
        return accessory;
    }

    fan(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Fanv2)
            .getCharacteristic(Characteristic.Active)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', devData.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("switch", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Fanv2)
            .getCharacteristic(Characteristic.CurrentFanState)
            .on("get", (callback) => {
                let curState = (devData.attributes.switch === "off") ? Characteristic.CurrentFanState.IDLE : Characteristic.CurrentFanState.BLOWING_AIR;
                callback(null, curState);
            });
        this.accessories.storeCharacteristicItem("switch", devData.deviceid, thisChar);

        if (devData.attributes.level || devData.attributes.fanSpeed) {
            let spdAttr = devData.attributes.fanSpeed ? 'fanSpeed' : 'level';
            thisChar = accessory
                .getOrAddService(Service.Fanv2)
                .getCharacteristic(Characteristic.RotationSpeed)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform(spdAttr, devData.attributes[spdAttr]));
                })
                .on("set", (value, callback) => {
                    if (value >= 0 && value <= 100) {
                        // that.log('Sending Fan value of ' + value);
                        this.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                            value1: parseInt(value)
                        });
                    }
                });
            this.accessories.storeCharacteristicItem(spdAttr, devData.deviceid, thisChar);
        }
        return accessory;
    }

    garage_door(accessory, devData) {
        let char = accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.TargetDoorState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('door', devData.attributes.door, 'Target Door State'));
            })
            .on("set", (value, callback) => {
                if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                    this.client.sendDeviceCommand(callback, devData.deviceid, "open");
                    accessory.context.deviceData.attributes.door = "opening";
                } else if (value === Characteristic.TargetDoorState.CLOSED || value === 1) {
                    this.client.sendDeviceCommand(callback, devData.deviceid, "close");
                    accessory.context.deviceData.attributes.door = "closing";
                }
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Door (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("door", devData.deviceid, char);

        char = accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.CurrentDoorState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('door', devData.attributes.door, 'Current Door State'));
            });
        this.accessories.storeCharacteristicItem("door", devData.deviceid, char);
        accessory
            .getOrAddService(Service.GarageDoorOpener)
            .setCharacteristic(Characteristic.ObstructionDetected, false);

        return accessory;
    }

    humidity_sensor(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.HumiditySensor)
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('humidity', devData.attributes.humidity));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Humidity (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("humidity", devData.deviceid, thisChar);
        if (devData.capabilities['Tamper Alert']) {
            thisChar = accessory
                .getOrAddService(Service.HumiditySensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    illuminance_sensor(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.LightSensor)
            .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('illuminance', devData.attributes.illuminance));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Illuminance (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("illuminance", devData.deviceid, thisChar);
        return accessory;
    }

    light_bulb(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', devData.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Bulb (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("switch", devData.deviceid, thisChar);
        return accessory;
    }

    light_color(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Hue)
            .setProps({
                minValue: 1,
                maxValue: 30000
            })
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('hue', devData.attributes.hue));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, "setHue", {
                    value1: Math.round(value / 3.6)
                });
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Hue (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("hue", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Saturation)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('saturation', devData.attributes.saturation));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, "setSaturation", {
                    value1: value
                });
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Saturation (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("saturation", devData.deviceid, thisChar);

        if (devData.attributes.colorTemperature) {
            thisChar = accessory
                .getOrAddService(Service.Lightbulb)
                .getCharacteristic(Characteristic.ColorTemperature)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('colorTemperature', devData.attributes.colorTemperature));
                })
                .on("set", (value, callback) => {
                    this.client.sendDeviceCommand(callback, devData.deviceid, "setColorTemperature", {
                        value1: value
                    });
                })
                .on("change", (obj) => {
                    this.log(`[CHARACTERISTIC CHANGE] ColorTemperature (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
                });
            this.accessories.storeCharacteristicItem("colorTemperature", devData.deviceid, thisChar);
        }
        return accessory;
    }

    light_level(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Brightness)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('level', devData.attributes.level));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                    value1: value
                });
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Level (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("level", devData.deviceid, thisChar);
        return accessory;
    }

    lock(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockCurrentState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('lock', devData.attributes.lock));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Lock (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("lock", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockTargetState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('lock', devData.attributes.lock));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, (value === 1 || value === true) ? "lock" : "unlock");
                accessory.context.deviceData.attributes.lock = (value === 1 || value === true) ? "locked" : "unlocked";
            });
        this.accessories.storeCharacteristicItem("lock", devData.deviceid, thisChar);
        return accessory;
    }

    motion_sensor(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.MotionSensor)
            .getCharacteristic(Characteristic.MotionDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('motion', devData.attributes.motion));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Motion (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("motion", devData.deviceid, thisChar);
        if (devData.capabilities['Tamper Alert']) {
            thisChar = accessory
                .getOrAddService(Service.MotionSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    power_meter(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Outlet)
            .addCharacteristic(this.CommunityTypes.Watts)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('power', devData.attributes.power));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Power (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("power", devData.deviceid, thisChar);
        return accessory;
    }

    presence_sensor(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.OccupancySensor)
            .getCharacteristic(Characteristic.OccupancyDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('presence', devData.attributes.presence));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Presence (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("presence", devData.deviceid, thisChar);
        if (devData.capabilities['Tamper Alert']) {
            thisChar = accessory
                .getOrAddService(Service.OccupancySensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    smoke_detector(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.SmokeSensor)
            .getCharacteristic(Characteristic.SmokeDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('smoke', devData.attributes.smoke));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Smoke (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("smoke", devData.deviceid, thisChar);
        if (devData.capabilities["Tamper Alert"]) {
            thisChar = accessory
                .getOrAddService(Service.SmokeSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    sonos_speaker(accessory, devData) {
        let thisChar;
        if (devData.capabilities["Audio Volume"]) {
            let sonosVolumeTimeout = null;
            let lastVolumeWriteValue = null;

            thisChar = accessory
                .getOrAddService(Service.Speaker)
                .getCharacteristic(Characteristic.Volume)
                .on("get", (callback) => {
                    this.log.debug("Reading sonos volume " + devData.attributes.volume);
                    callback(null, this.accessories.attributeStateTransform('volume', devData.attributes.volume));
                })
                .on("set", (value, callback) => {
                    if (value > 0 && value !== lastVolumeWriteValue) {
                        lastVolumeWriteValue = value;
                        this.log.debug(`Existing volume: ${devData.attributes.volume}, set to ${value}`);

                        // Smooth continuous updates to make more responsive
                        sonosVolumeTimeout = this.accessories.clearAndSetTimeout(sonosVolumeTimeout, () => {
                            this.log.debug(`Existing volume: ${devData.attributes.volume}, set to ${lastVolumeWriteValue}`);
                            this.client.sendDeviceCommand(callback, devData.deviceid, "setVolume", {
                                value1: lastVolumeWriteValue
                            });
                        }, 1000);
                    }
                });

            this.accessories.storeCharacteristicItem("volume", devData.deviceid, thisChar);
        }

        if (devData.capabilities["Audio Mute"]) {
            thisChar = accessory
                .getOrAddService(Service.Speaker)
                .getCharacteristic(Characteristic.Mute)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('mute', devData.attributes.mute));
                })
                .on("set", (value, callback) => {
                    this.client.sendDeviceCommand(callback, devData.deviceid, (value === "muted") ? "mute" : "unmute");
                });
            this.accessories.storeCharacteristicItem("mute", devData.deviceid, thisChar);
        }
        return accessory;
    }

    speaker_device(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Speaker)
            .getCharacteristic(Characteristic.Volume)
            .on("get", (callback) => {
                callback(null, parseInt(devData.attributes.level || 0));
            })
            .on("set", (value, callback) => {
                if (value > 0) {
                    this.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                        value1: value
                    });
                }
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Volume (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("volume", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Speaker)
            .getCharacteristic(Characteristic.Mute)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('mute', devData.attributes.mute));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, (value === "muted") ? "mute" : "unmute");
            });
        this.accessories.storeCharacteristicItem("mute", devData.deviceid, thisChar);
        return accessory;
    }

    switch_device(accessory, devData) {
        let char = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', devData.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Switch (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("switch", devData.deviceid, char);
        return accessory;
    }

    temperature_sensor(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 200
            })
            .on("get", (callback) => {
                callback(null, this.myUtils.tempConversionFrom_F(devData.attributes.temperature));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Temperature (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("temperature", devData.deviceid, thisChar);
        if (devData.capabilities["Tamper Alert"]) {
            thisChar = accessory
                .getOrAddService(Service.TemperatureSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    thermostat(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('thermostatOperatingState', devData.attributes.thermostatOperatingState));
            });
        this.accessories.storeCharacteristicItem("thermostatOperatingState", devData.deviceid, thisChar);
        // Handle the Target State
        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('thermostatMode', devData.attributes.thermostatMode));
            })
            .on("set", (value, callback) => {
                switch (value) {
                    case Characteristic.TargetHeatingCoolingState.COOL:
                        this.client.sendDeviceCommand(callback, devData.deviceid, "cool");
                        accessory.context.deviceData.attributes.thermostatMode = "cool";
                        break;
                    case Characteristic.TargetHeatingCoolingState.HEAT:
                        this.client.sendDeviceCommand(callback, devData.deviceid, "heat");
                        accessory.context.deviceData.attributes.thermostatMode = "heat";
                        break;
                    case Characteristic.TargetHeatingCoolingState.AUTO:
                        this.client.sendDeviceCommand(callback, devData.deviceid, "auto");
                        accessory.context.deviceData.attributes.thermostatMode = "auto";
                        break;
                    case Characteristic.TargetHeatingCoolingState.OFF:
                        this.client.sendDeviceCommand(callback, devData.deviceid, "off");
                        accessory.context.deviceData.attributes.thermostatMode = "off";
                        break;
                }
            });
        if (typeof devData.attributes.supportedThermostatModes === "string") {
            let validValuesArray = [];
            if (devData.attributes.supportedThermostatModes.includes("off")) {
                validValuesArray.push(0);
            }
            if (devData.attributes.supportedThermostatModes.includes("heat") || devData.attributes.supportedThermostatModes.includes("emergency heat")) {
                validValuesArray.push(1);
            }
            if (devData.attributes.supportedThermostatModes.includes("cool")) {
                validValuesArray.push(2);
            }
            if (devData.attributes.supportedThermostatModes.includes("auto")) {
                validValuesArray.push(3);
            }
            thisChar.setProps({
                validValues: validValuesArray
            });
        }
        this.accessories.storeCharacteristicItem("thermostatMode", devData.deviceid, thisChar);

        if (devData.capabilities["Relative Humidity Measurement"]) {
            thisChar = accessory
                .getOrAddService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .on("get", (callback) => {
                    callback(null, parseInt(devData.attributes.humidity));
                });
            this.accessories.storeCharacteristicItem("humidity", devData.deviceid, thisChar);
        }
        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on("get", (callback) => {
                callback(null, this.myUtils.tempConversionFrom_F(devData.attributes.temperature));
            });
        this.accessories.storeCharacteristicItem("temperature", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetTemperature)
            .on("get", (callback) => {
                let temp;
                switch (devData.attributes.thermostatMode) {
                    case 'cool':
                    case 'cooling':
                        temp = accessory.context.deviceData.coolingSetpoint;
                        break;
                    case 'emergency heat':
                    case 'heat':
                    case 'heating':
                        temp = accessory.context.deviceData.attributes.heatingSetpoint;
                        break;
                    default:
                        switch (accessory.context.deviceData.thermostatOperatingState) {
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
                if (!temp) {
                    callback("Unknown");
                } else {
                    callback(null, this.myUtils.tempConversionFrom_F(this.accessories.temperature_unit, temp));
                }
            })
            .on("set", (value, callback) => {
                // Convert the Celsius value to the appropriate unit for Smartthings
                let temp = this.myUtils.tempConversionFrom_C(value);
                // Set the appropriate temperature unit based on the mode
                switch (devData.attributes.thermostatMode) {
                    case "cool":
                        this.client.sendDeviceCommand(callback, devData.deviceid, "setCoolingSetpoint", {
                            value1: temp
                        });
                        accessory.context.deviceData.attributes.coolingSetpoint = temp;
                        accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                        break;
                    case "emergency heat":
                    case "heat":
                        this.client.sendDeviceCommand(callback, devData.deviceid, "setHeatingSetpoint", {
                            value1: temp
                        });
                        accessory.context.deviceData.attributes.heatingSetpoint = temp;
                        accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                        break;
                    default:
                        this.client.sendDeviceCommand(callback, devData.deviceid, "setThermostatSetpoint", {
                            value1: temp
                        });
                        accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                }
            });
        this.accessories.storeCharacteristicItem("coolingSetpoint", devData.deviceid, thisChar);
        this.accessories.storeCharacteristicItem("heatingSetpoint", devData.deviceid, thisChar);
        this.accessories.storeCharacteristicItem("thermostatSetpoint", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on("get", (callback) => {
                callback(null, (this.accessories.temperature_unit === 'C') ? Characteristic.TemperatureDisplayUnits.CELSIUS : Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
            });
        // this.accessories.storeCharacteristicItem("temperature_unit", "platform", thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .on("get", (callback) => {
                callback(null, this.myUtils.tempConversionFrom_F(devData.attributes.heatingSetpoint));
            })
            .on("set", (value, callback) => {
                // Convert the Celsius value to the appropriate unit for Smartthings
                let temp = this.myUtils.tempConversionFrom_C(value);
                this.client.sendDeviceCommand(callback, devData.deviceid, "setHeatingSetpoint", {
                    value1: temp
                });
                accessory.context.deviceData.attributes.heatingSetpoint = temp;
            });
        this.accessories.storeCharacteristicItem("heatingSetpoint", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Thermostat)
            .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .on("get", (callback) => {
                callback(null, this.myUtils.tempConversionFrom_F(devData.attributes.coolingSetpoint));
            })
            .on("set", (value, callback) => {
                // Convert the Celsius value to the appropriate unit for Smartthings
                let temp = this.myUtils.tempConversionFrom_C(value);
                this.client.sendDeviceCommand(callback, devData.deviceid, "setCoolingSetpoint", {
                    value1: temp
                });
                accessory.context.deviceData.attributes.coolingSetpoint = temp;
            });
        this.accessories.storeCharacteristicItem("coolingSetpoint", devData.deviceid, thisChar);
        return accessory;
    }

    valve(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.InUse)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('valve', devData.attributes.valve));
            });
        this.accessories.storeCharacteristicItem("valve", devData.deviceid, thisChar);

        //Defines the valve type (irrigation or generic)
        thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.ValveType)
            .on("get", (callback) => {
                callback(null, 0);
            });
        this.accessories.storeCharacteristicItem("valve", devData.deviceid, thisChar);

        //Defines Valve State (opened/closed)
        thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.Active)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('valve', devData.attributes.valve));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, devData.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("valve", devData.deviceid, thisChar);
        return accessory;
    }

    virtual_mode(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', devData.attributes.switch));
            })
            .on("set", (value, callback) => {
                if (value && (devData.attributes.switch === "off")) {
                    this.client.sendDeviceCommand(callback, devData.deviceid, "mode");
                }
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Mode (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("switch", devData.deviceid, thisChar);
        return accessory;
    }

    virtual_routine(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', devData.attributes.switch));
            })
            .on("set", (value, callback) => {
                if (value) {
                    this.client.sendDeviceCommand(callback, devData.deviceid, "routine");
                    setTimeout(() => {
                        console.log("routineOff...");
                        accessory.context.deviceData.attributes.switch = "off";
                        accessory
                            .getOrAddService(Service.Switch)
                            .getCharacteristic(Characteristic.On)
                            .updateValue(false);
                    }, 2000);
                }
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Routine (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("switch", devData.deviceid, thisChar);
        return accessory;
    }

    water_sensor(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.LeakSensor)
            .getCharacteristic(Characteristic.LeakDetected)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('water', devData.attributes.water));
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Water (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("water", devData.deviceid, thisChar);
        if (devData.capabilities['Tamper Alert']) {
            thisChar = accessory
                .getOrAddService(Service.LeakSensor)
                .getCharacteristic(Characteristic.StatusTampered)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('tamper', devData.attributes.tamper));
                });
            this.accessories.storeCharacteristicItem("tamper", devData.deviceid, thisChar);
        }
        return accessory;
    }

    window_shade(accessory, devData) {
        let thisChar = accessory
            .getOrAddService(Service.WindowCovering)
            .getCharacteristic(Characteristic.TargetPosition)
            .on("get", (callback) => {
                callback(null, parseInt(devData.attributes.level));
            })
            .on("set", (value, callback) => {
                if (devData.commands.close && value === 0) {
                    // setLevel: 0, not responding on spring fashion blinds
                    this.client.sendDeviceCommand(callback, devData.deviceid, "close");
                } else {
                    this.client.sendDeviceCommand(callback, devData.deviceid, "setLevel", {
                        value1: value
                    });
                }
            })
            .on("change", (obj) => {
                this.log(`[CHARACTERISTIC CHANGE] Shade (${accessory.displayName}) | LastUpdate: (${accessory.context.lastUpdate}) | NewValue: (${obj.newValue}) | OldValue: (${obj.oldValue})`);
            });
        this.accessories.storeCharacteristicItem("level", devData.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.WindowCovering)
            .getCharacteristic(Characteristic.CurrentPosition)
            .on("get", (callback) => {
                callback(null, parseInt(devData.attributes.level));
            });
        this.accessories.storeCharacteristicItem("level", devData.deviceid, thisChar);
        accessory
            .getOrAddService(Service.WindowCovering)
            .setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
        return accessory;
    }
};