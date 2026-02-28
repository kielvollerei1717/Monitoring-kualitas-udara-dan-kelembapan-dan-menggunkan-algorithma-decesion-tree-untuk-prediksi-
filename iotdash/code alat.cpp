#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiManager.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDR 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Sensor Configuration
#define DHTPIN 32
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

#define MQ135_AO_PIN 34
#define LED_PIN 2
#define BUZZER_PIN 25
#define BLUE_LED_PIN 26  // Blue LED indicator pin

// Flask Server Configuration
char flaskServerIP[17] = "192.168.43.103";  // change base on your flask server ip
const int flaskServerPort = 5000;
String serverURL;

// Preferences for storing configuration
Preferences preferences;

// WiFiManager parameter for custom IP
WiFiManagerParameter custom_flask_ip("server", "Flask Server IP", flaskServerIP, 17);

// Timing Configuration
const unsigned long 
  DHT_READ_INTERVAL = 3000,
  DATA_SEND_INTERVAL = 3100,
  DISPLAY_UPDATE_INTERVAL = 2000,
  WEB_STATUS_DURATION = 2000,
  CONNECTION_TIMEOUT = 10000,
  WIFI_RECONNECT_INTERVAL = 15000,      // 15 seconds between reconnect attempts
  AP_DISPLAY_DURATION = 5000,           // Show AP info for 5 seconds
  MAX_CONNECTION_TIME = 60000,         // 1 minutes for initial connection
  AP_MODE_TIMEOUT = 180000,             // 3 minutes in AP mode
  OFFLINE_RESTART_THRESHOLD = 180000,   // 3 minutes offline before restart prompt
  BLUE_LED_BLINK_INTERVAL = 500,        // Blue LED blink interval
  AP_BLUE_LED_BLINK_INTERVAL = 1000;    // Fixed: Correct declaration

// Buzzer configuration
const unsigned long 
  BUZZER_SLOW_INTERVAL = 1500,
  BUZZER_MEDIUM_INTERVAL = 1000,
  BUZZER_FAST_INTERVAL = 500;
  
const unsigned long BUZZER_ON_DURATION = 200;

// Smoothing factor
const float SMOOTHING_FACTOR = 0.3;
// WiFi Status Tracking
enum WiFiStatus {
  WIFI_CONNECTED,
  WIFI_RECONNECTING,
  WIFI_AP_MODE,
  WIFI_OFFLINE
};

// Sensor Data Structure
struct SensorData {
  float temperature = 0;
  float humidity = 0;
  float airQuality = 0;
  String status = "Normal";
};

// System State
struct SystemState {
  WiFiStatus wifiStatus = WIFI_OFFLINE;
  bool displayWebSuccess = false;
  bool webError = false;
  bool buzzerActive = false;
  bool firstReadComplete = false;
  bool showAPInfo = false;
  bool configChanged = false;
  bool blueLedOn = true;                  // Blue LED state
  bool blueLedBlinking = false;           // Blue LED blink mode
  String httpError = "";
  unsigned long lastWebStatusTime = 0;
  unsigned long lastBuzzerToggle = 0;
  unsigned long buzzerInterval = 0;
  unsigned long connectionStartTime = 0;
  unsigned long apStartTime = 0;
  unsigned long disconnectionTime = 0;
  unsigned long lastReconnectAttempt = 0;
  unsigned long offlineStartTime = 0;
  unsigned long lastBlueLedToggle = 0;    // Last blue LED toggle time
};

// Initialize components
SensorData sensorData;
SystemState systemState;
WiFiMulti wifiMulti;
WiFiManager wifiManager;

// Indonesian National Standards for Indoor Environment
const float 
  CO2_WARNING_LEVEL = 200.0,
  CO2_SEVERE_LEVEL = 300.0,
  CO2_CRITICAL_LEVEL = 500.0,
  
  // Temperature thresholds (Indonesian Standard SNI 03-6572-2001)
  TEMP_MIN_INDOOR = 20.5,    // Minimum comfortable temperature
  TEMP_MAX_INDOOR = 31,    // Maximum comfortable temperature
  
  // Humidity thresholds (Indonesian Standard SNI 03-6572-2001)
  HUMIDITY_MIN_INDOOR = 40.0,  // Minimum comfortable humidity
  HUMIDITY_MAX_INDOOR = 80.0;  // Maximum comfortable humidity

