(function (root) {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  const includes = (value, query) => normalize(value).includes(normalize(query));
  const filters = [
    ['', '全部条件'], ['bottom_fishing', '原文提及底钓条件'],
    ['sea_only', '仅挪威海'], ['hand_or_fight_rod', '仅手竿或搏鱼竿'],
    ['trolling', '含拖钓条件'], ['jig_step', '含阶梯动作条件'],
    ['float_upright', '含立漂条件'], ['drift', '含顺水漂流条件'],
    ['pits', '有坑区限制'], ['depth2', '饵深至少 2 米'],
  ];
  function fishMatches(record, query = '', condition = '') {
    if (!includes(record.name, query)) return false;
    if (condition === 'depth2') return record.restriction.depth_operator === '>=' && record.restriction.min_bait_depth_m === 2;
    return !condition || Boolean(record.restriction[condition]);
  }
  function reverseMatches(record, query, mode = 'listed') {
    const fields = { listed: 'bait_listed', excluded: 'bait_excluded', general: 'bait_general', groundbait: 'groundbait' };
    return (record[fields[mode]] || []).filter(item => includes(item, query));
  }
  function suggestions(rows, query, condition = '') {
    const characters = [...new Set(normalize(query))];
    if (!characters.length) return [];
    return rows.filter(record => fishMatches(record, '', condition))
      .map(record => ({ record, score: characters.filter(character => normalize(record.name).includes(character)).length }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score || left.record.line_no - right.record.line_no)
      .slice(0, 5).map(item => item.record);
  }
  function gearFilter(rows, options = {}) {
    const { query = '', brand = '', min = '', max = '', sort = 'source' } = options;
    const result = rows.filter(record => includes(record.name, query) && (!brand || record.brand === brand)
      && (min === '' || record.kg >= Number(min)) && (max === '' || record.kg <= Number(max)));
    if (sort === 'asc') result.sort((left, right) => left.kg - right.kg || left.line_no - right.line_no);
    if (sort === 'desc') result.sort((left, right) => right.kg - left.kg || left.line_no - right.line_no);
    if (sort === 'name') result.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN') || left.line_no - right.line_no);
    return result;
  }
  function route(hash) {
    const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
    const [page = 'fish', id] = (path || 'fish').split('/');
    return { page, id, params: new URLSearchParams(query) };
  }
  const api = { normalize, includes, filters, fishMatches, reverseMatches, gearFilter, route, suggestions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Coach = api;
})(globalThis);
