/*
  CSI-närvaro för gym-TV — ESP32-WROOM-32 (DevKit C)

  Arduino IDE:
    Kort: ESP32 Dev Module
    Upload Speed: 115200
    USB CDC On Boot: Disabled
  Kopiera config.example.h till config.h och fyll i WiFi.
  Router-IP tas freeån DHCP-gateway.
*/

#include <WiFi.h>
#include <WiFiUdp.h>
#include "esp_wifi.h"
#include "esp_timer.h"

#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

static WiFiUDP udp;
static IPAddress routerIp;
static bool csiOk = false;

static void wifiCsiRxCb(void *ctx, wifi_csi_info_t *info) {
  (void)ctx;
  if (!info || !info->buf || info->len <= 0) {
    return;
  }

  const wifi_pkt_rx_ctrl_t *rx = &info->rx_ctrl;
  Serial.printf(
      "CSI_DATA,%lld,%02x:%02x:%02x:%02x:%02x:%02x,%d,%u,",
      (long long)esp_timer_get_time(),
      info->mac[0],
      info->mac[1],
      info->mac[2],
      info->mac[3],
      info->mac[4],
      info->mac[5],
      rx->rssi,
      (unsigned)info->len);
  Serial.print('[');
  for (int i = 0; i < info->len; i++) {
    Serial.printf("%d ", info->buf[i]);
  }
  Serial.println(']');
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
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
  }
  routerIp = WiFi.gatewayIP();
  Serial.printf(
      "WIFI,connected,%s,gw,%s\n",
      WiFi.localIP().toString().c_str(),
      routerIp.toString().c_str());
}

void setup() {
  Serial.begin(115200);
  delay(300);
  connectWifi();
  csiOk = startCsi();
  if (csiOk) {
    Serial.println("CSI,ready");
  }
  udp.begin(0);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    csiOk = startCsi();
  }

  if (routerIp[0] == 0) {
    delay(PING_INTERVAL_MS);
    return;
  }
  const uint8_t payload = 0x00;
  if (udp.beginPacket(routerIp, UDP_TARGET_PORT) == 1) {
    udp.write(&payload, 1);
    udp.endPacket();
  }
  delay(PING_INTERVAL_MS);
}
