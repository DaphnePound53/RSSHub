const fs = require('fs');
const path = require('path');

// 1. 配置
const RSSHUB_URL = 'http://localhost:1200/bilibili/user/dynamic/346563107';
const HISTORY_FILE = path.join(__dirname, '../history.json');
const PUSH_KEY = process.env.PUSH_KEY; // 你的推送密钥

// 主函数
(async () => {
  try {
    console.log('Fetching RSS data...');
    // 2. 请求本地 RSSHub
    const response = await fetch(RSSHUB_URL);
    if (!response.ok) throw new Error(`RSSHub Error: ${response.status}`);
    const xmlText = await response.text();

    // 3. 简单的正则提取 GUID (去重用) 和 标题/链接
    // 注意：简单正则可能不严谨，想完美解析可以用 'fast-xml-parser' 库，但这里为了不想安装库演示正则
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const content = match[1];
      const title = /<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(content)?.[1] || '无标题';
      const link = /<link>(.*?)<\/link>/.exec(content)?.[1] || '';
      const guid = /<guid.*?>([\s\S]*?)<\/guid>/.exec(content)?.[1] || link; // 唯一标识
      items.push({ title, link, guid });
    }

    // 4. 读取历史
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }

    // 5. 对比新文章
    const newItems = items.filter(item => !history.includes(item.guid));

    if (newItems.length === 0) {
      console.log('No new items.');
      return;
    }

    console.log(`Found ${newItems.length} new items!`);

    // 6. 推送 (以 PushPlus 为例)
    // 把多条消息合并成一条推送，避免刷屏
    const content = newItems.map(i => `- [${i.title}](${i.link})`).join('\n\n');
    
    await fetch('http://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: PUSH_KEY,
        title: 'B站动态更新',
        content: content,
        template: 'markdown'
      })
    });

    // 7. 更新历史 (只保留最近 100 条，防止文件无限大)
    const allGuids = items.map(i => i.guid); 
    // 这里简单处理：直接覆盖为当前最新的列表。或者你可以 append 新的。
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(allGuids, null, 2));
    console.log('Done.');

  } catch (error) {
    console.error('Workflow failed:', error);
    process.exit(1);
  }
})();
