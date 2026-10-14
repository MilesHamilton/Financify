/**
 * Expo config plugin: drop the `aps-environment` entitlement that
 * expo-notifications adds. The app only schedules LOCAL notifications (the
 * monthly recap reminder), and personal development teams can't sign the
 * Push Notifications capability. Remove if remote push is ever added.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
