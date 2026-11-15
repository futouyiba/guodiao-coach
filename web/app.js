'use strict';

const main = document.getElementById('main');
const api = window.Coach;
let data;

function element(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function href(page, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined));
  return `#/${page}${query.size ? `?${query}` : ''}`;
}

function link(text, target, className) {
  return element('a', { href: target, class: className, onclick: event => {
    if (location.hash === target) {
      event.preventDefault();
      render();
      main.focus({ preventScroll: true });
    }
  } }, text);
}

function heading(title, description) {
  document.title = `${title} · 国钓教练`;
  return element('div', {}, element('h1', {}, title), element('p', { class: 'muted' }, description));
}

function empty(message = '试试更短的关键词，或重置筛选。') {
  return element('div', { class: 'empty' }, element('h2', {}, '没有找到匹配资料'), element('p', {}, message));
}

function selectField(label, name, choices, value = '') {
  return element('label', {}, label, element('select', { name }, choices.map(([key, text]) =>
    element('option', { value: key, selected: value === key }, text))));
}

function inputField(label, name, value = '', type = 'search', extra = {}) {
  return element('label', { class: type === 'search' ? 'grow' : '' }, label,
    element('input', { name, type, value, ...extra }));
}

function toolbar(page, fields, note, params = {}, resetParams = {}) {
  return element('form', { class: 'toolbar', role: 'search', onsubmit: event => {
    event.preventDefault();
    const values = { ...params, ...Object.fromEntries(new FormData(event.currentTarget)) };
    delete values.page;
    location.hash = href(page, values);
  } }, element('div', { class: 'fields' }, fields, element('button', { type: 'submit' }, '查询'),
    link('重置', href(page, resetParams), 'button secondary')), element('p', { class: 'hint' }, note));
}

function paginate(rows, params, render, size = 24) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.max(1, Math.min(pages, Number.parseInt(params.get('page'), 10) || 1));
  const change = page => {
    const query = Object.fromEntries(params);
    location.hash = href(api.route(location.hash).page, { ...query, page });
  };
  return [render(rows.slice((current - 1) * size, current * size)), pages > 1 ? element('div', { class: 'pagination' },
    element('button', { type: 'button', disabled: current === 1, onclick: () => change(current - 1) }, '上一页'),
    element('span', {}, `${current} / ${pages} 页`),
    element('button', { type: 'button', disabled: current === pages, onclick: () => change(current + 1) }, '下一页')) : null].filter(node => node !== null);
}

function resultsHeader(count, label) {
  return element('div', { class: 'results-header' }, element('h2', { role: 'status' }, `${count} ${label}`),
    element('span', { class: 'muted' }, '以文档原文为准，可进入详情核对'));
}

function fishCard(record) {
  return element('article', { class: 'fish-card' }, element('h3', {}, link(record.name, href(`fish/${record.id}`))),
    element('p', {}, record.restriction_raw ?? '限制资料暂缺'),
    element('p', { class: 'muted' }, `文档饵：${record.bait_listed.slice(0, 3).join('、') || record.bait_general.join('、') || '资料暂缺'}${record.bait_listed.length > 3 ? '等' : ''}`),
    element('span', { class: 'source-mini' }, `${record.source_file} · 第 ${record.line_no} 行`));
}

function fishPage(params) {
  const query = params.get('q') || '';
  const condition = params.get('condition') || '';
  const rows = data.fish.filter(record => api.fishMatches(record, query, condition));
  main.append(element('section', { class: 'hero' }, element('div', {}, element('p', { class: 'label' }, '鱼种攻略 / 从目标开始'),
    heading('我想钓什么？', '先确认文档限制，再查可用饵和窝料偏好。不用先填库存，也不用建立装备档案。')),
    element('aside', { class: 'index-note' }, element('strong', {}, `${data.fish.length} 种鱼的资料`),
      element('p', {}, `${data.hooks.length} 条鱼钩 · ${data.reels.length} 条渔轮`), element('p', {}, `资料版 ${data.manifest.version}`))));
  main.append(toolbar('fish', [inputField('搜索鱼名', 'q', query, 'search', { placeholder: '例如：鲟、梭鲈鱼' }),
    selectField('按原文条件筛选', 'condition', api.filters, condition)],
  '“提及底钓条件”不代表推荐底钓或已确认是淡水鱼；未提及的钓法不代表可用。所有结果仍须查看完整限制。'));
  main.append(resultsHeader(rows.length, '种鱼'));
  main.append(...(rows.length ? paginate(rows, params, records => element('div', { class: 'fish-grid' }, records.map(fishCard))) : [empty()]));
}

