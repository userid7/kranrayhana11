#include <ESP8266WiFi.h>
#include <FirebaseArduino.h>
#include <Ticker.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// Set these to run example.
#define FIREBASE_HOST "pdam-c60b7.firebaseio.com"
#define FIREBASE_AUTH "dvuGeRriRmP6VbHgUboYH6qQCqUARwBqb5dhKa0Y"
#define WIFI_SSID "InnaTech 11"
#define WIFI_PASSWORD "BR1J1NO10A"

#define relay 0

Ticker ticking;

FirebaseArduino FirebaseStream;
//Ticker espwdt;

int cd, cdwdt;
bool trig, flag, flag2;

bool maintenance = 0;

void counting() {
  cd = cd - 1;
  flag = 1;
}

void setup() {
  Serial.begin(9600);
  Serial.print(".");
  delay(300);
  Serial.print(".");
  delay(400);
  Serial.print(".");
  delay(400);
  Serial.print(".");

  delay(500);
  pinMode(relay, OUTPUT);
  digitalWrite(relay, LOW);
  delay(300);


  connecting();

  cekwaktu();
  int rescount = FirebaseStream.getInt("rescount");
  FirebaseStream.setInt("rescount", rescount + 1);

  
  //  Firebase.begin("publicdata-cryptocurrency.firebaseio.com");
  //  Firebase.stream("/bitcoin/last");
}


void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (FirebaseStream.failed()) {
      Serial.println("streaming error");
      Serial.println(FirebaseStream.error());
    }

    if (FirebaseStream.available()) {
      FirebaseObject event = FirebaseStream.readEvent();
      String eventType = event.getString("type");
      eventType.toLowerCase();

      Serial.print("event: ");
      Serial.println(eventType);
      if (eventType == "put") {
        Serial.print("data: ");
        Serial.println(event.getBool("data"));
        trig = event.getBool("data");
        doing();
      }
    }

    if (flag == 1) {
      Serial.print("keran on ");
      Serial.print(cd);
      Serial.println(" menit lagi");
      FirebaseStream.setInt("rumah/countdown", cd);
      if (cd == 0) {
        ticking.detach();
        trig = false;
        FirebaseStream.setBool("rumah/trigger", false);
      }
      flag = 0;
    }
  }
  else {
    connecting();
  }
}

void cekwaktu() {
  HTTPClient http; //Object of class HTTPClient
  http.begin("http://worldtimeapi.org/api/ip");
  int httpCode = http.GET();

  if (httpCode > 0)
  {
    const size_t bufferSize = JSON_OBJECT_SIZE(15) + 260;
    DynamicJsonBuffer jsonBuffer(bufferSize);
    JsonObject& root = jsonBuffer.parseObject(http.getString());

    const char* datetime = root["datetime"];

    Serial.print("date_time : ");
    Serial.println(datetime);

    String datetime2 = "";

    for (int i = 0; i < 19; i++) {
      datetime2 += datetime[i];
    }
    FirebaseStream.pushString("reslogs", datetime2);
  }
  http.end(); //Close connection
}

void connecting() {
  WiFiManager wifiManager;
  wifiManager.setAPStaticIPConfig(IPAddress(10, 0, 1, 1), IPAddress(10, 0, 1, 1), IPAddress(255, 255, 255, 0));

  wifiManager.autoConnect("AutoConnectAP_kran");

  Serial.print("connected: ");
  Serial.println(WiFi.localIP());

  FirebaseStream.begin(FIREBASE_HOST, FIREBASE_AUTH);
  FirebaseStream.stream("/rumah/trigger");
}

void doing() {
  if (trig == true) {
    cd = FirebaseStream.getInt("rumah/countdown");
    if (cd == 0) {
      delay(200);
      cd = FirebaseStream.getInt("rumah/countdown");
    }
    digitalWrite(relay, HIGH);
    delay(100);
    Serial.print("keran on ");
    //    Serial.print(cd);
    Serial.print(cd);
    Serial.print(" menit lagi");
    /////jalan keran
    if (cd > 0) {

      ticking.attach(60, counting);
    }
    Serial.println();
  }

  if (trig == false) {
    //    Serial.write(closestr, sizeof(closestr));
    flag = false;
    ticking.detach();
    FirebaseStream.setInt("rumah/countdown", 0);
    digitalWrite(relay, LOW);
    delay(100);
    Serial.println("keran off");
  }
}
