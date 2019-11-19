const {
    platformName,
    // platformDesc,
} = require("../Constants");

var Service, Characteristic;

module.exports = class MyUtils {
    constructor(platform, srvc, char) {
        this.platform = platform;
        this.log = platform.log;
        Service = srvc;
        Characteristic = char;
        this.homebridge = platform.homebridge;
    }

    garage_door(accessory, data) {
        let chars = [];
        chars.push(accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.TargetDoorState)
            .on("get", callback => {
                if (data.attributes.door === "closed" || data.attributes.door === "closing") {
                    callback(null, Characteristic.TargetDoorState.CLOSED);
                } else if (
                    data.attributes.door === "open" ||
                    data.attributes.door === "opening"
                ) {
                    callback(null, Characteristic.TargetDoorState.OPEN);
                }
            })
            .on("set", (value, callback) => {
                if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
                    this.client.sendDeviceCommand(callback, data.deviceid, "open");
                    data.attributes.door = "opening";
                } else if (
                    value === Characteristic.TargetDoorState.CLOSED ||
                    value === 1
                ) {
                    this.client.sendDeviceCommand(callback, data.deviceid, "close");
                    data.attributes.door = "closing";
                }
            })
        );
        chars.push(accessory
            .getOrAddService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.CurrentDoorState)
            .on("get", callback => {
                switch (data.attributes.door) {
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
            }));
        return {
            accessory: accessory,
            chars: chars
        };
    }

};