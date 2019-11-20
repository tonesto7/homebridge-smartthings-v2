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