function source(record) {
  return element('section', { class: 'panel' }, element('h2', {}, '原文与出处'),
    element('p', { class: 'muted' }, `${record.source_file} · 第 ${record.line_no} 行 · ID ${record.id}`),
    element('details', {}, element('summary', {}, '展开完整原文'), element('pre', {}, record.raw_text)));
}

function baitLinks(items, mode = 'listed') {
  return element('div', { class: 'chips' }, items.map(item => link(item, href('bait', { q: item, mode }), 'chip')));
}

function missing(title, description) {
  return element('section', { class: 'panel missing' }, element('h2', {}, title), element('strong', {}, '资料暂缺'),
    element('p', {}, description));
}

function fishDetail(id) {
  const record = data.fish.find(item => item.id === id);
  if (!record) return notFound();
  main.append(element('div', { class: 'breadcrumb' }, link('鱼种攻略', href('fish')), ' / ', record.name),
    heading(record.name, '按顺序查条件、选文档列出的饵，再核对出钓准备。'));
  const baits = element('section', { class: 'panel' }, element('h2', {}, '用什么饵'),
    element('p', { class: 'muted' }, '以下是文档列出的可用饵，不代表最佳饵或成功率。未列出不等于绝对无效。'),
    record.bait_listed.length ? baitLinks(record.bait_listed) : null,
    record.bait_general.length ? element('div', {}, element('h3', {}, '原文泛称'), baitLinks(record.bait_general, 'general'),
      element('p', { class: 'hint' }, '“各类可用饵”不展开成全部 SKU；本文没有逐项正向清单。')) : null,
    record.bait_excluded.length ? element('div', {}, element('h3', {}, '原文明确排除'), baitLinks(record.bait_excluded, 'excluded')) : null,
    record.eat_notes.length ? element('p', { class: 'hint' }, `原文备注：${record.eat_notes.join('；')}`) : null,
    element('details', {}, element('summary', {}, '核对饵料原文'), element('p', {}, record.eat_raw)));
  const groundbait = element('section', { class: 'panel' }, element('h2', {}, '窝料偏好'),
    record.groundbait_raw === null ? element('p', {}, '资料暂缺：原文没有窝料字段，不按近似鱼种补全。') :
      record.groundbait_raw === '无' ? element('p', {}, '原文标注“无”。这与原文缺字段不同。') :
        element('div', {}, baitLinks(record.groundbait, 'groundbait'), element('p', { class: 'hint' }, '这是偏好类别，不是已验证的完整窝料配方。'),
          element('p', { class: 'hint' }, `原文：${record.groundbait_raw}`)));
  main.append(element('div', { class: 'detail-grid' }, element('div', {},
    element('section', { class: 'panel conditions' }, element('h2', {}, '先看条件'),
      element('p', {}, record.restriction_raw ?? '资料暂缺'), element('small', {}, '条件保留原文上下文；“大于”不含等于，“至少”包含等于。')),
    baits, groundbait, source(record)), element('aside', {},
    missing('去哪里钓', record.restriction.sea_only ? '文档限定仅挪威海；具体钓场资料、钓位与坐标尚未收录。坑区限制请看左侧原文。' : '尚未收录可核对的钓场、钓位及坐标。未标注仅海钓，不等于证实是淡水鱼。'),
    missing('重量', '常见重量、最大重量、玩家纪录均未收录，三者不能混用。'),
    missing('参考装备', '缺少可验证的装备配方。不能用鱼重乘系数选钩和轮，也不能用锁轮拉力推鱼重上限。'),
    element('section', { class: 'panel' }, element('h2', {}, '下一步检查'), element('ul', {},
      element('li', {}, '核对钓法、饵深、船票及坑区条件。'), element('li', {}, '对照游戏确认具体饵型号与完整钓组。'),
      element('li', {}, '钓场和重量需另找可核对来源。')), link('查询装备文档值', href('gear'))))));
}

