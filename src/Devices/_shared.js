module.exports.batteryService = options => {
  const {
    Characteristic,
    Service,
    field = "battery",
    notCharging = false,
    lowLevel = 0.25
  } = options;

  const service = {
    service: Service.BatteryService,
    supported: state => state[field] !== undefined && state[field] !== null,
    characteristics: [
      {
        characteristic: Characteristic.BatteryLevel,
        get: state => Math.floor(state[field] * 100)
      },
      {
        characteristic: Characteristic.StatusLowBattery,
        get: state => {
          if (state[field] < lowLevel)
            return Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
          return Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
        }
      }
    ]
  };

  if (notCharging) {
    service.characteristics.push({
      characteristic: Characteristic.ChargingState,
      value: Characteristic.ChargingState.NOT_CHARGING
    });
  }

  return service;
};
