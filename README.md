# homebridge-smartthings-2.0

This is based off of @pdlove homebridge-smartthings and homebridge-smartthings-tonesto7

[![npm version](https://badge.fury.io/js/homebridge-smartthings-2.0.svg)](https://badge.fury.io/js/homebridge-smartthings-2.0)

**```Current SmartApp version: 2.0.0```**

<br>

# Change Log:

#### SmartThing App:

***v2.0.0*** - Updated to support v2.0 of the plugin

#### Homebridge Plugin:


***v2.0.0*** - Update to v2.0.0 to support Homebridge dynamic plugin api (Thanks @areson).  So devices can be loaded from cache.

<br>

## This version is not compatible with prior versions of homebridge-smartthings or homebridge-smartthings-tonesto7 Smartapp and plugin.

### Direct Updates from SmartThings
 * This method is nearly instant.
 * This option allows the hub to send updates directly to your homebridge-smartthings installation.
 * The hub must be able to send an http packet to your device so make sure to allow incoming traffic on the applicable port.
 * The port used for this can be configured by the "direct_port" setting and defaults to 8000.
 * The program will attempt to determine your IP address automatically, but that can be overridden by "direct_ip" which is useful if you have multiple addresses.
 * As a note, the hub isn't actual doing any of the processing so if you lose Internet, updates will stop. I'm told it "doesn't currently" support it, so there is hope.

When properly setup, you should see something like this in your Homebridge startup immediately after the PIN:
```
[1/29/2017, 8:28:45 AM] Homebridge is running on port 51826.
[1/29/2017, 8:28:45 AM] [SmartThings] Direct Connect Is Listening On 10.0.0.70:8000
[1/29/2017, 8:28:45 AM] [SmartThings] SmartThings Hub Communication Established
```

# Installation

Installation comes in two parts:

## 1. SmartApp Installation

* Log into your SmartThings account at [SmartThings IDE](https://account.smartthings.com/login)

_Note New SmartThings users: You must first enable github integration. (If you use github for work you will probably want to set up a new account as it will request access to your private repos). Only after enabling integration will you see the settings button. Non-US users [can set it up here](https://graph-eu01-euwest1.api.smartthings.com/githubAuth/step1)_.

* Click on <u><b>```My SmartApps```</b></u>
* Click on Settings and Add the New repository:
   * Owner: <u>```tonesto7```</u>
   * Name: <u>```homebridge-smartthings-tonesto7```</u>
   * Branch: <u>```master```</u>
   * Click <u><b>```Save```</b></u>.
* Click <u><b>```Update From Repo```</b></u>
   * Select <u>```homebridge-smartthings-tonesto7```</u>
* You should have <u>homebridge-smartthings.groovy</u> in the New section.
   * Check the Box next to <u>```homebridge-smartthings.groovy```</u>
   * Check <u><b>```Publish```</b></u> at the bottom
   * Click <u><b>```Execute Update```</b></u>.

* Click on the <u>```Homebridge-SmartThings```</u> app in the list:
   * Click <u><b>```App Settings```</b></u>
   * Scroll down to the OAuth section and click <u><b>```Enable OAuth in Smartapp```</b></u>
   * Click <u><b>```Update```</b></u> at the bottom.

<br>

## 2. SmartApp Configuration

* In the [SmartThings Classic Mobile App](https://apps.apple.com/app/smartthings-classic/id590800740), goto <u>```Marketplace```</u> and select <u>```SmartApps```</u>.
* At the bottom of the list, select <u>```My Apps```</u>
* Select <u>```Homebridge (SmartThings)```</u> from the choices on thelist.
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

 1. Install homebridge using: ```npm i -g homebridge``` (For Homebridge Install: [Homebridge Instructions](https://github.com/nfarina/homebridge/blob/master/README.md))
 2. Install SmartThings plugin using: ```npm i -g homebridge-smartthings-2.0```
 3. Update your configuration file. See sample config.json snippet below.

  <h3 style="padding: 0em .6em;">Config.json Settings Example</h3>

  <h4 style="padding: 0em .6em; margin-bottom: 5px;"><u>Example of all settings. Not all settings are required. Read the breakdown below</u></h4>

   <div style="overflow:auto;width:auto;border-width:.1em .1em .1em .8em;padding:.2em .6em;"><pre style="margin: 0; line-height: 125%"><span style="color: #f8f8f2">{</span>
   <span style="color: #f92672">&quot;platform&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;SmartThings&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;name&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;SmartThings&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;app_url&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;https://graph.api.smartthings.com:443/api/smartapps/installations/&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;app_id&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;d023c841-7f94-44ea-9e78-3039605f6b29&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;access_token&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;THIS-SHOULD-BE-YOUR-TOKEN&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;update_method&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;direct&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;direct_ip&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #e6db74">&quot;10.0.0.70&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;direct_port&quot;</span><span style="color: #f8f8f2">:</span> <span style="color: #ae81ff">8000</span><span style="color: #f8f8f2">,</span>
   <span style="color: #f92672">&quot;excluded_capabilities&quot;</span><span style="color: #f8f8f2">: {</span>
   <span style="color: lightblue">    &quot;SMARTTHINGS-DEVICE-ID-1&quot;</span><span style="color: #f8f8f2">: [</span>
   <span style="color: orange">       &quot;Switch&quot;</span><span style="color: #f8f8f2">,</span>
   <span style="color: orange">       &quot;Temperature Measurement&quot;</span>
   <span style="color: #f8f8f2">    ]</span>
   <span style="color: #f8f8f2">}<br>}</span>
   </pre></div>


 * <p><u>platform</u> & <u>name</u>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    This information is used by homebridge to identify the plugin and should be the settings above.</p>

 * <p><u>app_url</u> & <u>app_id</u> & <u>access_token</u>  <small style="color: orange; font-weight: 600;"><i>Required</i></small><br>
    To get this information, open Homebridge (SmartThings) SmartApp in your SmartThings Classic Mobile App, and tap on "View Configuration Data for Homebridge"<br><small style="color: yellow;"><b>Notice:</b> The app_url in the example above may be different for you.</small></p>

 * <p><u>direct_ip</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
    Defaults to first available IP on your computer<br><small style="color: gray;">Most installations won't need this, but if for any reason it can't identify your ip address correctly, use this setting to force the IP presented to SmartThings for the hub to send to.</small></p>

 * <p><u>direct_port</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
   Defaults to 8000<br><small style="color: gray;">This is the port that homebridge-smartthings plugin will listen on for traffic from your hub. Make sure your firewall allows incoming traffic on this port from your hub's IP address.</small></p>

 * <p><u>local_commands</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
    This will allow the service to send homekit commands to hub locally (SmartThings only)</p>

 * <p><u>excluded_capabilities</u>  <small style="color: #f92672; font-weight: 600;"><i>Optional</i></small><br>
   Defaults to None<br><small style="color: gray;">Specify the SmartThings device by ID and the associated capabilities you want homebridge-smartthings-tonesto7 to ignore<br>This prevents a SmartThings device creating unwanted or redundant HomeKit accessories</small></p>
