// const debounce = require('debounce-promise');
var Characteristic, accClass;

module.exports = class DeviceCharacteristics {
    constructor(accessories, char) {
        this.platform = accessories;
        this.platform = accessories.mainPlatform;
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
        let c = this.getOrAddService(svc).getCharacteristic(char);
        if (!c._events.get) {
            c.on("get", (callback) => {
                if (attr === 'status' && char === Characteristic.StatusActive) {
                    callback(null, this.context.deviceData.status === 'Online');
                } else {
                    callback(null, accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], c.displayName));
                }
            });
            if (opts.props && Object.keys(opts.props).length) c.setProps(opts.props);
            if (opts.evtOnly !== undefined) c.eventOnlyCharacteristic = opts.evtOnly;
            c.getValue();
            accClass.storeCharacteristicItem(attr, this.context.deviceData.deviceid, c);
        } else {
            if (attr === 'status' && char === Characteristic.StatusActive) {
                c.updateValue(this.context.deviceData.status === 'Online');
            } else {
                c.updateValue(accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], c.displayName));
            }
        }
    }

    manageGetSetCharacteristic(svc, char, attr, opts = {}) {
        let c = this.getOrAddService(svc).getCharacteristic(char);
        if (!c._events.get || !c._events.set) {
            if (!c._events.get) {
                c.on("get", (callback) => {
                    callback(null, accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], c.displayName));
                });
            }
            if (!c._events.set) {
                c.on("set", (value, callback) => {
                    let cmdName = accClass.transforms.transformCommandName(opts.set_altAttr || attr, value);
                    let cmdVal = accClass.transforms.transformCommandValue(opts.set_altAttr || attr, value);
                    if (opts.cmdHasVal === true) {
                        accClass.client.sendDeviceCommand(callback, this.context.deviceData.deviceid, cmdName, { value1: cmdVal });
                    } else {
                        accClass.client.sendDeviceCommand(callback, this.context.deviceData.deviceid, cmdVal);
                    }
                    if (opts.updAttrVal) this.context.deviceData.attributes[attr] = accClass.transforms.transformAttributeState(opts.set_altAttr || attr, this.context.deviceData.attributes[opts.set_altValAttr || attr], c.displayName);
                });
                if (opts.props && Object.keys(opts.props).length) c.setProps(opts.props);
                if (opts.evtOnly !== undefined) c.eventOnlyCharacteristic = opts.evtOnly;
                c.getValue();
            }
            c.getValue();
            accClass.storeCharacteristicItem(attr, this.context.deviceData.deviceid, c);
        } else {
            c.updateValue(accClass.transforms.transformAttributeState(opts.get_altAttr || attr, this.context.deviceData.attributes[opts.get_altValAttr || attr], c.displayName));
        }
    }

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
        let c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.ProgrammableSwitchEvent);
        if (!c._events.get) {
            c.setProps({
                validValues: this.transforms.transformAttributeState('supportedButtonValues', _accessory.context.deviceData.attributes.supportedButtonValues)
            });
            c.on("get", (callback) => {
                this.value = -1;
                callback(null, this.transforms.transformAttributeState('button', _accessory.context.deviceData.attributes.button));
            });

            // Turned on by default for Characteristic.ProgrammableSwitchEvent, required to emit `change`
            c.eventOnlyCharacteristic = false;
        }
        this.accessories.storeCharacteristicItem("button", _accessory.context.deviceData.deviceid, c);
        c.updateValue(this.transforms.transformAttributeState('button', _accessory.context.deviceData.attributes.button));
        _accessory.context.deviceGroups.push("button");
        return _accessory;
    }

    carbon_dioxide(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CarbonDioxideDetected, 'carbonDioxideMeasurement');
        _accessory.manageGetCharacteristic(_service, Characteristic.CarbonDioxideLevel, 'carbonDioxideMeasurement');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("carbon_dioxide");
        return _accessory;
    }

    carbon_monoxide(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CarbonMonoxideDetected, 'carbonMonoxide');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("carbon_monoxide");
        return _accessory;
    }


    contact_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.ContactSensorState, 'contact');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("contact_sensor");
        return _accessory;
    }

    energy_meter(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, this.CommunityTypes.KilowattHours, 'energy');
        _accessory.context.deviceGroups.push("energy_meter");
        return _accessory;
    }

    fan(_accessory, _service) {
        if (_accessory.hasAttribute('switch')) {
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Active, 'switch');
            _accessory.manageGetCharacteristic(_service, Characteristic.CurrentFanState, 'switch', { get: { altAttr: "fanState" } });
        } else {
            _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.CurrentFanState);
            _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.Active);
        }
        let spdSteps = 1;
        if (_accessory.hasDeviceFlag('fan_3_spd')) spdSteps = 33;
        if (_accessory.hasDeviceFlag('fan_4_spd')) spdSteps = 25;
        let spdAttr = (_accessory.hasAttribute('level')) ? "level" : (_accessory.hasAttribute('fanSpeed') && _accessory.hasCommand('setFanSpeed')) ? 'fanSpeed' : undefined;
        if (_accessory.hasAttribute('level') || _accessory.hasAttribute('fanSpeed')) {
            _accessory.manageGetSetCharacteristic(_service, Characteristic.RotationSpeed, spdAttr, { cmdHasVal: true, props: { minSteps: spdSteps } });
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.RotationSpeed); }
        _accessory.context.deviceGroups.push("fan");
        return _accessory;
    }

    garage_door(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentDoorState, 'door');
        _accessory.manageGetSetCharacteristic(_service, Characteristic.TargetDoorState, 'door');
        if (!_accessory.hasCharacteristic(_service, Characteristic.ObstructionDetected)) {
            _accessory.getOrAddService(_service).setCharacteristic(Characteristic.ObstructionDetected, false);
        }
        return _accessory;
    }

    humidity_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentRelativeHumidity, 'humidity');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("humidity_sensor");
        return _accessory;
    }

    illuminance_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentAmbientLightLevel, 'illuminance', { props: { minValue: 0, maxValue: 100000 } });
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("illuminance_sensor");
        return _accessory;
    }

    light(_accessory, _service) {
        _accessory.manageGetSetCharacteristic(_service, Characteristic.On, 'switch');
        if (_accessory.hasAttribute('level')) {
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Brightness, 'level', { cmdHasVal: true });
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.Brightness); }
        if (_accessory.hasAttribute('hue')) {
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Hue, 'hue', {
                cmdHasVal: true,
                props: {
                    minValue: 1,
                    maxValue: 30000
                }
            });
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.Hue); }
        if (_accessory.hasAttribute('saturation')) {
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Saturation, 'saturation', { cmdHasVal: true });
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.Saturation); }
        if (_accessory.hasAttribute('colorTemperature')) {
            _accessory.manageGetSetCharacteristic(_service, Characteristic.ColorTemperature, 'colorTemperature', { cmdHasVal: true });
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.ColorTemperature); }
        _accessory.context.deviceGroups.push("light_bulb");
        return _accessory;
    }

    lock(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.LockCurrentState, 'lock');
        _accessory.manageGetSetCharacteristic(_service, Characteristic.LockTargetState, 'lock');
        _accessory.context.deviceGroups.push("lock");
        return _accessory;
    }

    motion_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.MotionDetected, 'motion');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
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
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("presence_sensor");
        return _accessory;
    }

    smoke_detector(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.SmokeDetected, 'smoke');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("smoke_detector");
        return _accessory;
    }

    speaker(_accessory, _service) {
        let isSonos = (_accessory.context.deviceData.manufacturerName === "Sonos");
        let lvlAttr = (isSonos || _accessory.hasAttribute('volume')) ? 'volume' : _accessory.hasAttribute('level') ? 'level' : undefined;
        let c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.Volume);
        let sonosVolumeTimeout = null;
        let lastVolumeWriteValue = null;
        if (!c._events.get || !c._events.set) {
            if (!c._events.get) {
                c.on("get", (callback) => {
                    callback(null, this.transforms.transformAttributeState(lvlAttr, _accessory.context.deviceData.attributes[lvlAttr]) || 0);
                });
            }
            if (!c._events.set) {
                c.on("set", (value, callback) => {
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
                            value1: this.transforms.transformAttributeState(lvlAttr, value)
                        });
                    }
                });
            }
            this.accessories.storeCharacteristicItem("volume", _accessory.context.deviceData.deviceid, c);
        }
        _accessory.getOrAddService(_service).getCharacteristic(Characteristic.Volume).updateValue(this.transforms.transformAttributeState(lvlAttr, _accessory.context.deviceData.attributes[lvlAttr]) || 0);
        if (_accessory.hasCapability('Audio Mute')) {
            _accessory.manageGetSetCharacteristic(_service, Characteristic.Mute, 'mute');
        }

        _accessory.context.deviceGroups.push("speaker_device");
        return _accessory;
    }

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
        if (_accessory.hasCapability('Tamper Alert')) {
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        } else { _accessory.getOrAddService(_service).removeCharacteristic(Characteristic.StatusTampered); }
        _accessory.context.deviceGroups.push("temperature_sensor");
        return _accessory;
    }

    thermostat(_accessory, _service) {
        //TODO:  Still seeing an issue when setting mode from OFF to HEAT.  It's setting the temp to 40 but if I change to cool then back to heat it sets the correct value.
        // CURRENT HEATING/COOLING STATE
        let c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CurrentHeatingCoolingState);
        if (!c._events.get) {
            c.on("get", (callback) => {
                callback(null, this.transforms.transformAttributeState('thermostatOperatingState', _accessory.context.deviceData.attributes.thermostatOperatingState));
            });
        }
        this.accessories.storeCharacteristicItem("thermostatOperatingState", _accessory.context.deviceData.deviceid, c);
        c.updateValue(this.transforms.transformAttributeState("thermostatOperatingState", _accessory.context.deviceData.attributes.thermostatOperatingState));

        // TARGET HEATING/COOLING STATE
        c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TargetHeatingCoolingState);
        if (!c._events.get || !c._events.set) {
            c.setProps({
                validValues: this.transforms.transformAttributeState('supportedThermostatModes', _accessory.context.deviceData.attributes.supportedThermostatModes)
            });
            if (!c._events.get) {
                c.on("get", (callback) => {
                    callback(null, this.transforms.transformAttributeState('thermostatMode', _accessory.context.deviceData.attributes.thermostatMode));
                });
            }
            if (!c._events.set) {
                c.on("set", (value, callback) => {
                    let state = this.transforms.transformCommandValue('thermostatMode', value);
                    this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, this.transforms.transformCommandName('thermostatMode', value), {
                        value1: state
                    });
                    _accessory.context.deviceData.attributes.thermostatMode = state;
                });
            }
        }
        this.accessories.storeCharacteristicItem("thermostatMode", _accessory.context.deviceData.deviceid, c);
        c.updateValue(this.transforms.transformAttributeState("thermostatMode", _accessory.context.deviceData.attributes.thermostatMode));

        // CURRENT RELATIVE HUMIDITY
        if (_accessory.hasCapability('Relative Humidity Measurement')) {
            c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CurrentRelativeHumidity);
            if (!c._events.get) {
                c.on("get", (callback) => {
                    callback(null, parseInt(_accessory.context.deviceData.attributes.humidity));
                });
            }
            this.accessories.storeCharacteristicItem("humidity", _accessory.context.deviceData.deviceid, c);
            _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.transforms.transformAttributeState("humidity", _accessory.context.deviceData.attributes.humidity));
        }

        // CURRENT TEMPERATURE
        c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CurrentTemperature);
        if (!c._events.get) {
            c.setProps({
                minValue: this.transforms.thermostatTempConversion(40),
                maxValue: this.transforms.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            });
            c.on("get", (callback) => {
                callback(null, this.transforms.thermostatTempConversion(_accessory.context.deviceData.attributes.temperature));
            });
        }
        this.accessories.storeCharacteristicItem("temperature", _accessory.context.deviceData.deviceid, c);
        c.updateValue(this.transforms.transformAttributeState("temperature", _accessory.context.deviceData.attributes.temperature));


        // TARGET TEMPERATURE
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

        c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TargetTemperature);
        if (!c._events.get || !c._events.set) {
            c.setProps({
                minValue: this.transforms.thermostatTempConversion(40),
                maxValue: this.transforms.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            });
            if (!c._events.get) {
                c.on("get", (callback) => {
                    callback(null, targetTemp ? this.transforms.thermostatTempConversion(targetTemp) : "Unknown");
                });
            }
            if (!c._events.set) {
                c.on("set", (value, callback) => {
                    // Convert the Celsius value to the appropriate unit for Smartthings
                    let temp = this.transforms.thermostatTempConversion(value, true);
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
            }
        }
        this.accessories.storeCharacteristicItem("thermostatMode", _accessory.context.deviceData.deviceid, c);
        this.accessories.storeCharacteristicItem("coolingSetpoint", _accessory.context.deviceData.deviceid, c);
        this.accessories.storeCharacteristicItem("heatingSetpoint", _accessory.context.deviceData.deviceid, c);
        this.accessories.storeCharacteristicItem("thermostatSetpoint", _accessory.context.deviceData.deviceid, c);
        this.accessories.storeCharacteristicItem("temperature", _accessory.context.deviceData.deviceid, c);
        c.updateValue(targetTemp ? this.transforms.thermostatTempConversion(targetTemp) : "Unknown");

        // TEMPERATURE DISPLAY UNITS
        c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TemperatureDisplayUnits);
        if (!c._events.get) {
            c.on("get", (callback) => {
                callback(null, (this.platform.getTempUnit() === 'F') ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS);
            });
        }
        this.accessories.storeCharacteristicItem("temperature_unit", "platform", c);
        c.updateValue((this.platform.getTempUnit() === 'F') ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS);

        // HEATING THRESHOLD TEMPERATURE
        c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.HeatingThresholdTemperature);
        if (!c._events.get || !c._events.set) {
            c.setProps({
                minValue: this.transforms.thermostatTempConversion(40),
                maxValue: this.transforms.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            });
            if (!c._events.get) {
                c.on("get", (callback) => {
                    callback(null, this.transforms.thermostatTempConversion(_accessory.context.deviceData.attributes.heatingSetpoint));
                });
            }
            if (!c._events.set) {
                c.on("set", (value, callback) => {
                    // Convert the Celsius value to the appropriate unit for Smartthings
                    let temp = this.transforms.thermostatTempConversion(value, true);
                    this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setHeatingSetpoint", {
                        value1: temp
                    });
                    _accessory.context.deviceData.attributes.heatingSetpoint = temp;
                });
            }
        }
        this.accessories.storeCharacteristicItem("heatingSetpoint", _accessory.context.deviceData.deviceid, c);
        c.updateValue(this.transforms.thermostatTempConversion(_accessory.context.deviceData.attributes.heatingSetpoint));

        // COOLING THRESHOLD TEMPERATURE
        c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.CoolingThresholdTemperature);
        if (!c._events.get || !c._events.set) {
            c.setProps({
                minValue: this.transforms.thermostatTempConversion(40),
                maxValue: this.transforms.thermostatTempConversion(90),
                minSteps: (this.platform.getTempUnit() === 'F') ? 1.0 : 0.5
            });
            if (!c._events.get || !c._events.set) {
                c.on("get", (callback) => {
                    callback(null, this.transforms.thermostatTempConversion(_accessory.context.deviceData.attributes.coolingSetpoint));
                });
            }
            if (!c._events.set) {
                c.on("set", (value, callback) => {
                    // Convert the Celsius value to the appropriate unit for Smartthings
                    let temp = this.transforms.thermostatTempConversion(value, true);
                    this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setCoolingSetpoint", {
                        value1: temp
                    });
                    _accessory.context.deviceData.attributes.coolingSetpoint = temp;
                });
            }
        }
        this.accessories.storeCharacteristicItem("coolingSetpoint", _accessory.context.deviceData.deviceid, c);
        c.updateValue(this.transforms.thermostatTempConversion(_accessory.context.deviceData.attributes.coolingSetpoint));

        _accessory.context.deviceGroups.push("thermostat");
        return _accessory;
    }
    valve(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.InUse, 'valve');
        _accessory.manageGetSetCharacteristic(_service, Characteristic.Active, 'valve');
        if (!_accessory.hasCharacteristic(_service, Characteristic.ValveType))
            _accessory.getOrAddService(_service).setCharacteristic(Characteristic.ValveType, 0);

        _accessory.context.deviceGroups.push("valve");
        return _accessory;
    }

    virtual_mode(_accessory, _service) {
        let c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.On);
        if (!c._events.get || !c._events.set) {
            if (!c._events.get)
                c.on("get", (callback) => {
                    callback(null, this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
                });
            if (!c._events.set)
                c.on("set", (value, callback) => {
                    if (value && (_accessory.context.deviceData.attributes.switch === "off")) {
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "mode");
                    }
                });
            this.accessories.storeCharacteristicItem("switch", _accessory.context.deviceData.deviceid, c);
        }
        c.updateValue(this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
        _accessory.context.deviceGroups.push("virtual_mode");
        return _accessory;
    }

    virtual_routine(_accessory, _service) {
        let c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.On);
        if (!c._events.get || !c._events.set) {
            if (!c._events.get)
                c.on("get", (callback) => {
                    callback(null, this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
                });
            if (!c._events.set)
                c.on("set", (value, callback) => {
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
        }
        c.updateValue(this.transforms.transformAttributeState('switch', _accessory.context.deviceData.attributes.switch));
        _accessory.context.deviceGroups.push("virtual_routine");
        return _accessory;
    }

    water_sensor(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.LeakDetected, 'water');
        _accessory.manageGetCharacteristic(_service, Characteristic.StatusActive, 'status');
        if (_accessory.hasCapability('Tamper Alert'))
            _accessory.manageGetCharacteristic(_service, Characteristic.StatusTampered, 'tamper');
        _accessory.context.deviceGroups.push("window_shade");
        return _accessory;
    }

    window_covering(_accessory, _service) {
        _accessory.manageGetCharacteristic(_service, Characteristic.CurrentPosition, 'level');
        _accessory.getOrAddService(_service).setCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);

        let c = _accessory.getOrAddService(_service).getCharacteristic(Characteristic.TargetPosition);
        if (!c._events.get || !c._events.set) {
            if (!c._events.get) {
                c.on("get", (callback) => {
                    callback(null, parseInt(_accessory.context.deviceData.attributes.level));
                });
            }
            if (!c._events.set) {
                c.on("set", (value, callback) => {
                    if (_accessory.hasCommand('close') && value === 0) {
                        // setLevel: 0, not responding on spring fashion blinds
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "close");
                    } else {
                        this.client.sendDeviceCommand(callback, _accessory.context.deviceData.deviceid, "setLevel", {
                            value1: value
                        });
                    }
                });
            }
            this.accessories.storeCharacteristicItem("level", _accessory.context.deviceData.deviceid, c);
        }
        c.updateValue(this.transforms.transformAttributeState('level', _accessory.context.deviceData.attributes.level, 'Target Position'));
        _accessory.context.deviceGroups.push("window_shade");
        return _accessory;
    }
};