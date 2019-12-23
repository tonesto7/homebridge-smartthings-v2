const express = require('express');
const bodyParser = require('body-parser');
const SmartApp = require('@smartthings/smartapp');
const app = new SmartApp();
const PORT = process.env.PORT || 3005;
const server = module.exports = express();
server.use(bodyParser.json());

/* Only here for Glitch, so that GET doesn't return an error */
server.get('/', (req, res) => {
    res.send('Turns lights when motion is detected');
});

/* Handles lifecycle events from SmartThings */
server.post('/', async(req, res) => {
    app.handleHttpCallback(req, res);
});

/* Defines the SmartApp */
app.enableEventLogging(2) // Log and pretty-print all lifecycle events and responses
    .configureI18n() // Use files from locales directory for configuration page localization
    .publicKey('@smartthings_rsa.pub') // Public key defined with JSON so that it isn't copied when remixing
    .page('mainPage', (ctx, page) => {
        page.section('When there is activity here', (section) => {
            section.deviceSetting('motionSensors')
                .name('Select motion sensors')
                .description('Tap to set')
                .capabilities(['motionSensor'])
                .multiple(true);
        });
        page.section('Turn on these lights', (section) => {
            section.deviceSetting('lights')
                .name('Select lights')
                .description('Tap to set')
                .capabilities(['switch'])
                .multiple(true)
                .permissions('rx');
        });
        page.section('Options', (section) => {
            section.booleanSetting('turnOff').name('Turn off when motion stops');
            section.numberSetting('offDelay').name('After this number of seconds').defaultValue("0");
        });
    })
    .updated(async(ctx) => {
        await ctx.api.subscriptions.unsubscribeAll();
        return Promise.all([
            ctx.api.subscriptions.subscribeToDevices(ctx.config.motionSensors, 'motionSensor', 'motion.active', 'motionActiveHandler'),
            ctx.api.subscriptions.subscribeToDevices(ctx.config.motionSensors, 'motionSensor', 'motion.inactive', 'motionInactiveHandler')
        ]);
    })
    .subscribedEventHandler('motionActiveHandler', (ctx, event) => {
        const result = [ctx.api.devices.sendCommands(ctx.config.lights, "switch", "on")];
        if (ctx.configBooleanValue('turnOff') && ctx.configStringValue('offDelay') && ctx.configNumberValue('offDelay') > 0) {
            result.push(ctx.api.schedules.unschedule('motionStopHandler'));
        }
        return Promise.all(result);
    })
    .subscribedEventHandler('motionInactiveHandler', async(ctx, event) => {
        if (ctx.configBooleanValue('turnOff')) {
            const quiet = await othersQuiet(ctx, ctx.config.motionSensors, event.deviceId);
            if (quiet) {
                const delay = ctx.configNumberValue('offDelay');
                if (ctx.configStringValue('offDelay') && delay > 0) {
                    return ctx.api.schedules.runIn('motionStopHandler', delay);
                } else {
                    return ctx.api.devices.sendCommands(ctx.config.lights, "switch", "off");
                }
            }
        }
    })
    .scheduledEventHandler('motionStopHandler', (ctx, event) => {
        return ctx.api.devices.sendCommands(ctx.config.lights, "switch", "off");
    });

async function othersQuiet(ctx, devices, thisDeviceId) {
    const otherDevices = devices
        .filter(device => { return device.deviceConfig.deviceId !== thisDeviceId; })
        .map(device => { return ctx.api.devices.getAttributeValue(device.deviceConfig.deviceId, 'motionSensor', 'motion'); });

    const values = await Promise.all(otherDevices);
    if (values.find(value => { return value === "active"; })) {
        return false;
    } else {
        return true;
    }
}

/* Starts the server */
server.listen(PORT);
console.log(`Open: http://127.0.0.1:${PORT}`);