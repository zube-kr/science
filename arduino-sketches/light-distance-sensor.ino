/*
  별의 밝기가 다른 까닭은 - 거리에 따른 빛의 밝기 측정 스케치
  ------------------------------------------------------------
  CDS 조도센서(부품): 5V - CDS - A0 - 10kΩ 저항 - GND
    (조도센서 모듈이면  S -> A0,  가운데(+) -> 5V,  - -> GND)
  (선택) HC-SR04 초음파센서: VCC -> 5V, GND -> GND, TRIG -> 9, ECHO -> 10
    → 손전등(휴대 전화)까지의 거리를 자동으로 잴 때만 연결합니다.

  0.2초마다 "센서값,거리" 형식으로 시리얼 출력 (보드레이트 9600)
    센서값: 0~1023 (부품 회로에서는 밝을수록 커짐)
    거리  : cm, 초음파센서가 없거나 잴 수 없으면 -1
*/
const int LIGHT_PIN = A0;
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

// 잡음을 줄이려고 10번 읽어 평균을 낸다
int readLight() {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(LIGHT_PIN);
    delay(2);
  }
  return sum / 10;
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 25000);
  if (duration == 0) return -1;
  return duration * 0.0343 / 2.0;
}

void loop() {
  int light = readLight();
  float d = readDistanceCm();
  Serial.print(light);
  Serial.print(",");
  Serial.println(d, 1);
  delay(200);
}
