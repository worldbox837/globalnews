// crawl_test.js
// 실시간 뉴스 수집(크롤링/RSS) 테스트 스크립트

const sources = [
  {
    category: '국제',
    name: '연합뉴스 국제',
    url: 'https://www.yna.co.kr/rss/international.xml'
  },
  {
    category: '세계',
    name: '구글 뉴스 세계 이슈',
    url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko'
  },
  {
    category: '경제',
    name: '연합뉴스 경제',
    url: 'https://www.yna.co.kr/rss/economy.xml'
  },
  {
    category: '국내 헤드라인',
    name: '구글 뉴스 국내 주요',
    url: 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko'
  }
];

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

function parseRss(xmlText, maxItems = 5) {
  const items = [];
  const itemRegex = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null && items.length < maxItems) {
    const itemContent = match[1];
    const titleMatch = /<title[\s\S]*?>([\s\S]*?)<\/title>/i.exec(itemContent);
    const pubDateMatch = /<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i.exec(itemContent);
    const linkMatch = /<link[\s\S]*?>([\s\S]*?)<\/link>/i.exec(itemContent);
    const descMatch = /<description[\s\S]*?>([\s\S]*?)<\/description>/i.exec(itemContent);

    items.push({
      title: titleMatch ? cleanText(titleMatch[1]) : '',
      pubDate: pubDateMatch ? cleanText(pubDateMatch[1]) : '',
      link: linkMatch ? cleanText(linkMatch[1]) : '',
      description: descMatch ? cleanText(descMatch[1]).slice(0, 150) : ''
    });
  }
  return items;
}

async function runTest() {
  console.log('====================================================');
  console.log(`📡 [실시간 크롤링 테스트] 현재 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log('====================================================\n');

  const allCollected = [];

  for (const src of sources) {
    try {
      const startTime = Date.now();
      const res = await fetch(src.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const fetchTime = Date.now() - startTime;

      if (!res.ok) {
        console.log(`❌ [${src.name}] 요청 실패 (상태 코드: ${res.status})`);
        continue;
      }

      const text = await res.text();
      const items = parseRss(text, 5);

      console.log(`✅ [${src.name}] 수집 성공 (${fetchTime}ms, 총 ${items.length}건 발췌)`);
      items.forEach((it, i) => {
        console.log(`   ${i + 1}. [${src.category}] ${it.title}`);
        console.log(`      🕒 ${it.pubDate} | 🔗 ${it.link.slice(0, 60)}...`);
      });
      console.log('');

      allCollected.push({
        source: src.name,
        category: src.category,
        count: items.length,
        items
      });
    } catch (err) {
      console.error(`⚠️ [${src.name}] 오류 발생:`, err.message);
    }
  }

  // 간단한 통계 요약
  const totalCount = allCollected.reduce((acc, cur) => acc + cur.items.length, 0);
  console.log('====================================================');
  console.log(`🎉 수집 완료: 총 ${allCollected.length}개 소스에서 ${totalCount}개의 실시간 주요 뉴스 수집 완료`);
  console.log('====================================================');
}

runTest();
