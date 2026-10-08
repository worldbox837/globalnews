// update_news.js
// 3시간 주기 실시간 글로벌 뉴스 자동 수집 및 데이터셋 갱신 파이프라인

const fs = require('fs');
const path = require('path');

const RSS_FEEDS = [
  { name: '연합뉴스 국제', url: 'https://www.yna.co.kr/rss/international.xml', category: '국제' },
  { name: '연합뉴스 경제', url: 'https://www.yna.co.kr/rss/economy.xml', category: '경제' },
  { name: '구글 뉴스 세계', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko', category: '세계' },
  { name: '구글 뉴스 비즈니스', url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko', category: '경제' },
  { name: '구글 뉴스 테크', url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko', category: '테크' }
];

const COUNTRY_KEYWORDS = {
  'integrated-au-sydney': ['호주', '시드니', '캔버라', '오스트레일리아', '앤트로픽', 'australia', 'sydney'],
  'integrated-germany-ecb': ['독일', '베를린', '프랑크푸르트', 'ecb', '폭스바겐', '유럽중앙은행', 'germany', 'berlin'],
  'integrated-uk-london': ['영국', '런던', '브렉시트', '스타머', '영란은행', 'uk', 'britain', 'london'],
  'integrated-ukraine-drone': ['우크라이나', '키이우', '젤렌스키', '우크라', 'ukraine', 'kyiv'],
  'integrated-fr-senate': ['프랑스', '파리', '마크롱', '르펜', 'france', 'paris'],
  'integrated-serbia-vucic': ['세르비아', '베오그라드', '부치치', '발칸', 'serbia', 'belgrade'],
  'integrated-spain-housing': ['스페인', '마드리드', '바르셀로나', '산체스', 'spain', 'madrid'],
  'integrated-turkey-s400': ['튀르키예', '터키', '앙카라', '에르도안', 'turkey', 'turkiye', 'ankara'],
  'integrated-us-newyork': ['월가', '뉴욕증시', '연준', '파월', '나스닥', '다우', 's&p', '미 국채', '금리 인하', 'fed', 'wall street'],
  'integrated-us-siliconvalley': ['실리콘밸리', '오픈ai', '엔비디아', '구글', '애플', '마이크로소프트', '챗gpt', '생성형 ai', '빅테크', 'meta', 'nvidia'],
  'integrated-mexico-hurricane': ['멕시코', '아카풀코', '셰인바움', '카르텔', '허리케인', 'mexico'],
  'integrated-brazil-amazon': ['브라질', '아마존', '마나우스', '룰라', '산불', '가뭄', 'brazil'],
  'integrated-iran-us': ['이란', '테헤란', '호르무즈', '하메네이', '이란 혁명수비대', '페르시아', 'iran', 'tehran'],
  'integrated-gaza-israel': ['이스라엘', '가자', '하마스', '네타냐후', '헤즈볼라', '레바논', '라파', '팔레스타인', 'israel', 'gaza'],
  'integrated-yemen-houthi': ['예멘', '후티', '홍해', '아덴만', '유조선', 'yemen', 'houthi'],
  'integrated-safrica-crime': ['남아공', '요하네스버그', '케이프타운', '남아프리카', '라마포사', 'south africa'],
  'integrated-congo-health': ['콩고', '민주콩고', '킨샤사', '엠폭스', '아프리카 감염', 'congo', 'mpox'],
  'integrated-korea-bok': ['한국은행', '한은', '이창용', '기준금리', '금통위', '금융통화위원회', '소비자물가', '가계부채', '원달러'],
  'integrated-korea-dmz': ['북한', '김정은', 'dmz', '비무장지대', '미사일', '평양', '오물풍선', '휴전선', '합참'],
  'integrated-japan-tokyo': ['일본', '도쿄', '엔화', '닛케이', '이시바', '자민당', '일본은행', 'boj', 'japan', 'tokyo'],
  'integrated-china-beijing': ['중국', '베이징', '시진핑', '상하이', '위안화', '중국 경기', '관세', 'china', 'beijing'],
  'integrated-thailand-bangkok': ['태국', '방콕', '몬순', '태국 홍수', '치앙마이', 'thailand', 'bangkok'],
  'integrated-india-crops': ['인도', '뉴델리', '모디', '인도 경제', '인도 인플레', '갠지스', 'india', 'new delhi']
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
  while ((match = itemRegex.exec(xmlText)) !== null && items.length < 40) {
    const itemContent = match[1];
    const titleMatch = /<title[\s\S]*?>([\s\S]*?)<\/title>/i.exec(itemContent);
    const pubDateMatch = /<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i.exec(itemContent);
    const linkMatch = /<link[\s\S]*?>([\s\S]*?)<\/link>/i.exec(itemContent);
    const descMatch = /<description[\s\S]*?>([\s\S]*?)<\/description>/i.exec(itemContent);

    const title = titleMatch ? cleanText(titleMatch[1]) : '';
    const link = linkMatch ? cleanText(linkMatch[1]) : '';
    const pubDate = pubDateMatch ? cleanText(pubDateMatch[1]) : '';
    const desc = descMatch ? cleanText(descMatch[1]).slice(0, 140) : '';

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        summary: desc || title,
        source: sourceName
      });
    }
  }
  return items;
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
    return '최신 속보';
  }
}

