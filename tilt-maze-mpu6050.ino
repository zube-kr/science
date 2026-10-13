/*
  기울기 미로 게임 — MPU-6050(GY-521) 기울기 센서 읽기

  배선 (아두이노 우노 기준):
    GY-521 VCC -> 5V
    GY-521 GND -> GND
    GY-521 SCL -> A5
    GY-521 SDA -> A4
    (AD0 핀은 비워두면 I2C 주소 0x68 사용. AD0을 5V에 연결하면 0x69로 바뀜)

  동작:
    0.02초(50Hz)마다 X축, Y축 기울기 값(중력가속도 단위, 대략 -1.0~1.0)을
    "ax,ay" 형태의 텍스트 한 줄로 시리얼(115200bps)에 출력한다.
    별도 라이브러리 설치 없이 Wire.h만으로 MPU-6050 레지스터를 직접 읽는다.

  업로드 후에는 아두이노 IDE의 시리얼 모니터를 닫아야
  (포트가 하나만 열릴 수 있으므로) 웹페이지에서 연결할 수 있다.
*/

#include <Wire.h>

const int MPU_ADDR = 0x68;   // AD0을 5V에 연결했다면 0x69로 변경

float axFiltered = 0;
float ayFiltered = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();

  // MPU-6050은 전원이 들어오면 절전(sleep) 모드로 시작하므로 깨워줘야 한다.
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 레지스터
  Wire.write(0x00); // sleep 비트 해제
  Wire.endTransmission(true);
}

void loop() {
  // 가속도 레지스터(0x3B~0x40, X/Y/Z 각 2바이트)를 한 번에 읽는다.
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);

  int16_t rawAx = (Wire.read() << 8) | Wire.read();
  int16_t rawAy = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read(); // Z축은 이 게임에서 사용하지 않지만 버퍼는 비워줘야 함

  // 기본 감도(±2g)에서는 16384 LSB = 1g
  float ax = rawAx / 16384.0;
  float ay = rawAy / 16384.0;

  // 간단한 저역통과 필터로 떨림(노이즈)을 줄인다.
  axFiltered = axFiltered * 0.8 + ax * 0.2;
  ayFiltered = ayFiltered * 0.8 + ay * 0.2;

  Serial.print(axFiltered, 3);
  Serial.print(",");
  Serial.println(ayFiltered, 3);

  delay(20); // 약 50Hz
}
