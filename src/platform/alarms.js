// Creates or updates an alarm only when its schedule actually changed, so
// repeated startup/settings calls do not reset the timer.
export const ensureAlarm = async (alarms, name, options) => {
    const alarm = await alarms.get(name)
    if (!alarm) return alarms.create(name, options)
    if (options.periodInMinutes != null) {
        if (alarm.periodInMinutes !== options.periodInMinutes) await alarms.create(name, options)
        return
    }
    if (alarm.periodInMinutes || Math.abs(alarm.scheduledTime - options.when) > 60000) await alarms.create(name, options)
}
