# Smart-Soja Platform — ESP32 Protocol Documentation

## Overview
The Smart-Soja platform communicates with ESP32 devices via **MQTT** over a hybrid bridge. This document specifies the exact message formats, topics, and data structures expected by the platform.

---

## MQTT Connection Parameters

```
Broker: wss://broker.hivemq.com:8884/mqtt (WebSocket Secure)
Protocol: MQTT 3.1.1
QoS: 1 (At Least Once)
```

---

## Topic Structure

### Base Topic Format
```
smart-soja/{category}/{unit-id}
```

### Available Topics

#### 1. **Telemetry (ESP32 → Platform)**
```
smart-soja/telemetry/{unit-id}
```
**Direction:** ESP32 publishes sensor & control state data  
**Frequency:** Every 2-5 seconds (recommended)  
**Payload:** JSON object

---

#### 2. **Lot Completion (ESP32 → Platform)**
```
smart-soja/lot_completed/{unit-id}
```
**Direction:** ESP32 publishes when processing cycle completes  
**Frequency:** On event  
**Payload:** JSON object with lot metadata

---

#### 3. **Commands (Platform → ESP32)**
```
smart-soja/commands/{unit-id}
```
**Direction:** Platform sends control commands  
**Frequency:** On user action or mode change  
**Payload:** JSON object

---

## Message Formats

### 1. Telemetry Payload

**Topic:** `smart-soja/telemetry/{unit-id}`

```json
{
  "unitId": "unit-001",
  "timestamp": 1716633600000,
  "humidity": 45.2,
  "temperature": 32.5,
  "weight": 42.8,
  "ir1": true,
  "ir2": false,
  "mode": "auto",
  "step": 3,
  "alarm": false,
  "controls": {
    "alimentation": false,
    "tamis": true,
    "ventilateur": false,
    "chauffage": true,
    "vis_soja": true,
    "servo_vanne": false
  },
  "battery": 95
}
```

**Field Descriptions:**

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `unitId` | String | - | Unique device identifier (e.g., "unit-001") |
| `timestamp` | Number | Unix ms | Current milliseconds since epoch |
| `humidity` | Number | 0-100 | Relative humidity in % |
| `temperature` | Number | -40 to 125 | Temperature in °C |
| `weight` | Number | 0-60000 | Weight in grams (or kg if > 200) |
| `ir1` | Boolean | true/false | IR1 sensor state (Soja en entrée) |
| `ir2` | Boolean | true/false | IR2 sensor state (Sac en Sortie) |
| `mode` | String | "auto" \| "manual" | Current operating mode |
| `step` | Number | 0-12 | Current GRAFCET step (0 = idle) |
| `alarm` | Boolean | true/false | Emergency alarm triggered? |
| `controls` | Object | - | State of all actuators (see below) |
| `controls.alimentation` | Boolean | true/false | Servo 1 (Trémie) state |
| `controls.tamis` | Boolean | true/false | Tamis motor state |
| `controls.ventilateur` | Boolean | true/false | Ventilateur motor state |
| `controls.chauffage` | Boolean | true/false | Chauffage heater state |
| `controls.vis_soja` | Boolean | true/false | Vis motor state |
| `controls.servo_vanne` | Boolean | true/false | Servo 2 (Vanne) state |
| `battery` | Number | 0-100 | Battery percentage (if applicable) |

---

### 2. Lot Completion Payload

**Topic:** `smart-soja/lot_completed/{unit-id}`

