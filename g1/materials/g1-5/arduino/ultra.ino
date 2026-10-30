/*
  아화중 과학 중1 Ⅴ. 힘의 작용 — 초음파 센서로 거리 재기
  HC-SR04 초음파 센서   VCC -> 5V,  TRIG -> 9,  ECHO -> 10,  GND -> GND
  약 0.05초마다 "시간(ms),거리(cm)" 형식으로 시리얼 출력 (보드레이트 9600)
  ※ 센서 앞 2 cm ~ 2 m 사이의 평평한 면(종이 카드, 상자 옆면 등)을 향하게 한다.
*/
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

float ping() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 25000);   // 약 4 m까지
  if (us == 0) return -1;
  return us * 0.0343 / 2.0;                   // 소리의 속력 343 m/s
}

// 세 번 재서 가운데 값을 쓰면 튀는 값이 줄어든다
float distanceCm() {
  float a = ping(); delay(5);
  float b = ping(); delay(5);
  float c = ping();
  if (a > b) { float t = a; a = b; b = t; }
  if (b > c) { float t = b; b = c; c = t; }
  if (a > b) { float t = a; a = b; b = t; }
  return b;
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  float d = distanceCm();
  if (d > 0) {
    Serial.print(millis());
    Serial.print(",");
    Serial.println(d, 1);
  }
  delay(30);
}
