# CSI-baserad närvarosensor (ESP32 + Raspberry Pi)

Använder WiFi Channel State Information (CSI) för att detektera rörelse/närvaro
i ett rum — ingen ping mot telefoner eller andra klienter, bara mot er egen
router. ESP32:n skickar CSI-data som CSV över USB-serial till en Pi som gör
signalbehandlingen.

Gymskärmen (`pi/gym-helper.py`) läser samma USB-ström och tänder TV:n via CEC.
MQTT nedan är bara om ni kör sensorn fristående, t.ex. mot Home Assistant.

## Hårdvara

- ESP32-DevKitC (dual-core WROOM-32 — CSI kräver dual-core, C3 stöds inte)
- Raspberry Pi, ansluten till ESP32:n via USB
- En befintlig router som ESP32:n ska ansluta till (Active STA)

## 1. Flasha ESP32:n i Arduino IDE

1. Installera [Arduino IDE](https://www.arduino.cc/en/software) och ESP32-kärnan: **File → Preferences → Additional boards manager URLs**

   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`

   Sen **Boards Manager**: sök `esp32` av Espressif Systems och installera.

2. **File → Open** och öppna

   `firmware/csi_presence_sensor/csi_presence_sensor.ino`

3. Kopiera `config.example.h` till `config.h` i samma mapp och fyll i SSID och
   lösenord. Router-IP hämtas automatiskt från DHCP (gateway).
   - `UDP_TARGET_PORT` — valfri stängd port, standard 50123
   - `PING_INTERVAL_MS` — hur ofta ESP32 triggar en CSI-sample (75 ms ≈ 13 Hz)

4. Välj kort och port:
   - Board: **ESP32 Dev Module**
   - Upload Speed: **115200**
   - USB CDC On Boot: **Disabled**
   - Port: den COM-port DevKit C dyker upp som

5. **Upload**. Öppna Serial Monitor på 115200 baud och kolla att det kommer
   `WIFI,connected,...` och `CSI_DATA,...`-rader. Stäng monitorn innan kortet
   flyttas till Pi:n, så porten blir ledig.

## 2. Koppla in mot Pi:n

Anslut ESP32:n till Pi:n med USB-kabeln. Kontrollera att porten dyker upp:

```bash
ls /dev/tty*
```

Vanligtvis `/dev/ttyUSB0` (CP2102) eller `/dev/ttyACM0` (CH340/native USB).
Lägg din användare i `dialout`-gruppen om du får `Permission denied`:

```bash
sudo usermod -aG dialout $USER
# logga ut och in igen
```

## 3. Kör presence-monitorn på Pi:n

Gymskärmens helper gör det automatiskt. Fristående:

```bash
cd pi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python3 presence_monitor.py --port /dev/ttyUSB0
```

Med MQTT (t.ex. till Home Assistant):

```bash
python3 presence_monitor.py --port /dev/ttyUSB0 \
    --mqtt-host 192.168.1.50 --mqtt-topic home/office/presence
```

## Kalibrering (gymskärm)

På Pi:n, med gymskärmen igång:

```bash
~/ClimbTraining/pi/csi-tune.sh
~/ClimbTraining/pi/csi-tune.sh watch
~/ClimbTraining/pi/csi-tune.sh 2.5
```

Lägre tröskel = känsligare. Ställ den mellan tomt-rum-signal och signal när någon är vid TV:n.

`--threshold` är det viktigaste värdet att justera:

1. Kör skriptet utan `--quiet` i ett tomt rum en stund, notera vilken nivå
   "brus" (stdev) ligger på i loggen.
2. Gå in i rummet och rör dig, se hur mycket stdev-värdet stiger.
3. Sätt `--threshold` någonstans mellan de två nivåerna. Standard (3.0) är
   en utgångspunkt, inte ett facit — det varierar med rummets storlek,
   möblering och hur "stökigt" WiFi-spektrumet är i huset.

`--hold-seconds` styr hur länge status stannar på "present" efter senaste
rörelsen (standard 120 s). Öka om ni vill undvika att statusen växlar till
"empty" när någon sitter still en stund.

## Filstruktur

```
firmware/
  csi_presence_sensor/
    csi_presence_sensor.ino   # Arduino-sketch: WiFi STA + CSI + UDP-ping
    config.example.h          # Kopiera till config.h (SSID, lösenord, router-IP)
pi/
  presence_monitor.py         # Läser CSI-strömmen, avgör presence
  requirements.txt
```
