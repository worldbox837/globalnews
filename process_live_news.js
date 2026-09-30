// process_live_news.js
// 실시간 수집된 뉴스를 지도 및 데일리 브리핑 포맷(JSON)으로 변환하는 모듈

const fs = require('fs');
const path = require('path');

// 주요 국가/지역의 기본 좌표 매핑 테이블
const countryGeoDB = {
  '미국': { lat: 38.9, lng: -77.0, flag: '🇺🇸', name: '미국 (USA)' },
  '러시아': { lat: 55.7, lng: 37.6, flag: '🇷🇺', name: '러시아 (모스크바)' },
  '우크라이나': { lat: 50.4, lng: 30.5, flag: '🇺🇦', name: '우크라이나 (키이우)' },
  '중국': { lat: 39.9, lng: 116.4, flag: '🇨🇳', name: '중국 (베이징)' },
  '일본': { lat: 35.7, lng: 139.7, flag: '🇯🇵', name: '일본 (도쿄)' },
  '한국': { lat: 37.5, lng: 127.0, flag: '🇰🇷', name: '대한민국 (서울)' },
  '이란': { lat: 35.7, lng: 51.4, flag: '🇮🇷', name: '이란 (테헤란)' },
  '사우디': { lat: 24.7, lng: 46.7, flag: '🇸🇦', name: '사우디아라비아 (리야드)' },
  '튀르키예': { lat: 39.9, lng: 32.8, flag: '🇹🇷', name: '튀르키예 (앙카라)' },
  '유럽': { lat: 50.8, lng: 4.3, flag: '🇪🇺', name: '유럽연합 (브뤼셀)' }
};

// 키워드로 국가 및 카테고리 자동 추론 함수
function detectMetadata(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  
  // 카테고리 판별
  let category = 'politics';
  let categoryName = '정치·외교';
  let color = '#3b82f6';

  if (text.includes('채권') || text.includes('금리') || text.includes('은행') || text.includes('상장') || text.includes('관세') || text.includes('수출') || text.includes('재건축') || text.includes('인하') || text.includes('경제')) {
    category = 'economy';
    categoryName = '경제';
    color = '#ef4444';
  } else if (text.includes('비') || text.includes('강우') || text.includes('폭염') || text.includes('산불') || text.includes('기온') || text.includes('기후') || text.includes('가뭄')) {
    category = 'environment';
    categoryName = '환경';
    color = '#10b981';
  }

  // 국가 판별
  let countryInfo = countryGeoDB['미국']; // 기본값
  for (const [key, val] of Object.entries(countryGeoDB)) {
    if (text.includes(key.toLowerCase())) {
      countryInfo = val;
      break;
    }
  }

  return { category, categoryName, color, countryInfo };
}

async function run() {
  console.log('📡 [실시간 뉴스 브리핑 변환 파이프라인 가동]');
  
  // 1. RSS 피드 수집
  const urls = [
    'https://www.yna.co.kr/rss/international.xml',
    'https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko',
    'https://www.yna.co.kr/rss/economy.xml'
  ];

  const rawItems = [];
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const xml = await res.text();
      const itemRegex = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
      let m;
      while ((m = itemRegex.exec(xml)) !== null && rawItems.length < 15) {
        const itemXml = m[1];
        const title = (/<title[\s\S]*?>([\s\S]*?)<\/title>/i.exec(itemXml)?.[1] || '').replace(/<!\[CDATA\[|\]\]>|<[^>]+>/g, '').trim();
        const link = (/<link[\s\S]*?>([\s\S]*?)<\/link>/i.exec(itemXml)?.[1] || '').replace(/<!\[CDATA\[|\]\]>|<[^>]+>/g, '').trim();
        const pubDate = (/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i.exec(itemXml)?.[1] || '').trim();
        if (title && !rawItems.some(x => x.title === title)) {
          rawItems.push({ title, link, pubDate });
        }
      }
    } catch (e) {
      console.error('Fetch err:', e.message);
    }
  }

  console.log(`✅ ${rawItems.length}개의 실시간 기사 수집 완료.`);

  // 2. 브리핑 포맷으로 구조화
  const processedIssues = rawItems.slice(0, 8).map((it, idx) => {
    const meta = detectMetadata(it.title, '');
    return {
      id: `live-issue-${idx + 1}`,
      category: meta.category,
      categoryName: meta.categoryName,
      color: meta.color,
      country: meta.countryInfo.name,
      flag: meta.countryInfo.flag,
      lat: meta.countryInfo.lat,
      lng: meta.countryInfo.lng,
      title: it.title,
      shortTitle: it.title.length > 16 ? it.title.slice(0, 15) + '…' : it.title,
      summary: [
        `[실시간 속보] ${it.title}`,
        `발행 시각: ${it.pubDate}`,
        `주요 국가 및 지역: ${meta.countryInfo.name}`
      ],
      detail: `본 기사는 ${meta.countryInfo.name} 관련 실시간 주요 이슈로, ${it.pubDate} 기준 최신 외신 및 통신사 보도로 확인되었습니다.`,
      sources: [
        { title: it.title, url: it.link, media: "실시간 언론사 출처" }
      ]
    };
  });

  const outPath = path.join(__dirname, 'latest_crawled_news.json');
  fs.writeFileSync(outPath, JSON.stringify(processedIssues, null, 2), 'utf8');

  console.log(`\n🎉 [결과물 생성 완료] ${outPath}`);
  console.log('----------------------------------------------------');
  processedIssues.forEach((issue, i) => {
    console.log(`${i + 1}. [${issue.categoryName}] ${issue.flag} ${issue.country}: ${issue.title}`);
  });
  console.log('----------------------------------------------------');
}

run();
