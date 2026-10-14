/*
  초음파 드론 동굴 비행 게임 - 거리 측정 스케치
  아화중학교 과학교실

  [회로 연결]
    HC-SR04 초음파센서  TRIG -> 9,  ECHO -> 10, VCC -> 5V,  GND -> GND

  [동작]
    약 50ms마다 거리(cm) 값 한 줄을 시리얼로 출력합니다. (보드레이트 9600)
    예) 18.42

  손을 센서에 가까이/멀리 움직이면 그 거리에 따라 게임 속 드론이
  위아래로 움직입니다.
*/

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 최대 30ms 대기
  if (duration == 0) return -1; // 측정 실패
  return duration * 0.0343 / 2.0;
}

void loop() {
  float d = readDistanceCm();
  Serial.println(d, 2);
  delay(50);
}
