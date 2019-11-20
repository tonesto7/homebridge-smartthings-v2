const {
    platformName,
    // platformDesc,
} = require("../Constants");

var Service, Characteristic;

module.exports = class MyUtils {
    constructor(accessories, srvc, char) {
        this.platform = accessories;
        this.log = accessories.log;
        this.accessories = accessories;
        this.client = accessories.client;
        this.myUtils = accessories.myUtils;
        Service = srvc;
        Characteristic = char;
        this.homebridge = accessories.homebridge;
    }



    fan(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.Fanv2)
            .getCharacteristic(Characteristic.Active)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', data.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("switch", data.deviceid, thisChar);

        if (data.attributes.level !== undefined || data.attributes.fanSpeed !== undefined) {
            thisChar = accessory
                .getOrAddService(Service.Fanv2)
                .getCharacteristic(Characteristic.RotationSpeed)
                .on("get", (callback) => {
                    callback(null, this.accessories.attributeStateTransform('switch', data.attributes.level));
                })
                .on("set", (value, callback) => {
                    if (value >= 0 && value <= 100) {
                        // clearTimeout(waitTimer);
                        // that.log('Sending Fan value of ' + value);
                        this.client.sendDeviceCommand(callback, data.deviceid, "setLevel", {
                            value1: parseInt(value)
                        });
                    }
                });
            this.accessories.storeCharacteristicItem("level", data.deviceid, thisChar);
        }
        return accessory;
    }

    garage_door(accessory, data) {
        let char = accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.TargetDoorState)
            .on("get", (callback) => {
                callback(null, this.attributeStateTransform('door', data.attributes.door, 'Target Door State'));
            })
            .on("set", (value, callback) => {
                if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                    this.client.sendDeviceCommand(callback, data.deviceid, "open");
                    accessory.context.deviceData.attributes.door = "opening";
                } else if (value === Characteristic.TargetDoorState.CLOSED || value === 1) {
                    this.client.sendDeviceCommand(callback, data.deviceid, "close");
                    accessory.context.deviceData.attributes.door = "closing";
                }
            });
        this.accessories.storeCharacteristicItem("door", data.deviceid, char);

        char = accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.CurrentDoorState)
            .on("get", (callback) => {
                callback(null, this.attributeStateTransform('door', data.attributes.door, 'Current Door State'));
            });
        this.accessories.storeCharacteristicItem("door", data.deviceid, char);
        accessory
            .getOrAddService(Service.GarageDoorOpener)
            .setCharacteristic(Characteristic.ObstructionDetected, false);

        return accessory;
    }

    light_bulb(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', data.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("switch", data.deviceid, thisChar);
        return accessory;
    }

    light_color(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Hue)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('hue', data.attributes.hue));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, "setHue", {
                    value1: Math.round(value / 3.6)
                });
            });
        this.accessories.storeCharacteristicItem("hue", data.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Saturation)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('saturation', data.attributes.saturation));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, "setSaturation", {
                    value1: value
                });
            });
        this.accessories.storeCharacteristicItem("saturation", data.deviceid, thisChar);
        return accessory;
    }

    light_level(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.Lightbulb)
            .getCharacteristic(Characteristic.Brightness)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('level', data.attributes.level));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, "setLevel", {
                    value1: value
                });
            });
        this.accessories.storeCharacteristicItem("level", data.deviceid, thisChar);
        return accessory;
    }

    lock(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockCurrentState)
            .on("get", (callback) => {
                callback(null, this.attributeStateTransform('lock', data.attributes.lock));
            });
        this.accessories.storeCharacteristicItem("lock", data.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockTargetState)
            .on("get", (callback) => {
                callback(null, this.attributeStateTransform('lock', data.attributes.lock));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, (value === 1 || value === true) ? "lock" : "unlock");
                accessory.context.deviceData.attributes.lock = (value === 1 || value === true) ? "locked" : "unlocked";
            });
        this.accessories.storeCharacteristicItem("lock", data.deviceid, thisChar);
        return accessory;
    }

    switch (accessory, data) {
        let char = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', data.attributes.switch));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("switch", data.deviceid, char);
        return accessory;
    }

    valve(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.InUse)
            .on("get", (callback) => {
                callback(null, this.attributeStateTransform('valve', data.attributes.valve));
            });
        this.accessories.storeCharacteristicItem("valve", data.deviceid, thisChar);

        //Defines the valve type (irrigation or generic)
        thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.ValveType)
            .on("get", (callback) => {
                callback(null, 0);
            });
        this.accessories.storeCharacteristicItem("valve", data.deviceid, thisChar);

        //Defines Valve State (opened/closed)
        thisChar = accessory
            .getOrAddService(Service.Valve)
            .getCharacteristic(Characteristic.Active)
            .on("get", (callback) => {
                callback(null, this.attributeStateTransform('valve', data.attributes.valve));
            })
            .on("set", (value, callback) => {
                this.client.sendDeviceCommand(callback, data.deviceid, (value ? "on" : "off"));
            });
        this.accessories.storeCharacteristicItem("valve", data.deviceid, thisChar);
        return accessory;
    }

    virtual_mode(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', data.attributes.switch));
            })
            .on("set", (value, callback) => {
                if (value && (data.attributes.switch === "off")) {
                    this.client.sendDeviceCommand(callback, data.deviceid, "mode", {
                        value1: accessory.name.toString()
                    });
                }
            });
        this.accessories.storeCharacteristicItem("switch", data.deviceid, thisChar);
        return accessory;
    }

    virtual_routine(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on("get", (callback) => {
                callback(null, this.accessories.attributeStateTransform('switch', data.attributes.switch));
            })
            .on("set", (value, callback) => {
                if (value && (data.attributes.switch === "off")) {
                    this.client.sendDeviceCommand(callback, data.deviceid, "routine", {
                        value1: accessory.name.toString()
                    });
                    setTimeout(() => {
                        console.log("routineOff...");
                        accessory
                            .getOrAddService(Service.Switch)
                            .getCharacteristic(Characteristic.On).updateValue(false);
                    }, 2000);
                }
            });
        this.accessories.storeCharacteristicItem("switch", data.deviceid, thisChar);
        return accessory;
    }

    window_shade(accessory, data) {
        let thisChar = accessory
            .getOrAddService(Service.WindowCovering)
            .getCharacteristic(Characteristic.TargetPosition)
            .on("get", (callback) => {
                callback(null, parseInt(data.attributes.level));
            })
            .on("set", (value, callback) => {
                if (data.commands.close && value === 0) {
                    // setLevel: 0, not responding on spring fashion blinds
                    this.client.sendDeviceCommand(callback, data.deviceid, "close");
                } else {
                    this.client.sendDeviceCommand(callback, data.deviceid, "setLevel", {
                        value1: value
                    });
                }
            });
        this.accessories.storeCharacteristicItem("level", data.deviceid, thisChar);

        thisChar = accessory
            .getOrAddService(Service.WindowCovering)
            .getCharacteristic(Characteristic.CurrentPosition)
            .on("get", (callback) => {
                callback(null, parseInt(data.attributes.level));
            });
        this.accessories.storeCharacteristicItem("level", data.deviceid, thisChar);
        accessory
            .getOrAddService(Service.WindowCovering)
            .setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);

        return accessory;
    }

};