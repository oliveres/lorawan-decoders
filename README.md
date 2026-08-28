# lorawan-decoders

Backup of production LoRaWAN payload codecs (ChirpStack v4 / TTN v3 `decodeUplink` API),
fixed and tested against real uplinks.

| Device | Codec | Notes |
|---|---|---|
| Dragino SE0X-LB — 2-probe configuration also sold as "SE02" | [`SE0X-LB/se0x-lb-chirpstack-v4.js`](SE0X-LB/se0x-lb-chirpstack-v4.js) | strict-mode safe, numeric outputs, two's-complement fix, dynamic 1–4 probes |

Run tests:

```
node SE0X-LB/test/test.js
```
