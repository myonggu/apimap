# 길이음

실제 장소를 검색해 자동차 이동 거리와 예상 이동 시간을 확인하는 정적 웹앱입니다.

## 실행

`index.html`을 브라우저에서 열거나, 프로젝트 폴더를 Vercel에 가져오면 바로 배포할 수 있습니다. 빌드 단계, 서버, Redis, API 키 또는 환경변수는 필요하지 않습니다.

## 사용 API

- 장소 검색: [Nominatim](https://nominatim.org/)
- 자동차 경로 및 거리·시간 계산: [OSRM 공개 데모 서버](https://project-osrm.org/)
- 지도 링크: [OpenStreetMap](https://www.openstreetmap.org/)

장소 검색은 사용자가 검색 버튼을 눌렀을 때만 실행되며, 연속 검색은 Nominatim 사용 정책에 맞춰 초당 한 번 이하로 제한합니다. 공개 데모 서비스의 가용성 및 사용 정책에 따라 검색이나 경로 조회가 일시적으로 제한될 수 있습니다.
