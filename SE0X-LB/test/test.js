'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load the codec the way ChirpStack v4 (QuickJS) does — in strict mode.
const src = fs.readFileSync(path.join(__dirname, '..', 'se0x-lb-chirpstack-v4.js'), 'utf8');
const decodeUplink = new Function('"use strict";\n' + src + '\n;return decodeUplink;')();

// [1] Real uplink captured from a 2-probe unit (probes at Modbus addr 1 + 2)
const real = [...Buffer.from('DfgMzAwRDAhDAWsOGghLATQ=', 'base64')];
const d1 = decodeUplink({ fPort: 2, bytes: real }).data;
assert.deepStrictEqual(d1, {
  Node_type: 'SE0X-LB',
  BatV: 3.576,
  temp_DS18B20: 327.6, // DS18B20 not connected
  Mod: 0,
  i_flag: 0,
  s_flag: '1100',
  water_SOIL1: 43.64, temp_SOIL1: 21.15, conduct_SOIL1: 363,
  water_SOIL2: 36.1,  temp_SOIL2: 21.23, conduct_SOIL2: 308,
});

// [2] Negative temperature, single probe at addr 1 (-2.00 C == 0xFF38)
const d2 = decodeUplink({
  fPort: 2,
  bytes: [0x0D, 0xF8, 0x0C, 0xCC, 0x08, 0x0E, 0x1A, 0xFF, 0x38, 0x01, 0x4B],
}).data;
assert.strictEqual(d2.temp_SOIL1, -2);
assert.strictEqual(d2.s_flag, '1000');

// [3] Device status (FPort 5) — real reply to downlink 26 01
const d3 = decodeUplink({ fPort: 5, bytes: [...Buffer.from('+QEAAQAN7A==', 'base64')] }).data;
assert.deepStrictEqual(d3, {
  SENSOR_MODEL: 'SE0X-LB',
  FIRMWARE_VERSION: '1.0.0',
  FREQUENCY_BAND: 'EU868',
  SUB_BAND: 0,
  BAT: 3.564,
});

console.log('All tests passed.\n');
console.log(JSON.stringify(d1, null, 2));
