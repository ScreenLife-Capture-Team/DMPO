function utcToDate(utcString) {
    const date = new Date(utcString);
    return date.toLocaleDateString();
}

function timePassedFromDate(date) {
    const now = new Date().getTime(); // account for SGT
    const difference = now - date.getTime();
    const minutes = Math.round(difference / 60000);
    const hours = Math.round(difference / 3600000);
    const days = Math.round(difference / 86400000);
    console.log('days', days, 'hours', hours, 'minutes', minutes)
    if (days === 0 && hours === 0) {
        if (minutes > 1) {
            return `${minutes} minutes ago`;
        }
        return "1 minute ago";
    }
    if (days === 0) {
        if (hours > 1) {
            return `${hours} hours ago`;
        }
        return "1 hour ago";
    }
    if (days > 1) {
        return `${days} days ago`;
    }
    return "1 day ago";
}

const capitalize = (text) =>
    text.charAt(0).toUpperCase() + text.slice(1);

module.exports = { timePassedFromDate }