```json
{
  "unitId": "unit-001",
  "timestamp": 1716633600000,
  "lotId": "lot-20250525-001",
  "duration_ms": 180000,
  "weight_processed": 45200,
  "humidity_avg": 42.5,
  "temperature_avg": 31.8,
  "steps_completed": 12,
  "quality_score": 95
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `unitId` | String | Device identifier |
| `timestamp` | Number | When processing completed (Unix ms) |
| `lotId` | String | Unique lot identifier (auto-generated or provided) |
| `duration_ms` | Number | Total processing time in milliseconds |
| `weight_processed` | Number | Final weight in grams |
| `humidity_avg` | Number | Average humidity during processing |
| `temperature_avg` | Number | Average temperature during processing |
| `steps_completed` | Number | Total GRAFCET steps executed |
| `quality_score` | Number | 0-100 quality rating |

---

### 3. Command Payload (Platform → ESP32)

**Topic:** `smart-soja/commands/{unit-id}`

#### 3a. Mode Switch Command

```json
{
  "mode": "auto"
}
```

OR

```json
{
  "mode": "manual"
}
```

**Expected Response:** ESP32 publishes telemetry with updated `mode` field

---

#### 3b. Auto Mode Start Command

```json
{
  "mode": "auto",
  "action": "cycle_start"
}
```

**Expected Behavior:**
- ESP32 starts GRAFCET cycle (step 0 → step 1)
- Platform receives telemetry with `step > 0`
- Cycle progresses automatically

---

#### 3c. Manual Control Command

```json
{
  "action": "control_manual",
  "device": "servo_tremie",
  "state": "ON",
  "timestamp": 1716633600000
}
```

OR

```json
{
  "action": "control_manual",
  "device": "tamis",
  "state": "OFF",
  "timestamp": 1716633600000
}
```

**Valid Devices:**
- `servo_tremie` → Servo 1 (Alimentation/Trémie)
- `tamis` → Tamis motor
- `ventilateur` → Ventilateur motor
- `chauffage` → Chauffage heater
- `vis_soja` → Vis motor
- `servo_vanne` → Servo 2 (Vanne/Transfert)

**Valid States:**
- `"ON"` → Activate actuator
- `"OFF"` → Deactivate actuator

**Expected Response:** ESP32 toggles actuator and publishes telemetry confirming state change

---

#### 3d. Emergency Stop Command

```json
{
  "action": "emergency_stop",
  "timestamp": 1716633600000
}
```

**Expected Behavior:**
- ESP32 immediately cuts power to all actuators
- Sets `alarm: true` in telemetry
- Switches mode to `"manual"`
- Requires manual reset from platform

---

#### 3e. Test LED Command (Diagnostics)

```json
{
  "test_led": true
}
```

**Expected Behavior:** ESP32 blinks diagnostic LED to confirm connectivity

---

## MQTT Subscribe Topics (Platform Side)

The platform subscribes to these topics:

```
smart-soja/telemetry/+
smart-soja/lot_completed/+
```

The `+` wildcard matches any `unit-id`.

---

## Example Flow: MANUAL Mode Control

### Scenario: User clicks "Alimentation ON" button

**1. Platform publishes command:**
```
Topic: smart-soja/commands/unit-001
Payload: {
  "action": "control_manual",
  "device": "servo_tremie",
  "state": "ON",
  "timestamp": 1716633605000
}
```

**2. ESP32 receives & executes:**
- Activates Servo 1 (Trémie) pin
- Sets internal state: `controls.alimentation = true`

**3. ESP32 publishes telemetry:**
```
Topic: smart-soja/telemetry/unit-001
Payload: {
  "unitId": "unit-001",
  "timestamp": 1716633605500,
  "humidity": 45.2,
  "temperature": 32.5,
  "weight": 42.8,
  "ir1": true,
  "ir2": false,
  "mode": "manual",
  "step": 0,
  "alarm": false,
  "controls": {
    "alimentation": true,      ← UPDATED
    "tamis": false,
    "ventilateur": false,
    "chauffage": false,
    "vis_soja": false,
    "servo_vanne": false
  },
  "battery": 95
}
```

**4. Platform receives & updates UI:**
- Control card "Alimentation" gets `.active` class
- Status text changes to "ACTIF"
- Icon animates with pulsing effect

---

## Example Flow: AUTO Mode Cycle

### Scenario: User clicks "Automatique" button

**1. Platform publishes:**
```
Topic: smart-soja/commands/unit-001
Payload: {
  "mode": "auto",
  "action": "cycle_start"
}
```

**2. ESP32 enters AUTO mode:**
- Starts GRAFCET state machine
- Automatically controls all actuators per program

**3. ESP32 publishes periodic telemetry:**
```
Topic: smart-soja/telemetry/unit-001
Payload: {
  "unitId": "unit-001",
  "timestamp": 1716633606000,
  "humidity": 45.5,
  "temperature": 32.7,
  "weight": 42.9,
  "ir1": true,
  "ir2": false,
  "mode": "auto",
  "step": 2,              ← PROGRESSING
  "alarm": false,
  "controls": {
    "alimentation": true,  ← MANAGED BY ESP32
    "tamis": true,
    "ventilateur": false,
    "chauffage": true,
    "vis_soja": true,
    "servo_vanne": false
  },
  "battery": 95
}
```

**4. When cycle completes:**
```
Topic: smart-soja/lot_completed/unit-001
Payload: {
  "unitId": "unit-001",
  "timestamp": 1716633780000,
  "lotId": "lot-20250525-001",
  "duration_ms": 180000,
  "weight_processed": 45200,
  "humidity_avg": 42.5,
  "temperature_avg": 31.8,
  "steps_completed": 12,
  "quality_score": 95
}
```

**5. Platform:**
- Receives completion event
- Creates Lot record in Firestore
- Resets UI to idle state

---

## Error Handling

### ESP32 Connection Lost
- Platform sets `isConnected: false`
- MQTT badge turns red
- All control buttons disabled
- Shows "DÉCONNECTÉ" status

### ESP32 Sends Invalid JSON
- Platform logs error to console
- Ignores malformed message
- Remains in previous state

### Telemetry Timeout (>15s no data)
- Platform switches data source badge to "SIMU"
- Uses simulated/cached data
- Shows warning (optional)

### Emergency Alarm Received
- Platform calls `emergencyStop()`
- All controls disabled
- Shows red emergency banner
- Requires manual reset

---

## Debug/Diagnostics Commands

### Query Device Status
```json
{
  "action": "ping"
}
```
**Expected Response:** Telemetry message with `step: 0`

### Force Reset
```json
{
  "action": "reset"
}
```
**Expected Behavior:** ESP32 reinitializes all systems and publishes telemetry

### Request Full State Dump
```json
{
  "action": "dump_state"
}
```
**Expected Response:** Complete JSON of all internal ESP32 state variables

---

## Constraints & Limits

| Parameter | Limit | Note |
|-----------|-------|------|
| Message Size | < 1024 bytes | MQTT payload limit |
| Telemetry Frequency | 2-5s | Avoid >1s (bandwidth) |
| Timeout | 15s | Platform assumes disconnected |
| Max Weight | 60000g | Clamp or error if exceeded |
| Max Humidity | 100% | Clamp or error if exceeded |
| Max Temperature | 125°C | Sensor max; clamp if higher |

---

## Firmware Integration Checklist

- [ ] MQTT client connects to `wss://broker.hivemq.com:8884/mqtt`
- [ ] Subscribes to `smart-soja/commands/{unitId}`
- [ ] Publishes telemetry every 3-5 seconds
- [ ] Implements all 6 actuator control signals
- [ ] Reads all 4 sensor inputs (humidity, temp, weight, IR1, IR2)
- [ ] Implements GRAFCET state machine (steps 0-12)
- [ ] Handles mode switching (AUTO ↔ MANUAL)
- [ ] Publishes `lot_completed` events on cycle end
- [ ] Implements emergency stop signal
- [ ] Validates incoming JSON commands
- [ ] Retries on connection loss
- [ ] Maintains time synchronization via timestamp fields

