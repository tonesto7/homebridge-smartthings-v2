// const debounce = require('debounce-promise');
var Characteristic, accClass;

module.exports = class DeviceCharacteristics {
    constructor(accessories, char) {
        this.platform = accessories;
        Characteristic = char;
        accClass = accessories;
        this.log = accessories.log;
        this.logConfig = accessories.logConfig;
        this.accessories = accessories;
        this.client = accessories.client;
        this.myUtils = accessories.myUtils;
        this.transforms = accessories.transforms;
        this.CommunityTypes = accessories.CommunityTypes;
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

    manageGetCharacteristic(svc, char, attr, opts = {}) {
        // console.log('svc:', svc, ' | char: ', char, ' | attr: ', attr, ' | opts: ', opts);
        if (!this.hasCharacteristic(svc, char)) {
            let c = this.getOrAddService(svc)
                .getCharacteristic(char)
                .on("get", (callback) => {
                    if (attr === 'status' && char === Characteristic.StatusActive) {
                        callback(null, this.context.deviceData.status === 'Online');
                    } else {
                        callback(null, accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], opts.charName || undefined));
                    }
                });
            if (opts.props && Object.keys(opts.props).length) c.setProps(opts.props);
            if (opts.evtOnly !== undefined) c.eventOnlyCharacteristic = opts.evtOnly;
            c.getValue();
            accClass.storeCharacteristicItem(attr, this.context.deviceData.deviceid, c);
        } else {
            if (attr === 'status' && char === Characteristic.StatusActive) {
                this.getOrAddService(svc)
                    .getCharacteristic(char)
                    .updateValue(this.context.deviceData.status === 'Online');
            } else {
                this.getOrAddService(svc)
                    .getCharacteristic(char)
                    .updateValue(accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], opts.charName || undefined));
            }
        }
    }

    manageGetSetCharacteristic(svc, char, attr, opts = {}) {
        if (!this.hasCharacteristic(svc, char)) {
            let c = this
                .getOrAddService(svc)
                .getCharacteristic(char)
                .on("get", (callback) => {
                    callback(null, accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], opts.charName || undefined));
                })
                .on("set", (value, callback) => {
                    let cmdName = accClass.transforms.transformCommandName(opts.set_altAttr || attr, value);
                    if (opts.cmdHasVal === true) {
                        let cVal = accClass.transforms.transformCommandValue(opts.set_altAttr || attr, value);
                        accClass.sendDeviceCommand(callback, this.context.deviceData.deviceid, cmdName, {
                            value1: cVal
                        });
                    } else {
                        accClass.sendDeviceCommand(callback, this.context.deviceData.deviceid, cmdName);
                    }
                    if (opts.updAttrVal) this.context.deviceData.attributes[attr] = accClass.transforms.transformAttributeState(opts.set_altAttr || attr, this.context.deviceData.attributes[opts.set_altValAttr || attr], opts.charName || undefined);
                });
            if (opts.props && Object.keys(opts.props).length) c.setProps(opts.props);
            if (opts.evtOnly !== undefined) c.eventOnlyCharacteristic = opts.evtOnly;
            c.getValue();
            accClass.storeCharacteristicItem(attr, this.context.deviceData.deviceid, c);
        } else {
            this
                .getOrAddService(svc)
                .getCharacteristic(char)
                .updateValue(accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], opts.charName || undefined));
        }
    }

    // alarm_system(_accessory, _service) {
    //     if (!_accessory.hasCharacteristic(_service, Characteristic.SecuritySystemCurrentState)) {
    //         let c = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.SecuritySystemCurrentState)
    //             .on("get", (callback) => {
    //                 this.log_get('alarmSystemStatus', 'SecuritySystemCurrentState', _accessory, _accessory.context.deviceData.attributes.alarmSystemStatus);
    //                 callback(null, this.transforms.transformAttributeState('alarmSystemStatus', _accessory.context.deviceData.attributes.alarmSystemStatus));
    //             });
    //         this.accessories.storeCharacteristicItem("alarmSystemStatus", _accessory.context.deviceData.deviceid, c);
    //     } else {
    //         _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.SecuritySystemCurrentState)
    //             .updateValue(this.transforms.transformAttributeState("alarmSystemStatus", _accessory.context.deviceData.attributes.alarmSystemStatus, 'Security System Current State'));
    //     }

    //     if (!_accessory.hasCharacteristic(_service, Characteristic.SecuritySystemCurrentState)) {
    //         let c = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.SecuritySystemTargetState)
    //             .on("get", (callback) => {
    //                 this.log_get('alarmSystemStatus', 'SecuritySystemTargetState', _accessory, _accessory.context.deviceData.attributes.alarmSystemStatus);
    //                 callback(null, this.transforms.transformAttributeState('alarmSystemStatus', _accessory.context.deviceData.attributes.alarmSystemStatus));
    //             })
    //             .on("set", (value, callback) => {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, this.myUtils.convertAlarmCmd(value));
    //                 this.log_set('alarmSystemStatus', 'SecuritySystemTargetState', _accessory, this.myUtils.convertAlarmCmd(value));
    //             });
    //         this.accessories.storeCharacteristicItem("alarmSystemStatus", _accessory.context.deviceData.deviceid, c);
    //     } else {
    //         _accessory.getOrAddService(_service).getCharacteristic(Characteristic.SecuritySystemCurrentState).updateValue(this.transforms.transformAttributeState("alarmSystemStatus", _accessory.context.deviceData.attributes.alarmSystemStatus, 'Security System Target State'));
    //     }

    //     _accessory.context.deviceGroups.push("alarm_system");
    //     return _accessory;
    // }

    alarm_system(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.SecuritySystemCurrentState, 'alarmSystemStatus');
        _accessory.manageGetSetCharacteristic(_service, Characteristic.SecuritySystemTargetState, 'alarmSystemStatus');
        _accessory.context.deviceGroups.push("alarm_system");
        return _accessory;
    }

    battery(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.BatteryLevel, 'battery');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusLowBattery, 'battery');
        _accessory.manageGetCharacteristic(_service, Characteristic.ChargingState, 'batteryStatus');
        _accessory.context.deviceGroups.push("battery");
        return _accessory;
    }

    // button(_accessory, _service) {
    //     _accessory.manageGetCharacteristic(_service, Characteristic.ProgrammableSwitchEvent, 'button', {
    //         evtOnly: false,
    //         props: {
    //             validValues: this.transforms.transformAttributeState('supportedButtonValues', _accessory.context.deviceData.attributes.supportedButtonValues)
    //         }
    //     });
    //     _accessory.context.deviceGroups.push("button");
    //     return _accessory;
    // }

    button(_accessory, _service) {
        if (!_accessory.hasCharacteristic(_service, Characteristic.ProgrammableSwitchEvent)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                .setProps({
                    validValues: this.transforms.transformAttributeState('supportedButtonValues', _accessory.context.deviceData.attributes.supportedButtonValues)
                })
                .on("get", (callback) => {
                    this.value = -1;
                    callback(null, this.transforms.transformAttributeState('button', _accessory.context.deviceData.attributes.button));
                });

            // Turned on by default for Characteristic.ProgrammableSwitchEvent, required to emit `change`
            c.eventOnlyCharacteristic = false;
            this.accessories.storeCharacteristicItem("button", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service)
                .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                .updateValue(this.transforms.transformAttributeState('button', _accessory.context.deviceData.attributes.button));
        }
        _accessory.context.deviceGroups.push("button");
        return _accessory;
    }

    carbon_dioxide(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CarbonDioxideDetected, 'carbonDioxideMeasurement', { charName: 'Carbon Dioxide Detected' });
        _accessory.manageGetCharacteristic(_service, Characteristic.CarbonDioxideLevel, 'carbonDioxideMeasurement');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.context.deviceGroups.push("carbon_dioxide");
        return _accessory;
    }

    // carbon_dioxide(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.CarbonDioxideDetected)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('carbonDioxideMeasurement', _accessory.context.deviceData.attributes.carbonDioxideMeasurement, 'Carbon Dioxide Detected'));
    //         });
    //     this.accessories.storeCharacteristicItem("carbonDioxideMeasurement", _accessory.context.deviceData.deviceid, thisChar);

    //     thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.CarbonDioxideLevel)
    //         .on("get", (callback) => {
    //             if (_accessory.context.deviceData.attributes.carbonDioxideMeasurement >= 0) {
    //                 callback(null, _accessory.context.deviceData.attributes.carbonDioxideMeasurement);
    //             }
    //         });
    //     this.accessories.storeCharacteristicItem("carbonDioxideMeasurement", _accessory.context.deviceData.deviceid, thisChar);

    //     if (_accessory.hasCapability('Tamper Alert')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.StatusTampered)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('tamper', _accessory.context.deviceData.attributes.tamper));
    //             });
    //         this.accessories.storeCharacteristicItem("tamper", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("carbon_dioxide");
    //     return _accessory;
    // }

    carbon_monoxide(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CarbonMonoxideDetected, 'carbonMonoxide', { charName: 'Carbon Monoxide Detected' });
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.context.deviceGroups.push("carbon_monoxide");
        return _accessory;
    }

    // carbon_monoxide(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.CarbonMonoxideDetected)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('carbonMonoxide', _accessory.context.deviceData.attributes.carbonMonoxide));
    //         });
    //     this.accessories.storeCharacteristicItem("carbonMonoxide", _accessory.context.deviceData.deviceid, thisChar);
    //     if (_accessory.hasCapability('Tamper Alert')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.StatusTampered)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('tamper', _accessory.context.deviceData.attributes.tamper));
    //             });
    //         this.accessories.storeCharacteristicItem("tamper", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("carbon_monoxide");
    //     return _accessory;
    // }

    // contact_sensor(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.ContactSensorState)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('contact', _accessory.context.deviceData.attributes.contact));
    //         });
    //     this.accessories.storeCharacteristicItem("contact", _accessory.context.deviceData.deviceid, thisChar);
    //     if (_accessory.hasCapability('Tamper Alert')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.StatusTampered)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('tamper', _accessory.context.deviceData.attributes.tamper));
    //             });
    //         this.accessories.storeCharacteristicItem("tamper", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("contact_sensor");
    //     return _accessory;
    // }

    contact_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.ContactSensorState, 'contact');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.context.deviceGroups.push("contact_sensor");
        return _accessory;
    }

    energy_meter(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, this.CommunityTypes.KilowattHours, 'energy');
        _accessory.context.deviceGroups.push("energy_meter");
        return _accessory;
    }

    // energy_meter(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .addCharacteristic(this.CommunityTypes.KilowattHours)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('energy', _accessory.context.deviceData.attributes.energy));
    //         });
    //     this.accessories.storeCharacteristicItem("energy", _accessory.context.deviceData.deviceid, thisChar);

    //     _accessory.context.deviceGroups.push("energy_meter");
    //     return _accessory;
    // }

    fan(_accessory, _service) {
        _accessory.manageGetSetCharacteristic(_service, Characteristic.Active, 'switch');
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentFanState, 'switch', { get: { altAttr: "fanState" } });
        let spdSteps = 1;
        if (_accessory.hasDeviceFlag('fan_3_spd')) spdSteps = 33;
        if (_accessory.hasDeviceFlag('fan_4_spd')) spdSteps = 25;
        let spdAttr = (_accessory.hasAttribute('level')) ? "level" : (_accessory.hasAttribute('fanSpeed') && _accessory.hasCommand('setFanSpeed')) ? 'fanSpeed' : undefined;
        _accessory.manageGetSetCharacteristic(_service, Characteristic.RotationSpeed, spdAttr, { cmdHasVal: true, props: { minSteps: spdSteps } });

        _accessory.context.deviceGroups.push("fan");
        return _accessory;
    }

    // fan(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.Active)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
    //         })
    //         .on("set", (value, callback) => {
    //             this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, (value ? "on" : "off"));
    //         });
    //     this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, thisChar);

    //     thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.CurrentFanState)
    //         .on("get", (callback) => {
    //             let curState = (_accessory.context.deviceData.attributes.switch === "off") ? Characteristic.CurrentFanState.IDLE : Characteristic.CurrentFanState.BLOWING_AIR;
    //             callback(null, curState);
    //         });
    //     this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, thisChar);

    //     let spdSteps = 1;
    //     if (_accessory.hasDeviceFlag('fan_3_spd')) spdSteps = 33;
    //     if (_accessory.hasDeviceFlag('fan_4_spd')) spdSteps = 25;
    //     if (_accessory.hasAttribute('fanSpeed') && _accessory.hasCommand('setFanSpeed')) {
    //         //Uses the fanSpeed Attribute and Command instead of level when avail
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.RotationSpeed)
    //             .setProps({
    //                 minSteps: spdSteps
    //             })
    //             .on("get", (callback) => {
    //                 switch (parseInt(_accessory.context.deviceData.attributes.fanSpeed)) {
    //                     case 0:
    //                         callback(null, 0);
    //                         break;
    //                     case 1:
    //                         callback(null, 33);
    //                         break;
    //                     case 2:
    //                         callback(null, 66);
    //                         break;
    //                     case 3:
    //                         callback(null, 100);
    //                         break;
    //                 }
    //             })
    //             .on("set", (value, callback) => {
    //                 let spd = this.accessories.transformCommandValue("fanSpeed", _accessory.context.deviceData.attributes.fanSpeed);
    //                 if (value >= 0 && value <= 100) {
    //                     this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setFanSpeed", {
    //                         value1: spd
    //                     });
    //                     _accessory.context.deviceData.attributes.fanSpeed = spd;
    //                 }
    //             });
    //         this.accessories.storeCharacteristicItem('fanSpeed', _accessory.context.deviceData.deviceid, thisChar);
    //     } else if (_accessory.hasAttribute('level')) {

    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.RotationSpeed)
    //             .setProps({
    //                 minSteps: spdSteps
    //             })
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState("level", _accessory.context.deviceData.attributes.level));
    //             })
    //             .on("set", (value, callback) => {
    //                 if (value >= 0 && value <= 100) {
    //                     this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setLevel", {
    //                         value1: parseInt(value)
    //                     });
    //                     _accessory.context.deviceData.attributes.level = value;
    //                 }
    //             });
    //         this.accessories.storeCharacteristicItem("level", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("fan");
    //     return _accessory;
    // }

    // garage_door(_accessory, _service) {
    //     let char = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.TargetDoorState)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('door', _accessory.context.deviceData.attributes.door, 'Target Door State'));
    //         })
    //         .on("set", (value, callback) => {
    //             if (value === Characteristic.TargetDoorState.OPEN || value === 0) {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "open");
    //                 _accessory.context.deviceData.attributes.door = "opening";
    //             } else if (value === Characteristic.TargetDoorState.CLOSED || value === 1) {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "close");
    //                 _accessory.context.deviceData.attributes.door = "closing";
    //             }
    //         });
    //     this.accessories.storeCharacteristicItem("door", _accessory.context.deviceData.deviceid, char);

    //     char = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.CurrentDoorState)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('door', _accessory.context.deviceData.attributes.door, 'Current Door State'));
    //         });
    //     this.accessories.storeCharacteristicItem("door", _accessory.context.deviceData.deviceid, char);
    //     _accessory
    //         .getOrAddService(_service)
    //         .setCharacteristic(Characteristic.ObstructionDetected, false);
    //     _accessory.context.deviceGroups.push("garage_door");
    //     return _accessory;
    // }

    garage_door(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentDoorState, 'door', { charName: 'Current Door State' });
        _accessory.manageGetSetCharacteristic(_service, Characteristic.TargetDoorState, 'door', { charName: 'Target Door State' });
        if (!_accessory.hasCharacteristic(_service, Characteristic.ObstructionDetected)) {
            _accessory.getOrAddService(_service).setCharacteristic(Characteristic.ObstructionDetected, false);
        }
        return _accessory;
    }

    humidity_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentRelativeHumidity, 'humidity');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.context.deviceGroups.push("humidity_sensor");
        return _accessory;
    }

    illuminance_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentAmbientLightLevel, 'illuminance');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.context.deviceGroups.push("illuminance_sensor");
        return _accessory;
    }

    // humidity_sensor(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.CurrentRelativeHumidity)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('humidity', _accessory.context.deviceData.attributes.humidity));
    //         });
    //     this.accessories.storeCharacteristicItem("humidity", _accessory.context.deviceData.deviceid, thisChar);
    //     if (_accessory.hasCapability('Tamper Alert')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.StatusTampered)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('tamper', _accessory.context.deviceData.attributes.tamper));
    //             });
    //         this.accessories.storeCharacteristicItem("tamper", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("humidity_sensor");
    //     return _accessory;
    // }

    // illuminance_sensor(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('illuminance', _accessory.context.deviceData.attributes.illuminance));
    //         });
    //     this.accessories.storeCharacteristicItem("illuminance", _accessory.context.deviceData.deviceid, thisChar);

    //     _accessory.context.deviceGroups.push("illuminance_sensor");
    //     return _accessory;
    // }

    light(_accessory, _service) {
        _accessory.manageGetSetCharacteristic(_service, Characteristic.On, 'switch');
        if (_accessory.hasAttribute('level'))
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Brightness, 'level', { cmdHasVal: true });
        if (_accessory.hasAttribute('hue'))
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Hue, 'hue', {
                cmdHasVal: true,
                props: {
                    minValue: 1,
                    maxValue: 30000
                }
            });

        if (_accessory.hasAttribute('saturation'))
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Saturation, 'saturation', { cmdHasVal: true });

        if (_accessory.hasAttribute('colorTemperature'))
            _accessory.manageGetSetCharacteristic(_service, Characteristic.ColorTemperature, 'colorTemperature', { cmdHasVal: true });

        _accessory.context.deviceGroups.push("light_bulb");
        return _accessory;
    }

    // light(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.On)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
    //         })
    //         .on("set", (value, callback) => {
    //             this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, (value ? "on" : "off"));
    //         });
    //     this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, thisChar);

    //     if (_accessory.hasAttribute('level')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.Brightness)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('level', _accessory.context.deviceData.attributes.level));
    //             })
    //             .on("set", (value, callback) => {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setLevel", {
    //                     value1: value
    //                 });
    //             });
    //         this.accessories.storeCharacteristicItem("level", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     if (_accessory.hasAttribute('hue')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.Hue)
    //             .setProps({
    //                 minValue: 1,
    //                 maxValue: 30000
    //             })
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('hue', _accessory.context.deviceData.attributes.hue));
    //             })
    //             .on("set", (value, callback) => {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setHue", {
    //                     value1: Math.round(value / 3.6)
    //                 });
    //             });
    //         this.accessories.storeCharacteristicItem("hue", _accessory.context.deviceData.deviceid, thisChar);
    //     }
    //     if (_accessory.hasAttribute('saturation')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.Saturation)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('saturation', _accessory.context.deviceData.attributes.saturation));
    //             })
    //             .on("set", (value, callback) => {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setSaturation", {
    //                     value1: value
    //                 });
    //             });
    //         this.accessories.storeCharacteristicItem("saturation", _accessory.context.deviceData.deviceid, thisChar);
    //     }
    //     if (_accessory.hasAttribute('colorTemperature')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.ColorTemperature)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('colorTemperature', _accessory.context.deviceData.attributes.colorTemperature));
    //             })
    //             .on("set", (value, callback) => {
    //                 let temp = this.myUtils.colorTempToK(value);
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setColorTemperature", {
    //                     value1: temp
    //                 });
    //                 _accessory.context.deviceData.attributes.colorTemperature = temp;
    //             });
    //         this.accessories.storeCharacteristicItem("colorTemperature", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("light_bulb");
    //     return _accessory;
    // }

    // lock(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.LockCurrentState)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('lock', _accessory.context.deviceData.attributes.lock));
    //         });
    //     this.accessories.storeCharacteristicItem("lock", _accessory.context.deviceData.deviceid, thisChar);

    //     thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.LockTargetState)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('lock', _accessory.context.deviceData.attributes.lock));
    //         })
    //         .on("set", (value, callback) => {
    //             this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, (value === 1 || value === true) ? "lock" : "unlock");
    //             _accessory.context.deviceData.attributes.lock = (value === 1 || value === true) ? "locked" : "unlocked";
    //         });
    //     this.accessories.storeCharacteristicItem("lock", _accessory.context.deviceData.deviceid, thisChar);

    //     _accessory.context.deviceGroups.push("lock");
    //     return _accessory;
    // }

    lock(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.LockCurrentState, 'lock');
        _accessory.manageGetSetCharacteristic(_service, Characteristic.LockTargetState, 'lock');
        _accessory.context.deviceGroups.push("lock");
        return _accessory;
    }

    motion_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.MotionDetected, 'motion');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');

        _accessory.context.deviceGroups.push("motion_sensor");
        return _accessory;
    }

    power_meter(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, this.CommunityTypes.Watts, 'power');

        _accessory.context.deviceGroups.push("power_meter");
        return _accessory;
    }

    presence_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.OccupancyDetected, 'presence');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');

        _accessory.context.deviceGroups.push("presence_sensor");
        return _accessory;
    }

    smoke_detector(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.SmokeDetected, 'smoke');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');

        _accessory.context.deviceGroups.push("smoke_detector");
        return _accessory;
    }

    // motion_sensor(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.MotionDetected)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('motion', _accessory.context.deviceData.attributes.motion));
    //         });
    //     this.accessories.storeCharacteristicItem("motion", _accessory.context.deviceData.deviceid, thisChar);
    //     if (_accessory.hasCapability('Tamper Alert')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.StatusTampered)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('tamper', _accessory.context.deviceData.attributes.tamper));
    //             });
    //         this.accessories.storeCharacteristicItem("tamper", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("motion_sensor");
    //     return _accessory;
    // }

    // power_meter(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .addCharacteristic(this.CommunityTypes.Watts)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('power', _accessory.context.deviceData.attributes.power));
    //         });
    //     this.accessories.storeCharacteristicItem("power", _accessory.context.deviceData.deviceid, thisChar);

    //     _accessory.context.deviceGroups.push("power_meter");
    //     return _accessory;
    // }

    // presence_sensor(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.OccupancyDetected)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('presence', _accessory.context.deviceData.attributes.presence));
    //         });
    //     this.accessories.storeCharacteristicItem("presence", _accessory.context.deviceData.deviceid, thisChar);
    //     if (_accessory.hasCapability('Tamper Alert')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.StatusTampered)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('tamper', _accessory.context.deviceData.attributes.tamper));
    //             });
    //         this.storeCharacteristicItem("tamper", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("presence_sensor");
    //     return _accessory;
    // }

    // smoke_detector(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.SmokeDetected)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('smoke', _accessory.context.deviceData.attributes.smoke));
    //         });
    //     this.accessories.storeCharacteristicItem("smoke", _accessory.context.deviceData.deviceid, thisChar);
    //     if (_accessory.hasCapability('Tamper Alert')) {
    //         thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.StatusTampered)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('tamper', _accessory.context.deviceData.attributes.tamper));
    //             });
    //         this.accessories.storeCharacteristicItem("tamper", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("smoke_detector");
    //     return _accessory;
    // }

    speaker(_accessory, _service) {
        let isSonos = (_accessory.context.deviceData.manufacturerName === "Sonos");
        let lvlAttr = (isSonos || _accessory.hasAttribute('volume')) ? 'volume' : _accessory.hasAttribute('level') ? 'level' : undefined;
        if (!this.hasCharacteristic(_service, Characteristic.Volume)) {
            let sonosVolumeTimeout = null;
            let lastVolumeWriteValue = null;
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.Volume)
                .on("get", (callback) => {
                    callback(null, this.accessories.transformAttributeState(lvlAttr, _accessory.context.deviceData.attributes[lvlAttr]) || 0);
                })
                .on("set", (value, callback) => {
                    if (isSonos) {
                        if (value > 0 && value !== lastVolumeWriteValue) {
                            lastVolumeWriteValue = value;
                            sonosVolumeTimeout = this.accessories.clearAndSetTimeout(sonosVolumeTimeout, () => {
                                this.log.debug(`Existing volume: ${_accessory.context.deviceData.attributes.volume}, set to ${lastVolumeWriteValue}`);
                                this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setVolume", {
                                    value1: lastVolumeWriteValue
                                });
                            }, 1000);
                        }
                    }
                    if (value > 0) {
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, this.accessories.transformCommandName(lvlAttr, value), {
                            value1: this.accessories.transformAttributeState(lvlAttr, value)
                        });
                    }
                });
            this.accessories.storeCharacteristicItem("volume", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.Volume).updateValue(this.accessories.transformAttributeState(lvlAttr, _accessory.context.deviceData.attributes[lvlAttr]) || 0);
        }
        if (_accessory.hasCapability('Audio Mute'))
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Mute, 'mute');

        _accessory.context.deviceGroups.push("speaker_device");
        return _accessory;
    }

    // speaker(_accessory, _service) {
    //     let isSonos = (_accessory.context.deviceData.manufacturerName === "Sonos");
    //     let lvlAttr = (isSonos || _accessory.hasAttribute('volume')) ? 'volume' : _accessory.hasAttribute('level') ? 'level' : undefined;
    //     if (!this.hasCharacteristic(_service, Characteristic.Volume)) {
    //         let sonosVolumeTimeout = null;
    //         let lastVolumeWriteValue = null;
    //         let c = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.Volume)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState(lvlAttr, _accessory.context.deviceData.attributes[lvlAttr]) || 0);
    //             })
    //             .on("set", (value, callback) => {
    //                 if (isSonos) {
    //                     if (value > 0 && value !== lastVolumeWriteValue) {
    //                         lastVolumeWriteValue = value;
    //                         sonosVolumeTimeout = this.accessories.clearAndSetTimeout(sonosVolumeTimeout, () => {
    //                             this.log.debug(`Existing volume: ${_accessory.context.deviceData.attributes.volume}, set to ${lastVolumeWriteValue}`);
    //                             this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setVolume", {
    //                                 value1: lastVolumeWriteValue
    //                             });
    //                         }, 1000);
    //                     }
    //                 }
    //                 if (value > 0) {
    //                     this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, this.accessories.transformCommandName(lvlAttr, value), {
    //                         value1: this.transforms.transformAttributeState(lvlAttr, value)
    //                     });
    //                 }
    //             });
    //         this.accessories.storeCharacteristicItem("volume", _accessory.context.deviceData.deviceid, c);
    //     } else {
    //         _accessory.getOrAddService(_service).getCharacteristic(Characteristic.Volume).updateValue(this.transforms.transformAttributeState(lvlAttr, _accessory.context.deviceData.attributes[lvlAttr]) || 0);
    //     }

    //     if (_accessory.hasCapability('Audio Mute')) {
    //         let thisChar = _accessory
    //             .getOrAddService(_service)
    //             .getCharacteristic(Characteristic.Mute)
    //             .on("get", (callback) => {
    //                 callback(null, this.transforms.transformAttributeState('mute', _accessory.context.deviceData.attributes.mute));
    //             })
    //             .on("set", (value, callback) => {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, (value === "muted") ? "mute" : "unmute");
    //             });
    //         this.accessories.storeCharacteristicItem("mute", _accessory.context.deviceData.deviceid, thisChar);
    //     }

    //     _accessory.context.deviceGroups.push("speaker_device");
    //     return _accessory;
    // }

    switch_device(_accessory, _service) {
        _accessory.manageGetSetCharacteristic(_service, Characteristic.On, 'switch');
        _accessory.context.deviceGroups.push("switch");
        return _accessory;
    }

    temperature_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentTemperature, 'temperature', {
            props: {
                minValue: -100,
                maxValue: 200
            }
        });
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.context.deviceGroups.push("temperature_sensor");
        return _accessory;
    }

    thermostat(_accessory, _service) {
        //TODO:  Still seeing an issue when setting mode from OFF to HEAT.  It's setting the temp to 40 but if I change to cool then back to heat it sets the correct value.
        if (!_accessory.hasCharacteristic(_service, Characteristic.CurrentHeatingCoolingState)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .on("get", (callback) => {
                    callback(null, this.transforms.transformAttributeState('thermostatOperatingState', _accessory.context.deviceData.attributes.thermostatOperatingState));
                });
            this.accessories.storeCharacteristicItem("thermostatOperatingState", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(this.transforms.transformAttributeState("thermostatOperatingState", _accessory.context.deviceData.attributes.thermostatOperatingState));
        }

        // Handle the Target State
        if (!_accessory.hasCharacteristic(_service, Characteristic.TargetHeatingCoolingState)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .setProps({
                    validValues: this.transforms.transformAttributeState('supportedThermostatModes', _accessory.context.deviceData.attributes.supportedThermostatModes)
                })
                .on("get", (callback) => {
                    callback(null, this.transforms.transformAttributeState('thermostatMode', _accessory.context.deviceData.attributes.thermostatMode));
                })
                .on("set", (value, callback) => {
                    let state = this.accessories.transformCommandValue('thermostatMode', value);
                    this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, this.accessories.transformCommandName('thermostatMode', value), {
                        value1: state
                    });
                    _accessory.context.deviceData.attributes.thermostatMode = state;
                });

            this.accessories.storeCharacteristicItem("thermostatMode", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(this.transforms.transformAttributeState("thermostatMode", _accessory.context.deviceData.attributes.thermostatMode));
        }

        if (_accessory.hasCapability('Relative Humidity Measurement')) {
            if (!_accessory.hasCharacteristic(_service, Characteristic.CurrentRelativeHumidity)) {
                let c = _accessory
                    .getOrAddService(_service)
                    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .on("get", (callback) => {
                        callback(null, parseInt(_accessory.context.deviceData.attributes.humidity));
                    });
                this.accessories.storeCharacteristicItem("humidity", _accessory.context.deviceData.deviceid, c);
            } else {
                _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.transforms.transformAttributeState("humidity", _accessory.context.deviceData.attributes.humidity));
            }
        }

        if (!_accessory.hasCharacteristic(_service, Characteristic.CurrentTemperature)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({
                    minValue: this.myUtils.thermostatTempConversion(40),
                    maxValue: this.myUtils.thermostatTempConversion(90),
                    minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
                })
                .on("get", (callback) => {
                    callback(null, this.myUtils.thermostatTempConversion(_accessory.context.deviceData.attributes.temperature));
                });
            this.accessories.storeCharacteristicItem("temperature", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.transforms.transformAttributeState("temperature", _accessory.context.deviceData.attributes.temperature));
        }

        let targetTemp;
        switch (_accessory.context.deviceData.attributes.thermostatMode) {
            case 'cool':
            case 'cooling':
                targetTemp = _accessory.context.deviceData.attributes.coolingSetpoint;
                break;
            case 'emergency heat':
            case 'heat':
            case 'heating':
                targetTemp = _accessory.context.deviceData.attributes.heatingSetpoint;
                break;
            default:
                switch (_accessory.context.deviceData.attributes.thermostatOperatingState) {
                    case 'cooling':
                    case 'cool':
                        targetTemp = _accessory.context.deviceData.attributes.coolingSetpoint;
                        break;
                    default:
                        targetTemp = _accessory.context.deviceData.attributes.heatingSetpoint;
                        break;
                }
                break;
        }

        if (!_accessory.hasCharacteristic(_service, Characteristic.TargetTemperature)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.TargetTemperature)
                .setProps({
                    minValue: this.myUtils.thermostatTempConversion(40),
                    maxValue: this.myUtils.thermostatTempConversion(90),
                    minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
                })
                .on("get", (callback) => {
                    callback(null, targetTemp ? this.myUtils.thermostatTempConversion(targetTemp) : "Unknown");
                })
                .on("set", (value, callback) => {
                    // Convert the Celsius value to the appropriate unit for Smartthings
                    let temp = this.myUtils.thermostatTempConversion(value, true);
                    switch (_accessory.context.deviceData.attributes.thermostatMode) {
                        case "cool":
                            this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setCoolingSetpoint", {
                                value1: temp
                            });
                            _accessory.context.deviceData.attributes.coolingSetpoint = temp;
                            _accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                            break;
                        case "emergency heat":
                        case "heat":
                            this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setHeatingSetpoint", {
                                value1: temp
                            });
                            _accessory.context.deviceData.attributes.heatingSetpoint = temp;
                            _accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                            break;
                        default:
                            this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setThermostatSetpoint", {
                                value1: temp
                            });
                            _accessory.context.deviceData.attributes.thermostatSetpoint = temp;
                    }
                });
            this.accessories.storeCharacteristicItem("thermostatMode", _accessory.context.deviceData.deviceid, c);
            this.accessories.storeCharacteristicItem("coolingSetpoint", _accessory.context.deviceData.deviceid, c);
            this.accessories.storeCharacteristicItem("heatingSetpoint", _accessory.context.deviceData.deviceid, c);
            this.accessories.storeCharacteristicItem("thermostatSetpoint", _accessory.context.deviceData.deviceid, c);
            this.accessories.storeCharacteristicItem("temperature", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp ? this.myUtils.thermostatTempConversion(targetTemp) : "Unknown");
        }

        if (!_accessory.hasCharacteristic(_service, Characteristic.TemperatureDisplayUnits)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.TemperatureDisplayUnits)
                .on("get", (callback) => {
                    callback(null, (this.platform.getTempUnit() === 'F') ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS);
                });
            this.accessories.storeCharacteristicItem("temperature_unit", "platform", c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TemperatureDisplayUnits).updateValue((this.platform.getTempUnit() === 'F') ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS);
        }

        if (!_accessory.hasCharacteristic(_service, Characteristic.HeatingThresholdTemperature)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .setProps({
                    minValue: this.myUtils.thermostatTempConversion(40),
                    maxValue: this.myUtils.thermostatTempConversion(90),
                    minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
                })
                .on("get", (callback) => {
                    callback(null, this.myUtils.thermostatTempConversion(_accessory.context.deviceData.attributes.heatingSetpoint));
                })
                .on("set", (value, callback) => {
                    // Convert the Celsius value to the appropriate unit for Smartthings
                    let temp = this.myUtils.thermostatTempConversion(value, true);
                    this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setHeatingSetpoint", {
                        value1: temp
                    });
                    _accessory.context.deviceData.attributes.heatingSetpoint = temp;
                });
            this.accessories.storeCharacteristicItem("heatingSetpoint", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(this.myUtils.thermostatTempConversion(_accessory.context.deviceData.attributes.heatingSetpoint));
        }
        if (!_accessory.hasCharacteristic(_service, Characteristic.CoolingThresholdTemperature)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .setProps({
                    minValue: this.myUtils.thermostatTempConversion(40),
                    maxValue: this.myUtils.thermostatTempConversion(90),
                    minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
                })
                .on("get", (callback) => {
                    callback(null, this.myUtils.thermostatTempConversion(_accessory.context.deviceData.attributes.coolingSetpoint));
                })
                .on("set", (value, callback) => {
                    // Convert the Celsius value to the appropriate unit for Smartthings
                    let temp = this.myUtils.thermostatTempConversion(value, true);
                    this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setCoolingSetpoint", {
                        value1: temp
                    });
                    _accessory.context.deviceData.attributes.coolingSetpoint = temp;
                });
            this.accessories.storeCharacteristicItem("coolingSetpoint", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(this.myUtils.thermostatTempConversion(_accessory.context.deviceData.attributes.coolingSetpoint));
        }

        _accessory.context.deviceGroups.push("thermostat");
        return _accessory;
    }
    valve(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.InUse, 'valve');
        _accessory.manageGetSetCharacteristic(_service, Characteristic.Active, 'valve');
        if (!this.hasCharacteristic(_service, Characteristic.ValveType))
            _accessory.getOrAddService(_service).setCharacteristic(Characteristic.ValveType, 0);

        _accessory.context.deviceGroups.push("valve");
        return _accessory;
    }

    // valve(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.InUse)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('valve', _accessory.context.deviceData.attributes.valve));
    //         });
    //     this.accessories.storeCharacteristicItem("valve", _accessory.context.deviceData.deviceid, thisChar);

    //     //Defines Valve State (opened/closed)
    //     thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.Active)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('valve', _accessory.context.deviceData.attributes.valve));
    //         })
    //         .on("set", (value, callback) => {
    //             this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, (value ? "on" : "off"));
    //         });
    //     this.accessories.storeCharacteristicItem("valve", _accessory.context.deviceData.deviceid, thisChar);

    //     //Defines the valve type (irrigation or generic)
    //     thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.ValveType)
    //         .on("get", (callback) => {
    //             callback(null, 0);
    //         });
    //     // this.accessories.storeCharacteristicItem("valve", _accessory.context.deviceData.deviceid, thisChar);

    //     _accessory.context.deviceGroups.push("valve");
    //     return _accessory;
    // }

    // virtual_mode(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.On)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
    //         })
    //         .on("set", (value, callback) => {
    //             if (value && (_accessory.context.deviceData.attributes.switch === "off")) {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "mode");
    //             }
    //         });
    //     this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, thisChar);

    //     _accessory.context.deviceGroups.push("virtual_mode");
    //     return _accessory;
    // }

    // virtual_routine(_accessory, _service) {
    //     let thisChar = _accessory
    //         .getOrAddService(_service)
    //         .getCharacteristic(Characteristic.On)
    //         .on("get", (callback) => {
    //             callback(null, this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
    //         })
    //         .on("set", (value, callback) => {
    //             if (value) {
    //                 this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "routine");
    //                 setTimeout(() => {
    //                     console.log("routineOff...");
    //                     _accessory.context.deviceData.attributes.switch = "off";
    //                     _accessory
    //                         .getOrAddService(_service)
    //                         .getCharacteristic(Characteristic.On)
    //                         .updateValue(false);
    //                 }, 2000);
    //             }
    //         });
    //     this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, thisChar);

    //     _accessory.context.deviceGroups.push("virtual_routine");
    //     return _accessory;
    // }

    virtual_mode(_accessory, _service) {
        if (!this.hasCharacteristic(_service, Characteristic.On)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.On)
                .on("get", (callback) => {
                    callback(null, this.accessories.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
                })
                .on("set", (value, callback) => {
                    if (value && (_accessory.context.deviceData.attributes.switch === "off")) {
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "mode");
                    }
                });
            this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.On).updateValue(this.accessories.transformAttributeState('switch', this.context.deviceData.attributes.switch));
        }

        _accessory.context.deviceGroups.push("virtual_mode");
        return _accessory;
    }

    virtual_routine(_accessory, _service) {
        if (!this.hasCharacteristic(_service, Characteristic.On)) {
            let c = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.On)
                .on("get", (callback) => {
                    callback(null, this.accessories.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
                })
                .on("set", (value, callback) => {
                    if (value) {
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "routine");
                        setTimeout(() => {
                            console.log("routineOff...");
                            _accessory.context.deviceData.attributes.switch = "off";
                            _accessory
                                .getOrAddService(_service)
                                .getCharacteristic(Characteristic.On)
                                .updateValue(false);
                        }, 2000);
                    }
                });
            this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, c);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.On).updateValue(this.accessories.transformAttributeState('switch', this.context.deviceData.attributes.switch));
        }
        _accessory.context.deviceGroups.push("virtual_routine");
        return _accessory;
    }

    water_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.LeakDetected, 'water');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.deviceGroups.push("window_shade");
        return _accessory;
    }

    window_shade(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentPosition, 'level');

        if (!this.hasCharacteristic(_service, Characteristic.TargetPosition)) {
            let thisChar;
            thisChar = _accessory
                .getOrAddService(_service)
                .getCharacteristic(Characteristic.TargetPosition)
                .on("get", (callback) => {
                    callback(null, parseInt(_accessory.context.deviceData.attributes.level));
                })
                .on("set", (value, callback) => {
                    if (_accessory.hasCommand('close') && value === 0) {
                        // setLevel: 0, not responding on spring fashion blinds
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "close");
                    } else {
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setLevel", {
                            value1: value
                        });
                    }
                });
            this.accessories.storeCharacteristicItem("level", _accessory.context.deviceData.deviceid, thisChar);
        } else {
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TargetPosition).updateValue(this.accessories.transformAttributeState('level', this.context.deviceData.attributes.level, 'Target Position'));
        }
        _accessory.getOrAddService(_service).setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);

        _accessory.deviceGroups.push("window_shade");
        return _accessory;
    }
};