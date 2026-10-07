# LD2410D-radar (ESP32-C3) för gymskärmen

ESP32-C3 läser radarn och skickar JSON-rader över USB. `gym-helper.py` läser
porten (`/dev/radar`), tänder TV:n när någon är i zonen i läge **Radar**, och
nollställer timeouten så länge tillståndet är `still` eller `motion`.

## Firmware

Öppna `radar_usb.ino` i Arduino IDE.

Tools: kort *ESP32C3 Dev Module* (eller *Nologo ESP32C3 Super Mini*),
**USB CDC On Boot: Enabled**.

## På Pi:n

`install.sh` installerar `python3-serial` och udev-regeln `99-radar.rules`
som binder **endast** Espressif USB CDC (`303a:1001`) till `/dev/radar`.
Helpern lyssnar bara på `/dev/radar` (fallback: `/dev/serial/by-id/*Espressif*`)
— aldrig generiska `/dev/ttyACM*`.

Kontrollera efter omstart:

```bash
ls -l /dev/radar
# bör peka på t.ex. ttyACM0
udevadm info -a -n /dev/radar | grep -E 'idVendor|idProduct|serial'
```

Har ni flera ESP32-C3: lägg till `ATTRS{serial}=="..."` i `99-radar.rules`.

Radarstatus syns i helperns health:

```bash
curl -s http://127.0.0.1:8743/health | python3 -m json.tool
```

## Läge i Inställningar

| Läge | Beteende |
| --- | --- |
| Av | Inga CEC-kommandon |
| Schema | På/av enligt klockslag |
| Radar | På när någon är i zonen, av efter X minuter utan närvaro |
