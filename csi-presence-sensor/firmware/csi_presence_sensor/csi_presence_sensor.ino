/*
  CSI-närvaro för gym-TV — ESP32-WROOM-32 (DevKit C)

  Arduino IDE:
    Kort: ESP32 Dev Module
    Upload Speed: 115200
    USB CDC On Boot: Disabled
  Kopiera config.example.h till config.h och fyll i WiFi.
  Router-IP tas från DHCP-gateway.
*/

#include <string.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include "esp_wifi.h"
#include "esp_timer.h"

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

static const int CSI_MAX = 256;

static WiFiUDP udp;
static IPAddress routerIp;
static bool csiOk = false;
static portMUX_TYPE csiMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool csiFresh = false;
static int8_t csiCopy[CSI_MAX];
static volatile uint16_t csiLen = 0;
static volatile int csiRssi = 0;
static uint32_t lastHeartMs = 0;
static uint32_t lastPingMs = 0;

static void wifiCsiRxCb(void *ctx, wifi_csi_info_t *info) {
  (void)ctx;
  if (!info || !info->buf || info->len <= 0) {
    return;
  }
  const uint16_t n = info->len > CSI_MAX ? CSI_MAX : info->len;
  portENTER_CRITICAL(&csiMux);
  memcpy(csiCopy, info->buf, n);
  csiLen = n;
  csiRssi = info->rx_ctrl.rssi;
  csiFresh = true;
  portEXIT_CRITICAL(&csiMux);
}

static bool startCsi() {
  wifi_csi_config_t cfg = {};
  cfg.lltf_en = true;
  cfg.htltf_en = true;
  cfg.stbc_htltf2_en = false;
  cfg.ltf_merge_en = true;
  cfg.channel_filter_en = false;
  cfg.manu_scale = false;
  cfg.shift = 0;

  esp_wifi_set_promiscuous(true);
  if (esp_wifi_set_csi_config(&cfg) != ESP_OK) {
    Serial.println("CSI_ERR,set_csi_config");
    return false;
  }
  if (esp_wifi_set_csi_rx_cb(wifiCsiRxCb, nullptr) != ESP_OK) {
    Serial.println("CSI_ERR,set_csi_rx_cb");
    return false;
  }
  if (esp_wifi_set_csi(true) != ESP_OK) {
    Serial.println("CSI_ERR,set_csi");
    return false;
  }
  return true;
}

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("WIFI,connecting,%s\n", WIFI_SSID);
  uint32_t started = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    if (millis() - started > 15000) {
      Serial.println("WIFI,wait");
      started = millis();
    }
  }
  routerIp = WiFi.gatewayIP();
  Serial.printf(
      "WIFI,connected,%s,gw,%s\n",
      WiFi.localIP().toString().c_str(),
      routerIp.toString().c_str());
}

static void printCsi() {
  int8_t local[CSI_MAX];
  uint16_t n = 0;
  int rssi = 0;
  portENTER_CRITICAL(&csiMux);
  if (!csiFresh) {
    portEXIT_CRITICAL(&csiMux);
    return;
  }
  n = csiLen;
  rssi = csiRssi;
  memcpy(local, csiCopy, n);
  csiFresh = false;
  portEXIT_CRITICAL(&csiMux);

  Serial.printf("CSI_DATA,%lld,%d,%u,[", (long long)esp_timer_get_time(), rssi, (unsigned)n);
  for (uint16_t i = 0; i < n; i++) {
    Serial.printf("%d ", local[i]);
  }
  Serial.println(']');
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("CSI_BOOT");
  connectWifi();
  csiOk = startCsi();
  Serial.println(csiOk ? "CSI,ready" : "CSI,failed");
  udp.begin(0);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    csiOk = false;
    connectWifi();
    csiOk = startCsi();
  }

  printCsi();

  const uint32_t now = millis();
  if (now - lastHeartMs >= 1000) {
    lastHeartMs = now;
    Serial.printf(
        "CSI_HEART,wifi=%d,csi=%d,gw=%s\n",
        WiFi.status() == WL_CONNECTED ? 1 : 0,
        csiOk ? 1 : 0,
        routerIp.toString().c_str());
  }

  if (routerIp[0] == 0) {
    delay(50);
    return;
  }
  if (now - lastPingMs >= PING_INTERVAL_MS) {
    lastPingMs = now;
    const uint8_t payload = 0x00;
    if (udp.beginPacket(routerIp, UDP_TARGET_PORT) == 1) {
      udp.write(&payload, 1);
      udp.endPacket();
    }
  }
  delay(5);
}
