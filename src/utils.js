export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
export function hmsToMilliseconds(str) {
  const p = str.split(":");
  let ms = 0;
  let multiplier = 1;

  while (p.length > 0) {
    ms += multiplier * parseInt(p.pop(), 10) * 1000;
    multiplier *= 60;
  }

  return ms;
}

export const secondsToMilliseconds = (seconds) => {
  return seconds * 1000;
}

export const throttleFunction = (func, delay) => {
  let prev = 0;
  return (...args) => {
    let now = new Date().getTime();

    if (now - prev > delay) {
      prev = now;
      return func(...args);
    }
  };
};