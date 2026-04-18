// Simple config stub. Replace values or wire to env/config system as needed.
export const CONFIG = {
  INFLUX_TOKEN: process.env.INFLUX_TOKEN ?? '',
  INFLUX_URL: process.env.INFLUX_URL ?? '',
  INFLUX_ORG: process.env.INFLUX_ORG ?? '',
  INFLUX_BUCKET: process.env.INFLUX_BUCKET ?? '',
};

export default CONFIG;
