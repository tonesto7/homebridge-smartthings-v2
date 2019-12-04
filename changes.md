 ══════════
   Plugin (v2.0.1)
   December 4th, 2019
 ══════════
• Completely rewrote the entire plugin using modern javascript structure.

• The code is now much cleaner,  easier to update/maintain, and easier for others to follow.

• This translates into a  faster/leaner and way more stable plugin than previous versions.

• The plugin now uses the Homebridge Dynamic platform API, meaning it no longer requires a restart of the Homebridge service for device changes to occur.

• The plugin now utilizes the device cache on service restart to prevent losing all of your devices when the plugin fails to start for an extended period of time.

• It will now remove devices no longer selected under SmartThings.

• Introduced an all-new logging system to provide more insight into issues and status, as well as write them to a file.

• I used all of the issues from my existing plugin to repair this new version.

• Many, many other bug fixes for devices, commands and many other items.

• ***Important NOTICE:***
**Due to the changes in the plugin API you can not directly update the plugin, you will need to add as a new accessory and setup your devices/automations/scenes again.
On a positive note, you can use the same SmartApp instance though as long as you update to the latest code.**

 ══════════
   SmartApp (v2.0.1)
   December 4th, 2019
 ══════════
• Reworked and cleaned up the UI so it's now more organized and easier to follow.

• Added new capability filter options.

• Optimized the command/event streaming system to perform faster and more reliably.

• Added duplicate device detection cleanups so Homekit doesn't try to create duplicate devices and throw an error.

• Many, many other bug fixes and cleanups.
