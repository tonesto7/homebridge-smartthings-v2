const {
    pluginName,
    platformName
} = require("./src/Constants");
const StPlatform = require("./src/ST_Platform");

module.exports = (homebridge) => {
    homebridge.registerPlatform(pluginName, platformName, StPlatform, true);
};