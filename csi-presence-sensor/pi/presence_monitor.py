#!/usr/bin/env python3
"""
CSI-baserad närvarosensor - Pi-sidan.

Läser CSI-data som ESP32 skriver över USB-serial (se firmware/csi_presence_sensor),
räknar ut rörelseinducerad varians i signalen över ett glidande fönster,
och håller en presence-status med en "håll kvar"-timer så att den inte
studsar mellan present/empty vid korta pauser i rörelsen.

Exempel:
    python3 presence_monitor.py --port /dev/ttyUSB0

Med MQTT (t.ex. mot Home Assistant):
    python3 presence_monitor.py --port /dev/ttyUSB0 \\
        --mqtt-host 192.168.1.50 --mqtt-topic home/office/presence
"""

import argparse
import re
import statistics
import time
from collections import deque

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False


# Matchar formatet som app_main.c skriver ut:
# CSI_DATA,<timestamp>,<mac>,...,<len>,[<raw csi-värden separerade med mellanslag>]
CSI_LINE_RE = re.compile(r'CSI_DATA,.*\[(?P<csi>[^\]]*)\]')


def parse_csi_line(line):
    """Parsar en CSI_DATA-rad och returnerar en lista med amplitudvärden, eller None."""
    m = CSI_LINE_RE.match(line.strip())
    if not m:
        return None

    csi_str = m.group("csi").strip()
    if not csi_str:
        return None

    try:
        raw = [int(x) for x in csi_str.split()]
    except ValueError:
        return None

    # Rådatan är par av (imaginär, real) int8-värden per subcarrier.
    amplitudes = []
    for i in range(0, len(raw) - 1, 2):
        imag, real = raw[i], raw[i + 1]
        amplitudes.append((imag * imag + real * real) ** 0.5)
    return amplitudes


def useful_subcarriers(amplitudes):
    """Hoppa över LLTF-kanter och DC — de hoppar av radio, inte av folk."""
    if not amplitudes:
        return None
    n = len(amplitudes)
    if n >= 64:
        return amplitudes[6:32] + amplitudes[33:59]
    if n < 16:
        return None
    edge = max(2, n // 16)
    mid = n // 2
    return amplitudes[edge:mid] + amplitudes[mid + 1 : n - edge]


class PresenceDetector:
    """Rörelse = median av per-subcarriers stdev över ett kort fönster.
    Medelamplitud över alla bin blandar paketstorlek/RSSI och sitter fast på 'rörelse'.
    Presence hålls kvar en stund efter senaste rörelsen (hold_seconds)."""

    def __init__(self, window_size=16, motion_threshold=3.0, hold_seconds=120):
        self.frames = deque(maxlen=window_size)
        self.motion_threshold = motion_threshold
        self.hold_seconds = hold_seconds
        self.last_motion_time = 0.0
        self.last_stdev = 0.0
        self.last_motion = False

    def feed(self, amplitudes):
        vec = useful_subcarriers(amplitudes)
        if not vec:
            return False
        if self.frames and len(vec) != len(self.frames[0]):
            self.frames.clear()
        self.frames.append(vec)

        motion_now = False
        need = max(6, self.frames.maxlen // 2)
        if len(self.frames) >= need:
            bins = len(vec)
            stdevs = [
                statistics.pstdev(frame[i] for frame in self.frames)
                for i in range(bins)
            ]
            stdevs.sort()
            score = stdevs[len(stdevs) // 2]
            self.last_stdev = score
            if score > self.motion_threshold:
                motion_now = True
                self.last_motion_time = time.time()
        self.last_motion = motion_now

        return motion_now

    @property
    def presence(self):
        return (time.time() - self.last_motion_time) < self.hold_seconds


def main():
    parser = argparse.ArgumentParser(description="CSI-baserad närvarosensor (Pi-sidan)")
    parser.add_argument("--port", required=True, help="Serieport, t.ex. /dev/ttyUSB0")
    parser.add_argument("--baud", type=int, default=115200, help="Baudrate (matcha ESP32:ns UART)")
    parser.add_argument("--window", type=int, default=20,
                         help="Antal samples i det glidande fönstret")
    parser.add_argument("--threshold", type=float, default=3.0,
                         help="Tröskelvärde för standardavvikelse -> rörelse. "
                              "Kalibrera per rum, se README.")
    parser.add_argument("--hold-seconds", type=float, default=120,
                         help="Hur länge presence hålls kvar efter senaste rörelsen")
    parser.add_argument("--mqtt-host", default=None, help="MQTT-broker (valfritt)")
    parser.add_argument("--mqtt-port", type=int, default=1883)
    parser.add_argument("--mqtt-topic", default="csi_presence/state")
    parser.add_argument("--mqtt-user", default=None)
    parser.add_argument("--mqtt-password", default=None)
    parser.add_argument("--quiet", action="store_true",
                         help="Skriv bara ut när status faktiskt ändras")
    args = parser.parse_args()

    import serial

    mqtt_client = None
    if args.mqtt_host:
        if not MQTT_AVAILABLE:
            raise SystemExit("paho-mqtt är inte installerat. Kör: pip install paho-mqtt")
        mqtt_client = mqtt.Client()
        if args.mqtt_user:
            mqtt_client.username_pw_set(args.mqtt_user, args.mqtt_password)
        mqtt_client.connect(args.mqtt_host, args.mqtt_port, keepalive=60)
        mqtt_client.loop_start()

    detector = PresenceDetector(
        window_size=args.window,
        motion_threshold=args.threshold,
        hold_seconds=args.hold_seconds,
    )

    ser = serial.Serial(args.port, args.baud, timeout=1)
    print(f"Lyssnar på {args.port} @ {args.baud} baud... (Ctrl+C för att avsluta)")

    last_state = None
    samples_seen = 0

    try:
        while True:
            raw_line = ser.readline()
            if not raw_line:
                continue
            try:
                line = raw_line.decode("utf-8", errors="ignore")
            except UnicodeDecodeError:
                continue

            amplitudes = parse_csi_line(line)
            if amplitudes is None:
                continue

            samples_seen += 1
            motion_now = detector.feed(amplitudes)
            presence = detector.presence
            state = "present" if presence else "empty"

            if state != last_state:
                print(f"[{time.strftime('%H:%M:%S')}] Status ändrad -> {state} "
                      f"(rörelse just nu: {motion_now}, samples hittills: {samples_seen})")
                if mqtt_client:
                    mqtt_client.publish(args.mqtt_topic, state, retain=True)
                last_state = state
            elif not args.quiet and motion_now:
                print(f"[{time.strftime('%H:%M:%S')}] Rörelse (status: {state})")

    except KeyboardInterrupt:
        print("\nAvslutar...")
    finally:
        ser.close()
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()


if __name__ == "__main__":
    main()
