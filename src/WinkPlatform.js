const childProcess = require("child_process");
const fs = require("fs");

const _ = require("lodash");
const compareVersions = require("compare-versions");
const Joi = require("joi");

const Accessories = require("./Accessories");
const AccessoryHelper = require("./AccessoryHelper");
const configSchema = require("./configSchema");
const devices = require("./devices");
const { pluginName, platformName } = require("./constants");
const Subscriptions = require("./Subscriptions");
const WinkClient = require("./WinkClient");
const pkg = require("../package.json");

module.exports = class WinkPlatform {
    constructor(log, config, api) {
        if (!config) {
            log("Plugin not configured.");
            return;
        }

        const result = Joi.validate(config, configSchema);
        if (result.error) {
            log.error("Invalid config.", result.error.message);
            return;
        }

        this.log = log;
        this.config = this.cleanConfig(config);
        this.api = api;

        this.checkVersion();

        this.definitions = devices(api.hap);
        this.accessories = new Accessories();
        this.accessoryHelper = new AccessoryHelper({
            config: this.config,
            definitions: this.definitions,
            hap: api.hap,
            log,
            onChange: this.handleAccessoryStateChange.bind(this)
        });
        this.client = new WinkClient({
            config: this.config,
            log,
            updateConfig: config => this.updateConfig(config)
        });
        this.interval = null;
        this.subscriptions = new Subscriptions();

        this.subscriptions.on("device-list", () => this.refreshDevices());
        this.subscriptions.on("device-update", device => {
            this.log(
                `Received update notification: ${device.name} (${device.object_type}/${
          device.object_id
        })`
            );
            this.updateDevice(device);
        });
        this.subscriptions.on("unknown-message", message => {
            this.log.warn("Received unknown notification:", message);
        });

        this.api.on("didFinishLaunching", this.didFinishLaunching.bind(this));
    }

    updateConfig(newConfig) {
        const configPath = this.api.user.configPath();
        const file = fs.readFileSync(configPath);
        const config = JSON.parse(file);
        const platConfig = config.platforms.find(x => x.name == this.config.name);
        _.extend(platConfig, newConfig);
        const serializedConfig = JSON.stringify(config, null, "  ");
        fs.writeFileSync(configPath, serializedConfig, "utf8");
        _.extend(this.config, newConfig);
    }

    checkVersion() {
        childProcess.exec(`npm view ${pkg.name} version`, (error, stdout) => {
            const latestVersion = stdout && stdout.trim();
            if (latestVersion && compareVersions(stdout.trim(), pkg.version) > 0) {
                this.log.warn(
                    `NOTICE: New version of ${pkg.name} available: ${latestVersion}`
                );
            }
        });
    }

    cleanConfig(config) {
        const newConfig = {
            debug: false,
            direct_access: true,
            fan_ids: [],
            hide_groups: [],
            hide_ids: [],
            outlet_ids: [],
            switch_ids: [],
            window_ids: [],
            ...config
        };

        ["fan_ids", "hide_ids", "window_ids"].forEach(field => {
            newConfig[field] = newConfig[field].map(id => id.toString());
        });

        return newConfig;
    }

    handleAccessoryStateChange(accessory, state) {
        return this.client.updateDevice(accessory, state);
    }

    configureAccessory(accessory) {
        if (!this.accessories) {
            return;
        }

        this.patchAccessory(accessory);
        this.accessories.add(accessory);
        this.log(
            `Loaded from cache: ${accessory.context.name} (${
        accessory.context.object_type
      }/${accessory.context.object_id})`
        );
    }

    patchAccessory(accessory, device) {
        if (device) {
            accessory.context = device;
        }
        accessory.definition = this.accessoryHelper.getDefinition(
            accessory.context
        );
        Object.defineProperty(accessory, "merged_state", {
            get: function() {
                return {
                    ...this.context.last_reading,
                    ...this.context.desired_state
                };
            }
        });
    }

    async didFinishLaunching() {
        const authenticated = await this.client.authenticate();

        if (authenticated) {
            this.accessories.forEach(accessory => {
                const device = accessory.context;
                const newAccessory = this.getNewAccessory(device);

                this.accessoryHelper.configureAccessory(accessory);
                this.accessoryHelper.removeDeprecatedServices(accessory, newAccessory);
            });

            this.interval = setInterval(() => this.refreshDevices(), 60 * 60 * 1000);

            this.refreshDevices();
        }
    }

    getNewAccessory(device) {
        const { uuid } = this.api.hap;
        const deviceId = uuid.isValid(device.uuid) ?
            device.uuid :
            uuid.generate(device.uuid);
        const accessory = new this.api.platformAccessory(device.name, deviceId);
        this.patchAccessory(accessory, device);
        this.accessoryHelper.configureAccessory(accessory);
        return accessory;
    }

    addDevice(device) {
        const accessory = this.getNewAccessory(device);
        this.api.registerPlatformAccessories(pluginName, platformName, [accessory]);
        this.accessories.add(accessory);
        this.log(
            `Added: ${accessory.context.name} (${accessory.context.object_type}/${
        accessory.context.object_id
      })`
        );
    }

    updateDevice(device) {
        const accessory = this.accessories.get(device);
        this.accessoryHelper.updateAccessoryState(accessory, device);
        this.subscriptions.subscribe(device.subscription);
    }

    async refreshDevices() {
        try {
            this.log("Refreshing devices...");

            // Request user - this should ensure that pubnub subscriptions don't stop working
            await this.client.getUser();

            const response = await this.client.getDevices();

            const [hubs, devices, ignoreDevices] = this.sortDevices(response.data);

            this.client.processHubs(hubs);

            const toRemove = this.accessories.diffRemove(devices);
            const toUpdate = this.accessories.intersection(devices);
            const toAdd = this.accessories.diffAdd(devices);

            if (response.subscription) {
                this.subscriptions.subscribe(response.subscription);
            }

            toRemove.forEach(this.removeAccessory, this);
            toUpdate.forEach(this.updateDevice, this);
            toAdd.forEach(this.addDevice, this);
            ignoreDevices.forEach(this.ignoreDevice, this);

            this.log("Devices refreshed");
        } catch (e) {
            this.log.error("Failed to refresh devices.", e);
        }
    }

    sortDevices(devices) {
        const supportedDevices = [];
        const ignoreDevices = [];

        const currentDevices = devices.filter(device => !device.hidden_at);

        currentDevices
            .filter(device => device.object_type !== "hub")
            .forEach(device => {
                const definition = this.definitions[device.object_type];

                if (!definition) {
                    ignoreDevices.push([device, "Not supported by HomeKit"]);
                    return;
                }

                const hide_groups =
                    this.config.hide_groups.indexOf(definition.group) !== -1 ||
                    this.config.hide_groups.indexOf(definition.type) !== -1;

                if (hide_groups) {
                    ignoreDevices.push([device, "Hidden by hide_groups config option"]);
                    return;
                }

                const hide_ids = this.config.hide_ids.indexOf(device.object_id) !== -1;

                if (hide_ids) {
                    ignoreDevices.push([device, "Hidden by hide_ids config option"]);
                    return;
                }

                supportedDevices.push(device);
            });

        const hubIds = supportedDevices.filter(x => x.hub_id).map(x => x.hub_id);

        const hubs = currentDevices.filter(
            device =>
            device.object_type === "hub" &&
            hubIds.includes(device.hub_id) &&
            device.last_reading.ip_address
        );

        return [hubs, supportedDevices, ignoreDevices];
    }

    ignoreDevice(data) {
        const [device, reason] = data;
        if (!this.accessories.ignore(device)) {
            return;
        }

        this.log(
            `${reason}: ${device.name} (${device.object_type}/${device.object_id})`
        );
    }

    removeAccessory(accessory) {
        if (this.accessories.remove(accessory)) {
            this.api.unregisterPlatformAccessories(pluginName, platformName, [
                accessory
            ]);
            this.log(
                `Removed: ${accessory.context.name} (${accessory.context.object_type}/${
          accessory.context.object_id
        })`
            );
        }
    }
};