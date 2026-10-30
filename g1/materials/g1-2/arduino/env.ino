/*
  아화중 과학 중1 Ⅱ. 생물의 구성과 다양성 — 서식 환경 측정기 (온습도 센서 + 빛 센서)
  DHT11 온습도 센서   VCC(+) -> 5V,  DATA(S) -> 2,  GND(-) -> GND
  CDS(조도 센서)      한쪽 다리 -> 5V, 다른 쪽 다리 -> A0,  10 kΩ 저항: A0 <-> GND
  필요한 라이브러리: 아두이노 IDE [라이브러리 관리]에서 "DHT sensor library"(Adafruit) 설치
  약 1초마다 "시간(ms),온도(℃),습도(%),밝기(0~1023)" 형식으로 시리얼 출력 (보드레이트 9600)
*/
#include <DHT.h>
#define DHTPIN 2
#define DHTTYPE DHT11
const int LIGHT_PIN = A0;
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(LIGHT_PIN); delay(5); }
  if (!isnan(h) && !isnan(t)) {
    Serial.print(millis()); Serial.print(",");
    Serial.print(t, 1);     Serial.print(",");
    Serial.print(h, 0);     Serial.print(",");
    Serial.println(sum / 10);
  }
  delay(1000);
}
