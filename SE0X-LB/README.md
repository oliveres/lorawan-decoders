# Dragino SE0X-LB — ChirpStack v4 / TTN payload codec

Fixed decoder for the Dragino **SE0X-LB** LoRaWAN Soil Moisture & EC transmitter
(1–4 addressable RS485 probes on waterproof connectors).

> **Heads-up — "SE02" naming:** the 2-probe configuration of this platform is sold
> commercially as **SE02**, but the firmware inside is the SE0X family (device status
> model byte `0xF9`) and uplinks use the **SE0X payload format**. The official
> `SE02V1.0` decoder from
> [dragino-end-node-decoder](https://github.com/dragino/dragino-end-node-decoder)
> expects a different fixed layout — and since both formats happen to be 17 bytes
> with two probes, it runs without errors and silently produces shifted garbage
> (EC ~17000 µS/cm, moisture >100 %). Verify what you have with downlink `26 01` →
> the device replies on FPort 5; first byte `0xF9` = SE0X firmware, `0xF1` = SE02 v1.0.

## Payload format

### FPORT = 2 — sensor data

| Bytes | Field | Scale |
|---|---|---|
| 0–1 | Battery voltage (`value & 0x3FFF`) | mV |
| 2–3 | DS18B20 temperature, signed | /10 °C — `327.6` = probe not connected |
| 4 | Flags: bit7 `MOD`, bit6 `i_flag` (interrupt), bits 3–0 probe bitmap (bit3 = addr 1 … bit0 = addr 4) | |
| 5… | One 6-byte block per **detected** probe, packed back-to-back in address order | |

Per-probe block (MOD = 0): `water(2)` /100 % · `temp(2)` signed /100 °C · `EC(2)` µS/cm

Payload length = `5 + 6 × probeCount` → 11 / 17 / 23 / 29 bytes.

MOD = 1 (raw mode): `dielectric(2)` /10 · `raw water(2)` · `raw EC(2)` per probe.

### FPORT = 5 — device status (reply to downlink `26 01`)

`model(1) = 0xF9 · firmware(2) · band(1) · sub-band(1) · battery(2) mV`

## Fixes vs. the official Dragino decoder

- **Strict-mode safe.** The official decoder throws `ReferenceError: type is not
  defined` in ChirpStack v4 (QuickJS runs codecs in strict mode) — undeclared
  `type`, `i`, `j`, `k` — so no decoded object appears at all.
- **Correct two's complement** for negative temperatures (`value - 0x10000`; the
  official `value - 0xFFFF` is off by +0.01 °C on every negative reading).
- **Numeric outputs** — no `.toFixed()` strings, so InfluxDB / Grafana / Loxone
  receive numbers, not text.
- **Contiguous probe blocks per the s_flag bitmap** — decodes correctly even for
  non-contiguous Modbus addresses (e.g. probes at 1 and 3); the official decoder
  reads fixed slots and breaks there.
- Truncated-payload guard.

Output field names (`water_SOIL1`, `temp_SOIL1`, `conduct_SOIL1`, …) are kept
identical to the official decoder for dashboard compatibility.

## Usage

ChirpStack v4: *Device profile → Codec → JavaScript functions* → paste
[`se0x-lb-chirpstack-v4.js`](se0x-lb-chirpstack-v4.js). The same `decodeUplink`
API works in TTN v3 payload formatters.

## Test

```
node test/test.js
```

Runs the codec against a captured real uplink and edge cases
(negative temperature, FPort 5 status).

## Probe addressing (AT+MADD)

Probes ship at Modbus address 1. To run multiple probes, connect them **one at a
time** with the yellow wire on VDD, set `AT+MADD=<n>`, then restart (`ATZ`) —
setting an address with more than one probe connected does not work. The `s_flag`
bitmap in each uplink shows which addresses responded (e.g. `1100` = addr 1 + 2).
