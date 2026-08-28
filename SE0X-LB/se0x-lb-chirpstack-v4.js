// Dragino SE0X-LB - ChirpStack v4 payload codec
// QuickJS strict-mode safe (no implicit globals), numeric outputs.
//
// FPORT=2 layout:
//   bytes[0..1]  BatV (mask 0x3FFF), mV
//   bytes[2..3]  DS18B20 temp, signed, /10  (327.6 = probe not connected)
//   bytes[4]     flags: bit7 = MOD, bit6 = interrupt flag,
//                bits3..0 = probe bitmap (bit3 = addr 1 ... bit0 = addr 4)
//   then one 6-byte block per DETECTED probe, packed back-to-back
//   in address order:  water(2) | temp(2) | EC(2)
//   -> payload length = 5 + 6 * probeCount  (11 / 17 / 23 / 29 bytes)
//
// Fixes vs. official Dragino decoder:
//   - all variables declared (official one throws ReferenceError in strict mode:
//     undeclared `type`, `i`, `j`, `k`)
//   - negative temps use proper two's complement (value - 0x10000,
//     official `value - 0xFFFF` is off by 0.01 degC)
//   - values returned as numbers, not strings (.toFixed removed)
//   - probe blocks read contiguously per s_flag bitmap, so non-contiguous
//     Modbus addresses (e.g. 1 and 3) decode correctly too
//   - truncated-payload guard

function s16(v) {
  return (v & 0x8000) ? v - 0x10000 : v;
}

function decodeUplink(input) {
  var bytes = input.bytes;
  var data = {};
  var i, addr, base, value, flags, mod, type;

  if (input.fPort === 2) {
    data.Node_type = "SE0X-LB";
    data.BatV = ((bytes[0] << 8 | bytes[1]) & 0x3FFF) / 1000;

    data.temp_DS18B20 = s16(bytes[2] << 8 | bytes[3]) / 10;

    flags = bytes[4];
    mod = (flags >> 7) & 0x01;
    data.Mod = mod;
    data.i_flag = (flags >> 6) & 0x01;

    type = flags & 0x0F;
    data.s_flag = "";
    for (i = 0; i < 4; i++) {
      data.s_flag += ((type >> (3 - i)) & 0x01) ? "1" : "0";
    }

    base = 5;
    for (i = 0; i < 4; i++) {
      if (((type >> (3 - i)) & 0x01) !== 1) continue;
      if (base + 6 > bytes.length) break; // truncated payload guard
      addr = i + 1;
      if (mod === 0) {
        data["water_SOIL" + addr]   = (bytes[base] << 8 | bytes[base + 1]) / 100;
        data["temp_SOIL" + addr]    = s16(bytes[base + 2] << 8 | bytes[base + 3]) / 100;
        data["conduct_SOIL" + addr] = bytes[base + 4] << 8 | bytes[base + 5];
      } else {
        data["Soil_dielectric_constant" + addr] = (bytes[base] << 8 | bytes[base + 1]) / 10;
        data["Raw_water_SOIL" + addr]           = bytes[base + 2] << 8 | bytes[base + 3];
        data["Raw_conduct_SOIL" + addr]         = bytes[base + 4] << 8 | bytes[base + 5];
      }
      base += 6;
    }
    return { data: data };
  }

  if (input.fPort === 5) {
    var bands = {
      1: "EU868", 2: "US915", 3: "IN865", 4: "AU915", 5: "KZ865",
      6: "RU864", 7: "AS923", 8: "AS923_1", 9: "AS923_2", 10: "AS923_3",
      11: "CN470", 12: "EU433", 13: "KR920", 14: "MA869"
    };
    if (bytes[0] === 0xF9) data.SENSOR_MODEL = "SE0X-LB";
    data.FIRMWARE_VERSION = (bytes[1] & 0x0F) + "." + ((bytes[2] >> 4) & 0x0F) + "." + (bytes[2] & 0x0F);
    data.FREQUENCY_BAND = bands[bytes[3]] || ("0x" + bytes[3].toString(16));
    data.SUB_BAND = (bytes[4] === 0xFF) ? "NULL" : bytes[4];
    data.BAT = (bytes[5] << 8 | bytes[6]) / 1000;
    return { data: data };
  }

  return { data: {} };
}
