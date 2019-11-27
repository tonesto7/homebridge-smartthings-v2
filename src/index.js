const {
    pluginName,
    platformName
} = require("./Constants");
const StPlatform = require("./ST_Platform");

module.exports = (homebridge) => {
    homebridge.registerPlatform(pluginName, platformName, StPlatform, true);
};