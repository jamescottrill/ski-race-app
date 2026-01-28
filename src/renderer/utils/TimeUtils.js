const convertRaceTime = (time) => {
  if (!time) return '';
  // Round to 2 decimal places to avoid floating point precision errors
  const roundedTime = Math.round(time * 100) / 100;
  const minutes = Math.floor(roundedTime / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(roundedTime % 60).toString().padStart(2, '0');
  const milliseconds = (roundedTime.toFixed(2).split('.')[1] ?? '00');
  return `${minutes}:${seconds}.${milliseconds}`;
};

const convertHumanTime = (time) => {
  const minutes = parseInt(time.split(':')[0] ?? '0', 10) * 60;
  const seconds = parseFloat(time.split(':')[1] ?? '0');
  return minutes + seconds;
};

const formatTime = (value) => {
  if (value === '000000') return '';
  const parts = value.match(/(\d{1,2}):?\.?(\d{2}):?\.?(\d{1,2})?/);
  if (parts) {
    const minutes = parts[1].padStart(2, '0');
    const seconds = parts[2].padStart(2, '0');
    const milliseconds = parts[3] ? parts[3].padEnd(2, '0') : '00';
    return `${minutes}:${seconds}.${milliseconds}`;
  }
  return '';
};

export { convertRaceTime, convertHumanTime, formatTime };
