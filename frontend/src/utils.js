import crypto from 'crypto-js';

export const generateUniqueId = (firstName, lastName) => {
  const nameString = `${firstName}${lastName}`;
  const hash = crypto.SHA256(nameString).toString(crypto.enc.Hex);
  return hash;
};

export function formatTimeString(timeString) {
    // Parse the createdAt string into a Date object
    const date = new Date(timeString);
    
    // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
    const weekday = weekdays[date.getDay()];

    // Get the month (0 = January, 1 = February, ..., 11 = December)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];

    // Get the day of the month
    const day = date.getDate();

    // Get the year
    const year = date.getFullYear();

    // Get the hours (0-23)
    let hours = date.getHours();

    // Get the minutes (0-59)
    let minutes = date.getMinutes();

    // Add leading zero if minutes is less than 10
    if (minutes < 10) {
        minutes = '0' + minutes;
    }

    // Format the time string
    let time;
    if (hours >= 12) {
        time = `${hours % 12}:${minutes} PM`; // Convert to 12-hour format for PM
    } else {
        time = `${hours}:${minutes} AM`; // Convert to 12-hour format for AM
    }

    // Combine the formatted date, time, and weekday into a single string
    const formattedDate = `${weekday}, ${month} ${day}, ${year} - ${time}`;

    return formattedDate;
}