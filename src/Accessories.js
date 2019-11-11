const _ = require("lodash");

module.exports = class Accessories {
  constructor() {
    this.comparator = this.comparator.bind(this);
    this._accessories = {};
    this._ignored = {};
  }

  getAccessoryKey(accessory) {
    const context = accessory.context || accessory;
    return `${context.object_type}/${context.object_id}`;
  }

  get(device) {
    const key = this.getAccessoryKey(device);
    return this._accessories[key];
  }

  ignore(device) {
    const key = this.getAccessoryKey(device);
    if (this._ignored[key]) {
      return false;
    }

    this._ignored[key] = device;
    return true;
  }

  add(accessory) {
    const key = this.getAccessoryKey(accessory);
    return (this._accessories[key] = accessory);
  }

  remove(accessory) {
    const key = this.getAccessoryKey(accessory);
    const _accessory = this._accessories[key];
    delete this._accessories[key];
    return _accessory;
  }

  forEach(fn) {
    return _.forEach(this._accessories, fn);
  }

  intersection(devices) {
    const accessories = _.values(this._accessories);
    return _.intersectionWith(devices, accessories, this.comparator);
  }

  diffAdd(devices) {
    const accessories = _.values(this._accessories);
    return _.differenceWith(devices, accessories, this.comparator);
  }

  diffRemove(devices) {
    const accessories = _.values(this._accessories);
    return _.differenceWith(accessories, devices, this.comparator);
  }

  comparator(accessory1, accessory2) {
    return (
      this.getAccessoryKey(accessory1) === this.getAccessoryKey(accessory2)
    );
  }
};
