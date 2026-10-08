// update_news.js
// 실시간 글로벌 뉴스 대량 수집 & 전 세계 50+ 다국가 동적 지도 브리핑 자동 갱신 파이프라인

const fs = require('fs');
const path = require('path');

// 1. 대용량 실시간 RSS 피드 소스
const RSS_FEEDS = [
  { name: '연합뉴스 국제', url: 'https://www.yna.co.kr/rss/international.xml', category: '국제' },
  { name: '연합뉴스 경제', url: 'https://www.yna.co.kr/rss/economy.xml', category: '경제' },
  { name: '구글 뉴스 세계', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko', category: '세계' },
  { name: '구글 뉴스 비즈니스', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko', category: '경제' },
  { name: '구글 뉴스 테크', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko', category: '테크' }
];

// 2. 글로벌 55개국 정밀 지리 및 키워드 데이터베이스
const GLOBAL_COUNTRY_DB = {
  // === 동아시아 & 오세아니아 ===
  'kr': {
    country: '대한민국 (서울)', flag: '🇰🇷', lat: 37.5, lng: 127.0, dx: 45, dy: -25,
    countryAliases: ['South Korea', 'Korea', 'KR'],
    titleKws: ['한국', '서울', '한은', '윤석열', '국회', '대통령실', '코스피', '원달러', '이창용', '한국은행', '금통위'],
    bodyKws: ['한국', '서울', '한은', '코스피'],
    defTitle: '한국은행 기준금리 및 거시경제 통화정책 동향', defShort: '한은 기준금리 정책', defCat: 'economy'
  },
  'kp': {
    country: '북한 (평양)', flag: '🇰🇵', lat: 39.0, lng: 125.7, dx: -55, dy: -40,
    countryAliases: ['North Korea', 'Dem. Rep. Korea', 'KP'],
    titleKws: ['북한', '평양', '김정은', '오물풍선', '조선중앙통신', '북한군', '대남', '北'],
    bodyKws: ['북한', '김정은', '평양'],
    defTitle: '북한 비무장지대 군사 동향 및 대남 군사 긴장', defShort: '북한 DMZ 군사동향', defCat: 'politics'
  },
  'cn': {
    country: '중국 (베이징)', flag: '🇨🇳', lat: 39.9, lng: 116.4, dx: -35, dy: -45,
    countryAliases: ['China', 'CN'],
    titleKws: ['중국', '베이징', '시진핑', '상하이', '위안화', '중화', '中', '중국군'],
    bodyKws: ['중국', '베이징', '시진핑', '상하이'],
    defTitle: '중국 대규모 경기부양책 및 기술 자립 공급망 전략', defShort: '중국 경기부양 전략', defCat: 'economy'
  },
  'jp': {
    country: '일본 (도쿄)', flag: '🇯🇵', lat: 35.7, lng: 139.7, dx: 55, dy: 35,
    countryAliases: ['Japan', 'JP'],
    titleKws: ['일본', '도쿄', '이시바', '자민당', '기시다', '엔화', '닛케이', '일본은행', 'boj', '日'],
    bodyKws: ['일본', '도쿄', '엔화', '닛케이'],
    defTitle: '일본 정국 재편과 엔화·닛케이 증시 변동성', defShort: '일본 엔화·정국 재편', defCat: 'economy'
  },
  'tw': {
    country: '대만 (타이베이)', flag: '🇹🇼', lat: 25.0, lng: 121.5, dx: 45, dy: 20,
    countryAliases: ['Taiwan', 'TW'],
    titleKws: ['대만', '타이베이', '라이칭더', 'tsmc', '차이잉원', '양안'],
    bodyKws: ['대만', '타이베이', 'tsmc'],
    defTitle: '대만 해협 안보 긴장 및 글로벌 파운드리 반도체 공급망', defShort: '대만 TSMC·해협 안보', defCat: 'economy'
  },
  'in': {
    country: '인도 (뉴델리)', flag: '🇮🇳', lat: 28.6, lng: 77.2, dx: 35, dy: 45,
    countryAliases: ['India', 'IN'],
    titleKws: ['인도', '뉴델리', '모디', '뭄바이', '힌두'],
    bodyKws: ['인도', '뉴델리', '모디'],
    defTitle: '인도 글로벌 제조업 허브 도약과 식량 인플레이션 관리', defShort: '인도 경제성장·물가', defCat: 'economy'
  },
  'th': {
    country: '태국 (방콕)', flag: '🇹🇭', lat: 13.7, lng: 100.5, dx: -50, dy: 30,
    countryAliases: ['Thailand', 'TH'],
    titleKws: ['태국', '방콕', '패통탄', '치앙마이', '몬순', '태국 홍수'],
    bodyKws: ['태국', '방콕'],
    defTitle: '태국 몬순 폭우 침수 피해 및 신임 내각 경기 대응', defShort: '태국 폭우 침수 대응', defCat: 'environment'
  },
  'vn': {
    country: '베트남 (하노이)', flag: '🇻🇳', lat: 21.0, lng: 105.8, dx: -50, dy: 5,
    countryAliases: ['Vietnam', 'Viet Nam', 'VN'],
    titleKws: ['베트남', '하노이', '호찌민', '또럼'],
    bodyKws: ['베트남', '하노이'],
    defTitle: '베트남 글로벌 IT 생산기지 유치 및 에너지 인프라 확충', defShort: '베트남 IT제조 허브', defCat: 'economy'
  },
  'id': {
    country: '인도네시아 (자카르타)', flag: '🇮🇩', lat: -6.2, lng: 106.8, dx: 45, dy: 35,
    countryAliases: ['Indonesia', 'ID'],
    titleKws: ['인도네시아', '자카르타', '프라보워', '조코위', '발리', '누산타라'],
    bodyKws: ['인도네시아', '자카르타'],
    defTitle: '인도네시아 신수도 이전 및 니켈 등 배터리 광물 동맹', defShort: '인니 신수도·광물전략', defCat: 'economy'
  },
  'ph': {
    country: '필리핀 (마닐라)', flag: '🇵🇭', lat: 14.6, lng: 121.0, dx: 50, dy: -10,
    countryAliases: ['Philippines', 'PH'],
    titleKws: ['필리핀', '마닐라', '마르코스'],
    bodyKws: ['필리핀', '마닐라'],
    defTitle: '필리핀 남중국해 영유권 갈등과 미국과의 방위 협력 강화', defShort: '필리핀 남중국해 안보', defCat: 'politics'
  },
  'my': {
    country: '말레이시아 (쿠알라룸푸르)', flag: '🇲🇾', lat: 3.1, lng: 101.7, dx: -50, dy: -25,
    countryAliases: ['Malaysia', 'MY'],
    titleKws: ['말레이시아', '안와르', '쿠알라룸푸르'],
    bodyKws: ['말레이시아'],
    defTitle: '말레이시아 동남아 AI 데이터센터 허브 급부상', defShort: '말레이시아 AI센터허브', defCat: 'economy'
  },
  'sg': {
    country: '싱가포르', flag: '🇸🇬', lat: 1.3, lng: 103.8, dx: 45, dy: 20,
    countryAliases: ['Singapore', 'SG'],
    titleKws: ['싱가포르', '로런스 웡'],
    bodyKws: ['싱가포르'],
    defTitle: '싱가포르 아시아 금융 허브 경쟁력 및 디지털 자산 규제', defShort: '싱가포르 금융허브', defCat: 'economy'
  },
  'pk': {
    country: '파키스탄 (이슬라마바드)', flag: '🇵🇰', lat: 33.7, lng: 73.0, dx: -55, dy: -35,
    countryAliases: ['Pakistan', 'PK'],
    titleKws: ['파키스탄', '이슬라마바드', '샤리프'],
    bodyKws: ['파키스탄'],
    defTitle: '파키스탄 IMF 구제금융 이행과 경제 재건 과제', defShort: '파키스탄 경제안정화', defCat: 'economy'
  },
  'au': {
    country: '호주 (시드니)', flag: '🇦🇺', lat: -33.9, lng: 151.2, dx: 45, dy: 25,
    countryAliases: ['Australia', 'AU'],
    titleKws: ['호주', '시드니', '캔버라', '오스트레일리아', '앨버니지', '멜버른'],
    bodyKws: ['호주', '시드니', '캔버라'],
    defTitle: '호주 글로벌 AI 데이터센터 전력망 확충과 핵심광물 패권', defShort: '호주 전력망·핵심광물', defCat: 'economy'
  },
  'nz': {
    country: '뉴질랜드 (웰링턴)', flag: '🇳🇿', lat: -41.3, lng: 174.8, dx: 40, dy: 20,
    countryAliases: ['New Zealand', 'NZ'],
    titleKws: ['뉴질랜드', '웰링턴', '오클랜드', '럭슨'],
    bodyKws: ['뉴질랜드'],
    defTitle: '뉴질랜드 기준금리 인하와 농축산업 수출 회복세', defShort: '뉴질랜드 통화정책', defCat: 'economy'
  },
  'kz': {
    country: '카자흐스탄 (아스타나)', flag: '🇰🇿', lat: 51.2, lng: 71.4, dx: 45, dy: -35,
    countryAliases: ['Kazakhstan', 'KZ'],
    titleKws: ['카자흐스탄', '토카예프', '아스타나'],
    bodyKws: ['카자흐스탄'],
    defTitle: '카자흐스탄 원전 건설 추진과 중앙아시아 물류 회랑', defShort: '카자흐 원전·물류회랑', defCat: 'economy'
  },
  'mn': {
    country: '몽골 (울란바토르)', flag: '🇲🇳', lat: 47.9, lng: 106.9, dx: 45, dy: -25,
    countryAliases: ['Mongolia', 'MN'],
    titleKws: ['몽골', '울란바토르'],
    bodyKws: ['몽골'],
    defTitle: '몽골 희토류 등 광물자원 개발과 제3의 이웃 외교', defShort: '몽골 희토류 외교', defCat: 'economy'
  },

  // === 북미 & 중남미 ===
  'us': {
    country: '미국 (워싱턴/뉴욕)', flag: '🇺🇸', lat: 38.9, lng: -77.0, dx: 50, dy: -30,
    countryAliases: ['United States of America', 'United States', 'USA', 'US'],
    titleKws: ['미국', '바이든', '트럼프', '워싱턴', '백악관', '뉴욕', '연준', '파월', '나스닥', '다우', 's&p', '미 국채', '美', '미군'],
    bodyKws: ['미국', '워싱턴', '백악관', '뉴욕', '연준', '트럼프'],
    defTitle: '미국 연준 통화정책 향방과 월가 증시 대변동', defShort: '미국 연준 금리·증시', defCat: 'economy'
  },
  'us-tech': {
    country: '미국 (실리콘밸리)', flag: '🤖', lat: 37.4, lng: -122.1, dx: -70, dy: 20,
    countryAliases: ['United States of America', 'United States', 'USA', 'US'],
    titleKws: ['오픈ai', '실리콘밸리', '챗gpt', '엔비디아', '구글', '애플', '마이크로소프트', '메타', '테슬라', '빅테크', '생성형 ai'],
    bodyKws: ['오픈ai', '엔비디아', '실리콘밸리', '빅테크', '챗gpt'],
    defTitle: '실리콘밸리 차세대 AI 모델 경쟁 및 빅테크 인프라 투자', defShort: '오픈AI·빅테크 혁신', defCat: 'economy'
  },
  'ca': {
    country: '캐나다 (오타와)', flag: '🇨🇦', lat: 45.4, lng: -75.7, dx: 15, dy: -55,
    countryAliases: ['Canada', 'CA'],
    titleKws: ['캐나다', '오타와', '트뤼도', '토론토', '밴쿠버'],
    bodyKws: ['캐나다', '오타와', '트뤼도'],
    defTitle: '캐나다 주택시장 규제 완화와 북미 광물 공급망 협력', defShort: '캐나다 핵심공급망', defCat: 'economy'
  },
  'mx': {
    country: '멕시코 (멕시코시티)', flag: '🇲🇽', lat: 19.4, lng: -99.1, dx: -60, dy: 30,
    countryAliases: ['Mexico', 'MX'],
    titleKws: ['멕시코', '셰인바움', '멕시코시티', '카르텔', '페소화'],
    bodyKws: ['멕시코', '멕시코시티'],
    defTitle: '멕시코 셰인바움 신임 대통령 국정 기조와 니어쇼어링', defShort: '멕시코 신정부 국정', defCat: 'economy'
  },
  'br': {
    country: '브라질 (브라질리아)', flag: '🇧🇷', lat: -15.8, lng: -47.9, dx: 50, dy: 25,
    countryAliases: ['Brazil', 'BR'],
    titleKws: ['브라질', '룰라', '브라질리아', '상파울루', '아마존'],
    bodyKws: ['브라질', '룰라', '상파울루'],
    defTitle: '브라질 아마존 보호 기후 정책과 남미 경제 블록 주도', defShort: '브라질 아마존·경제', defCat: 'environment'
  },
  'ar': {
    country: '아르헨티나 (부에노스아이레스)', flag: '🇦🇷', lat: -34.6, lng: -58.4, dx: 45, dy: 35,
    countryAliases: ['Argentina', 'AR'],
    titleKws: ['아르헨티나', '밀레이', '부에노스아이레스'],
    bodyKws: ['아르헨티나', '밀레이'],
    defTitle: '아르헨티나 밀레이 정부의 급진적 재정 개혁과 인플레 안정화', defShort: '아르헨티나 재정개혁', defCat: 'economy'
  },
  'cl': {
    country: '칠레 (산티아고)', flag: '🇨🇱', lat: -33.4, lng: -70.6, dx: -55, dy: 30,
    countryAliases: ['Chile', 'CL'],
    titleKws: ['칠레', '산티아고', '보리치'],
    bodyKws: ['칠레'],
    defTitle: '칠레 리튬 국유화 전략과 글로벌 친환경 광물 협력', defShort: '칠레 리튬 국유화', defCat: 'economy'
  },
  'co': {
    country: '콜롬비아 (보고타)', flag: '🇨🇴', lat: 4.7, lng: -74.1, dx: -55, dy: -25,
    countryAliases: ['Colombia', 'CO'],
    titleKws: ['콜롬비아', '보고타', '페트로'],
    bodyKws: ['콜롬비아'],
    defTitle: '콜롬비아 친환경 에너지 전환 정책 및 남미 평화 구축', defShort: '콜롬비아 친환경전환', defCat: 'politics'
  },
  'pe': {
    country: '페루 (리마)', flag: '🇵🇪', lat: -12.0, lng: -77.0, dx: -55, dy: 15,
    countryAliases: ['Peru', 'PE'],
    titleKws: ['페루', '리마', '볼루아르테'],
    bodyKws: ['페루'],
    defTitle: '페루 메가 항만 창카이항 개장과 태평양 무역 회랑', defShort: '페루 메가항만 무역', defCat: 'economy'
  },

  // === 유럽 대륙 ===
  'ru': {
    country: '러시아 (모스크바)', flag: '🇷🇺', lat: 55.7, lng: 37.6, dx: 70, dy: -45,
    countryAliases: ['Russia', 'Russian Federation', 'RU'],
    titleKws: ['러시아', '모스크바', '푸틴', '크렘린', '러군', '러시아군', '러'],
    bodyKws: ['러시아', '모스크바', '푸틴'],
    defTitle: '러시아 군사 작전 지속과 서방 대러 제재 대응 전략', defShort: '러시아 군사·제재대응', defCat: 'politics'
  },
  'ua': {
    country: '우크라이나 (키이우)', flag: '🇺🇦', lat: 50.4, lng: 30.5, dx: 55, dy: -20,
    countryAliases: ['Ukraine', 'UA'],
    titleKws: ['우크라이나', '키이우', '젤렌스키', '우크라', '돈바스'],
    bodyKws: ['우크라이나', '키이우', '젤렌스키'],
    defTitle: '우크라이나 방공망 확충과 전후 재건 국제 공조', defShort: '우크라이나 방공·재건', defCat: 'politics'
  },
  'gb': {
    country: '영국 (런던)', flag: '🇬🇧', lat: 51.5, lng: -0.1, dx: -70, dy: -35,
    countryAliases: ['United Kingdom', 'Britain', 'GB'],
    titleKws: ['영국', '런던', '스타머', '영란은행', '수낵', '영 왕실', '브렉시트', '英'],
    bodyKws: ['영국', '런던', '스타머'],
    defTitle: '영국 스타머 노동당 내각의 재정 준칙과 경제 회복 플랜', defShort: '영국 노동당 경제플랜', defCat: 'politics'
  },
  'de': {
    country: '독일 (베를린)', flag: '🇩🇪', lat: 52.5, lng: 13.4, dx: -5, dy: -65,
    countryAliases: ['Germany', 'DE'],
    titleKws: ['독일', '베를린', '숄츠', '폭스바겐', '프랑크푸르트', 'ecb', '獨'],
    bodyKws: ['독일', '베를린', '숄츠'],
    defTitle: '독일 제조업 침체 우려와 에너지 전환 산업 재편', defShort: '독일 제조업 경기대응', defCat: 'economy'
  },
  'fr': {
    country: '프랑스 (파리)', flag: '🇫🇷', lat: 48.8, lng: 2.3, dx: -75, dy: 5,
    countryAliases: ['France', 'FR'],
    titleKws: ['프랑스', '파리', '마크롱', '르펜', '바르니에', '엘리제궁', '佛'],
    bodyKws: ['프랑스', '파리', '마크롱'],
    defTitle: '프랑스 정국 갈등과 재정 적자 축소 긴축 예산안', defShort: '프랑스 정국·예산안', defCat: 'politics'
  },
  'it': {
    country: '이탈리아 (로마)', flag: '🇮🇹', lat: 41.9, lng: 12.5, dx: 25, dy: 45,
    countryAliases: ['Italy', 'IT'],
    titleKws: ['이탈리아', '로마', '멜로니', '교황청', '바티칸', '밀라노', '伊'],
    bodyKws: ['이탈리아', '로마'],
    defTitle: '이탈리아 멜로니 정부의 난민 정책과 EU 내 외교적 입지', defShort: '이탈리아 EU외교입지', defCat: 'politics'
  },
  'es': {
    country: '스페인 (마드리드)', flag: '🇪🇸', lat: 40.4, lng: -3.7, dx: -70, dy: 30,
    countryAliases: ['Spain', 'ES'],
    titleKws: ['스페인', '마드리드', '바르셀로나', '산체스'],
    bodyKws: ['스페인', '마드리드'],
    defTitle: '스페인 주거권 위기 시위와 재생에너지 발전 비중 확대', defShort: '스페인 주거권·재생E', defCat: 'economy'
  },
  'nl': {
    country: '네덜란드 (암스테르담)', flag: '🇳🇱', lat: 52.4, lng: 4.9, dx: -60, dy: -60,
    countryAliases: ['Netherlands', 'NL'],
    titleKws: ['네덜란드', '암스테르담', '헤이그', 'asml', '스호프'],
    bodyKws: ['네덜란드', 'asml'],
    defTitle: '네덜란드 ASML 초미세 노광장비 수출 통제 및 원전 확대', defShort: '네덜란드 ASML·원전', defCat: 'economy'
  },
  'ch': {
    country: '스위스 (베른)', flag: '🇨🇭', lat: 46.9, lng: 7.4, dx: -60, dy: -25,
    countryAliases: ['Switzerland', 'CH'],
    titleKws: ['스위스', '제네바', '취리히', '다보스'],
    bodyKws: ['스위스', '제네바'],
    defTitle: '스위스 중앙은행 통화정책과 글로벌 자산관리 안정성', defShort: '스위스 자산관리안정', defCat: 'economy'
  },
  'pl': {
    country: '폴란드 (바르샤바)', flag: '🇵🇱', lat: 52.2, lng: 21.0, dx: 30, dy: -45,
    countryAliases: ['Poland', 'PL'],
    titleKws: ['폴란드', '바르샤바', '투스크'],
    bodyKws: ['폴란드', '바르샤바'],
    defTitle: '폴란드 동유럽 방위력 증강과 한국산 무기 체계 배치', defShort: '폴란드 국방력 증강', defCat: 'politics'
  },
  'se': {
    country: '스웨덴 (스톡홀름)', flag: '🇸🇪', lat: 59.3, lng: 18.1, dx: 25, dy: -65,
    countryAliases: ['Sweden', 'SE'],
    titleKws: ['스웨덴', '스톡홀름', '크리스테르손'],
    bodyKws: ['스웨덴'],
    defTitle: '스웨덴 나토 가입 이후 발트해 방어 체계 통합 가속', defShort: '스웨덴 나토발트해방어', defCat: 'politics'
  },
  'no': {
    country: '노르웨이 (오슬로)', flag: '🇳🇴', lat: 59.9, lng: 10.7, dx: -55, dy: -65,
    countryAliases: ['Norway', 'NO'],
    titleKws: ['노르웨이', '오슬로', '스퇴레'],
    bodyKws: ['노르웨이'],
    defTitle: '노르웨이 국부펀드 운용 전략과 북해 천연가스 공급', defShort: '노르웨이 국부펀드', defCat: 'economy'
  },
  'fi': {
    country: '핀란드 (헬싱키)', flag: '🇫🇮', lat: 60.2, lng: 24.9, dx: 65, dy: -65,
    countryAliases: ['Finland', 'FI'],
    titleKws: ['핀란드', '헬싱키', '스투브'],
    bodyKws: ['핀란드'],
    defTitle: '핀란드 러시아 국경 통제 강화 및 동유럽 방위 태세', defShort: '핀란드 동부국경통제', defCat: 'politics'
  },
  'gr': {
    country: '그리스 (아테네)', flag: '🇬🇷', lat: 38.0, lng: 23.7, dx: 30, dy: 45,
    countryAliases: ['Greece', 'GR'],
    titleKws: ['그리스', '아테네', '미초타키스'],
    bodyKws: ['그리스'],
    defTitle: '그리스 지중해 관광산업 호조와 국채 신용등급 상향', defShort: '그리스 관광·재정회복', defCat: 'economy'
  },
  'tr': {
    country: '튀르키예 (앙카라)', flag: '🇹🇷', lat: 39.9, lng: 32.8, dx: 45, dy: 35,
    countryAliases: ['Turkey', 'Turkiye', 'TR'],
    titleKws: ['튀르키예', '터키', '앙카라', '에르도안', '이스탄불'],
    bodyKws: ['튀르키예', '터키', '앙카라'],
    defTitle: '튀르키예 인플레이션 진정과 중동-유럽 가교 외교', defShort: '튀르키예 중동중재외교', defCat: 'politics'
  },

  // === 중동 & 아프리카 ===
  'il': {
    country: '이스라엘·가자', flag: '🇮🇱', lat: 31.8, lng: 35.2, dx: -55, dy: 35,
    countryAliases: ['Israel', 'IL', 'Palestine', 'PS'],
    titleKws: ['이스라엘', '네타냐후', '텔아비브', '가자', '하마스', '헤즈볼라', '레바논', '팔레스타인', '라파'],
    bodyKws: ['이스라엘', '가자', '하마스', '헤즈볼라'],
    defTitle: '이스라엘 중동 전면전 위기와 가자지구 인도적 휴전 협상', defShort: '이스라엘 중동군사긴장', defCat: 'politics'
  },
  'ir': {
    country: '이란 (테헤란)', flag: '🇮🇷', lat: 35.7, lng: 51.4, dx: 55, dy: -20,
    countryAliases: ['Iran', 'Islamic Republic of Iran', 'IR'],
    titleKws: ['이란', '테헤란', '하메네이', '페제시키안', '혁명수비대', '호르무즈', '페르시아'],
    bodyKws: ['이란', '테헤란', '호르무즈'],
    defTitle: '이란 호르무즈 해협 군사 봉쇄 위협과 대서방 외교 줄다리기', defShort: '이란 호르무즈 군사위협', defCat: 'politics'
  },
  'sa': {
    country: '사우디 (리야드)', flag: '🇸🇦', lat: 24.7, lng: 46.7, dx: 35, dy: 45,
    countryAliases: ['Saudi Arabia', 'SA'],
    titleKws: ['사우디', '리야드', '빈살만', '사우디아라비아', '아람코'],
    bodyKws: ['사우디', '리야드'],
    defTitle: '사우디 비전 2030 네옴시티 투자 조정과 원유 감산 기조', defShort: '사우디 비전2030·감산', defCat: 'economy'
  },
  'ye': {
    country: '예멘 (사나)', flag: '🇾🇪', lat: 15.3, lng: 44.2, dx: 40, dy: 25,
    countryAliases: ['Yemen', 'YE'],
    titleKws: ['예멘', '후티', '홍해', '아덴만'],
    bodyKws: ['예멘', '후티'],
    defTitle: '예멘 후티 반군 홍해 상선 미사일 타격과 글로벌 해운 마비', defShort: '예멘 후티 홍해타격', defCat: 'politics'
  },
  'sy': {
    country: '시리아 (다마스쿠스)', flag: '🇸🇾', lat: 33.5, lng: 36.3, dx: 30, dy: -25,
    countryAliases: ['Syria', 'SY'],
    titleKws: ['시리아', '다마스쿠스', '아사드'],
    bodyKws: ['시리아'],
    defTitle: '시리아 국경 분쟁 지역 공습과 중동 피란민 위기', defShort: '시리아 안보정세불안', defCat: 'politics'
  },
  'iq': {
    country: '이라크 (바그다드)', flag: '🇮🇶', lat: 33.3, lng: 44.4, dx: 35, dy: 5,
    countryAliases: ['Iraq', 'IQ'],
    titleKws: ['이라크', '바그다드'],
    bodyKws: ['이라크'],
    defTitle: '이라크 원유 수송 파이프라인 정비 및 내수 경제 재건', defShort: '이라크 원유수송로', defCat: 'economy'
  },
  'ae': {
    country: 'UAE (두바이/아부다비)', flag: '🇦🇪', lat: 24.5, lng: 54.4, dx: 45, dy: 15,
    countryAliases: ['United Arab Emirates', 'AE'],
    titleKws: ['uae', '아랍에미리트', '두바이', '아부다비'],
    bodyKws: ['두바이', '아부다비'],
    defTitle: 'UAE 글로벌 AI 인프라 투자 펀드 출범과 중동 금융 중심 도약', defShort: 'UAE AI투자펀드', defCat: 'economy'
  },
  'qa': {
    country: '카타르 (도하)', flag: '🇶🇦', lat: 25.3, lng: 51.5, dx: 30, dy: -20,
    countryAliases: ['Qatar', 'QA'],
    titleKws: ['카타르', '도하'],
    bodyKws: ['카타르'],
    defTitle: '카타르 LNG 장기 공급 계약 확대 및 중동 평화 중재', defShort: '카타르 LNG공급·중재', defCat: 'economy'
  },
  'eg': {
    country: '이집트 (카이로)', flag: '🇪🇬', lat: 30.0, lng: 31.2, dx: -55, dy: -30,
    countryAliases: ['Egypt', 'EG'],
    titleKws: ['이집트', '카이로', '엘시시', '수에즈'],
    bodyKws: ['이집트', '카이로'],
    defTitle: '이집트 수에즈 운하 통행료 수익 감소와 경제 개혁 과제', defShort: '이집트 수에즈운하위기', defCat: 'economy'
  },
  'za': {
    country: '남아공 (프리토리아)', flag: '🇿🇦', lat: -25.7, lng: 28.2, dx: 45, dy: 35,
    countryAliases: ['South Africa', 'ZA'],
    titleKws: ['남아공', '남아프리카', '요하네스버그', '라마포사', '케이프타운'],
    bodyKws: ['남아공', '남아프리카'],
    defTitle: '남아공 연립정부 출범 이후 전력난 해소와 경제 개혁', defShort: '남아공 연정·경제개혁', defCat: 'economy'
  },
  'ng': {
    country: '나이지리아 (아부자)', flag: '🇳🇬', lat: 9.1, lng: 7.5, dx: -55, dy: 20,
    countryAliases: ['Nigeria', 'NG'],
    titleKws: ['나이지리아', '라고스', '아부자'],
    bodyKws: ['나이지리아'],
    defTitle: '나이지리아 산유국 정유 시설 가동과 나이라화 환율 안정', defShort: '나이지리아 정유·환율', defCat: 'economy'
  },
  'ke': {
    country: '케냐 (나이로비)', flag: '🇰🇪', lat: -1.3, lng: 36.8, dx: 50, dy: 15,
    countryAliases: ['Kenya', 'KE'],
    titleKws: ['케냐', '나이로비', '루토', '에볼라'],
    bodyKws: ['케냐'],
    defTitle: '케냐 동아프리카 테크 허브 확장과 공공 보건 방역 강화', defShort: '케냐 테크허브·보건', defCat: 'environment'
  },
  'cd': {
    country: '민주콩고 (킨샤사)', flag: '🇨🇩', lat: -4.3, lng: 15.3, dx: -55, dy: 15,
    countryAliases: ['Democratic Republic of the Congo', 'Dem. Rep. Congo', 'Congo', 'CD'],
    titleKws: ['콩고', '민주콩고', '킨샤사', '엠폭스'],
    bodyKws: ['콩고', '엠폭스'],
    defTitle: '민주콩고 엠폭스 바이러스 비상사태 대응 및 코발트 공급망', defShort: '민주콩고 엠폭스방역', defCat: 'environment'
  }
};

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function parseRss(xmlText, sourceName) {
  const items = [];
  const itemRegex = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null && items.length < 80) {
    const itemContent = match[1];
    const titleMatch = /<title[\s\S]*?>([\s\S]*?)<\/title>/i.exec(itemContent);
    const pubDateMatch = /<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i.exec(itemContent);
    const linkMatch = /<link[\s\S]*?>([\s\S]*?)<\/link>/i.exec(itemContent);
    const descMatch = /<description[\s\S]*?>([\s\S]*?)<\/description>/i.exec(itemContent);

    const rawTitle = titleMatch ? cleanText(titleMatch[1]) : '';
    const link = linkMatch ? cleanText(linkMatch[1]) : '';
    const pubDate = pubDateMatch ? cleanText(pubDateMatch[1]) : '';
    const desc = descMatch ? cleanText(descMatch[1]).slice(0, 180) : '';

    if (rawTitle && link) {
      items.push({
        title: rawTitle,
        link,
        pubDate,
        summary: desc || rawTitle,
        source: sourceName
      });
    }
  }
  return items;
}

// 스마트 헤드라인 요약기: 지도 말풍선에 들어갈 8~14자 당일 핵심 요약 헤드라인 생성
function makeShortTitle(fullTitle, countryName) {
  let clean = fullTitle
    .replace(/\[.*?\]|\(.*?\)/g, '') // [단독], [영상], (종합), [쇼츠] 제거
    .replace(/["'“”‘’]/g, '')
    .replace(/…|\.\.\./g, '')
    .trim();

  // 말풍선 글자수 한도 (약 13자)
  if (clean.length > 13) {
    const words = clean.split(' ');
    let res = '';
    for (const w of words) {
      if ((res + ' ' + w).trim().length <= 13) {
        res = (res + ' ' + w).trim();
      } else break;
    }
    clean = res || clean.slice(0, 12);
  }
  return clean || countryName;
}

// 카테고리 자동 판별
function detectCategory(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('금리') || text.includes('인플레') || text.includes('증시') || text.includes('환율') ||
      text.includes('경기') || text.includes('투자') || text.includes('수출') || text.includes('반도체') ||
      text.includes('ai') || text.includes('빅테크') || text.includes('부동산') || text.includes('원유') ||
      text.includes('유가') || text.includes('국채') || text.includes('주가') || text.includes('기업') ||
      text.includes('상장') || text.includes('관세') || text.includes('은행')) {
    return { category: 'economy', categoryName: '경제·테크', color: '#ef4444' };
  }
  if (text.includes('홍수') || text.includes('폭우') || text.includes('가뭄') || text.includes('지진') ||
      text.includes('태풍') || text.includes('허리케인') || text.includes('산불') || text.includes('폭염') ||
      text.includes('기후') || text.includes('바이러스') || text.includes('에볼라') || text.includes('엠폭스') ||
      text.includes('감염') || text.includes('재난') || text.includes('환경') || text.includes('엘니뇨')) {
    return { category: 'environment', categoryName: '환경·재난', color: '#10b981' };
  }
  return { category: 'politics', categoryName: '정치·외교', color: '#3b82f6' };
}

function formatRelativeTime(dateStr) {
  try {
    const pub = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.max(1, Math.floor((now - pub) / (1000 * 60)));
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return `${Math.floor(diffHours / 24)}일 전`;
  } catch (e) {
    return '실시간 속보';
  }
}

async function updateAllNews() {
  const now = new Date();
  const kstString = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);
  console.log(`====================================================`);
  console.log(`📡 [실시간 글로벌 뉴스 수집 & 50+ 다국가 갱신] ${kstString} KST`);
  console.log(`====================================================`);

  const collectedArticles = [];
  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRss(xml, feed.name);
      collectedArticles.push(...items);
    } catch (e) {
      console.warn(`Feed fetch failed (${feed.name}):`, e.message);
    }
  }

  // 중복 기사 제거
  const uniqueArticles = [];
  collectedArticles.forEach(art => {
    if (!uniqueArticles.some(u => u.title === art.title)) {
      uniqueArticles.push(art);
    }
  });

  console.log(`✅ 총 ${uniqueArticles.length}건의 고유 실시간 기사 확보 완료.`);

  const finalIssuesList = [];
  let freshUpdatedCountries = 0;

  // 전체 55개국 순회하며 실시간 뉴스 매칭 또는 대표 현안 구성
  for (const [key, cInfo] of Object.entries(GLOBAL_COUNTRY_DB)) {
    // 1) 제목에 국가 핵심 키워드가 포함된 기사 (최우선순위)
    const titleMatches = uniqueArticles.filter(art => {
      const t = art.title.toLowerCase();
      return cInfo.titleKws.some(kw => t.includes(kw.toLowerCase()));
    });

    // 2) 본문에 포함된 보조 기사
    const bodyMatches = uniqueArticles.filter(art => {
      const b = art.summary.toLowerCase();
      return cInfo.bodyKws.some(kw => b.includes(kw.toLowerCase())) && !titleMatches.some(tm => tm.title === art.title);
    });

    const allMatches = [...titleMatches, ...bodyMatches];

    if (allMatches.length > 0) {
      freshUpdatedCountries++;
      const topArticle = allMatches[0];
      const catInfo = detectCategory(topArticle.title, topArticle.summary);
      const shortTitle = makeShortTitle(topArticle.title, cInfo.country.split(' ')[0]);

      const relatedNews = allMatches.slice(1, 6).map(h => ({
        title: h.title,
        category: detectCategory(h.title, h.summary).categoryName,
        media: h.source,
        time: formatRelativeTime(h.pubDate),
        url: h.link,
        summary: h.summary.length > 95 ? h.summary.slice(0, 92) + '...' : h.summary
      }));

      // 불릿 서머리 3개
      const bullets = [
        `[실시간 속보] ${topArticle.title}`,
        topArticle.summary ? topArticle.summary.slice(0, 110) : `외신 및 국내 통신사 실시간 주요 보도`,
        `발행: ${formatRelativeTime(topArticle.pubDate)} (${topArticle.source})`
      ];

      finalIssuesList.push({
        id: `issue-${key}`,
        category: catInfo.category,
        categoryName: catInfo.categoryName,
        color: catInfo.color,
        country: cInfo.country,
        flag: cInfo.flag,
        lat: cInfo.lat,
        lng: cInfo.lng,
        dx: cInfo.dx,
        dy: cInfo.dy,
        title: topArticle.title, // 당일 실시간 1순위 헤드라인!
        shortTitle: shortTitle,   // ⭐ 지도 말풍선에 당일 실시간 뉴스가 뜸!
        live: {
          headline: topArticle.title,
          time: formatRelativeTime(topArticle.pubDate),
          summary: bullets,
          detail: topArticle.summary || topArticle.title,
          sources: [
            {
              title: topArticle.title,
              url: topArticle.link,
              media: topArticle.source
            }
          ]
        },
        deepDive: {
          headline: `${cInfo.country.split(' ')[0]} 주요 현안 심층 분석 및 지정학적 리포트`,
          tag: '글로벌 심층 브리핑',
          summary: [
            `${cInfo.country.split(' ')[0]} 관련 대외 통상 및 안보 파급 효과 점검`,
            `동아시아 및 글로벌 공급망에 미치는 영향 분석`,
            `주요 정책 당국 및 국제기구 대응 동향 모니터링`
          ],
          detail: `${cInfo.country} 관련 최신 동향은 글로벌 경제 및 안보 구도에 중대한 영향을 미치고 있습니다.`
        },
        countryAliases: cInfo.countryAliases,
        relatedNews: relatedNews
      });
    } else {
      // 당일 기사가 아직 없는 국가도 기본 대표 현안으로 맵에 풍성하게 표시!
      const catColor = cInfo.defCat === 'economy' ? '#ef4444' : (cInfo.defCat === 'environment' ? '#10b981' : '#3b82f6');
      const catName = cInfo.defCat === 'economy' ? '경제·테크' : (cInfo.defCat === 'environment' ? '환경·재난' : '정치·외교');

      finalIssuesList.push({
        id: `issue-${key}`,
        category: cInfo.defCat,
        categoryName: catName,
        color: catColor,
        country: cInfo.country,
        flag: cInfo.flag,
        lat: cInfo.lat,
        lng: cInfo.lng,
        dx: cInfo.dx,
        dy: cInfo.dy,
        title: cInfo.defTitle,
        shortTitle: cInfo.defShort,
        live: {
          headline: cInfo.defTitle,
          time: '글로벌 모니터링',
          summary: [
            `${cInfo.country.split(' ')[0]} 주요 경제·안보 핵심 현안 지속 모니터링`,
            `글로벌 공급망 및 국제 정세 파급 효과 분석`,
            `주요 외신 및 국제기구 정책 대응 동향`
          ],
          detail: `${cInfo.country} 관련 주요 정책과 경제 동향을 24시간 실시간 모니터링하고 있습니다.`,
          sources: [
            {
              title: `${cInfo.country} 공식 현안 브리핑`,
              url: 'https://news.google.com',
              media: '글로벌 외신 종합'
            }
          ]
        },
        deepDive: {
          headline: `${cInfo.country.split(' ')[0]} 핵심 지정학적 리포트`,
          tag: '심층 기획',
          summary: [
            `지역 안보 및 통상 협력 현황`,
            `글로벌 원자재 및 에너지 수급 동향`,
            `향후 정책 전망과 리스크 관리`
          ],
          detail: `${cInfo.country}의 전략적 위치와 경제적 영향력에 대한 분석 리포트입니다.`
        },
        countryAliases: cInfo.countryAliases,
        relatedNews: []
      });
    }
  }

  // 메타데이터 저장
  const metaInfo = {
    lastUpdatedKst: kstString,
    lastUpdatedTimestamp: now.getTime(),
    intervalHours: 3,
    totalCountriesOnMap: finalIssuesList.length,
    updatedTodayCount: freshUpdatedCountries
  };

  const jsonPath = path.join(__dirname, 'integrated_issues.json');
  fs.writeFileSync(jsonPath, JSON.stringify(finalIssuesList, null, 2), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'last_updated.json'), JSON.stringify(metaInfo, null, 2), 'utf8');

  console.log(`🎉 [갱신 완료] 총 ${finalIssuesList.length}개국 지도 배치 (오늘 실시간 뉴스 반영: ${freshUpdatedCountries}개국)`);
  console.log(`⏰ 마지막 갱신 시각: ${kstString} KST`);
  console.log(`====================================================`);
}

updateAllNews().catch(console.error);