function baitPage(params) {
  const query = params.get('q') || '';
  const allowedModes = ['listed', 'excluded', 'general', 'groundbait'];
  const mode = allowedModes.includes(params.get('mode')) ? params.get('mode') : 'listed';
  const labels = [['listed', '正向清单'], ['excluded', '排除项（不是可用饵）'], ['general', '泛称（不展开 SKU）'], ['groundbait', '窝料偏好类别']];
  main.append(heading('从饵料找鱼', '反查文档列出的关系，不把“不吃”误算为可用，也不把泛称当完整商品清单。'),
    toolbar('bait', [inputField('搜索饵名或类别', 'q', query, 'search', { placeholder: '例如：蚯蚓、Gummi Makk、贻贝类' }),
      selectField('查询关系', 'mode', labels, mode)], '关键词匹配当前关系中的文字，不自动推断类别包含哪些商品。结果中的鱼仍受各自钓法限制。', {}, { mode }));
  const field = { listed: 'bait_listed', excluded: 'bait_excluded', general: 'bait_general', groundbait: 'groundbait' }[mode];
  const catalog = [...new Set(data.fish.flatMap(record => record[field]))].filter(item => api.includes(item, query)).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  main.append(element('section', { class: 'panel' }, element('h2', {}, '文档词条索引'),
    element('p', { class: 'muted' }, `${catalog.length} 个词条，点击即可反查。系列与类别保留原文名称。`),
    element('div', { class: 'catalog' }, baitLinks(catalog, mode))));
  if (!query.trim()) {
    main.append(element('p', { class: 'muted' }, '请搜索或点击一个词条。泛称和排除关系可通过上方“查询关系”切换。'));
    return;
  }
  const rows = data.fish.filter(record => api.reverseMatches(record, query, mode).length);
  main.append(resultsHeader(rows.length, `种鱼 · ${labels.find(([key]) => key === mode)[1]}`));
  if (mode === 'excluded') main.append(element('p', { class: 'panel conditions' }, '下面的鱼在原文中明确“不吃”匹配项，不是推荐使用。'));
  if (mode === 'general') main.append(element('p', { class: 'panel conditions' }, '仅展示原文泛称，不能据此断言某个具体饵可用。'));
  main.append(...(rows.length ? paginate(rows, params, records => element('ul', { class: 'link-list' }, records.map(record =>
    element('li', {}, link(record.name, href(`fish/${record.id}`)), element('p', {}, `匹配词条：${api.reverseMatches(record, query, mode).join('、')}`),
      element('p', { class: 'muted' }, record.restriction_raw ?? '限制资料暂缺'),
      element('small', {}, `${record.source_file} · 第 ${record.line_no} 行`))))) : [empty('当前关系中没有匹配词条。可缩短关键词或切换查询关系；没有记录不代表绝对无效。')]));
}