---

## Testing Checklist (Platform)

- [ ] Receives telemetry updates every 3-5 seconds
- [ ] Control cards toggle correctly in MANUAL mode
- [ ] Controls disabled (opacity 0.5) in AUTO mode
- [ ] Mode toggle switches work (AUTO ↔ MANUAL)
- [ ] Emergency stop cuts all actuators
- [ ] Lot completion creates records in Firestore
- [ ] Telemetry data persists across page reloads
- [ ] No console errors or MQTT errors
- [ ] UI responsive to real sensor data
- [ ] MQTT badge shows connected/disconnected

---

## Support & Debugging

If ESP32 doesn't communicate:

1. **Check MQTT Broker Connectivity:**
   - Test with MQTT client tool (MQTT Explorer, MQTTbox)
   - Verify WiFi connection on ESP32

2. **Verify Topics:**
   - Confirm topic names match exactly (case-sensitive)
   - Ensure `unitId` is consistent across all messages

3. **Check Payload Format:**
   - Validate JSON syntax (use online validator)
   - Ensure all required fields present

4. **Enable Debug Logs:**
   - Platform: Open browser DevTools → Console
   - ESP32: Enable serial debug output

5. **Test with Manual Commands:**
   ```
   Platform → smart-soja/commands/unit-001
   {"mode": "manual"}
   ```
   Expect ESP32 telemetry response within 2 seconds

---

**Last Updated:** May 25, 2026  
**Platform Version:** Smart-Soja v2.0  
**Status:** Production Ready ✅
