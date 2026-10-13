/*
  샤를의 법칙 실험 - 온도 & 거리(기체 부피 비례값) 측정 스케치
  아화중학교 과학수업 · 1학년 6단원(기체의 성질)

  이 스케치를 아두이노 우노에 업로드한 뒤, charles-law-arduino.html 페이지에서
  "아두이노 연결하기" 버튼으로 USB 시리얼에 연결하면 실시간으로 값을 받아옵니다.

  [회로 연결]
    LM35 온도센서     OUT -> A0,  VCC -> 5V,  GND -> GND
    HC-SR04 초음파센서 TRIG -> 9,  ECHO -> 10, VCC -> 5V,  GND -> GND

  [동작]
    0.5초마다 "온도,거리" 형식의 한 줄을 시리얼로 출력합니다. (보드레이트 9600)
    예) 23.40,12.85

  ※ 서미스터를 대신 쓰고 싶다면 readTemperature() 함수만 전압분배 회로에 맞는
     공식으로 바꿔주면 됩니다. (저항 10kΩ과 직렬 연결, 베타값 계산식 필요)
*/

const int TEMP_PIN = A0;
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

float readTemperature() {
  int raw = analogRead(TEMP_PIN);
  float voltage = raw * (5.0 / 1023.0);
  float tempC = voltage * 100.0; // LM35: 10mV = 1도
  return tempC;
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
  float t = readTemperature();
  float d = readDistanceCm();

  Serial.print(t, 2);
  Serial.print(",");
  Serial.println(d, 2);

  delay(500);
}
