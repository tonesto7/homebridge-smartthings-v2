# homebridge-smartthings-v2
[![npm](https://img.shields.io/npm/v/homebridge-smartthings-v2?style=for-the-badge)](https://www.npmjs.com/package/homebridge-smartthings-v2)
[![npm](https://img.shields.io/npm/dt/homebridge-smartthings-v2?style=for-the-badge)](https://www.npmjs.com/package/homebridge-smartthings-v2)
![npm](https://img.shields.io/npm/dw/homebridge-smartthings-v2?style=for-the-badge)
[![GitHub issues](https://img.shields.io/github/issues/tonesto7/homebridge-smartthings-v2?style=for-the-badge)](https://github.com/tonesto7/homebridge-smartthings-v2/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/tonesto7/homebridge-smartthings-v2?style=for-the-badge)](https://github.com/tonesto7/homebridge-smartthings-v2/pulls)

## About
V2 of this plugin is a complete rewrite of the homebridge-smartthings-tonesto7 plugin using modern Javascript structure using classes, promises, arrow functions.

![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/tonesto7/homebridge-smartthings-v2?label=Latest%20SmartApp%20Version&sort=semver&style=for-the-badge)

## Credits
Big thanks for @Areson for his help/motivation in rewriting this.

I also wanted to mention the following projects I referenced for inspiration for design and fixes:
* [homebridge-wink3](https://github.com/sibartlett/homebridge-wink3)
* [homebridge-hubconnect-hubitat](https://github.com/danTapps/homebridge-hubitat-hubconnect)

## Change Log:

### SmartThing App:

- See [CHANGELOG](https://github.com/tonesto7/homebridge-smartthings-v2/blob/master/CHANGELOG-app.md)

### Homebridge Plugin:

- See [CHANGELOG](https://github.com/tonesto7/homebridge-smartthings-v2/blob/master/CHANGELOG.md)

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
   * (If you are upgrading from a previous version of this project, OAuth will likely already be enabled, and you can safely disregard this step)
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
   {
      "platform": "SmartThings-v2",
      "name": "SmartThings-v2",
      "app_url": "https://graph.api.smartthings.com:443/api/smartapps/installations/",
      "app_id": "ffc2dd6e-6fa5-48a9-b274-35c4185ed9ac",
      "access_token": "1888d2bc-7792-1114-9f32-e4724e388a26",
      "communityUserName": "tonesto7",
      "direct_ip": "10.0.0.15",
      "direct_port": 8000,
      "local_commands": true,
      "temperature_unit": "F",
      "validateTokenId": false,
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
   }
```


 * <p><code>platform</code> & <code>name</code>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    This information is used by homebridge to identify the plugin and should be the settings above.</p>

 * <p><code>app_url</code> & <code>app_id</code> & <code>access_token</code>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    To get this information, open Homebridge (SmartThings) SmartApp in your SmartThings Classic Mobile App, and tap on "View Configuration Data for Homebridge"<br><small style="color: yellow;"><b>Notice:</b> The app_url in the example will be different for you.</small></p>

 * <p><code>communityUserName</code>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: ``</i></small><br>
    Only needed when you are having issues with the plugin and you want me to be able to identify your reported exception errors.</p>

 * <p><code>direct_ip</code>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `First available IP on your computer`</i></small><br>
    Most installations won't need this, but if for any reason it can't identify your ip address correctly, use this setting to force the IP presented to SmartThings for the hub to send to.</p>

 * <p>
   <code>direct_port</code>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `8000`</i></small><br>
   This is the port that homebridge-smartthings plugin will listen on for traffic from your hub. Make sure your firewall allows incoming traffic on this port from your hub's IP address.
   </p>

 * <p><code>local_commands</code>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>
    This will allow the service to send homekit commands to hub locally, this is also available under the SmartApp settings.</p>

 * <p><code>temperature_unit</code>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `F`</i></small><br>
    This will allow you to define the temp unit to use.  This can also be set in the SmartApp</p>

 * <p><u>validateTokenId</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>
    This forces the plugin to validate the smartthings app token and location with that in the plugin configuration</p>

 * <p><u>excluded_capabilities</u><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `{}` (None)</i></small><br>
   NOTICE: The smartapp offers many inputs to help filter out device capabilities. Only use this if the available inputs don't meet your needs.
   Specify the SmartThings device by ID and the associated capabilities you want the plugin to ignore<br>This prevents a SmartThings device creating unwanted or redundant HomeKit accessories.</p>

 * <p>
   <code>logConfig</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small><br>
   Define log output format options as well as enable the log file output

   - <code>debug</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>Enables Debug log output

   - <code>showChanges</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `true`</i></small><br>Logs device event changes received from SmartThings

   - <code>hideTimestamp</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>Hides timestamp prefix from console log output

   - <code>hideNamePrefix</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>Hides pluglin name prefix `[SmartThings-v2]` from console log output

   - <code>file</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small><br>
      Enable log file output and configure options

     - <code>enabled</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `false`</i></small><br>
      Activates logging to file (homebridge-smartthings-v2.log) stored in the same folder as the homebridge config.json

     - <code>level</code><small style="color: #f92672; font-weight: 600;"><i> Optional</i></small> | <small style="color: green; font-weight: 600;"><i>Default: `good`</i></small><br>
     Defines the log entry levels that are written to the file. `good`(recommended) is the default which will write all necessary entries.
   </p>

## Frequently Asked Question:

 ***Q:*** Can this support Samsung Washer, Dryers, Window AC, Robot Vacuum's<br>
 ***A:*** Not in the way you hoped. There are no characteristics in Homekit to allow it beyond simple On/Off Switches

 ***Q:*** Can this support Axis Blinds<br>
 ***A:*** Maybe, I can support any device that has windowShade capability and/or level attributes

## Known Issues:

* When you change capability filters on a device already created under homekit it will not remove the old capabilities from the device (I'm working on this)

## DONATIONS:

<a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RVFJTG8H86SK8&source=url">PayPal Donations Link</a>
