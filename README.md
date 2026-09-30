# 🌐 지도로 보는 세계 현황 · Daily Global Briefing

실시간 세계 지도 위에 23개국 글로벌 핵심 뉴스 및 심층 분석을 시각화하여 제공하는 인터랙티브 웹 대시보드입니다.

## 🚀 주요 기능
- **인터랙티브 밀러 투영 세계 지도**: 23개국 주요 핫이슈 위치 및 맞춤형 지시선(Leader Line), 말풍선 핀포인트 표시.
- **3단 테마 시스템**: 
  - 🛰️ **위성사진**: NASA 실사 위성 텍스처 매핑 풀스크린 뷰
  - ☀️ **화이트 테마**: 모던하고 산뜻한 라이트 모드
  - 🌙 **다크 테마**: 심야 및 프로페셔널 다크 인디고 모드
- **100% 뷰포트 반응형 레이아웃**: 상하/좌우 여백 없이 카드 경계선까지 꽉 찬 뷰 제공.
- **3시간 주기 자동 갱신 (GitHub Actions)**:
  - 3시간마다 GitHub 클라우드가 무료로 연합뉴스 및 구글 뉴스 RSS 피드를 수집하여 최신 속보를 동기화하고 웹사이트를 자동 재배포합니다.
  - 브라우저를 켜둔 상태에서도 3시간 경과 시 최신 뉴스로 자동 리프레시됩니다.

## 🛠️ 수동 실행 및 빌드 방법
```bash
# 1. 최신 뉴스 수집 및 데이터셋 갱신
node update_news.js

# 2. 웹사이트 빌드 (index.html 생성)
node build_map.js
```

## ⚙️ 배포 설정 (GitHub Pages)
1. GitHub 저장소의 **Settings** -> **Pages** 이동
2. **Build and deployment** > **Source**: `Deploy from a branch` 선택
3. **Branch**: `main` / `/(root)` 선택 후 **Save**
4. 저장소 **Settings** -> **Actions** -> **General** -> **Workflow permissions**에서 `Read and write permissions` 활성화
