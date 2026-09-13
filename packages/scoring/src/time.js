const convertRaceTime = (time) => {
  if (!time) return '';
  const minutes = Math.floor(time / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (time % 60).toString().split('.')[0].padStart(2, '0');
  const milliseconds = (time.toString().split('.')[1] ?? '00').padEnd(2, '0');
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
