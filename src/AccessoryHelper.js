module.exports = class AccessoryHelper {
  constructor(options) {
    this.config = options.config;
    this.definitions = options.definitions;
    this.hap = options.hap;
    this.log = options.log;
    this.onChange = options.onChange;
  }

  getOrAddService(accessory, service) {
    return accessory.getService(service) || accessory.addService(service);
  }

  getOrAddCharacteristic(service, characteristic) {
    return (
      service.getCharacteristic(characteristic) ||
      service.addCharacteristic(characteristic)
    );
  }

  getDefinition(device) {
    const definition = this.definitions[device.object_type];
    const last_reading = device.last_reading;
    return {
      ...definition,
      services: definition.services
        .filter(
          service =>
            !service.supported ||
            service.supported(last_reading, device, this.config)
        )
        .map(service => ({
          ...service,
          characteristics: service.characteristics.filter(
            characteristic =>
              !characteristic.supported ||
              characteristic.supported(last_reading, device, this.config)
          )
        }))
    };
  }

  configureAccessory(accessory) {
    this.configureAccessoryCharacteristics(accessory);
    this.updateAccessoryState(accessory);
  }

  configureAccessoryCharacteristics(accessory) {
    const { Characteristic, Service } = this.hap;
    const device = accessory.context;

    accessory
      .getService(Service.AccessoryInformation)
      .setCharacteristic(
        Characteristic.Manufacturer,
        device.device_manufacturer
      )
      .setCharacteristic(Characteristic.Model, device.model_name)
      .setCharacteristic(Characteristic.SerialNumber, device.object_id);

    const services = accessory.definition.services;

    services.forEach(definition => {
      const service = this.getOrAddService(accessory, definition.service);

      definition.characteristics.forEach(c => {
        if (c.value) {
          service.setCharacteristic(c.characteristic, c.value);
          return;
        }

        const characteristic = this.getOrAddCharacteristic(
          service,
          c.characteristic
        );

        if (c.get) {
          characteristic.on(
            "get",
            this.readAccessory.bind(this, accessory, c.get)
          );
        }

        if (c.set) {
          characteristic.on(
            "set",
            this.writeAccessory.bind(this, accessory, c.set)
          );
        }
      });
    });
  }

  removeDeprecatedServices(accessory, newAccessory) {
    const configuredServices = newAccessory.services.map(s => s.UUID);

    accessory.services
      .filter(s => !configuredServices.includes(s.UUID))
      .forEach(s => accessory.removeService(s));
  }

  readAccessory(accessory, get, callback) {
    // First argument is current state
    // Second argument is desired state (merged state)
    const value = get(accessory.context.last_reading, accessory.merged_state);
    callback(null, value);
  }

  writeAccessory(accessory, set, value, callback) {
    const state = set(value, accessory);

    this.onChange(accessory, state)
      .then(response => {
        if (response) {
          this.updateAccessoryState(accessory, {
            ...accessory.context,
            desired_state: {
              ...accessory.context.desired_state,
              ...response.data.desired_state
            }
          });
        }
        callback();
      })
      .catch(e => {
        this.log.error(
          `Failed to update device: ${accessory.context.name} (${
            accessory.context.object_type
          }/${accessory.context.object_id})`,
          e
        );
        callback(e);
      });
  }

  updateAccessoryState(accessory, device) {
    const context = accessory.context;
    const mergedValues1 = accessory.merged_state;
    const mergedValues2 = device && {
      ...device.last_reading,
      ...device.desired_state
    };

    if (device) {
      accessory.context = device;
    }

    accessory.definition.services.forEach(s => {
      const service = accessory.getService(s.service);

      s.characteristics.filter(c => c.get).forEach(c => {
        const oldValue = c.get(context.last_reading, mergedValues1);
        const newValue = device && c.get(device.last_reading, mergedValues2);

        if (device && oldValue === newValue) {
          return;
        }

        const characteristic = service.getCharacteristic(c.characteristic);
        characteristic && characteristic.getValue();
      });
    });
  }
};