function gearPage(params) {
  const kind = params.get('kind') === 'reels' ? 'reels' : 'hooks';
  const rows = data[kind];
  const query = params.get('q') || '';
  const brand = params.get('brand') || '';
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const sort = params.get('sort') || 'source';
  const brands = [...new Set(rows.map(record => record.brand))].sort();
  main.append(heading('装备资料，不替你判配装', '按完整名称查询文档值。周年版、涂装及重复名称分别保留，不按简称或启发式系列合并。'),
    element('div', { class: 'chips' }, link('鱼钩资料', href('gear', { kind: 'hooks' }), 'button' + (kind === 'hooks' ? '' : ' secondary')),
      link('渔轮资料', href('gear', { kind: 'reels' }), 'button' + (kind === 'reels' ? '' : ' secondary'))),
    toolbar('gear', [inputField('搜索完整型号', 'q', query, 'search', { placeholder: '例如：Beluga Venga Classic 10000' }),
      selectField('品牌索引', 'brand', [['', '全部品牌'], ...brands.map(value => [value, value])], brand),
      inputField('最低文档 kg', 'min', min, 'number', { min: 0, step: 'any' }),
      inputField('最高文档 kg', 'max', max, 'number', { min: 0, step: 'any' }),
      selectField('排序', 'sort', [['source', '原文顺序'], ['asc', '文档值从低到高'], ['desc', '文档值从高到低'], ['name', '完整名称']], sort)],
    '鱼钩显示“钩拉力”，渔轮显示“轮锁轮拉力”，两者含义不同；品牌仅作名称索引。kg 范围不是鱼重范围，也不是配装合格线。', { kind }, { kind }));
  if (min !== '' && max !== '' && Number(min) > Number(max)) {
    main.append(empty('最低文档值不能高于最高值，请调整范围或重置。'));
    return;
  }
  const filtered = api.gearFilter(rows, { query, brand, min, max, sort });
  main.append(element('p', { class: 'hint' }, '鱼钩表包含不同钩型，不能把三本钩或铅头钩当通用底钓鱼钩。尺寸与系列解析不可靠时只认完整名称；普通号和 /0 号不套用统一强弱规则。'),
    resultsHeader(filtered.length, '条装备记录'));
  const label = kind === 'hooks' ? '钩拉力' : '轮锁轮拉力';
  const renderTable = records => element('div', { class: 'table-wrap' }, element('table', {},
    element('caption', {}, `${label}：用户文档值，不保证实机当前值。点击名称可核对原文。`),
    element('thead', {}, element('tr', {}, ['完整名称', `${label}（kg）`, '品牌索引', '来源行号'].map(text => element('th', { scope: 'col' }, text)))),
    element('tbody', {}, records.map(record => element('tr', {}, element('td', {}, link(record.name, href(`gear/${record.id}`))),
      element('td', {}, record.kg), element('td', {}, record.brand), element('td', {}, `${record.line_no} · ${record.id}`))))));
  main.append(...(filtered.length ? paginate(filtered, params, renderTable, 40) : [empty()]));
}

function gearDetail(id) {
  const record = [...data.hooks, ...data.reels].find(item => item.id === id);
  if (!record) return notFound();
  const kind = record.kind === 'hook' ? 'hooks' : 'reels';
  main.append(element('div', { class: 'breadcrumb' }, link('装备资料', href('gear', { kind })), ' / 原文记录'),
    heading(record.name, '保留原文完整名称，不按系列、尺寸或周年简称合并。'),
    element('section', { class: 'panel conditions' }, element('h2', {}, record.kind === 'hook' ? '文档钩拉力' : '文档轮锁轮拉力'),
      element('p', {}, `${record.kg} kg`), element('p', { class: 'hint' }, '不是鱼重上限，不表示此装备适合所有钓法，也不能据此判断完整钓组安全。')),
    source(record), link('按该完整名称搜索', href('gear', { kind, q: record.name })));
}

