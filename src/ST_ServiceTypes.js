// const debounce = require('debounce-promise');
var Service;

module.exports = class ServiceTypes {
    constructor(accessories, srvc) {
        this.platform = accessories;
        this.log = accessories.log;
        this.logConfig = accessories.logConfig;
        this.accessories = accessories;
        this.client = accessories.client;
        this.myUtils = accessories.myUtils;
        this.CommunityTypes = accessories.CommunityTypes;
        Service = srvc;
        this.homebridge = accessories.homebridge;
        this.serviceMap = {
            alarm_system: Service.SecuritySystem,
            battery: Service.BatteryService,
            button: Service.StatelessProgrammableSwitch,
            carbon_dioxide: Service.CarbonDioxideSensor,
            carbon_monoxide: Service.CarbonMonoxideSensor,
            contact_sensor: Service.ContactSensor,
            energy_meter: Service.Outlet,
            fan: Service.Fanv2,
            garage_door: Service.GarageDoorOpener,
            humidity_sensor: Service.HumiditySensor,
            illuminance_sensor: Service.LightSensor,
            light: Service.Lightbulb,
            lock: Service.LockMechanism,
            motion_sensor: Service.MotionSensor,
            power_meter: Service.Outlet,
            presence_sensor: Service.OccupancySensor,
            smoke_detector: Service.SmokeSensor,
            speaker: Service.Speaker,
            switch_device: Service.Switch,
            temperature_sensor: Service.TemperatureSensor,
            thermostat: Service.Thermostat,
            valve: Service.Valve,
            virtual_mode: Service.Switch,
            virtual_routine: Service.Switch,
            water_sensor: Service.LeakSensor,
            window_covering: Service.WindowCovering
        };
    }

    AccessoryCategory(type) {
        switch (type.toUpperCase()) {
            case "OTHER":
                return 1;
            case "BRIDGE":
                return 2;
            case "FAN":
                return 3;
            case "GARAGE_DOOR_OPENER":
            case "GARAGE_DOOR":
                return 4;
            case "LIGHT":
                return 5;
            case "LOCK":
                return 6;
            case "OUTLET":
                return 7;
            case "SWITCH_DEVICE":
                return 8;
            case "THERMOSTAT":
                return 9;
            case "CARBON_DIOXIDE":
            case "CARBON_MONOXIDE":
            case "CONTACT_SENSOR":
            case "HUMIDITY_SENSOR":
            case "ILLUMINANCE_SENSOR":
            case "MOTION_SENSOR":
            case "PRESENCE_SENSOR":
            case "TEMPERATURE_SENSOR":
            case "WATER_SENSOR":
            case "SENSOR":
                return 10;
            case "ALARM_SYSTEM":
                return 11;
            case "SECURITY_SYSTEM":
                return 11;
            case "DOOR":
                return 12;
            case "WINDOW":
                return 13;
            case "WINDOW_COVERING":
                return 14;
            case "BUTTON":
            case "PROGRAMMABLE_SWITCH":
                return 15;
            case "RANGE_EXTENDER":
                return 16;
            case "CAMERA":
                return 17;
            case "IP_CAMERA":
                return 17;
            case "VIDEO_DOORBELL":
                return 18;
            case "AIR_PURIFIER":
                return 19;
            case "AIR_HEATER":
                return 20;
            case "AIR_CONDITIONER":
                return 21;
            case "AIR_HUMIDIFIER":
                return 22;
            case "AIR_DEHUMIDIFIER":
                return 23;
            case "APPLE_TV":
                return 24;
            case "HOMEPOD":
                return 25;
            case "SPEAKER":
                return 26;
            case "AIRPORT":
                return 27;
            case "SPRINKLER":
                return 28;
            case "FAUCET":
                return 29;
            case "SHOWER_HEAD":
                return 30;
            case "TELEVISION":
                return 31;
            case "TARGET_CONTROLLER":
                return 32;
            case "ROUTER":
                return 33;
            default:
                return 1;
        }
    };

    getServiceTypes(accessory) {
        let svcs = [];
        for (let i = 0; i < serviceTests.length; i++) {
            const svcTest = serviceTests[i];
            if (svcTest.ImplementsService(accessory)) {
                // console.log(svcTest.Name);
                const blockSvc = (svcTest.onlyOnNoGrps === true && svcs.length > 0);
                if (blockSvc) {
                    console.log(`(${accessory.name}) | Service BLOCKED | name: ${svcTest.Name} | Cnt: ${svcs.length} | svcs: ${JSON.stringify(svcs)}`);
                }
                if (!blockSvc && this.serviceMap[svcTest.Name]) {
                    svcs.push({
                        name: svcTest.Name,
                        type: this.serviceMap[svcTest.Name]
                    });
                }
            }
        }
        return svcs;
    }

    lookupServiceType(name) {
        if (this.serviceMap[name]) {
            return this.serviceMap[name];
        }
        return null;
    }
};

class ServiceTest {
    constructor(name, testfn, onlyOnNoGrps = false) {
        this.ImplementsService = testfn;
        this.Name = name;
        this.onlyOnNoGrps = (onlyOnNoGrps !== false);
    }
}