// Function prototypes
void initDisplay();
void loadConfiguration();
void saveConfiguration();
void startWiFiConnection();
void startAPMode();
void manageWiFi();
bool readDHT();
void readMQ135();
void determineAirStatus();
void handleBuzzer();
void updateBlueLED();
void sendSensorData();
void updateDisplay();

// Initialize OLED display
void initDisplay() {
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED allocation failed");
    while (1);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Starting Sensors...");
  display.display();
}

// Load saved configuration
void loadConfiguration() {
  preferences.begin("air-monitor", true);
  String savedIP = preferences.getString("flaskIP", "");
  if (savedIP.length() > 0) {
    savedIP.toCharArray(flaskServerIP, 17);
    Serial.println("Loaded saved Flask IP: " + savedIP);
  } else {
    Serial.println("Using default Flask IP");
  }
  preferences.end();
  
  // Set custom parameter with loaded value
  custom_flask_ip.setValue(flaskServerIP, 17);
  
  // Build server URL
  serverURL = "http://" + String(flaskServerIP) + ":" + String(flaskServerPort) + "/upload";
}

// Save configuration
void saveConfiguration() {
  preferences.begin("air-monitor", false);
  preferences.putString("flaskIP", flaskServerIP);
  preferences.end();
  Serial.println("Saved Flask IP: " + String(flaskServerIP));
  
  // Rebuild server URL
  serverURL = "http://" + String(flaskServerIP) + ":" + String(flaskServerPort) + "/upload";
  Serial.println("New server URL: " + serverURL);
}

// Start WiFi connection in background
void startWiFiConnection() {
  systemState.connectionStartTime = millis();
  systemState.wifiStatus = WIFI_RECONNECTING;
  systemState.disconnectionTime = 0;
  systemState.offlineStartTime = 0;
  
  // Add WiFi networks
  wifiMulti.addAP("123", "shinugai123"); // change based on your wifi network
  
  wifiMulti.run();
}

// Start AP mode
void startAPMode() {
  systemState.wifiStatus = WIFI_AP_MODE;
  systemState.showAPInfo = true;
  systemState.apStartTime = millis();
  systemState.configChanged = false;
  
  // Update parameter with current value before showing portal
  custom_flask_ip.setValue(flaskServerIP, 17);
  wifiManager.addParameter(&custom_flask_ip);
  
  wifiManager.setConfigPortalTimeout(AP_MODE_TIMEOUT / 1000);
  wifiManager.setConfigPortalBlocking(false);
  wifiManager.setSaveConfigCallback([]() {
    // Use strlcpy for safer copying
    strlcpy(flaskServerIP, custom_flask_ip.getValue(), sizeof(flaskServerIP));
    systemState.configChanged = true;
    saveConfiguration();
  });
  
  wifiManager.startConfigPortal("AirMonitorAP"); 
  Serial.println("AP Mode Started"); // change whatever you want
}

