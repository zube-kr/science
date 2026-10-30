/*
  아화중 과학 중1 Ⅵ. 기체의 성질 — 온도에 따른 주사기 속 공기의 부피 (온도 센서 + 초음파 센서)
  LM35 온도 센서        VCC(왼쪽 다리) -> 5V,  OUT(가운데) -> A0,  GND(오른쪽) -> GND
  HC-SR04 초음파 센서   VCC -> 5V,  TRIG -> 9,  ECHO -> 10,  GND -> GND
  약 0.5초마다 "시간(ms),온도(℃),거리(cm)" 형식으로 시리얼 출력 (보드레이트 9600)
  ※ 초음파 센서는 주사기 피스톤 위에 붙인 종이 카드를 위에서 내려다보게 한다.
*/
const int TEMP_PIN = A0;
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

float ping() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 25000);
  if (us == 0) return -1;
  return us * 0.0343 / 2.0;
}

// 다섯 번 재서 가운데 값을 쓴다
float distanceCm() {
  float v[5];
  for (int i = 0; i < 5; i++) { v[i] = ping(); delay(8); }
  for (int i = 0; i < 4; i++)
    for (int j = i + 1; j < 5; j++)
      if (v[j] < v[i]) { float t = v[i]; v[i] = v[j]; v[j] = t; }
  return v[2];
}

// LM35는 1 ℃마다 10 mV — 20번 평균
float temperatureC() {
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(TEMP_PIN); delay(2); }
  return (sum / 20.0) * 5.0 / 1023.0 * 100.0;
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  float t = temperatureC();
  float d = distanceCm();
  Serial.print(millis());
  Serial.print(",");
  Serial.print(t, 1);
  Serial.print(",");
  Serial.println(d, 2);
  delay(400);
}
