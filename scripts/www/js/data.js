/* ============================================================
 * 铁路工务智慧巡检系统 —— 数据层
 * 使用 localStorage 实现本地持久化，包含默认示例数据。
 * ============================================================ */
(function (w) {
  'use strict';
  var PREFIX = 'tlgw_';

  function load(key, def) {
    try {
      var raw = w.localStorage.getItem(PREFIX + key);
      if (raw === null) return def;
      return JSON.parse(raw);
    } catch (e) { return def; }
  }
  function save(key, val) {
    w.localStorage.setItem(PREFIX + key, JSON.stringify(val));
  }
  function uid() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function todayStr(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /* ---------- 默认种子数据 ---------- */
  var seed = {
    users: [
      { id: 'u1', username: 'admin', password: '123456', name: '系统管理员', role: '管理员', station: '第一养护站' },
      { id: 'u2', username: 'zhangsan', password: '123456', name: '张三', role: '站长', station: '第一养护站' }
    ],
    station: {
      name: '第一养护站', code: 'YHZ-001', address: '北京市丰台区铁路工务段东侧',
      director: '张三', phone: '010-12345678', established: '2005-03-15',
      area: 'K1200+000 ~ K1260+000', staffCount: 36,
      facilities: '站房2栋、材料库1座、机械设备库1座、职工宿舍1栋',
      remark: '主要负责京广线K1200~K1260区段的日常养护与巡检工作。',
      photo: ''
    },
    staff: [
      { id: 's1', name: '张三', gender: '男', position: '站长', phone: '13800000001', station: '第一养护站', joinDate: '2005-06-01' },
      { id: 's2', name: '李四', gender: '男', position: '技术员', phone: '13800000002', station: '第一养护站', joinDate: '2010-03-12' },
      { id: 's3', name: '王五', gender: '男', position: '线路工', phone: '13800000003', station: '第一养护站', joinDate: '2012-08-20' },
      { id: 's4', name: '赵六', gender: '男', position: '线路工', phone: '13800000004', station: '第一养护站', joinDate: '2015-04-05' },
      { id: 's5', name: '孙七', gender: '女', position: '内勤', phone: '13800000005', station: '第一养护站', joinDate: '2018-09-01' }
    ],
    roads: [
      { id: 'r1', code: 'JGX-K1200', name: '京广线K1200-K1210段', startPile: 'K1200+000', endPile: 'K1210+000', length: 10, level: '一级', type: '正线', station: '第一养护站' },
      { id: 'r2', code: 'JGX-K1210', name: '京广线K1210-K1220段', startPile: 'K1210+000', endPile: 'K1220+000', length: 10, level: '一级', type: '正线', station: '第一养护站' },
      { id: 'r3', code: 'JGX-K1220', name: '京广线K1220-K1240段', startPile: 'K1220+000', endPile: 'K1240+000', length: 20, level: '一级', type: '正线', station: '第一养护站' },
      { id: 'r4', code: 'ZTX-K0', name: '站内专用线', startPile: 'K0+000', endPile: 'K2+500', length: 2.5, level: '二级', type: '站线', station: '第一养护站' }
    ],
    bridges: [
      { id: 'b1', code: 'QL-001', name: '永定河大桥', location: 'K1205+200', length: 320, type: '钢梁桥', status: '良好', station: '第一养护站' },
      { id: 'b2', code: 'QL-002', name: '凉水河大桥', location: 'K1222+800', length: 180, type: '钢筋混凝土桥', status: '良好', station: '第一养护站' }
    ],
    culverts: [
      { id: 'c1', code: 'HD-001', name: 'K1203+500涵洞', location: 'K1203+500', length: 25, type: '盖板涵', status: '良好', station: '第一养护站' },
      { id: 'c2', code: 'HD-002', name: 'K1230+200涵洞', location: 'K1230+200', length: 30, type: '拱涵', status: '一般', station: '第一养护站' }
    ],
    tunnels: [
      { id: 't1', code: 'SD-001', name: '云岗隧道', location: 'K1240+100', length: 1200, status: '良好', station: '第一养护站' }
    ],
    machines: [
      { id: 'm1', code: 'JX-001', name: '捣固机', model: 'YD-32', count: 2, status: '正常', station: '第一养护站' },
      { id: 'm2', code: 'JX-002', name: '起拨道机', model: 'YQB-2', count: 1, status: '维修中', station: '第一养护站' },
      { id: 'm3', code: 'JX-003', name: '钢轨打磨机', model: 'NM-2', count: 3, status: '正常', station: '第一养护站' }
    ],
    materials: [
      { id: 'mt1', code: 'CL-001', name: '钢轨夹板', spec: '60kg/m', unit: '副', stock: 120, warn: 30, station: '第一养护站' },
      { id: 'mt2', code: 'CL-002', name: '道钉', spec: '5×25', unit: '个', stock: 5000, warn: 500, station: '第一养护站' },
      { id: 'mt3', code: 'CL-003', name: '扣件', spec: '弹条Ⅱ型', unit: '套', stock: 800, warn: 200, station: '第一养护站' }
    ],
    workOrders: [],
    tempWorks: [
      { id: 'tw1', date: todayStr(-1), name: '临时工-王师傅', content: '配合清筛作业', hours: 8, station: '第一养护站' }
    ],
    machineUses: [
      { id: 'mu1', date: todayStr(-1), machine: '捣固机', user: '李四', hours: 4, purpose: '线路捣固', station: '第一养护站' }
    ],
    materialUses: [
      { id: 'mau1', date: todayStr(-1), material: '道钉', count: 120, user: '王五', purpose: '线路养护', station: '第一养护站' }
    ],
    surveys: [
      { id: 'sv1', road: '京广线K1200-K1210段', project: '路面', person: '李四', date: todayStr(-3), startPile: 'K1200+000', endPile: 'K1201+000', segCount: 10, scores: [95,92,88,90,85,82,80,78,90,86], total: 86.6, grade: '优', station: '第一养护站' }
    ],
    patrolLogs: [
      { id: 'p1', date: todayStr(-1), staff: '王五', weather: '晴', line: '京广线K1200-K1210段', content: '巡视正常，钢轨、道床状态良好。' }
    ],
    patrolProblems: [
      { id: 'pp1', date: todayStr(-2), source: '上级检查', line: '京广线K1203', issue: '个别扣件松动', level: '一般', status: '待处理', handle: '', station: '第一养护站' }
    ],
    weather: [
      { date: todayStr(-1), am: '晴', pm: '多云' }
    ]
  };


  /* 派工单种子（今天/昨天/前天） */
  var wd = todayStr(0), yd = todayStr(-1), qd = todayStr(-2);
  seed.workOrders = [
    { id: 'w1', date: qd, name: '李四', content: '线路巡检', road: '京广线K1200-K1210段', type: '生产工', remark: '重点检查道床' },
    { id: 'w2', date: qd, name: '王五', content: '捣固作业', road: '京广线K1220-K1240段', type: '生产工', remark: '' },
    { id: 'w3', date: qd, name: '赵六', content: '休息', road: '', type: '休息', remark: '' },
    { id: 'w4', date: yd, name: '李四', content: '线路巡检', road: '京广线K1200-K1210段', type: '生产工', remark: '' },
    { id: 'w5', date: yd, name: '王五', content: '钢轨打磨', road: '京广线K1210-K1220段', type: '生产工', remark: '' },
    { id: 'w6', date: yd, name: '赵六', content: '特勤值守', road: '永定河大桥', type: '特勤工', remark: '' },
    { id: 'w7', date: wd, name: '李四', content: '线路巡检', road: '京广线K1200-K1210段', type: '生产工', remark: '' },
    { id: 'w8', date: wd, name: '王五', content: '道床清筛', road: '京广线K1220-K1240段', type: '生产工', remark: '' },
    { id: 'w9', date: wd, name: '孙七', content: '内勤值班', road: '第一养护站', type: '特勤工', remark: '' }
  ];

  var db = {};
  function ensure() {
    Object.keys(seed).forEach(function (k) {
      db[k] = load(k, seed[k]);
      save(k, db[k]);
    });
  }
  function get(k) { return db[k]; }
  function put(k, val) { db[k] = val; save(k, val); }

  w.DB = {
    load: load, save: save, uid: uid, todayStr: todayStr,
    ensure: ensure, get: get, put: put
  };
})(window);
