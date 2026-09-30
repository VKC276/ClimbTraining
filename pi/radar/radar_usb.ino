/*
  radar_usb - LD2410D -> ESP32-C3 Super Mini -> USB -> Raspberry Pi
  ------------------------------------------------------------------
  Skickar en JSON-rad per händelse över USB (CDC):
    {"event":"motion","seq":12,"t":45021,"dist":236,"dir":"approaching"}
    {"event":"still","seq":13,"t":47100,"dist":240}
    {"event":"clear","seq":14,"t":61000}
    {"event":"status","seq":15,"t":65000,"state":"clear","dist":-1,...}   (heartbeat)

  Tar emot textkommandon från Pi:n (ett per rad):
    ping | status | config | save | defaults | reboot | debug on | debug off
    set threshold <cm> | set window <ms> | set hold <ms> | set timeout <ms> | set heartbeat <ms>

  Koppling:
    Radar VCC -> 5V      Radar TX -> GPIO20
    Radar GND -> GND     Radar RX -> GPIO21
    Radar OUT -> GPIO3

  Arduino IDE: Tools -> USB CDC On Boot -> Enabled   (krävs, annars kompileras inte koden)
*/

#include <Arduino.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <esp_system.h>
#include <esp_arduino_version.h>
#include <stdarg.h>

#if !ARDUINO_USB_CDC_ON_BOOT
#error "Satt Tools -> USB CDC On Boot -> Enabled i Arduino IDE"
#endif

#define FW_VERSION    "1.0.0"
#define RADAR_RX_PIN  20
#define RADAR_TX_PIN  21
#define RADAR_OUT_PIN 3
#define LED_PIN       8        // inbyggd LED, aktiv låg
#define RADAR_BAUD    115200
#define WDT_TIMEOUT_S 8

// ------------------------------------------------------------------
// Inställningar (sparas i flash med kommandot "save")
// ------------------------------------------------------------------
struct Config {
  int      threshold   = 15;    // cm variation inom fönstret = rörelse
  uint32_t windowMs    = 1500;  // tidsfönster för variationen
  uint32_t holdMs      = 2000;  // rörelse hålls kvar så länge efter sista förändringen
  uint32_t timeoutMs   = 2000;  // inga avståndsrader så länge = ingen avståndsdata
  uint32_t heartbeatMs = 5000;  // statusrad till Pi:n
  bool     debug       = false; // status varje sekund + okända radarrader
};

Config         cfg;
Preferences    prefs;
HardwareSerial RadarSerial(1);

enum State { ST_CLEAR, ST_STILL, ST_MOTION };
State state = ST_CLEAR;

const char* stateName(State s) {
  switch (s) {
    case ST_CLEAR:  return "clear";
    case ST_STILL:  return "still";
    case ST_MOTION: return "motion";
  }
  return "unknown";
}

// Ringbuffert med avståndsmätningar
const int BUF_SIZE = 64;
int      sampleDist[BUF_SIZE];
uint32_t sampleTime[BUF_SIZE];
int      bufHead = 0, bufCount = 0;

char radarLine[64]; int radarLen = 0;
char cmdLine[96];   int cmdLen   = 0;

int      lastDist        = -1;
uint32_t lastDistMs      = 0;
uint32_t lastRadarByteMs = 0;
uint32_t lastMotionMs    = 0;
uint32_t lastHeartbeatMs = 0;
int      spread = 0;
int      trend  = 0;
uint32_t seq    = 0;

// ------------------------------------------------------------------
// Utskrift: en komplett JSON-rad per anrop
// ------------------------------------------------------------------
void emit(const char* event, const char* fmt = nullptr, ...) {
  char extra[200] = "";
  if (fmt) {
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(extra, sizeof(extra), fmt, ap);
    va_end(ap);
  }
  char line[280];
  int n = snprintf(line, sizeof(line), "{\"event\":\"%s\",\"seq\":%lu,\"t\":%lu%s%s}\n",
                   event, (unsigned long)++seq, (unsigned long)millis(),
                   extra[0] ? "," : "", extra);
  if (n < 0) return;
  if (n >= (int)sizeof(line)) { n = sizeof(line) - 2; line[n] = '}'; line[n + 1] = '\n'; n += 2; }
  Serial.write((const uint8_t*)line, n);   // släpps direkt om ingen värd lyssnar
}

// Gör text säker att lägga i en JSON-sträng
void sanitize(char* s) {
  for (; *s; s++) {
    if (*s == '"' || *s == '\\' || *s < 0x20 || *s > 0x7E) *s = '?';
  }
}

