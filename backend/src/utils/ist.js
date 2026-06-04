/**
 * IST (Asia/Kolkata, UTC+5:30) time utilities.
 *
 * All date/time logic in the app must use these helpers so the server
 * behaves correctly regardless of whether it runs on UTC (Azure) or any
 * other system timezone.
 */
const moment = require('moment-timezone');

const TZ = 'Asia/Kolkata';

/** Current moment in IST */
const nowIST = () => moment().tz(TZ);

/** Today's date string in IST — "YYYY-MM-DD" */
const todayIST = () => nowIST().format('YYYY-MM-DD');

/** Day-of-week in IST (0=Sun … 6=Sat) */
const dayOfWeekIST = (dateStr) => moment.tz(dateStr, TZ).day();

/** Format any Date/moment to IST date string */
const toISTDate = (d) => moment(d).tz(TZ).format('YYYY-MM-DD');

/** Format any Date/moment to IST datetime string */
const toISTDateTime = (d) => moment(d).tz(TZ).format('YYYY-MM-DD HH:mm:ss');

/** Parse a date string as an IST midnight Date (useful for DB comparisons) */
const istMidnight = (dateStr) => moment.tz(dateStr, TZ).startOf('day').toDate();

/** Return a JS Date representing the current IST time (for DB inserts) */
const nowISTDate = () => nowIST().toDate();

module.exports = { nowIST, todayIST, dayOfWeekIST, toISTDate, toISTDateTime, istMidnight, nowISTDate, TZ };
