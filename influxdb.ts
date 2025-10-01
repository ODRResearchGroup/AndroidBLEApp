// InfluxDB HTTP API client for React Native
export class InfluxDBClient {
  private url: string;
  private token: string;
  private org: string;
  private bucket: string;

  constructor(url: string, token: string, org: string, bucket: string) {
    this.url = url;
    this.token = token;
    this.org = org;
    this.bucket = bucket;
  }

  // Write data to InfluxDB using line protocol
  async writeData(measurement: string, tags: Record<string, string>, fields: Record<string, any>, timestamp?: Date) {
    const tagString = Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    const fieldString = Object.entries(fields)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}="${value}"`;
        }
        return `${key}=${value}`;
      })
      .join(',');

    const timestampNs = timestamp ? timestamp.getTime() * 1000000 : Date.now() * 1000000;
    const lineProtocol = `${measurement},${tagString} ${fieldString} ${timestampNs}`;

    try {
      const response = await fetch(`${this.url}/api/v2/write?org=${this.org}&bucket=${this.bucket}&precision=ns`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: lineProtocol,
      });

      if (!response.ok) {
        throw new Error(`InfluxDB write failed: ${response.status} ${response.statusText}`);
      }

      console.log('Data written to InfluxDB successfully');
    } catch (error) {
      console.error('Error writing to InfluxDB:', error);
      throw error;
    }
  }

  // Write sensor data specifically
  async writeSensorData(deviceId: string, sensorType: string, value: number, unit: string, timestamp?: Date) {
    await this.writeData(
      'sensor_readings',
      {
        device_id: deviceId,
        sensor_type: sensorType,
        unit: unit,
      },
      {
        value: value,
      },
      timestamp
    );
  }
}
