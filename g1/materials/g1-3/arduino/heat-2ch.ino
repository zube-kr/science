/*
  아화중 과학 중1 Ⅲ. 열 — 온도 센서 2개로 동시에 측정하기
  센서 1  LM35 온도 센서        OUT -> A0,  VCC -> 5V,  GND -> GND
  센서 2  써미스터(NTC 10kΩ)    5V -> 10kΩ 저항 -> A1 -> 써미스터 -> GND
          (37종 센서 키트의 '아날로그 온도 센서 모듈(KY-013)'은 S -> A1, 가운데 -> 5V, - -> GND)
  1초마다 "센서1온도,센서2온도" 형식으로 시리얼 출력 (보드레이트 9600)
  ※ 센서를 물에 넣을 때는 랩이나 열수축 튜브로 다리(핀) 부분을 꼭 감싸서 방수한다.
*/
const int LM35_PIN = A0;
const int NTC_PIN  = A1;

// 써미스터를 따뜻하게 했는데 온도가 내려가면 1로 바꾼다(모듈마다 연결 방향이 다름)
#define NTC_REVERSED 0
const float SERIES_R = 10000.0;  // 함께 연결한 저항 10kΩ
const float NTC_R0   = 10000.0;  // 25 ℃에서 써미스터 저항
const float NTC_BETA = 3950.0;   // 써미스터 B 상수

float readLM35() {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(LM35_PIN); delay(2); }
  float voltage = (sum / 10.0) * (5.0 / 1023.0);
  return voltage * 100.0;        // LM35: 10 mV = 1 ℃
}

float readNTC() {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(NTC_PIN); delay(2); }
  float raw = sum / 10.0;
  if (raw < 1 || raw > 1022) return -99;
#if NTC_REVERSED
  float r = SERIES_R * (1023.0 / raw - 1.0);
#else
  float r = SERIES_R * raw / (1023.0 - raw);
#endif
  float invT = 1.0 / 298.15 + log(r / NTC_R0) / NTC_BETA;  // B 상수 식
  return 1.0 / invT - 273.15;
}

void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.print(readLM35(), 1);
  Serial.print(",");
  Serial.println(readNTC(), 1);
  delay(1000);
}
