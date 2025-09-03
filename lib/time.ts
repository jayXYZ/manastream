// dxc-controller/src/lib/utils/Time.ts
export class Time {
  static getTimeFromSeconds(secs: number): {
    totalSeconds: number;
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
  } {
    const totalSeconds = Math.ceil(secs);
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((Math.abs(totalSeconds) % (60 * 60)) / 60);
    const seconds = Math.floor(Math.abs(totalSeconds) % 60);

    return {
      totalSeconds,
      seconds,
      minutes,
      hours,
      days,
    };
  }

  static getSecondsFromExpiry(expiry: number, shouldRound: boolean): number {
    const now = new Date().getTime();
    const milliSecondsDistance = expiry - now;
    const val = milliSecondsDistance / 1000;
    return shouldRound ? Math.round(val) : val;
  }

  static getSecondsFromPrevTime(
    prevTime: number,
    shouldRound: boolean,
  ): number {
    const now = new Date().getTime();
    const milliSecondsDistance = now - prevTime;
    const val = milliSecondsDistance / 1000;
    return shouldRound ? Math.round(val) : val;
  }

  static getSecondsFromTimeNow(): number {
    const now = new Date();
    const currentTimestamp = now.getTime();
    const offset = now.getTimezoneOffset() * 60;
    return currentTimestamp / 1000 - offset;
  }

  static getFormattedTimeFromSeconds(
    totalSeconds: number,
    format: string,
  ): { seconds: number; minutes: number; hours: number; ampm: string } {
    const {
      seconds: secondsValue,
      minutes,
      hours,
    } = Time.getTimeFromSeconds(totalSeconds);
    let ampm = "";
    let hoursValue = hours;

    if (format === "12-hour") {
      ampm = hours >= 12 ? "pm" : "am";
      hoursValue = hours % 12;
    }

    return {
      seconds: secondsValue,
      minutes,
      hours: hoursValue,
      ampm,
    };
  }
}
