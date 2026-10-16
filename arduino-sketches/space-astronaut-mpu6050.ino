/*
  3D 우주 유영 게임 — MPU-6050(GY-521) 가속도 + 자이로 센서 읽기
  아화중학교 과학수업

  배선 (아두이노 우노 기준, 기울기 미로·비행기 슈팅 게임과 같음):
    GY-521 VCC -> 5V
    GY-521 GND -> GND
    GY-521 SCL -> A5
    GY-521 SDA -> A4
    (AD0 핀은 비워두면 I2C 주소 0x68 사용. AD0을 5V에 연결하면 0x69로 바뀜)

  동작:
    0.02초(50Hz)마다 아래 4개 값을 "ax,ay,az,gz" 형태의 한 줄로
    시리얼(115200bps)에 출력한다.
      ax : X축 기울기(중력가속도 단위, 약 -1.0~1.0)  → 우주인 좌우 이동
      ay : Y축 기울기(중력가속도 단위, 약 -1.0~1.0)  → 우주인 위아래 이동
      az : Z축 가속도(평평하게 두면 약 1.0)            → 화면에 표시(참고용)
      gz : Z축 회전 속도(°/s, 보드를 수평으로 비틀 때) → 회전 대시
    별도 라이브러리 설치 없이 Wire.h만으로 MPU-6050 레지스터를 직접 읽는다.
    앞의 두 값(ax, ay)은 기울기 미로·비행기 슈팅 게임과 같은 방식이다.

  업로드 후에는 아두이노 IDE의 시리얼 모니터를 닫아야
  (포트가 하나만 열릴 수 있으므로) 웹페이지에서 연결할 수 있다.
*/

#include <Wire.h>

const int MPU_ADDR = 0x68;   // AD0을 5V에 연결했다면 0x69로 변경

float axFiltered = 0;
float ayFiltered = 0;
float azFiltered = 1;
float gzFiltered = 0;
float gzOffset = 0;          // 자이로 영점(가만히 있을 때의 값)

void readRaw(int16_t &ax, int16_t &ay, int16_t &az, int16_t &gz) {
  // 0x3B부터 14바이트: 가속도 X/Y/Z, 온도, 자이로 X/Y/Z (각 2바이트)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 14, true);

  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read();             // 온도(사용 안 함)
  Wire.read(); Wire.read();             // 자이로 X(사용 안 함)
  Wire.read(); Wire.read();             // 자이로 Y(사용 안 함)
  gz = (Wire.read() << 8) | Wire.read();
}

void setup() {
  Serial.begin(115200);
  Wire.begin();

  // MPU-6050은 전원이 들어오면 절전(sleep) 모드로 시작하므로 깨워줘야 한다.
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 레지스터
  Wire.write(0x00); // sleep 비트 해제
  Wire.endTransmission(true);
  delay(100);

  // 자이로 영점 맞추기: 시작할 때 보드를 가만히 두면 평균값을 구해 뺀다.
  long sum = 0;
  for (int i = 0; i < 100; i++) {
    int16_t ax, ay, az, gz;
    readRaw(ax, ay, az, gz);
    sum += gz;
    delay(5);
  }
  gzOffset = sum / 100.0;
}

void loop() {
  int16_t rawAx, rawAy, rawAz, rawGz;
  readRaw(rawAx, rawAy, rawAz, rawGz);

  // 기본 감도: 가속도 ±2g → 16384 LSB = 1g, 자이로 ±250°/s → 131 LSB = 1°/s
  float ax = rawAx / 16384.0;
  float ay = rawAy / 16384.0;
  float az = rawAz / 16384.0;
  float gz = (rawGz - gzOffset) / 131.0;

  // 간단한 저역통과 필터로 떨림(노이즈)을 줄인다.
  axFiltered = axFiltered * 0.8 + ax * 0.2;
  ayFiltered = ayFiltered * 0.8 + ay * 0.2;
  azFiltered = azFiltered * 0.8 + az * 0.2;
  gzFiltered = gzFiltered * 0.5 + gz * 0.5;   // 회전은 빠르게 반응하도록 약하게만 거른다

  Serial.print(axFiltered, 3);
  Serial.print(",");
  Serial.print(ayFiltered, 3);
  Serial.print(",");
  Serial.print(azFiltered, 3);
  Serial.print(",");
  Serial.println(gzFiltered, 1);

  delay(20); // 약 50Hz
}
