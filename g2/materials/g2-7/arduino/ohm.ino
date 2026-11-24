// 아화중학교 중2 Ⅶ 아두이노 실험 — 옴의 법칙 측정기
// A0 : 가변 저항 가운데 다리 = 전원 전압(저항 Rx 위쪽)
// A1 : Rx와 기준 저항(1 kΩ) 사이 = 기준 저항에 걸리는 전압
// 회로 : 5V ─ 가변 저항(10 kΩ) ─ GND,  가운데 다리 ─ Rx ─ (A1) ─ 1 kΩ ─ GND
// 출력 : "OHM,A0전압(mV),A1전압(mV)"  (0.2 초마다)
//   Rx에 걸리는 전압 = A0 − A1,  Rx에 흐르는 전류 = A1 ÷ 1 kΩ

void setup() {
  Serial.begin(9600);
}

void loop() {
  long s0 = 0, s1 = 0;
  for (int i = 0; i < 20; i++) {      // 20 번 읽어 평균 → 값이 덜 흔들림
    s0 += analogRead(A0);
    s1 += analogRead(A1);
    delay(2);
  }
  float v0 = s0 / 20.0 * 5000.0 / 1023.0;
  float v1 = s1 / 20.0 * 5000.0 / 1023.0;
  Serial.print("OHM,");
  Serial.print(v0, 0);
  Serial.print(",");
  Serial.println(v1, 0);
  delay(200);
}
