
# Changelog

## v2.1.0
- [NEW] Added a Device Event and Command history page to review events and commands sent and received by the plugin.
- [UPDATE] Cleaned up some of the unnecessary attributes from the subscription logic.
- [FIX] Refactored the accessToken logic to be more consistent.
- [UPDATE] Modified the device event subscription process to reduce timeouts.
- [FIX] Other bug fixes, cleanups, and optimizations.

## v2.0.3
- [NEW] Added a new device data input where you can select a device and see all available attributes, capabilities, commands, and the last 30 events.
- [FIX] Other bug fixes and cleanups.

## v2.0.1
- [UPDATE] Reworked and cleaned up the UI so it's now more organized and easier to follow.
- [NEW] Added new capability filter options.
- [UPDATE] Optimized the command/event streaming system to perform faster and more reliably.
- [NEW] Added duplicate device detection cleanups so Homekit doesn't try to create duplicate devices and throw an error.
- [FIX] Many, many other bug fixes and cleanups.
