/*
  아화중 과학 중1 Ⅶ. 태양계 — 빛 센서(CDS)로 밝기 재기
  CDS(조도 센서)  한쪽 다리 -> 5V,  다른 쪽 다리 -> A0
  10 kΩ 저항      A0 -> GND   (밝을수록 A0 값이 커진다)
  ※ 빛 센서 모듈(S, +, -)을 쓰면 S -> A0, + -> 5V, - -> GND (모듈에 따라 어두울수록 커질 수 있음)
  약 0.05초마다 "시간(ms),밝기(0~1023)" 형식으로 시리얼 출력 (보드레이트 9600)
*/
const int LIGHT_PIN = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  long sum = 0;
  for (int i = 0; i < 8; i++) { sum += analogRead(LIGHT_PIN); delay(2); }
  Serial.print(millis());
  Serial.print(",");
  Serial.println(sum / 8);
  delay(30);
}