const char* resetReasonText() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON:  return "power_on";
    case ESP_RST_SW:       return "software";
    case ESP_RST_PANIC:    return "panic";
    case ESP_RST_INT_WDT:  return "int_watchdog";
    case ESP_RST_TASK_WDT: return "task_watchdog";
    case ESP_RST_WDT:      return "watchdog";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_USB:      return "usb";
    default:               return "other";
  }
}

// ------------------------------------------------------------------
// Inställningar i flash
// ------------------------------------------------------------------
void loadConfig() {
  prefs.begin("radar", true);
  cfg.threshold   = prefs.getInt("thr",  cfg.threshold);
  cfg.windowMs    = prefs.getUInt("win", cfg.windowMs);
  cfg.holdMs      = prefs.getUInt("hold", cfg.holdMs);
  cfg.timeoutMs   = prefs.getUInt("tout", cfg.timeoutMs);
  cfg.heartbeatMs = prefs.getUInt("hb",  cfg.heartbeatMs);
  prefs.end();
}

void saveConfig() {
  prefs.begin("radar", false);
  prefs.putInt("thr",   cfg.threshold);
  prefs.putUInt("win",  cfg.windowMs);
  prefs.putUInt("hold", cfg.holdMs);
  prefs.putUInt("tout", cfg.timeoutMs);
  prefs.putUInt("hb",   cfg.heartbeatMs);
  prefs.end();
}

void sendConfig() {
  emit("config", "\"fw\":\"%s\",\"threshold\":%d,\"window\":%lu,\"hold\":%lu,\"timeout\":%lu,\"heartbeat\":%lu,\"debug\":%s",
       FW_VERSION, cfg.threshold, (unsigned long)cfg.windowMs, (unsigned long)cfg.holdMs,
       (unsigned long)cfg.timeoutMs, (unsigned long)cfg.heartbeatMs, cfg.debug ? "true" : "false");
}

void sendStatus() {
  uint32_t now = millis();
  long radarAge = lastRadarByteMs ? (long)(now - lastRadarByteMs) : -1;
  emit("status", "\"state\":\"%s\",\"dist\":%d,\"spread\":%d,\"trend\":%d,\"out\":%d,\"radar_age\":%ld",
       stateName(state), state == ST_CLEAR ? -1 : lastDist, spread, trend,
       digitalRead(RADAR_OUT_PIN), radarAge);
}

// ------------------------------------------------------------------
// Radar: läs textrader "distance:xxx"
// ------------------------------------------------------------------
void addSample(int d) {
  sampleDist[bufHead] = d;
  sampleTime[bufHead] = millis();
  bufHead = (bufHead + 1) % BUF_SIZE;
  if (bufCount < BUF_SIZE) bufCount++;
}

void analyze() {
  uint32_t now = millis();
  int minD = 100000, maxD = -1;
  long sumOld = 0, sumNew = 0;
  int nOld = 0, nNew = 0;

  for (int i = 0; i < bufCount; i++) {
    int idx = (bufHead - 1 - i + BUF_SIZE) % BUF_SIZE;
    uint32_t age = now - sampleTime[idx];
    if (age > cfg.windowMs) break;
    int d = sampleDist[idx];
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
    if (age < cfg.windowMs / 2) { sumNew += d; nNew++; }
    else                        { sumOld += d; nOld++; }
  }

  if (maxD < 0) { spread = 0; trend = 0; return; }
  spread = maxD - minD;
  trend  = (nOld > 0 && nNew > 0) ? (int)(sumNew / nNew - sumOld / nOld) : 0;
}

void handleRadarLine(char* s) {
  if (strncmp(s, "distance:", 9) == 0) {
    int d = atoi(s + 9);
    if (d >= 0 && d <= 3000) {
      lastDist   = d;
      lastDistMs = millis();
      addSample(d);
    }
  } else if (cfg.debug && s[0]) {
    sanitize(s);
    emit("radar_raw", "\"text\":\"%s\"", s);
  }
}

void readRadar() {
  while (RadarSerial.available()) {
    char c = RadarSerial.read();
    lastRadarByteMs = millis();
    if (c == '\n' || c == '\r') {
      if (radarLen > 0) {
        radarLine[radarLen] = 0;
        handleRadarLine(radarLine);
        radarLen = 0;
      }
    } else if (radarLen < (int)sizeof(radarLine) - 1) {
      radarLine[radarLen++] = c;
    } else {
      radarLen = 0;   // för lång rad = skräp
    }
  }
}

// ------------------------------------------------------------------
// Tillstånd
// ------------------------------------------------------------------
void setState(State s) {
  if (s == state) return;
  state = s;
  digitalWrite(LED_PIN, s == ST_MOTION ? LOW : HIGH);

  switch (s) {
    case ST_MOTION: {
      const char* dir = trend < -5 ? "approaching" : trend > 5 ? "leaving" : "lateral";
      emit("motion", "\"dist\":%d,\"dir\":\"%s\",\"spread\":%d", lastDist, dir, spread);
      break;
    }
    case ST_STILL:
      emit("still", "\"dist\":%d", lastDist);
      break;
    case ST_CLEAR:
      emit("clear");
      break;
  }
}