// Non-blocking WiFi management
void manageWiFi() {
  // Handle WiFi state transitions
  if (WiFi.status() == WL_CONNECTED) {
    systemState.wifiStatus = WIFI_CONNECTED;
    systemState.disconnectionTime = 0;
    systemState.offlineStartTime = 0;
    return;
  }
  
  unsigned long currentMillis = millis();
  
  // Handle AP info display timeout
  if (systemState.showAPInfo && 
      currentMillis - systemState.apStartTime > AP_DISPLAY_DURATION) {
    systemState.showAPInfo = false;
  }
  
  // Start AP mode after initial connection timeout
  if (systemState.wifiStatus == WIFI_RECONNECTING && 
      currentMillis - systemState.connectionStartTime > MAX_CONNECTION_TIME) {
    startAPMode();
    return;
  }
  
  // Handle disconnection
  if (systemState.wifiStatus == WIFI_CONNECTED) {
    systemState.wifiStatus = WIFI_RECONNECTING;
    systemState.disconnectionTime = currentMillis;
    systemState.lastReconnectAttempt = currentMillis;
  }
  
  // Start AP mode after disconnection timeout
  if (systemState.wifiStatus == WIFI_RECONNECTING && 
      systemState.disconnectionTime != 0 && 
      currentMillis - systemState.disconnectionTime > 15000) { // 15 seconds
    startAPMode();
    systemState.disconnectionTime = 0;
    return;
  }
  
  // Handle AP mode timeout
  if (systemState.wifiStatus == WIFI_AP_MODE && 
      currentMillis - systemState.apStartTime > AP_MODE_TIMEOUT) {
    wifiManager.stopConfigPortal();
    systemState.wifiStatus = WIFI_OFFLINE;
    systemState.offlineStartTime = currentMillis;
    
    if (systemState.configChanged) {
      Serial.println("Configuration changed - restarting ESP32");
      ESP.restart();
    }
    Serial.println("AP Mode Timeout - Entering Offline Mode");
  }
  
  // Attempt reconnect if not connected
  if (systemState.wifiStatus == WIFI_RECONNECTING && 
      currentMillis - systemState.lastReconnectAttempt > WIFI_RECONNECT_INTERVAL) {
    systemState.lastReconnectAttempt = currentMillis;
    WiFi.reconnect();
  }
  
  // Handle offline timeout
  if (systemState.wifiStatus == WIFI_OFFLINE && 
      currentMillis - systemState.offlineStartTime > OFFLINE_RESTART_THRESHOLD) {
    systemState.offlineStartTime = currentMillis; // Reset timer but stay offline
  }
}

// Read and smooth DHT22 sensor data
bool readDHT() {
  float rawTemp = dht.readTemperature();
  float rawHumidity = dht.readHumidity();
  
  if (isnan(rawTemp) || isnan(rawHumidity)) {
    return false;
  }
  
  if (!systemState.firstReadComplete) {
    sensorData.temperature = rawTemp;
    sensorData.humidity = rawHumidity;
    systemState.firstReadComplete = true;
  } else {
    sensorData.temperature = (SMOOTHING_FACTOR * rawTemp) + 
                            ((1 - SMOOTHING_FACTOR) * sensorData.temperature);
    sensorData.humidity = (SMOOTHING_FACTOR * rawHumidity) + 
                         ((1 - SMOOTHING_FACTOR) * sensorData.humidity);
  }
  
  return true;
}

// Read and smooth MQ135 sensor data
void readMQ135() {
  int rawValue = analogRead(MQ135_AO_PIN);
  float currentAQ = map(rawValue, 0, 4095, 0, 1000);
  
  if (!systemState.firstReadComplete) {
    sensorData.airQuality = currentAQ;
  } else {
    sensorData.airQuality = (SMOOTHING_FACTOR * currentAQ) + 
                           ((1 - SMOOTHING_FACTOR) * sensorData.airQuality);
  }
}

// Determine air quality status based on Indonesian standards
void determineAirStatus() {
  if (sensorData.airQuality > CO2_CRITICAL_LEVEL) {
    sensorData.status = "CRITICAL AIR";
    systemState.buzzerInterval = BUZZER_FAST_INTERVAL;
  } 
  else if (sensorData.airQuality > CO2_SEVERE_LEVEL) {
    sensorData.status = "SEVERE AIR";
    systemState.buzzerInterval = BUZZER_MEDIUM_INTERVAL;
  } 
  else if (sensorData.airQuality > CO2_WARNING_LEVEL) {
    sensorData.status = "POOR AIR";
    systemState.buzzerInterval = BUZZER_SLOW_INTERVAL;
  } 
  else if (sensorData.temperature < TEMP_MIN_INDOOR) {
    sensorData.status = "TOO COLD";
    systemState.buzzerInterval = 0;
  } 
  else if (sensorData.temperature > TEMP_MAX_INDOOR) {
    sensorData.status = "TOO HOT";
    systemState.buzzerInterval = 0;
  } 
  else if (sensorData.humidity < HUMIDITY_MIN_INDOOR) {
    sensorData.status = "TOO DRY";
    systemState.buzzerInterval = 0;
  } 
  else if (sensorData.humidity > HUMIDITY_MAX_INDOOR) {
    sensorData.status = "TOO MOIST";
    systemState.buzzerInterval = 0;
  } 
  else {
    sensorData.status = "NORMAL";
    systemState.buzzerInterval = 0;
  }
}

