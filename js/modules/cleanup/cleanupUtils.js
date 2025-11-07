export function relativeTimeFromNow(timestamp) {
  if (!timestamp) {
    return 'unknown';
  }

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diff >= year) {
    const years = Math.floor(diff / year);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
  if (diff >= month) {
    const months = Math.floor(diff / month);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  if (diff >= day) {
    const days = Math.floor(diff / day);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (diff >= hour) {
    const hours = Math.floor(diff / hour);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diff >= minute) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}