// ------------------------------------------------------------------
// Kommandon från Pi:n
// ------------------------------------------------------------------
bool setValue(const char* key, long v) {
  if      (!strcmp(key, "threshold") && v >= 3    && v <= 500)   cfg.threshold   = v;
  else if (!strcmp(key, "window")    && v >= 200  && v <= 10000) cfg.windowMs    = v;
  else if (!strcmp(key, "hold")      && v >= 0    && v <= 60000) cfg.holdMs      = v;
  else if (!strcmp(key, "timeout")   && v >= 500  && v <= 60000) cfg.timeoutMs   = v;
  else if (!strcmp(key, "heartbeat") && v >= 1000 && v <= 60000) cfg.heartbeatMs = v;
  else return false;
  return true;
}

void handleCommand(char* c) {
  while (*c == ' ') c++;
  for (char* p = c; *p; p++) *p = tolower(*p);

  if (!strcmp(c, "ping")) {
    emit("pong");
  } else if (!strcmp(c, "status")) {
    sendStatus();
  } else if (!strcmp(c, "config")) {
    sendConfig();
  } else if (!strcmp(c, "save")) {
    saveConfig();
    emit("ack", "\"cmd\":\"save\"");
  } else if (!strcmp(c, "defaults")) {
    bool dbg = cfg.debug;
    cfg = Config();
    cfg.debug = dbg;
    emit("ack", "\"cmd\":\"defaults\"");
    sendConfig();
  } else if (!strcmp(c, "reboot")) {
    emit("ack", "\"cmd\":\"reboot\"");
    Serial.flush();
    delay(100);
    ESP.restart();
  } else if (!strcmp(c, "debug on")) {
    cfg.debug = true;
    emit("ack", "\"cmd\":\"debug\",\"value\":true");
  } else if (!strcmp(c, "debug off")) {
    cfg.debug = false;
    emit("ack", "\"cmd\":\"debug\",\"value\":false");
  } else if (!strncmp(c, "set ", 4)) {
    char key[16];
    long val;
    if (sscanf(c + 4, "%15s %ld", key, &val) == 2 && setValue(key, val)) {
      emit("ack", "\"cmd\":\"set\",\"key\":\"%s\",\"value\":%ld", key, val);
    } else {
      emit("error", "\"msg\":\"bad_set\"");
    }
  } else if (c[0]) {
    emit("error", "\"msg\":\"unknown_command\"");
  }
}

void readCommands() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (cmdLen > 0) {
        cmdLine[cmdLen] = 0;
        handleCommand(cmdLine);
        cmdLen = 0;
      }
    } else if (cmdLen < (int)sizeof(cmdLine) - 1) {
      cmdLine[cmdLen++] = ch;
    } else {
      cmdLen = 0;
      emit("error", "\"msg\":\"command_too_long\"");
    }
  }
}

// ------------------------------------------------------------------
// Watchdog: startar om ESP:n om loop() hänger sig
// ------------------------------------------------------------------
void setupWatchdog() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdtCfg = {
    .timeout_ms     = WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic  = true
  };
  if (esp_task_wdt_init(&wdtCfg) == ESP_ERR_INVALID_STATE) {
    esp_task_wdt_reconfigure(&wdtCfg);
  }
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  esp_task_wdt_add(NULL);
}

// ------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);   // blockera aldrig om Pi:n inte läser

  pinMode(RADAR_OUT_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  loadConfig();
  RadarSerial.begin(RADAR_BAUD, SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN);
  setupWatchdog();

  emit("boot", "\"fw\":\"%s\",\"reason\":\"%s\"", FW_VERSION, resetReasonText());
  sendConfig();
}

void loop() {
  esp_task_wdt_reset();

  readRadar();
  readCommands();

  uint32_t now     = millis();
  bool     hasData = lastDistMs && (now - lastDistMs < cfg.timeoutMs);
  bool     outHigh = digitalRead(RADAR_OUT_PIN);

  analyze();
  if (hasData && spread >= cfg.threshold) lastMotionMs = now;

  if (hasData && lastMotionMs && now - lastMotionMs < cfg.holdMs) setState(ST_MOTION);
  else if (hasData || outHigh)                                    setState(ST_STILL);
  else                                                            setState(ST_CLEAR);

  uint32_t hb = cfg.debug ? 1000 : cfg.heartbeatMs;
  if (now - lastHeartbeatMs >= hb) {
    lastHeartbeatMs = now;
    sendStatus();
  }

  delay(2);
}