function aboutPage() {
  main.append(heading('这份教练怎么用', '先查原文，再判断是否适用于你的实际出钓场景。本站只提供只读资料查询。'));
  const section = (title, ...children) => element('section', { class: 'panel' }, element('h2', {}, title), children);
  main.append(element('div', { class: 'prose' },
    section('三步上手', element('ol', {}, element('li', {}, '在鱼种攻略搜索目标，先看详情中的限制条件。'),
      element('li', {}, '点击饵料或窝料类别，反查文档列出的关联鱼；注意正向、排除和泛称。'),
      element('li', {}, '查装备全名和文档拉力值；完整配装、钓场、重量仍需独立验证。'))),
    section('来源与可核对性', element('p', {}, `数据版 ${data.manifest.version}，结构版本 ${data.manifest.schema_version}。三份 TXT 均为用户提供的玩家整理资料，不是官方实机校准数据。原件未修改。`),
      data.manifest.sources.map(item => element('div', {}, element('h3', {}, `${item.file}（${item.records} 条）`),
        element('details', {}, element('summary', {}, '源文件 SHA-256'), element('pre', {}, item.sha256)))),
      element('p', {}, '每条记录保留文件名、行号、原文和类别＋行号 ID。行号 ID 对当前来源版本稳定；未来来源文件增删行时需显式迁移，不能按名称覆盖重复记录。')),
    section('我们明确不推断什么', element('ul', {},
      element('li', {}, '饵列表不是最优饵或成功率，未列出也不自动判为无效；窝料偏好不是配方。'),
      element('li', {}, '未写“仅挪威海”不等于淡水鱼；没有限制不等于支持所有钓法。'),
      element('li', {}, '不以鱼重乘固定系数推装备，不把锁轮 100 kg 当鱼重上限，不断言钩必须不小于轮锁轮拉力。'),
      element('li', {}, '不跨用 2020 Mono 反编译公式计算现行版本钓组天花板，不根据同拉力猜材质或钩型。'),
      element('li', {}, 'Beluga Venga Classic 10000 在用户表中为 100 kg；普通 Venga 10000 为 99 kg。它们是不同文档记录，不保证当前实机数值。'),
      element('li', {}, '不编造鱼价、每小时收益、重量纪录、钓点坐标或装备配方。'))),
    section('当前范围与后续', element('p', {}, '本版：鱼种攻略、饵料反查、装备资料。没有账号、后端、库存写入、自动采集或大模型聊天；不会启动游戏或读取凭据。查询条件保存在地址栏，不上传搜索内容。'),
      element('ol', {}, element('li', {}, '下一阶段补充有来源的钓场、钓位和重量，建立鱼种与钓场双向链接。'),
        element('li', {}, '资料足够后再做综合筛选、参考配装和出钓准备清单。'),
        element('li', {}, '之后可选个人收藏和钓组保存；库存、实测记录、收益分析和采集另议。')),
      element('p', {}, '扩展接口：鱼记录中的 location_ids、weights.common / maximum / record、equipment_recipe；清单中的 locations。空值就是尚未收录，不是零或已验证无。'))));
}

function notFound() {
  main.append(heading('这条资料暂未收录', '链接可能有误，或记录不属于当前资料版本。'), link('返回鱼种攻略', href('fish'), 'button'));
}

function render() {
  const { page, id, params } = api.route(location.hash);
  main.replaceChildren();
  for (const anchor of document.querySelectorAll('[data-nav]')) {
    if (anchor.dataset.nav === page) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  }
  if (page === 'fish') id ? fishDetail(id) : fishPage(params);
  else if (page === 'bait' && !id) baitPage(params);
  else if (page === 'gear') id ? gearDetail(id) : gearPage(params);
  else if (page === 'about' && !id) aboutPage();
  else notFound();
  window.scrollTo(0, 0);
}

async function start() {
  try {
    const names = ['fish', 'hooks', 'reels', 'manifest'];
    const loaded = await Promise.all(names.map(async name => {
      const response = await fetch(`../data/${name}.json`);
      if (!response.ok) throw new Error(`${name}.json：HTTP ${response.status}`);
      return response.json();
    }));
    data = Object.fromEntries(names.map((name, index) => [name, loaded[index]]));
    render();
    window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); });
  } catch (error) {
    main.replaceChildren(heading('资料暂时无法读取', '请通过本地 HTTP 服务打开 coach/web/，不要直接双击 HTML。'),
      element('pre', {}, '在工作区运行：python coach/serve.py'),
      element('p', {}, '若资料文件缺失，请按 README 重建数据后刷新。'), element('p', { class: 'muted' }, error.message));
  }
}

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView();
});
start();
