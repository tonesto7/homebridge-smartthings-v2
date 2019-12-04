# homebridge-smartthings-v2

## About
V2 of this plugin is a complete rewrite of the homebridge-smartthings-tonesto7 plugin using modern Javascript structure using classes, promises, arrow functions.

[![npm version](https://badge.fury.io/js/homebridge-smartthings-v2.svg)](https://badge.fury.io/js/homebridge-smartthings-v2)

**```Latest SmartApp Version: 2.0.1```**

### What's New for 2.0:


#### Plugin
* Completely rewrote the entire plugin. It's now much cleaner, easier to maintain and follow.
* It's Faster/leaner and way more stable that previous versions.
* It now uses Homebridges Dynamic platform API, meaning it no longer requires a restart of homebridge for device changes to occur and uses a device cache on service restart to prevent losing all of your devices when the plugin fails to start for an extended period of time.
* It will now removes devices no longer selected under SmartThings.
* All new logging system to provide more insight into issues and status, as well as write them to a file.
* Many, many other bug fixes for devices, commands and many other items.
* ***Important NOTICE:*** Due to the changes in the plugin api you can not directly update the plugin, you will need to add as a new accessory and set it up your devices/automations/scenes again. On a positive note you can use the same SmartApp instance though as long as you update to the latest code.***

#### SmartApp
* Cleaned up the UI and made it easier to follow and more organized.
* Added new filter options.
* Optimized the command/event streaming system.
* Added duplicate device detection and cleanups.
* Many, many other bug fixes and cleanups.

## Credits
Big thanks for @Areson for his help/motivation in rewriting this.

I also wanted to mention the following projects I referenced for inspiration for design and fixes:
* homebridge-wink3
* homebridge-hubconnect-hubitat

## Change Log:

### SmartThing App:

***v2.0.0*** - Updated to support v2.0 of the plugin, cleaner layout, tons of optimizations, and many bugfixes;

### Homebridge Plugin:

***v2.0.0*** - Update to v2.0.0 to support Homebridge dynamic plugin api (Thanks @areson).  So devices can be loaded from cache.


#### Direct Updates from SmartThings
 * This method is nearly instant.
 * This option allows the hub to send updates directly to your homebridge-smartthings installation.
 * The hub must be able to send an http packet to your device so make sure to allow incoming traffic on the applicable port.
 * The port used for this can be configured by the "direct_port" setting and defaults to 8000.
 * The program will attempt to determine your IP address automatically, but that can be overridden by "direct_ip" which is useful if you have multiple addresses.
 * As a note, the hub isn't actual doing any of the processing so if you lose Internet, updates will stop. I'm told it "doesn't currently" support it, so there is hope.

When properly setup, you should see something like this in your Homebridge startup immediately after the PIN:
```
[11/25/2019, 4:44:46 PM] [SmartThings-v2] Devices to Remove: (0) []
[11/25/2019, 4:44:46 PM] [SmartThings-v2] Devices to Update: (40)
[11/25/2019, 4:44:46 PM] [SmartThings-v2] Devices to Create: (0) []
[11/25/2019, 4:44:46 PM] [SmartThings-v2] Total Initialization Time: (2 seconds)
[11/25/2019, 4:44:46 PM] [SmartThings-v2] Unknown Capabilities: ["Power Source"]
[11/25/2019, 4:44:46 PM] [SmartThings-v2] SmartThings DeviceCache Size: (40)
[11/25/2019, 4:44:46 PM] [SmartThings-v2] WebServer Initiated...
[11/25/2019, 4:44:46 PM] [SmartThings-v2] Sending StartDirect Request to SmartThings | SendToLocalHub: (false)
[11/25/2019, 4:44:46 PM] [SmartThings-v2] Direct Connect is Listening On 10.0.0.163:8000
```

# Installation

Installation comes in two parts:

## 1. SmartApp Installation

### Option 1: Automated Install
   Install using my [SmartThings Community Installer](http://thingsthataresmart.wiki/index.php?title=Community_Installer_(Free_Marketplace))

### Option 2: GitHub Integration or Manual Install

_Note New SmartThings users: You must first enable github integration. (If you use github for work you will probably want to set up a new account as it will request access to your private repos). Only after enabling integration will you see the settings button. Non-US users [can set it up here](https://graph-eu01-euwest1.api.smartthings.com/githubAuth/step1)_.

_Note to users updating from homebridge-smartthings-tonesto7: You can continue to use the original Homebridge-SmartThings app if you choose, but to keep it aligned with any changes made to the `homebridge-smartthings-v2` plugin you should consider migrating the app to point to `homebridge-smartthings-v2` repository instead of `homebridge-smartthings-tonesto7` or `homebridge-smartthings`._
* Log into your SmartThings account at [SmartThings IDE](https://account.smartthings.com/login)
* Click on <u><b>```My SmartApps```</b></u>
* Click on Settings and Add the New repository:
   * Owner: <u>```tonesto7```</u>
   * Name: <u>```homebridge-smartthings-v2```</u>
   * Branch: <u>```master```</u>
   * Click <u><b>```Save```</b></u>.
* Click <u><b>```Update From Repo```</b></u>
   * Select <u>```homebridge-smartthings-v2```</u>
* You should have <u>homebridge-v2.groovy</u> in the New section.
   * Check the Box next to <u>```homebridge-v2.groovy```</u>
   * Check <u><b>```Publish```</b></u> at the bottom
   * Click <u><b>```Execute Update```</b></u>.

* Click on the <u>```homebridge-v2```</u> app in the list:
   * Click <u><b>```App Settings```</b></u>
   * Scroll down to the OAuth section and click <u><b>```Enable OAuth in Smartapp```</b></u>
   * Click <u><b>```Update```</b></u> at the bottom.

<br>

## 2. SmartApp Configuration

* In the [SmartThings Classic Mobile App](https://apps.apple.com/app/smartthings-classic/id590800740), goto <u>```Marketplace```</u> and select <u>```SmartApps```</u>.
* At the bottom of the list, select <u>```My Apps```</u>
* Select <u>```Homebridge v2```</u> from the choices on thelist.
* Configuring the App:

   <u>There are 4 inputs at the top that can be used to force a device to be discovered as a specific type in HomeKit</u>

   Any other devices being added just Tap on the input next to an appropriate device group and then select each device you would like to use (The same devices can be in any of the Sensor, Switch, Other inputs)
    * There are several categories because of the way SmartThings assigns capabilities. So you might not see your device in one, but might in another.
    * Almost all devices contain the Refresh capability and are under the "Other Devices" group
    * Some sensors don't have a refresh and are under the "Sensor Devices" group.
    * Some devices, mainly Virtual Switches, only have the Switch Capability and are in the "Switch Devices".

    <b>Selecting the same device in multiple categories it will only be shown once in HomeKit, so you can safely check them all in all groups</b>

 * Tap <u><b>```Done```</b></u>
 * Tap <u><b>```Done```</b></u>
 You are finished with the App configuration!

<br>

## 3. Homebridge Plugin Installation:

***NOTICE:*** I highly recommend installing the plugin [homebridge-config-ui-x](https://github.com/oznu/homebridge-config-ui-x) to manage your homebridge instance and configs. This will allow you to use the web based form to configure this plugin.


 1. Install homebridge using: ```npm i -g homebridge``` (For Homebridge Install: [Homebridge Instructions](https://github.com/nfarina/homebridge/blob/master/README.md))
 2. Install SmartThings plugin using: ```npm i -g homebridge-smartthings-v2```
 3. Update your configuration file. See sample config.json snippet below.

  <h3 style="padding: 0em .6em;">Config.json Settings Example</h3>

  <h4 style="padding: 0em .6em; margin-bottom: 5px;"><u>Example of all settings. Not all settings are required. Read the breakdown below</u></h4>

```
      "platform": "SmartThings-v2",
      "name": "SmartThings-v2",
      "app_url": "https://graph.api.smartthings.com:443/api/smartapps/installations/",
      "app_id": "ffc2dd6e-6fa5-48a9-b274-35c4185ed9ac",
      "access_token": "1888d2bc-7792-1114-9f32-e4724e388a26",
      "direct": true,
      "direct_port": 8000,
      "excluded_capabilities": {
         "SMARTTHINGS-DEVICE-ID-1": [
            "Switch",
            "Temperature Measurement"
         ]
      },
      "logConfig": {
         "debug": false,
         "showChanges": true,
         "hideTimestamp": false,
         "hideNamePrefix": false,
         "file": {
            "enabled": true,
            "level": "good"
         }
      }
```


 * <p><u>platform</u> & <u>name</u>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    This information is used by homebridge to identify the plugin and should be the settings above.</p>

 * <p><u>app_url</u> & <u>app_id</u> & <u>access_token</u>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    To get this information, open Homebridge (SmartThings) SmartApp in your SmartThings Classic Mobile App, and tap on "View Configuration Data for Homebridge"<br><small style="color: yellow;"><b>Notice:</b> The app_url in the example will be different for you.</small></p>

 * <p><u>direct_ip</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `First available IP on your computer`</i></small><br>
    Most installations won't need this, but if for any reason it can't identify your ip address correctly, use this setting to force the IP presented to SmartThings for the hub to send to.</p>

 * <p>
   <u>direct_port</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `8000`</i></small><br>
   This is the port that homebridge-smartthings plugin will listen on for traffic from your hub. Make sure your firewall allows incoming traffic on this port from your hub's IP address.
   </p>

 * <p><u>local_commands</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>
    This will allow the service to send homekit commands to hub locally (SmartThings only)</p>

 * <p><u>excluded_capabilities</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `{}` (None)</i></small><br>
   NOTICE: The smartapp offers many inputs to help filter out device capabilities. Only use this if the available inputs don't meet your needs.
   Specify the SmartThings device by ID and the associated capabilities you want the plugin to ignore<br>This prevents a SmartThings device creating unwanted or redundant HomeKit accessories.</p>

 * <p>
   <u>logConfig</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small><br>
   Define log output format options as well as enable the log file output

   - <u>debug</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>Enables Debug log output

   - <u>showChanges</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `true`</i></small><br>Logs device event changes received from SmartThings

   - <u>hideTimestamp</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>Hides timestamp prefix from console log output

   - <u>hideNamePrefix</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>Hides pluglin name prefix `[SmartThings-v2]` from console log output

   - <u>file</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small><br>
      Enable log file output and configure options

     - <u>enabled</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>
      Activates logging to file (homebridge-smartthings-v2.log) stored in the same folder as the homebridge config.json

     - <u>level</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `good`</i></small><br>
     Defines the log entry levels that are written to the file. `good`(recommended) is the default which will write all necessary entries.
   </p>

## Frequently Asked Question:

 ***Q:*** Can this support Samsung Washer, Dryers, Window AC, Robot Vacuum's<br>
 ***A:*** Not in the way you hoped. There are no characteristics in Homekit to allow it beyond simple On/Off Switches

 ***Q:*** Can this support Axis Blinds<br>
 ***A:*** Maybe, I can support any device that has windowShade capability and/or level attributes


## DONATIONS:

<a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=HWBN4LB9NMHZ4">PayPal Donations Link</a>