async function updateNewsDataset() {
  const now = new Date();
  const kstString = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);
  console.log(`📡 [3시간 뉴스 업데이트 파이프라인 가동] 현재 시각: ${kstString} (KST)`);

  const collectedArticles = [];
  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRss(xml, feed.name);
      collectedArticles.push(...items);
    } catch (e) {
      console.warn(`Feed fetch failed (${feed.name}):`, e.message);
    }
  }

  console.log(`✅ 총 ${collectedArticles.length}건의 실시간 뉴스 수집 완료.`);

  // Load existing integrated dataset
  const jsonPath = path.join(__dirname, 'integrated_issues.json');
  const issues = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let updatedCountryCount = 0;

  issues.forEach(item => {
    const keywords = COUNTRY_KEYWORDS[item.id] || [];
    const matched = collectedArticles.filter(art => {
      const text = (art.title + ' ' + art.summary).toLowerCase();
      return keywords.some(kw => text.includes(kw.toLowerCase()));
    });

    if (matched.length > 0) {
      updatedCountryCount++;
      const freshNews = matched.slice(0, 4).map(art => ({
        title: art.title,
        category: item.categoryName,
        media: art.source,
        time: formatRelativeTime(art.pubDate),
        url: art.link,
        summary: art.summary.length > 100 ? art.summary.slice(0, 97) + '...' : art.summary
      }));

      // Merge with existing news (avoid duplicate titles)
      const existing = item.relatedNews || [];
      const merged = [...freshNews];
      existing.forEach(oldNews => {
        if (!merged.some(m => m.title === oldNews.title) && merged.length < 5) {
          merged.push(oldNews);
        }
      });

      item.relatedNews = merged;
      item.live.time = '최신 갱신';
    }
  });

  // Save metadata
  const metaInfo = {
    lastUpdatedKst: kstString,
    lastUpdatedTimestamp: now.getTime(),
    intervalHours: 3,
    totalIssues: issues.length,
    updatedCountries: updatedCountryCount
  };

  fs.writeFileSync(jsonPath, JSON.stringify(issues, null, 2), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'last_updated.json'), JSON.stringify(metaInfo, null, 2), 'utf8');

  console.log(`🎉 [데이터셋 갱신 완료] 23개국 중 ${updatedCountryCount}개국 최신 뉴스 동기화 완료.`);
  console.log(`⏰ 마지막 갱신 시각: ${kstString} KST`);
}

updateNewsDataset().catch(console.error);