// Control buzzer based on air quality
void handleBuzzer() {
  static unsigned long lastBeepStart = 0;
  static bool inBeepCycle = false;
  
  if (systemState.buzzerInterval > 0) {
    unsigned long currentTime = millis();
    
    if (!inBeepCycle) {
      // Start new beep cycle
      digitalWrite(BUZZER_PIN, HIGH);
      lastBeepStart = currentTime;
      inBeepCycle = true;
    } else {
      // Check if beep duration has passed
      if (currentTime - lastBeepStart >= BUZZER_ON_DURATION) {
        digitalWrite(BUZZER_PIN, LOW);
        
        // Check if entire interval has passed
        if (currentTime - lastBeepStart >= systemState.buzzerInterval) {
          inBeepCycle = false;  // Ready for next beep
        }
      }
    }
  } else {
    // Ensure buzzer is off when not needed
    if (inBeepCycle) {
      digitalWrite(BUZZER_PIN, LOW);
      inBeepCycle = false;
    }
  }
}

// Control blue LED indicator
void updateBlueLED() {
  unsigned long currentMillis = millis();
  unsigned long blinkInterval = 0;
  
  switch(systemState.wifiStatus) {
    case WIFI_RECONNECTING:
      blinkInterval = BLUE_LED_BLINK_INTERVAL; // Use normal blink interval
      break;
      
    case WIFI_AP_MODE:
      blinkInterval = AP_BLUE_LED_BLINK_INTERVAL; // Use slower blink for AP mode
      break;
      
    case WIFI_CONNECTED:
    case WIFI_OFFLINE:
      // Solid on for connected/offline states
      if (!systemState.blueLedOn) {
        systemState.blueLedOn = true;
        digitalWrite(BLUE_LED_PIN, HIGH);
      }
      return; // Exit early - no blinking needed
  }

  // Handle blinking for reconnecting/AP modes
  if (currentMillis - systemState.lastBlueLedToggle > blinkInterval) {
    systemState.lastBlueLedToggle = currentMillis;
    systemState.blueLedOn = !systemState.blueLedOn;
    digitalWrite(BLUE_LED_PIN, systemState.blueLedOn);
  }
}

// Send data to server
void sendSensorData() {
  if (systemState.wifiStatus != WIFI_CONNECTED) {
    systemState.httpError = "OFFLINE";
    systemState.webError = true;
    return;
  }

  String postData = "temperature=" + String(sensorData.temperature, 1) +
                   "&humidity=" + String(sensorData.humidity, 1) +
                   "&air_quality=" + String(sensorData.airQuality, 1) +
                   "&status=" + String(sensorData.status);

  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.setTimeout(8000);

  int httpCode = http.POST(postData);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      systemState.displayWebSuccess = true;
      systemState.lastWebStatusTime = millis();
      systemState.webError = false;
    } else {
      systemState.httpError = "HTTP:" + String(httpCode);
      systemState.webError = true;
    }
  } else {
    systemState.httpError = http.errorToString(httpCode);
    systemState.webError = true;
  }

  http.end();
}