// NOTE: These Tests are executed in order which is important
const serviceTests = [
    new ServiceTest("window_shade", accessory => (accessory.hasCapability('Switch Level') && !accessory.hasCapability('Speaker') && !(accessory.hasCapability('Fan') || accessory.hasCapability('Fan Light') || accessory.hasCapability('Fan Speed') || accessory.hasCapability('Fan Control') || accessory.hasCommand('setFanSpeed') || accessory.hasCommand('lowSpeed') || accessory.hasAttribute('fanSpeed')) && accessory.hasCapability('Window Shade') && (accessory.hasCommand('levelOpenClose') || accessory.hasCommand('presetPosition'))), true),
    new ServiceTest("light", accessory => (accessory.hasCapability('Switch Level') && (accessory.hasCapability('LightBulb') || accessory.hasCapability('Fan Light') || accessory.hasCapability('Bulb') || accessory.context.deviceData.name.includes('light') || accessory.hasAttribute('saturation') || accessory.hasAttribute('hue') || accessory.hasAttribute('colorTemperature') || accessory.hasCapability("Color Control"))), true),
    new ServiceTest("garage_door", accessory => accessory.hasCapability("Garage Door Control")),
    new ServiceTest("lock", accessory => accessory.hasCapability("Lock")),
    new ServiceTest("valve", accessory => accessory.hasCapability("Valve")),
    new ServiceTest("speaker", accessory => accessory.hasCapability('Speaker')),
    new ServiceTest("fan", accessory => ((accessory.hasCapability('Fan') || accessory.hasCapability('Fan Light') || accessory.hasCapability('Fan Speed') || accessory.hasCapability('Fan Control') || accessory.hasCommand('setFanSpeed') || accessory.hasCommand('lowSpeed') || accessory.hasAttribute('fanSpeed'))), true),
    new ServiceTest("virtual_mode", accessory => accessory.hasCapability("Mode")),
    new ServiceTest("virtual_routine", accessory => accessory.hasCapability("Routine")),
    new ServiceTest("button", accessory => accessory.hasCapability("Button")),
    new ServiceTest("light", accessory => (accessory.hasCapability('Switch') && (accessory.hasCapability('LightBulb') || accessory.hasCapability('Fan Light') || accessory.hasCapability('Bulb') || accessory.context.deviceData.name.toLowerCase().includes('light'))), true),
    new ServiceTest("switch_device", accessory => (accessory.hasCapability('Switch') && !(accessory.hasCapability('LightBulb') || accessory.hasCapability('Fan Light') || accessory.hasCapability('Bulb') || accessory.context.deviceData.name.toLowerCase().includes('light'))), true),
    new ServiceTest("smoke_detector", accessory => accessory.hasCapability("Smoke Detector") && accessory.hasAttribute('smoke')),
    new ServiceTest("carbon_monoxide", accessory => accessory.hasCapability("Carbon Monoxide Detector") && accessory.hasAttribute('carbonMonoxide')),
    new ServiceTest("carbon_dioxide", accessory => accessory.hasCapability("Carbon Dioxide Measurement") && accessory.hasAttribute('carbonDioxideMeasurement')),
    new ServiceTest("motion_sensor", accessory => (accessory.hasCapability("Motion Sensor"))),
    new ServiceTest("water_sensor", accessory => (accessory.hasCapability("Water Sensor"))),
    new ServiceTest("presence_sensor", accessory => (accessory.hasCapability("Presence Sensor"))),
    new ServiceTest("humidity_sensor", accessory => (accessory.hasCapability("Relative Humidity Measurement") && !(accessory.hasCapability('Thermostat') || accessory.hasCapability('Thermostat Operating State') || accessory.hasAttribute('thermostatOperatingState')))),
    new ServiceTest("temperature_sensor", accessory => (accessory.hasCapability("Temperature Measurement") && !(accessory.hasCapability('Thermostat') || accessory.hasCapability('Thermostat Operating State') || accessory.hasAttribute('thermostatOperatingState')))),
    new ServiceTest("illuminance_sensor", accessory => (accessory.hasCapability("Illuminance Measurement"))),
    new ServiceTest("contact_sensor", accessory => (accessory.hasCapability('Contact Sensor') && !accessory.hasCapability('Garage Door Control'))),
    new ServiceTest("battery", accessory => (accessory.hasCapability('Battery'))),
    new ServiceTest("energy_meter", accessory => (accessory.hasCapability('Energy Meter') && !accessory.hasCapability('Switch')), true),
    new ServiceTest("power_meter", accessory => (accessory.hasCapability('Power Meter') && !accessory.hasCapability('Switch')), true),
    new ServiceTest("thermostat", accessory => (accessory.hasCapability('Thermostat') || accessory.hasCapability('Thermostat Operating State') || accessory.hasAttribute('thermostatOperatingState'))),
    new ServiceTest("alarm_system", accessory => (accessory.hasAttribute("alarmSystemStatus")))
];