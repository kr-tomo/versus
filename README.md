# VERSUS

중세 무사 대전 격투 웹 앱(PWA). 기획은 `../proposal/`, 구현 계획은 `../docs/plan.md`, 승인된 컨셉 아트는 `../concept/index.html`에 있습니다.

## 실행

이 `src/` 폴더가 앱 루트입니다. 빌드 없이 정적 파일로 동작합니다. 서비스 워커와 ES 모듈 때문에 HTTP로 서빙해야 합니다.

```sh
cd src
npm run serve        # http://localhost:8080
npm test             # 순수 로직 테스트 (node --test)
npm run build:sprites  # tools/art 리그로 themes/classic 스프라이트 재생성
```

## 조작

| 행동 | 터치 | 키보드 P1 / P2 | 게임패드 |
|---|---|---|---|
| 이동 | ◀ ▶ | A D / ← → | 방향키·왼쪽 스틱 |
| 점프 | 점프 | W / ↑ | 위 |
| 2층에서 내려가기 | – | S / ↓ | 아래 |
| 공격 | 공격 | F / K | A |
| 방어(누르고 있기) | 방어 | G / L | B |
| 일시정지 | 타이머 탭 | – | Start |

게임패드는 연결된 순서대로 P1, P2에 배정되고, 배정된 플레이어의 터치 버튼은 흐리게 비활성화됩니다.

## 테마 추가

`themes/<id>/theme.json`에 무기 슬롯(sword, spear, axe, dagger, fist)별 캐릭터 스프라이트 시트와 프레임 아틀라스, 맵(lava, jungle, seoul, tundra)별 레이어 이미지를 정의합니다. 구조는 `themes/classic/theme.json`과 같고, 이미지는 SVG와 PNG 모두 쓸 수 있습니다. 게임 수치와 맵 변수는 `js/config.js`에 있습니다.