// Update OLED display
void updateDisplay() {
  display.clearDisplay();
  
  // Header
  display.setCursor(0, 0);
  display.print("Air Monitor [");
  
  // WiFi status indicator
  switch(systemState.wifiStatus) {
    case WIFI_CONNECTED: display.print("ON"); break;
    case WIFI_RECONNECTING: display.print("RC"); break;
    case WIFI_AP_MODE: display.print("AP"); break;
    case WIFI_OFFLINE: display.print("OFF"); break;
  }
  display.print("]");
  
  // Divider
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  
  // Sensor data
  display.setCursor(0, 15);
  display.printf("T:%.1fC", sensorData.temperature);
  
  display.setCursor(64, 15);
  display.printf("H:%.1f%%", sensorData.humidity);
  
  display.setCursor(0, 30);
  display.printf("AQ:%.1fppm", sensorData.airQuality);
  
  // Status
  display.setCursor(0, 45);
  display.print("Status: ");
  
  if (sensorData.airQuality > CO2_CRITICAL_LEVEL) {
    display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
  }
  display.print(sensorData.status);
  display.setTextColor(SSD1306_WHITE);
  
  // Bottom status line
  display.setCursor(0, 55);
  
  if (systemState.showAPInfo) {
    // Show AP info temporarily
    display.print("AP: AirMonitorAP");
  } 
  else if (systemState.wifiStatus == WIFI_AP_MODE) {
    // Show AP active status
    display.print("AP Mode Active");
  }
  else if (systemState.wifiStatus == WIFI_OFFLINE) {
    // Permanent offline mode
    if (millis() - systemState.offlineStartTime > OFFLINE_RESTART_THRESHOLD) {
      display.print("RESTART TO CONFIG");
    } else {
      display.print("Web: Offline");
    }
  } 
  else if (systemState.displayWebSuccess) {
    display.print("Web: Success");
  } 
  else if (systemState.webError) {
    display.print("Web: ");
    display.print(systemState.httpError.substring(0, 15));
  } 
  else {
    display.print("Web: Ready");
  }
  
  display.display();
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BLUE_LED_PIN, OUTPUT);  // Initialize blue LED
  
  // Start with blue LED on
  digitalWrite(BLUE_LED_PIN, HIGH);
  
  initDisplay();
  dht.begin();
  
  // Load configuration from flash
  loadConfiguration();
  
  // Initial sensor read
  if (readDHT()) {
    readMQ135();
    determineAirStatus();
    updateDisplay();
  }
  
  // Start WiFi in background
  startWiFiConnection();
  
  Serial.println("System initialized");
  Serial.println("Server URL: " + serverURL);
}

void loop() {
  static unsigned long lastDHTRead = 0;
  static unsigned long lastDataSend = 0;
  static unsigned long lastDisplayUpdate = 0;
  
  // Always read sensors
  if (millis() - lastDHTRead > DHT_READ_INTERVAL) {
    lastDHTRead = millis();
    if (readDHT()) {
      readMQ135();
      determineAirStatus();
    }
  }
  
  // Send data only if WiFi is connected
  if (systemState.wifiStatus == WIFI_CONNECTED && 
      millis() - lastDataSend > DATA_SEND_INTERVAL) {
    lastDataSend = millis();
    sendSensorData();
  }
  
  // Always update display
  if (millis() - lastDisplayUpdate > DISPLAY_UPDATE_INTERVAL) {
    lastDisplayUpdate = millis();
    updateDisplay();
  }
  
  // Handle buzzer
  handleBuzzer();
  
  // Update blue LED indicator
  updateBlueLED();
  
  // Manage WiFi connection
  manageWiFi();
  
  // Process WiFiManager in AP mode
  if (systemState.wifiStatus == WIFI_AP_MODE) {
    wifiManager.process();
  }
  
  // Clear web success message
  if (systemState.displayWebSuccess && 
      millis() - systemState.lastWebStatusTime > WEB_STATUS_DURATION) {
    systemState.displayWebSuccess = false;
  }
  
  // Handle long offline state
  if (systemState.wifiStatus == WIFI_OFFLINE && 
      millis() - systemState.offlineStartTime > OFFLINE_RESTART_THRESHOLD + 30000) {
    ESP.restart();
  }
  
  delay(50);
}
