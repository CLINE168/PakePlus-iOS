/* ============================================================
 * 铁路工务智慧巡检系统 —— 应用逻辑
 * 依赖：data.js
 * ============================================================ */
(function (w) {
  'use strict';
  var DB = w.DB;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var esc = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var currentUser = null;

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------------- Modal ---------------- */
  function openModal(title, bodyHtml, footHtml, lg) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    $('#modalFoot').innerHTML = footHtml || '';
    var box = $('#modalBox');
    box.classList.toggle('modal-lg', !!lg);
    $('#modalMask').classList.remove('hidden');
  }
  function closeModal() { $('#modalMask').classList.add('hidden'); }

  /* ---------------- 通用小工具 ---------------- */
  function tag(text, cls) { return '<span class="tag ' + (cls || 'tag-gray') + '">' + esc(text) + '</span>'; }
  function actionBtns(rowId, extra) {
    var h = '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + rowId + '">修改</button> ' +
            '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + rowId + '">删除</button>';
    return h + (extra || '');
  }
  function confirmDel(msg, cb) {
    if (!w.confirm(msg)) return;
    cb();
  }
  function option(sel, arr, val, textKey) {
    return arr.map(function (o) {
      var v = o[val], t = o[textKey || 'name'];
      return '<option value="' + esc(v) + '">' + esc(t) + '</option>';
    }).join('');
  }
  /* 生成验证码 */
  var captchaText = '';
  function drawCaptcha() {
    var c = $('#captchaCanvas');
    if (!c) return;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#eef4fa'; ctx.fillRect(0, 0, c.width, c.height);
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    captchaText = '';
    for (var i = 0; i < 4; i++) captchaText += chars[Math.floor(Math.random() * chars.length)];
    for (var j = 0; j < 5; j++) {
      ctx.strokeStyle = 'rgba(27,107,176,0.3)';
      ctx.beginPath();
      ctx.moveTo(Math.random() * c.width, Math.random() * c.height);
      ctx.lineTo(Math.random() * c.width, Math.random() * c.height);
      ctx.stroke();
    }
    for (var k = 0; k < 4; k++) {
      ctx.font = 'bold ' + (20 + Math.floor(Math.random() * 6)) + 'px Arial';
      ctx.fillStyle = ['#1b6bb0', '#e07b00', '#1a9e5a', '#d33'][k % 4];
      ctx.save();
      ctx.translate(12 + k * 20, 24);
      ctx.rotate((Math.random() - 0.5) * 0.6);
      ctx.fillText(captchaText[k], 0, 0);
      ctx.restore();
    }
  }

  /* ============================================================
   * 菜单定义
   * ============================================================ */
  var MENU = [
    { group: '基本情况', items: [
      { key: 'station', name: '养护站基本信息' },
      { key: 'staff', name: '职工信息' },
      { key: 'roads', name: '管养路段信息' },
      { key: 'bridges', name: '管养桥梁信息' },
      { key: 'culverts', name: '管养涵洞信息' },
      { key: 'tunnels', name: '管养隧道信息' },
      { key: 'machines', name: '机械设备台账' },
      { key: 'materials', name: '库存材料' }
    ] },
    { group: '日常管理', items: [
      { key: 'workorders', name: '派工单' },
      { key: 'tempwork', name: '临时用工' },
      { key: 'attendance', name: '出工出勤情况' },
      { key: 'machineuse', name: '机械使用登记' },
      { key: 'materialuse', name: '材料使用登记' }
    ] },
    { group: '铁路技术状况', items: [
      { key: 'survey', name: '技术状况调查' },
      { key: 'surveydetail', name: '技术状况明细表' },
      { key: 'surveysummary', name: '技术状况汇总表' },
      { key: 'realstatus', name: '实时铁路技术状况' }
    ] },
    { group: '巡查管理', items: [
      { key: 'patrollog', name: '铁路巡查日志录入' },
      { key: 'patrolproblem', name: '巡查问题管理' }
    ] }
  ];

  function buildMenu() {
    var nav = $('#menu');
    nav.innerHTML = MENU.map(function (g) {
      var items = g.items.map(function (it) {
        return '<div class="menu-item" data-key="' + it.key + '">' + esc(it.name) + '</div>';
      }).join('');
      return '<div class="menu-group open" data-group="' + g.group + '">' +
             '<div class="menu-group-head">' + esc(g.group) + '<span class="arrow">▶</span></div>' + items + '</div>';
    }).join('');
  }

  function setActive(key) {
    $$('.menu-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-key') === key);
    });
  }

  var MODULE_TITLES = {};
  MENU.forEach(function (g) { g.items.forEach(function (it) { MODULE_TITLES[it.key] = it.name; }); });
  var App = {
    current: null,
    setToolbar: function (html) { $('#toolbar').innerHTML = html; },
    setPanel: function (html) { $('#panel').innerHTML = html; }
  };
  w.App = App;

  /* ============================================================
   * 通用 CRUD 模块
   * ============================================================ */
  function makeCrudModule(key, cfg) {
    var list = function () { return DB.get(key); };
    function saveAll(arr) { DB.put(key, arr); }
    var head = '<tr><th style="width:40px">序号</th>' +
      cfg.columns.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
      '<th style="width:150px">操作</th></tr>';
    function rows(filter) {
      var arr = list().filter(function (r) {
        if (!filter) return true;
        return (r[cfg.filterKey] || '').indexOf(filter) !== -1;
      });
      if (!arr.length) return '<tr><td colspan="' + (cfg.columns.length + 2) + '"><div class="empty">暂无数据，请点击“新建”添加</div></td></tr>';
      return arr.map(function (r, i) {
        var tds = cfg.columns.map(function (c) {
          var v = r[c.key];
          return '<td>' + (c.render ? c.render(v, r) : esc(v)) + '</td>';
        }).join('');
        return '<tr><td>' + (i + 1) + '</td>' + tds + '<td>' + actionBtns(r.id) + '</td></tr>';
      }).join('');
    }
    App[key] = {
      render: function () {
        App.current = key; setActive(key);
        App.setToolbar('<span class="tb-title">' + esc(MODULE_TITLES[key]) + '</span>' +
          (cfg.filterKey ? '<input type="search" placeholder="输入' + esc(cfg.filterLabel || '关键字') + '过滤查询" data-act="filter">' : '') +
          '<button class="btn btn-primary" data-act="new">新建</button>');
        App.setPanel('<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' + rows('') + '</tbody></table></div>');
      },
      renderRows: function (filter) {
        $('#panel').innerHTML = '<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' + rows(filter || '') + '</tbody></table></div>';
      },
      form: function (row) {
        var f = cfg.fields.map(function (fl) {
          var val = row ? (row[fl.key] !== undefined ? row[fl.key] : '') : (fl.default !== undefined ? fl.default : '');
          var inp;
          if (fl.type === 'select') {
            var opts = '<option value="">请选择</option>' + fl.options.map(function (o) {
              return '<option value="' + esc(o.value) + '"' + (String(val) === String(o.value) ? ' selected' : '') + '>' + esc(o.name) + '</option>';
            }).join('');
            inp = '<select data-k="' + fl.key + '">' + opts + '</select>';
          } else if (fl.type === 'textarea') {
            inp = '<textarea data-k="' + fl.key + '">' + esc(val) + '</textarea>';
          } else {
            inp = '<input type="' + (fl.type || 'text') + '" data-k="' + fl.key + '" value="' + esc(val) + '">';
          }
          return '<div class="form-group ' + (fl.full ? 'full' : '') + '"><label>' + esc(fl.label) + (fl.required ? ' *' : '') + '</label>' + inp +
            (fl.hint ? '<div class="hint">' + esc(fl.hint) + '</div>' : '') + '</div>';
        }).join('');
        openModal((row ? '修改' : '新建') + esc(cfg.title), '<div class="form-grid">' + f + '</div>',
          '<button class="btn btn-ghost" data-act="cancel">取消</button><button class="btn btn-primary" data-act="ok">保存</button>');
      },
      save: function (rowId) {
        var data = {};
        $$('#modalBody [data-k]').forEach(function (el) { data[el.getAttribute('data-k')] = el.value; });
        var arr = list();
        if (rowId) {
          var idx = arr.findIndex(function (x) { return x.id === rowId; });
          if (idx > -1) { arr[idx] = Object.assign({}, arr[idx], data); }
        } else {
          data.id = DB.uid();
          if (cfg.defaults) Object.assign(data, cfg.defaults());
          arr.push(data);
        }
        saveAll(arr); closeModal(); App[key].render(); toast('保存成功');
      },
      del: function (rowId) {
        confirmDel('确定删除这条记录吗？', function () {
          saveAll(list().filter(function (x) { return x.id !== rowId; }));
          App[key].render(); toast('已删除');
        });
      }
    };
  }

  /* ---------- 职工信息 ---------- */
  makeCrudModule('staff', {
    title: '职工信息', filterKey: 'name', filterLabel: '职工姓名',
    columns: [
      { key: 'name', label: '姓名' }, { key: 'gender', label: '性别' },
      { key: 'position', label: '职务' }, { key: 'phone', label: '联系电话' },
      { key: 'station', label: '所属养护站' }, { key: 'joinDate', label: '入职日期' }
    ],
    fields: [
      { key: 'name', label: '姓名', required: true },
      { key: 'gender', label: '性别', type: 'select', options: [{ name: '男', value: '男' }, { name: '女', value: '女' }] },
      { key: 'position', label: '职务' },
      { key: 'phone', label: '联系电话' },
      { key: 'station', label: '所属养护站', default: '第一养护站' },
      { key: 'joinDate', label: '入职日期', type: 'date' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 管养路段信息 ---------- */
  makeCrudModule('roads', {
    title: '管养路段信息', filterKey: 'name', filterLabel: '路段编号或名称',
    columns: [
      { key: 'code', label: '路段编号' }, { key: 'name', label: '路段名称' },
      { key: 'startPile', label: '起点桩号' }, { key: 'endPile', label: '终点桩号' },
      { key: 'length', label: '长度(km)' }, { key: 'level', label: '等级' }, { key: 'type', label: '类型' }
    ],
    fields: [
      { key: 'code', label: '路段编号', required: true, hint: '新增/修改的管养路段不能与已有路段重复' },
      { key: 'name', label: '路段名称', required: true },
      { key: 'startPile', label: '起点桩号' },
      { key: 'endPile', label: '终点桩号' },
      { key: 'length', label: '长度(km)', type: 'number' },
      { key: 'level', label: '等级', type: 'select', options: [{ name: '一级', value: '一级' }, { name: '二级', value: '二级' }, { name: '三级', value: '三级' }] },
      { key: 'type', label: '类型', type: 'select', options: [{ name: '正线', value: '正线' }, { name: '站线', value: '站线' }, { name: '专用线', value: '专用线' }] },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 管养桥梁信息 ---------- */
  makeCrudModule('bridges', {
    title: '管养桥梁信息', filterKey: 'name', filterLabel: '桥梁编号或名称',
    columns: [
      { key: 'code', label: '桥梁编号' }, { key: 'name', label: '桥梁名称' },
      { key: 'location', label: '所在位置' }, { key: 'length', label: '长度(m)' },
      { key: 'type', label: '类型' }, { key: 'status', label: '状态' }
    ],
    fields: [
      { key: 'code', label: '桥梁编号', required: true },
      { key: 'name', label: '桥梁名称', required: true },
      { key: 'location', label: '所在位置' },
      { key: 'length', label: '长度(m)', type: 'number' },
      { key: 'type', label: '类型', type: 'select', options: [{ name: '钢梁桥', value: '钢梁桥' }, { name: '钢筋混凝土桥', value: '钢筋混凝土桥' }, { name: '预应力桥', value: '预应力桥' }] },
      { key: 'status', label: '状态', type: 'select', options: [{ name: '良好', value: '良好' }, { name: '一般', value: '一般' }, { name: '较差', value: '较差' }] },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 管养涵洞信息 ---------- */
  makeCrudModule('culverts', {
    title: '管养涵洞信息', filterKey: 'name', filterLabel: '涵洞编号或名称',
    columns: [
      { key: 'code', label: '涵洞编号' }, { key: 'name', label: '涵洞名称' },
      { key: 'location', label: '所在位置' }, { key: 'length', label: '长度(m)' },
      { key: 'type', label: '类型' }, { key: 'status', label: '状态' }
    ],
    fields: [
      { key: 'code', label: '涵洞编号', required: true },
      { key: 'name', label: '涵洞名称', required: true },
      { key: 'location', label: '所在位置' },
      { key: 'length', label: '长度(m)', type: 'number' },
      { key: 'type', label: '类型', type: 'select', options: [{ name: '盖板涵', value: '盖板涵' }, { name: '拱涵', value: '拱涵' }, { name: '圆管涵', value: '圆管涵' }] },
      { key: 'status', label: '状态', type: 'select', options: [{ name: '良好', value: '良好' }, { name: '一般', value: '一般' }, { name: '较差', value: '较差' }] },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 管养隧道信息 ---------- */
  makeCrudModule('tunnels', {
    title: '管养隧道信息', filterKey: 'name', filterLabel: '隧道编号或名称',
    columns: [
      { key: 'code', label: '隧道编号' }, { key: 'name', label: '隧道名称' },
      { key: 'location', label: '所在位置' }, { key: 'length', label: '长度(m)' },
      { key: 'status', label: '状态' }
    ],
    fields: [
      { key: 'code', label: '隧道编号', required: true },
      { key: 'name', label: '隧道名称', required: true },
      { key: 'location', label: '所在位置' },
      { key: 'length', label: '长度(m)', type: 'number' },
      { key: 'status', label: '状态', type: 'select', options: [{ name: '良好', value: '良好' }, { name: '一般', value: '一般' }, { name: '较差', value: '较差' }] },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 机械设备台账 ---------- */
  makeCrudModule('machines', {
    title: '机械设备台账', filterKey: 'name', filterLabel: '设备名称',
    columns: [
      { key: 'code', label: '设备编号' }, { key: 'name', label: '设备名称' },
      { key: 'model', label: '型号' }, { key: 'count', label: '数量' },
      { key: 'status', label: '状态' }
    ],
    fields: [
      { key: 'code', label: '设备编号', required: true },
      { key: 'name', label: '设备名称', required: true },
      { key: 'model', label: '型号' },
      { key: 'count', label: '数量', type: 'number' },
      { key: 'status', label: '状态', type: 'select', options: [{ name: '正常', value: '正常' }, { name: '维修中', value: '维修中' }, { name: '停用', value: '停用' }] },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 库存材料 ---------- */
  makeCrudModule('materials', {
    title: '库存材料', filterKey: 'name', filterLabel: '材料名称',
    columns: [
      { key: 'code', label: '材料编号' }, { key: 'name', label: '材料名称' },
      { key: 'spec', label: '规格' }, { key: 'unit', label: '单位' },
      { key: 'stock', label: '库存数量', render: function (v, r) { return v + (Number(v) <= Number(r.warn) ? ' ' + tag('库存不足', 'tag-orange') : ''); } },
      { key: 'warn', label: '预警值' }
    ],
    fields: [
      { key: 'code', label: '材料编号', required: true },
      { key: 'name', label: '材料名称', required: true },
      { key: 'spec', label: '规格' },
      { key: 'unit', label: '单位' },
      { key: 'stock', label: '库存数量', type: 'number' },
      { key: 'warn', label: '预警值', type: 'number' },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 养护站基本信息 ---------- */
  App.station = {
    render: function () {
      App.current = 'station'; setActive('station');
      var s = DB.get('station');
      App.setToolbar('<span class="tb-title">养护站基本信息</span>' +
        '<button class="btn btn-primary" data-act="editStation">保存修改 / 更换照片</button>');
      var img = s.photo ? '<img src="' + esc(s.photo) + '">' : '🚞';
      var fields = [
        ['养护站名称', s.name], ['单位编码', s.code], ['单位地址', s.address],
        ['负责人', s.director], ['联系电话', s.phone], ['建站日期', s.established],
        ['管养范围', s.area], ['职工人数', s.staffCount]
      ];
      var kvs = fields.map(function (f) { return '<div class="kv"><b>' + f[0] + '：</b>' + esc(f[1]) + '</div>'; }).join('');
      App.setPanel(
        '<div class="info-cards">' +
        '<div class="info-card"><div class="card-img">' + img + '</div><div class="card-body"><div class="card-title">' + esc(s.name) + '</div>' + kvs + '</div></div>' +
        '<div class="info-card"><div class="card-body"><div class="card-title">主要设施情况</div><div class="kv"><b>设施：</b>' + esc(s.facilities) + '</div><div class="kv" style="white-space:normal"><b>备注：</b>' + esc(s.remark) + '</div></div></div>' +
        '</div>');
    },
    edit: function () {
      var s = DB.get('station');
      var f = [
        ['name', '养护站名称', 'text'], ['code', '单位编码', 'text'], ['address', '单位地址', 'text'],
        ['director', '负责人', 'text'], ['phone', '联系电话', 'text'], ['established', '建站日期', 'date'],
        ['area', '管养范围', 'text'], ['staffCount', '职工人数', 'number']
      ].map(function (x) {
        return '<div class="form-group"><label>' + x[1] + '</label><input type="' + x[2] + '" data-k="' + x[0] + '" value="' + esc(s[x[0]]) + '"></div>';
      }).join('');
      var full = '<div class="form-group full"><label>主要设施情况</label><input data-k="facilities" value="' + esc(s.facilities) + '"></div>' +
                 '<div class="form-group full"><label>备注</label><textarea data-k="remark">' + esc(s.remark) + '</textarea></div>' +
                 '<div class="form-group full"><label>更换照片（输入图片地址，可留空）</label><input data-k="photo" value="' + esc(s.photo) + '"></div>';
      openModal('编辑养护站基本信息', '<div class="form-grid">' + f + full + '</div>',
        '<button class="btn btn-ghost" data-act="cancel">取消</button><button class="btn btn-primary" data-act="saveStation">保存</button>');
    },
    save: function () {
      var data = {};
      $$('#modalBody [data-k]').forEach(function (el) { data[el.getAttribute('data-k')] = el.value; });
      var cur = DB.get('station');
      DB.put('station', Object.assign({}, cur, data));
      closeModal(); App.station.render(); toast('保存成功');
    }
  };

  /* ---------- 临时用工 ---------- */
  makeCrudModule('tempwork', {
    title: '临时用工', filterKey: 'name', filterLabel: '用工姓名',
    columns: [
      { key: 'date', label: '日期' }, { key: 'name', label: '姓名' },
      { key: 'content', label: '工作内容' }, { key: 'hours', label: '工时(小时)' }
    ],
    fields: [
      { key: 'date', label: '日期', type: 'date', default: DB.todayStr() },
      { key: 'name', label: '姓名', required: true },
      { key: 'content', label: '工作内容' },
      { key: 'hours', label: '工时(小时)', type: 'number' },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 机械使用登记 ---------- */
  makeCrudModule('machineuse', {
    title: '机械使用登记', filterKey: 'machine', filterLabel: '机械名称',
    columns: [
      { key: 'date', label: '日期' }, { key: 'machine', label: '机械名称' },
      { key: 'user', label: '使用人' }, { key: 'hours', label: '使用工时' },
      { key: 'purpose', label: '用途' }
    ],
    fields: [
      { key: 'date', label: '日期', type: 'date', default: DB.todayStr() },
      { key: 'machine', label: '机械名称', required: true },
      { key: 'user', label: '使用人', required: true },
      { key: 'hours', label: '使用工时', type: 'number' },
      { key: 'purpose', label: '用途' },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ---------- 材料使用登记 ---------- */
  makeCrudModule('materialuse', {
    title: '材料使用登记', filterKey: 'material', filterLabel: '材料名称',
    columns: [
      { key: 'date', label: '日期' }, { key: 'material', label: '材料名称' },
      { key: 'count', label: '使用数量' }, { key: 'user', label: '使用人' },
      { key: 'purpose', label: '用途' }
    ],
    fields: [
      { key: 'date', label: '日期', type: 'date', default: DB.todayStr() },
      { key: 'material', label: '材料名称', required: true },
      { key: 'count', label: '使用数量', type: 'number' },
      { key: 'user', label: '使用人' },
      { key: 'purpose', label: '用途' },
      { key: 'station', label: '所属养护站', default: '第一养护站' }
    ],
    defaults: function () { return { station: '第一养护站' }; }
  });

  /* ============================================================
   * 派工单
   * ============================================================ */
  var WORK_TYPES = ['生产工', '特勤工', '休息'];
  var WORK_CONTENTS = ['线路巡检', '捣固作业', '钢轨打磨', '道床清筛', '换轨作业', '特勤值守', '内勤值班', '休息', '缺勤', '其他'];

  App.workorders = {
    state: { date: DB.todayStr(), type: '全部' },
    toolbar: function () {
      return '<span class="tb-title">派工单</span>' +
        '<button class="btn btn-ghost btn-sm" data-act="wdPrev">◀</button>' +
        '<input type="date" data-act="wdDate" value="' + this.state.date + '">' +
        '<button class="btn btn-ghost btn-sm" data-act="wdNext">▶</button>' +
        '<select data-act="wdType">' +
          '<option value="全部"' + (this.state.type === '全部' ? ' selected' : '') + '>全部派工</option>' +
          '<option value="生产工"' + (this.state.type === '生产工' ? ' selected' : '') + '>生产工派工</option>' +
          '<option value="特勤工"' + (this.state.type === '特勤工' ? ' selected' : '') + '>特勤工派工</option>' +
          '<option value="休息"' + (this.state.type === '休息' ? ' selected' : '') + '>休息/缺勤派工</option>' +
        '</select>' +
        '<button class="btn btn-ghost btn-sm" data-act="wdWeather">天气录入</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="wdCopy">复制派工</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="wdExport">导出</button>' +
        '<button class="btn btn-primary" data-act="new">新建派工</button>';
    },
    getDateOrders: function () {
      var list = DB.get('workOrders').filter(function (o) { return o.date === this.state.date; }, this);
      if (this.state.type !== '全部') list = list.filter(function (o) { return o.type === this.state.type; }, this);
      return list;
    },
    render: function () {
      App.current = 'workorders'; setActive('workorders');
      App.setToolbar(this.toolbar());
      var list = this.getDateOrders();
      var w = DB.get('weather').find(function (x) { return x.date === this.state.date; });
      var weatherStr = w ? ('上午：' + (w.am || '-') + '　下午：' + (w.pm || '-')) : '未录入';
      var rowsHtml = list.map(function (o, i) {
        var typeTag = o.type === '生产工' ? tag(o.type, 'tag-green') : (o.type === '特勤工' ? tag(o.type, 'tag-blue') : tag(o.type, 'tag-gray'));
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(o.name) + '</td><td>' + esc(o.content) + '</td>' +
          '<td>' + esc(o.road) + '</td><td>' + typeTag + '</td><td>' + esc(o.remark) + '</td>' +
          '<td>' + actionBtns(o.id) + '</td></tr>';
      }).join('');
      App.setPanel(
        '<div class="stat-grid">' +
          '<div class="stat-box"><div class="num" style="font-size:16px">' + this.state.date + '</div><div class="lab">当前派工日期</div></div>' +
          '<div class="stat-box"><div class="num">' + list.length + '</div><div class="lab">当日派工条数</div></div>' +
          '<div class="stat-box"><div class="num">' + list.filter(function (o) { return o.type === '生产工'; }).length + '</div><div class="lab">生产工</div></div>' +
          '<div class="stat-box"><div class="num">' + list.filter(function (o) { return o.type === '特勤工'; }).length + '</div><div class="lab">特勤工</div></div>' +
          '<div class="stat-box"><div class="num">' + list.filter(function (o) { return o.type === '休息'; }).length + '</div><div class="lab">休息/缺勤</div></div>' +
          '<div class="stat-box"><div class="num" style="font-size:14px">' + esc(weatherStr) + '</div><div class="lab">当日天气</div></div>' +
        '</div>' +
        '<div class="table-wrap"><table><thead><tr><th>序号</th><th>姓名</th><th>工作项目</th><th>作业路段</th><th>类别</th><th>备注</th><th style="width:150px">操作</th></tr></thead>' +
        '<tbody>' + (rowsHtml || '<tr><td colspan="7"><div class="empty">当日暂无派工信息</div></td></tr>') + '</tbody></table></div>');
    },
    form: function (row) {
      var staff = DB.get('staff');
      var roads = DB.get('roads');
      var staffOpts = '<option value="">请选择职工</option>' + staff.map(function (s) { return '<option value="' + esc(s.name) + '">' + esc(s.name) + '（' + esc(s.position) + '）</option>'; }).join('');
      var contentOpts = '<option value="">请选择工作项目</option>' + WORK_CONTENTS.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
      var roadOpts = '<option value="">请选择作业路段</option>' + roads.map(function (r) { return '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>'; }).join('');
      var typeOpts = '<option value="">请选择类别</option>' + WORK_TYPES.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
      function buildSelect(key, opts, val) {
        var html = opts.replace(/(<option value="[^"]*")/g, function (a, g) {
          var v = g.match(/value="([^"]*)"/)[1];
          return g + (String(val) === String(v) ? ' selected' : '');
        });
        return '<select data-k="' + key + '">' + html + '</select>';
      }
      var body = '<div class="form-grid">' +
        '<div class="form-group"><label>派工日期</label><input type="date" data-k="date" value="' + esc(row ? row.date : this.state.date) + '"></div>' +
        '<div class="form-group"><label>姓名 *</label>' + buildSelect('name', staffOpts, row && row.name) + '</div>' +
        '<div class="form-group"><label>工作项目 *</label>' + buildSelect('content', contentOpts, row && row.content) + '</div>' +
        '<div class="form-group"><label>作业路段</label>' + buildSelect('road', roadOpts, row && row.road) + '</div>' +
        '<div class="form-group"><label>类别</label>' + buildSelect('type', typeOpts, row && row.type) + '</div>' +
        '<div class="form-group full"><label>备注</label><textarea data-k="remark">' + esc(row ? row.remark : '') + '</textarea></div>' +
        '</div>';
      openModal((row ? '修改' : '新增') + '派工', body,
        '<button class="btn btn-ghost" data-act="cancel">取消</button><button class="btn btn-primary" data-act="ok">保存</button>');
    },
    save: function (rowId) {
      var data = {};
      $$('#modalBody [data-k]').forEach(function (el) { data[el.getAttribute('data-k')] = el.value; });
      if (!data.name || !data.content) { toast('请选择姓名和工作项目'); return; }
      var arr = DB.get('workOrders');
      if (rowId) {
        var idx = arr.findIndex(function (x) { return x.id === rowId; });
        if (idx > -1) arr[idx] = Object.assign({}, arr[idx], data);
      } else { data.id = DB.uid(); arr.push(data); }
      DB.put('workOrders', arr); closeModal(); App.workorders.render(); toast('保存成功');
    },
    del: function (rowId) {
      confirmDel('确定删除这条派工信息吗？', function () {
        DB.put('workOrders', DB.get('workOrders').filter(function (x) { return x.id !== rowId; }));
        App.workorders.render(); toast('已删除');
      });
    },
    weather: function () {
      var w = DB.get('weather').find(function (x) { return x.date === this.state.date; }, this) || {};
      var opts = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '小雪', '中雪', '大风', '雾'];
      function sel(key, val) {
        return '<select data-k="' + key + '">' + opts.map(function (o) {
          return '<option value="' + o + '"' + (w[key] === o ? ' selected' : '') + '>' + o + '</option>';
        }).join('') + '</select>';
      }
      var body = '<div class="form-grid">' +
        '<div class="form-group"><label>日期</label><input data-k="date" value="' + this.state.date + '" readonly></div>' +
        '<div class="form-group"><label>上午天气</label>' + sel('am', w.am) + '</div>' +
        '<div class="form-group"><label>下午天气</label>' + sel('pm', w.pm) + '</div>' +
        '</div>';
      openModal('天气录入（' + this.state.date + '）', body,
        '<button class="btn btn-ghost" data-act="cancel">取消</button><button class="btn btn-primary" data-act="saveWeather">保存</button>');
    },
    saveWeather: function () {
      var data = {};
      $$('#modalBody [data-k]').forEach(function (el) { data[el.getAttribute('data-k')] = el.value; });
      var arr = DB.get('weather');
      var idx = arr.findIndex(function (x) { return x.date === data.date; });
      if (idx > -1) arr[idx] = Object.assign({}, arr[idx], data);
      else { data.id = DB.uid(); arr.push(data); }
      DB.put('weather', arr); closeModal(); App.workorders.render(); toast('天气已保存');
    },
    copy: function () {
      var src = this.state.date;
      var body = '<div class="form-grid">' +
        '<div class="form-group"><label>源日期</label><input value="' + src + '" readonly></div>' +
        '<div class="form-group"><label>复制到日期</label><input type="date" data-k="target" value="' + src + '"></div>' +
        '</div><div class="hint" style="font-size:12px;color:#999">将源日期的派工单复制到目标日期（含全部类别）。</div>';
      openModal('复制派工', body,
        '<button class="btn btn-ghost" data-act="cancel">取消</button><button class="btn btn-primary" data-act="doCopy">是，开始复制</button>');
    },
    doCopy: function () {
      var target = $('#modalBody [data-k=target]').value;
      if (!target) { toast('请选择目标日期'); return; }
      var src = this.state.date;
      var all = DB.get('workOrders');
      var srcs = all.filter(function (o) { return o.date === src; });
      if (!srcs.length) { toast('源日期无派工可复制'); return; }
      var existNames = all.filter(function (o) { return o.date === target; }).map(function (o) { return o.name; });
      srcs.forEach(function (o) {
        if (existNames.indexOf(o.name) === -1) {
          all.push(Object.assign({}, o, { id: DB.uid(), date: target }));
        }
      });
      DB.put('workOrders', all); closeModal(); toast('已复制 ' + srcs.length + ' 条派工到 ' + target);
      this.state.date = target; this.render();
    },
    exportCsv: function () {
      var list = this.getDateOrders();
      var header = ['序号', '姓名', '工作项目', '作业路段', '类别', '备注'];
      var lines = [header.join(',')];
      list.forEach(function (o, i) {
        lines.push([i + 1, o.name, o.content, o.road, o.type, o.remark].map(function (v) {
          return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        }).join(','));
      });
      var csv = '\ufeff' + lines.join('\r\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '派工单_' + this.state.date + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('已导出 Excel(CSV) 文件');
    }
  };

  /* ============================================================
   * 出工出勤情况统计
   * ============================================================ */
  App.attendance = {
    state: { start: DB.todayStr(-6), end: DB.todayStr() },
    render: function () {
      App.current = 'attendance'; setActive('attendance');
      App.setToolbar('<span class="tb-title">出工出勤情况</span>' +
        '<input type="date" data-act="atStart" value="' + this.state.start + '">' +
        '<span>至</span>' +
        '<input type="date" data-act="atEnd" value="' + this.state.end + '">' +
        '<button class="btn btn-ghost btn-sm" data-act="atQuery">查询</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="atExport">导出</button>');
      this.build();
    },
    rangeDates: function () {
      var out = [], cur = new Date(this.state.start), end = new Date(this.state.end);
      while (cur <= end) {
        var m = String(cur.getMonth() + 1).padStart(2, '0'), d = String(cur.getDate()).padStart(2, '0');
        out.push(cur.getFullYear() + '-' + m + '-' + d);
        cur.setDate(cur.getDate() + 1);
      }
      return out;
    },
    build: function () {
      var staff = DB.get('staff');
      var orders = DB.get('workOrders');
      var dates = this.rangeDates();
      var dateSet = {};
      orders.forEach(function (o) { dateSet[o.date + '|' + o.name] = o.type; });
      var head = '<tr><th>姓名</th><th>职务</th>' + dates.map(function (d) { return '<th style="min-width:44px">' + d.slice(5) + '</th>'; }).join('') +
        '<th>出勤</th><th>生产工</th><th>特勤工</th><th>休息/缺勤</th></tr>';
      var body = staff.map(function (s) {
        var cell = dates.map(function (d) {
          var t = dateSet[d + '|' + s.name] || '';
          var cls = t === '生产工' ? 'tag-green' : (t === '特勤工' ? 'tag-blue' : (t === '休息' ? 'tag-gray' : 'tag-gray'));
          return '<td>' + (t ? tag(t.charAt(0), cls) : '<span style="color:#ccc">-</span>') + '</td>';
        }).join('');
        var p = orders.filter(function (o) { return o.name === s.name && dates.indexOf(o.date) > -1 && o.type === '生产工'; }).length;
        var sp = orders.filter(function (o) { return o.name === s.name && dates.indexOf(o.date) > -1 && o.type === '特勤工'; }).length;
        var r = orders.filter(function (o) { return o.name === s.name && dates.indexOf(o.date) > -1 && o.type === '休息'; }).length;
        return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.position) + '</td>' + cell +
          '<td><b>' + (p + sp) + '</b></td><td>' + p + '</td><td>' + sp + '</td><td>' + r + '</td></tr>';
      }).join('');
      var inRange = orders.filter(function (o) { return dates.indexOf(o.date) > -1; });
      var stat = '<div class="stat-grid">' +
        '<div class="stat-box"><div class="num">' + staff.length + '</div><div class="lab">职工人数</div></div>' +
        '<div class="stat-box"><div class="num">' + inRange.filter(function (o) { return o.type !== '休息'; }).length + '</div><div class="lab">出勤人次</div></div>' +
        '<div class="stat-box"><div class="num">' + inRange.filter(function (o) { return o.type === '生产工'; }).length + '</div><div class="lab">生产工出勤</div></div>' +
        '<div class="stat-box"><div class="num">' + inRange.filter(function (o) { return o.type === '特勤工'; }).length + '</div><div class="lab">特勤工出勤</div></div>' +
        '<div class="stat-box"><div class="num">' + inRange.filter(function (o) { return o.type === '休息'; }).length + '</div><div class="lab">休息/缺勤</div></div>' +
        '</div>';
      App.setPanel(stat + '<div class="table-wrap" style="overflow:auto"><table><thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="' + (dates.length + 7) + '"><div class="empty">暂无数据</div></td></tr>') + '</tbody></table></div>');
    },
    exportCsv: function () {
      var staff = DB.get('staff');
      var orders = DB.get('workOrders');
      var dates = this.rangeDates();
      var dateSet = {};
      orders.forEach(function (o) { dateSet[o.date + '|' + o.name] = o.type; });
      var lines = [['姓名', '职务'].concat(dates, ['出勤', '生产工', '特勤工', '休息/缺勤']).join(',')];
      staff.forEach(function (s) {
        var row = [s.name, s.position];
        var p = 0, sp = 0, r = 0;
        dates.forEach(function (d) {
          var t = dateSet[d + '|' + s.name] || '';
          row.push(t || '-');
          if (t === '生产工') p++; else if (t === '特勤工') sp++; else if (t === '休息') r++;
        });
        row.push(p + sp, p, sp, r);
        lines.push(row.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
      });
      var csv = '\ufeff' + lines.join('\r\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      a.download = '出工出勤统计_' + this.state.start + '_' + this.state.end + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('已导出 Excel(CSV) 文件');
    }
  };

  /* ============================================================
   * 技术状况调查
   * ============================================================ */
  var SURVEY_PROJECTS = ['路面', '路基', '桥隧构造物', '沿线设施'];
  function parsePile(str) {
    if (!str) return null;
    var m = String(str).match(/([Kk]?)(\d+)\+?(\d+)?/);
    if (!m) return null;
    return parseInt(m[2], 10) * 1000 + (m[3] ? parseInt(m[3], 10) : 0);
  }
  function gradeOf(avg) {
    if (avg >= 90) return '优';
    if (avg >= 80) return '良';
    if (avg >= 70) return '中';
    return '差';
  }

  App.survey = {
    state: { road: '', project: '路面', person: '', date: DB.todayStr(), startPile: '', endPile: '' },
    render: function () {
      App.current = 'survey'; setActive('survey');
      var roads = DB.get('roads');
      var roadOpts = '<option value="">请选择调查线路</option>' + roads.map(function (r) {
        return '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>';
      }).join('');
      var projOpts = SURVEY_PROJECTS.map(function (p) {
        return '<option value="' + p + '"' + (this.state.project === p ? ' selected' : '') + '>' + p + '</option>';
      }, this).join('');
      App.setToolbar('<span class="tb-title">铁路技术状况调查</span>' +
        '<button class="btn btn-primary" data-act="startSurvey">开始调查</button>');
      App.setPanel(
        '<div class="table-wrap" style="padding:20px"><div class="form-grid">' +
        '<div class="form-group"><label>调查线路 *</label><select data-act="svRoad">' + roadOpts + '</select></div>' +
        '<div class="form-group"><label>调查项目 *</label><select data-act="svProject">' + projOpts + '</select></div>' +
        '<div class="form-group"><label>调查人员</label><input data-act="svPerson" value="' + esc(this.state.person) + '"></div>' +
        '<div class="form-group"><label>调查时间</label><input type="date" data-act="svDate" value="' + this.state.date + '"></div>' +
        '<div class="form-group"><label>起点桩号（如 K1200+000）</label><input data-act="svStart" value="' + esc(this.state.startPile) + '" placeholder="K1200+000"></div>' +
        '<div class="form-group"><label>终点桩号（如 K1202+000）</label><input data-act="svEnd" value="' + esc(this.state.endPile) + '" placeholder="K1202+000"></div>' +
        '</div>' +
        '<div class="hint" style="margin-top:14px;font-size:13px;color:#666">选择调查线路、调查项目，填写调查人员、调查时间、起点桩号与终点桩号后，点击上方“开始调查”按钮，系统弹出铁路技术状况评定表，按每公里一段（每段100米）进行评分。</div>' +
        '</div>');
    },
    begin: function () {
      var road = $('[data-act=svRoad]').value;
      var project = $('[data-act=svProject]').value;
      var person = $('[data-act=svPerson]').value;
      var date = $('[data-act=svDate]').value;
      var start = $('[data-act=svStart]').value;
      var end = $('[data-act=svEnd]').value;
      var s = parsePile(start), e = parsePile(end);
      if (!road) { toast('请选择调查线路'); return; }
      if (s === null || e === null) { toast('起点/终点桩号格式不正确'); return; }
      if (e < s) { toast('终点桩号应不小于起点桩号'); return; }
      var segCount = Math.max(1, Math.ceil((e - s) / 100));
      if (segCount > 200) { toast('调查范围过大，请按每公里分段调查'); return; }
      this.state.road = road; this.state.project = project; this.state.person = person;
      this.state.date = date; this.state.startPile = start; this.state.endPile = end;
      this.buildTable(segCount, s);
    },
    buildTable: function (segCount, baseMeters) {
      var rows = [];
      for (var i = 0; i < segCount; i++) {
        var m = baseMeters + i * 100;
        var pile = 'K' + Math.floor(m / 1000) + '+' + String(m % 1000).padStart(3, '0');
        var kmGroup = Math.floor(i / 10) + 1;
        rows.push('<tr><td>' + (i + 1) + '</td><td>' + kmGroup + '公里·第' + (i % 10 + 1) + '段</td><td>' + pile + '</td>' +
          '<td><input type="number" min="0" max="100" data-score="' + i + '" value="80"></td></tr>');
      }
      var body = '<div class="table-wrap score-table" style="margin-bottom:12px"><table>' +
        '<thead><tr><th>段号</th><th>位置</th><th>桩号</th><th>评分(0-100)</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
        '<div class="seg-nav"><button class="btn btn-ghost" data-act="allAvg">计算当前评分</button><span id="avgResult">当前：—</span></div>';
      openModal('铁路技术状况评定表（' + this.state.road + '·' + this.state.project + '）', body, '', true);
      $('#modalFoot').innerHTML = '<button class="btn btn-ghost" data-act="cancel">取消</button>' +
        '<button class="btn btn-primary" data-act="svSave">保存评定</button>';
      this.compute();
    },
    compute: function () {
      var inputs = $$('#modalBody [data-score]');
      var sum = 0, n = inputs.length;
      if (!n) return;
      inputs.forEach(function (el) { sum += Number(el.value) || 0; });
      var avg = Math.round(sum / n * 10) / 10;
      var el = $('#avgResult');
      if (el) { el.innerHTML = '当前综合评分：<b>' + avg + '</b>　' + '<span class="grade-badge grade-' + gradeOf(avg) + '">' + gradeOf(avg) + '</span>'; }
    },
    save: function () {
      var inputs = $$('#modalBody [data-score]');
      var scores = inputs.map(function (el) { return Number(el.value) || 0; });
      var sum = scores.reduce(function (a, b) { return a + b; }, 0);
      var avg = Math.round(sum / scores.length * 10) / 10;
      var rec = {
        id: DB.uid(), road: this.state.road, project: this.state.project,
        person: this.state.person, date: this.state.date,
        startPile: this.state.startPile, endPile: this.state.endPile,
        segCount: scores.length, scores: scores, total: avg, grade: gradeOf(avg),
        station: '第一养护站'
      };
      var arr = DB.get('surveys'); arr.push(rec); DB.put('surveys', arr);
      closeModal(); toast('评定结果已保存：综合评分 ' + avg + '（' + gradeOf(avg) + '）');
    }
  };

  /* ============================================================
   * 技术状况明细表
   * ============================================================ */
  App.surveydetail = {
    state: { road: '全部' },
    render: function () {
      App.current = 'surveydetail'; setActive('surveydetail');
      var roads = DB.get('roads');
      var roadOpts = '<option value="全部">全部线路</option>' + roads.map(function (r) {
        return '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>';
      }).join('');
      App.setToolbar('<span class="tb-title">技术状况明细表</span>' +
        '<select data-act="sdRoad">' + roadOpts + '</select>' +
        '<button class="btn btn-primary" data-act="sdQuery">查询</button>');
      this.build();
    },
    build: function () {
      var surveys = DB.get('surveys');
      if (this.state.road !== '全部') surveys = surveys.filter(function (s) { return s.road === this.state.road; }, this);
      surveys = surveys.sort(function (a, b) { return b.date < a.date ? -1 : (b.date > a.date ? 1 : 0); });
      var head = '<tr><th>调查时间</th><th>线路</th><th>调查项目</th><th>调查人员</th><th>桩号范围</th><th>段数</th><th>综合评分</th><th>等级</th><th style="width:90px">明细</th></tr>';
      var body = surveys.map(function (s) {
        return '<tr><td>' + esc(s.date) + '</td><td>' + esc(s.road) + '</td><td>' + esc(s.project) + '</td><td>' + esc(s.person) + '</td>' +
          '<td>' + esc(s.startPile) + ' ~ ' + esc(s.endPile) + '</td><td>' + s.segCount + '</td>' +
          '<td><b>' + s.total + '</b></td><td>' + tag(s.grade, 'tag-blue') + '</td>' +
          '<td><span class="link" data-act="svDetail" data-id="' + s.id + '">查看明细</span></td></tr>';
      }).join('');
      App.setPanel('<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' +
        (body || '<tr><td colspan="9"><div class="empty">暂无技术评定明细，请先在“技术状况调查”中完成调查</div></td></tr>') + '</tbody></table></div>');
    },
    showDetail: function (id) {
      var s = DB.get('surveys').find(function (x) { return x.id === id; });
      if (!s) return;
      var rows = s.scores.map(function (sc, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + (Math.floor(i / 10) + 1) + '公里·第' + (i % 10 + 1) + '段</td><td>' + sc + '</td></tr>';
      }).join('');
      openModal('技术评定明细（' + s.road + '·' + s.project + '）',
        '<div class="table-wrap score-table"><table><thead><tr><th>段号</th><th>位置</th><th>评分</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div style="margin-top:14px">综合评分：<b>' + s.total + '</b>　等级：<span class="grade-badge grade-' + s.grade + '">' + s.grade + '</span></div>',
        '<button class="btn btn-ghost" data-act="cancel">关闭</button>', true);
    }
  };

  /* ============================================================
   * 技术状况汇总表
   * ============================================================ */
  App.surveysummary = {
    render: function () {
      App.current = 'surveysummary'; setActive('surveysummary');
      var surveys = DB.get('surveys');
      var summary = {};
      surveys.forEach(function (s) {
        if (!summary[s.road]) summary[s.road] = { projects: {} };
        summary[s.road].projects[s.project] = s;
      });
      var head = '<tr><th>线路</th>' + SURVEY_PROJECTS.map(function (p) { return '<th>' + p + '评分</th>'; }).join('') + '<th>综合评分</th><th>等级</th></tr>';
      var body = Object.keys(summary).map(function (key) {
        var row = summary[key];
        var cells = SURVEY_PROJECTS.map(function (p) {
          var s = row.projects[p];
          return '<td>' + (s ? s.total : '-') + '</td>';
        }).join('');
        var vals = SURVEY_PROJECTS.map(function (p) { return row.projects[p] ? row.projects[p].total : null; }).filter(function (v) { return v !== null; });
        var avg = vals.length ? Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length * 10) / 10 : null;
        var g = avg !== null ? gradeOf(avg) : '';
        return '<tr><td>' + esc(row.road) + '</td>' + cells + '<td><b>' + (avg !== null ? avg : '-') + '</b></td>' +
          '<td>' + (g ? '<span class="grade-badge grade-' + g + '">' + g + '</span>' : '-') + '</td></tr>';
      }).join('');
      App.setToolbar('<span class="tb-title">技术状况汇总表</span>' +
        '<button class="btn btn-ghost btn-sm" data-act="smExport">导出</button>');
      App.setPanel('<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' +
        (body || '<tr><td colspan="6"><div class="empty">暂无汇总数据</div></td></tr>') + '</tbody></table></div>');
    },
    exportCsv: function () {
      var surveys = DB.get('surveys');
      var summary = {};
      surveys.forEach(function (s) {
        if (!summary[s.road]) summary[s.road] = { projects: {} };
        summary[s.road].projects[s.project] = s.total;
      });
      var lines = [['线路'].concat(SURVEY_PROJECTS, ['综合评分', '等级']).join(',')];
      Object.keys(summary).forEach(function (road) {
        var row = [road];
        var vals = [];
        SURVEY_PROJECTS.forEach(function (p) { var v = summary[road].projects[p] || ''; row.push(v); if (v !== '') vals.push(Number(v)); });
        var avg = vals.length ? Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length * 10) / 10 : '';
        row.push(avg, avg !== '' ? gradeOf(avg) : '');
        lines.push(row.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
      });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
      a.download = '技术状况汇总表.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('已导出 Excel(CSV) 文件');
    }
  };

  /* ============================================================
   * 实时铁路技术状况
   * ============================================================ */
  App.realstatus = {
    render: function () {
      App.current = 'realstatus'; setActive('realstatus');
      App.setToolbar('<span class="tb-title">实时铁路技术状况</span>' +
        '<select data-act="rsStation"><option value="第一养护站">第一养护站</option></select>');
      var surveys = DB.get('surveys');
      var roads = DB.get('roads');
      var latest = {};
      surveys.forEach(function (s) {
        if (!latest[s.road] || s.date > latest[s.road].date) latest[s.road] = s;
      });
      var rows = roads.map(function (r) {
        var sv = latest[r.name];
        var statusText = !sv ? '未评定' : (sv.grade === '优' || sv.grade === '良' ? '良好' : (sv.grade === '中' ? '一般' : '较差'));
        var statusTag = !sv ? tag('未评定', 'tag-gray') : (statusText === '良好' ? tag(statusText, 'tag-green') : (statusText === '一般' ? tag(statusText, 'tag-orange') : tag(statusText, 'tag-red')));
        return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.startPile) + ' ~ ' + esc(r.endPile) + '</td><td>' + esc(r.length) + ' km</td>' +
          '<td>' + (sv ? '<b>' + sv.total + '</b>' : '-') + '</td>' +
          '<td>' + (sv ? tag(sv.project + '·' + sv.date, 'tag-blue') : '-') + '</td>' +
          '<td>' + (sv ? '<span class="grade-badge grade-' + sv.grade + '">' + sv.grade + '</span>' : '-') + '</td>' +
          '<td>' + statusTag + '</td></tr>';
      }).join('');
      var head = '<tr><th>线路</th><th>桩号范围</th><th>长度</th><th>最新评分</th><th>调查信息</th><th>等级</th><th>实时状况</th></tr>';
      App.setPanel('<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' +
        (rows || '<tr><td colspan="7"><div class="empty">暂无线路数据</div></td></tr>') + '</tbody></table></div>');
    }
  };

  /* ============================================================
   * 巡查管理：铁路巡查日志录入
   * ============================================================ */
  App.patrollog = {
    render: function () {
      App.current = 'patrollog'; setActive('patrollog');
      App.setToolbar('<span class="tb-title">铁路巡查日志录入</span>' +
        '<button class="btn btn-primary" data-act="new">新建日志</button>');
      var logs = DB.get('patrolLogs').sort(function (a, b) { return b.date < a.date ? -1 : (b.date > a.date ? 1 : 0); });
      var head = '<tr><th>日期</th><th>巡查人员</th><th>天气</th><th>巡查线路</th><th style="min-width:200px">日志内容</th><th style="width:150px">操作</th></tr>';
      var body = logs.map(function (l) {
        return '<tr><td>' + esc(l.date) + '</td><td>' + esc(l.staff) + '</td><td>' + esc(l.weather) + '</td><td>' + esc(l.line) + '</td>' +
          '<td style="white-space:normal">' + esc(l.content) + '</td><td>' + actionBtns(l.id) + '</td></tr>';
      }).join('');
      App.setPanel('<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' +
        (body || '<tr><td colspan="6"><div class="empty">暂无巡查日志</div></td></tr>') + '</tbody></table></div>');
    },
    form: function (row) {
      var staff = DB.get('staff');
      var staffOpts = '<option value="">请选择</option>' + staff.map(function (s) { return '<option value="' + esc(s.name) + '">' + esc(s.name) + '</option>'; }).join('');
      function buildSelect(key, opts, val) {
        var html = opts.replace(/(<option value="[^"]*")/g, function (a, g) {
          return g + (String(val) === String(g.match(/value="([^"]*)"/)[1]) ? ' selected' : '');
        });
        return '<select data-k="' + key + '">' + html + '</select>';
      }
      var body = '<div class="form-grid">' +
        '<div class="form-group"><label>日期</label><input type="date" data-k="date" value="' + esc(row ? row.date : DB.todayStr()) + '"></div>' +
        '<div class="form-group"><label>巡查人员</label>' + buildSelect('staff', staffOpts, row && row.staff) + '</div>' +
        '<div class="form-group"><label>天气</label>' + buildSelect('weather', ['晴', '多云', '阴', '小雨', '中雨', '大风'].map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join(''), row && row.weather) + '</div>' +
        '<div class="form-group"><label>巡查线路</label>' + buildSelect('line', '<option value="">请选择</option>' + DB.get('roads').map(function (r) { return '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>'; }).join(''), row && row.line) + '</div>' +
        '<div class="form-group full"><label>日志内容</label><textarea data-k="content">' + esc(row ? row.content : '') + '</textarea></div>' +
        '</div>';
      openModal((row ? '修改' : '新建') + '巡查日志', body,
        '<button class="btn btn-ghost" data-act="cancel">取消</button><button class="btn btn-primary" data-act="ok">保存</button>');
    },
    save: function (rowId) {
      var data = {};
      $$('#modalBody [data-k]').forEach(function (el) { data[el.getAttribute('data-k')] = el.value; });
      var arr = DB.get('patrolLogs');
      if (rowId) {
        var idx = arr.findIndex(function (x) { return x.id === rowId; });
        if (idx > -1) arr[idx] = Object.assign({}, arr[idx], data);
      } else { data.id = DB.uid(); arr.push(data); }
      DB.put('patrolLogs', arr); closeModal(); App.patrollog.render(); toast('保存成功');
    },
    del: function (rowId) {
      confirmDel('确定删除这条巡查日志吗？', function () {
        DB.put('patrolLogs', DB.get('patrolLogs').filter(function (x) { return x.id !== rowId; }));
        App.patrollog.render(); toast('已删除');
      });
    }
  };

  /* ============================================================
   * 巡查管理：巡查问题管理
   * ============================================================ */
  App.patrolproblem = {
    render: function () {
      App.current = 'patrolproblem'; setActive('patrolproblem');
      App.setToolbar('<span class="tb-title">巡查问题管理</span>' +
        '<button class="btn btn-primary" data-act="new">登记问题</button>');
      var list = DB.get('patrolProblems').sort(function (a, b) { return b.date < a.date ? -1 : (b.date > a.date ? 1 : 0); });
      function statusTag(s) {
        if (s === '已处理') return tag(s, 'tag-green');
        if (s === '处理中') return tag(s, 'tag-orange');
        return tag(s, 'tag-red');
      }
      var head = '<tr><th>日期</th><th>来源</th><th>线路/位置</th><th>问题描述</th><th>级别</th><th>状态</th><th>处理结果</th><th style="width:150px">操作</th></tr>';
      var body = list.map(function (p) {
        var lvl = p.level === '重大' ? tag(p.level, 'tag-red') : (p.level === '一般' ? tag(p.level, 'tag-orange') : tag(p.level, 'tag-gray'));
        return '<tr><td>' + esc(p.date) + '</td><td>' + esc(p.source) + '</td><td>' + esc(p.line) + '</td>' +
          '<td style="white-space:normal">' + esc(p.issue) + '</td><td>' + lvl + '</td><td>' + statusTag(p.status) + '</td>' +
          '<td style="white-space:normal">' + esc(p.handle) + '</td><td>' + actionBtns(p.id) + '</td></tr>';
      }).join('');
      App.setPanel('<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' +
        (body || '<tr><td colspan="8"><div class="empty">暂无巡查问题，可对上级部门发现的问题进行登记与处理</div></td></tr>') + '</tbody></table></div>');
    },
    form: function (row) {
      var sel = function (key, opts, val) {
        var html = '<option value="">请选择</option>' + opts.map(function (o) {
          return '<option value="' + o + '"' + (String(val) === String(o) ? ' selected' : '') + '>' + o + '</option>';
        }).join('');
        return '<select data-k="' + key + '">' + html + '</select>';
      };
      var body = '<div class="form-grid">' +
        '<div class="form-group"><label>日期</label><input type="date" data-k="date" value="' + esc(row ? row.date : DB.todayStr()) + '"></div>' +
        '<div class="form-group"><label>来源</label><input data-k="source" value="' + esc(row ? row.source : '上级检查') + '"></div>' +
        '<div class="form-group"><label>线路/位置</label><input data-k="line" value="' + esc(row ? row.line : '') + '"></div>' +
        '<div class="form-group"><label>级别</label>' + sel('level', ['重大', '一般', '轻微'], row && row.level) + '</div>' +
        '<div class="form-group full"><label>问题描述</label><textarea data-k="issue">' + esc(row ? row.issue : '') + '</textarea></div>' +
        '<div class="form-group"><label>状态</label>' + sel('status', ['待处理', '处理中', '已处理'], row && row.status) + '</div>' +
        '<div class="form-group full"><label>处理结果</label><textarea data-k="handle">' + esc(row ? row.handle : '') + '</textarea></div>' +
        '</div>';
      openModal((row ? '修改' : '登记') + '巡查问题', body,
        '<button class="btn btn-ghost" data-act="cancel">取消</button><button class="btn btn-primary" data-act="ok">保存</button>');
    },
    save: function (rowId) {
      var data = {};
      $$('#modalBody [data-k]').forEach(function (el) { data[el.getAttribute('data-k')] = el.value; });
      var arr = DB.get('patrolProblems');
      if (rowId) {
        var idx = arr.findIndex(function (x) { return x.id === rowId; });
        if (idx > -1) arr[idx] = Object.assign({}, arr[idx], data);
      } else { data.id = DB.uid(); arr.push(data); }
      DB.put('patrolProblems', arr); closeModal(); App.patrolproblem.render(); toast('保存成功');
    },
    del: function (rowId) {
      confirmDel('确定删除这条问题吗？', function () {
        DB.put('patrolProblems', DB.get('patrolProblems').filter(function (x) { return x.id !== rowId; }));
        App.patrolproblem.render(); toast('已删除');
      });
    }
  };

  /* ============================================================
   * 事件绑定与登录
   * ============================================================ */
  var editId = null;
  var GENERIC = ['staff', 'roads', 'bridges', 'culverts', 'tunnels', 'machines', 'materials', 'tempwork', 'machineuse', 'materialuse'];

  function findRow(key, id) {
    return DB.get(key).find(function (x) { return x.id === id; });
  }
  function fmt(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dd;
  }
  function navigate(key) {
    var mod = App[key];
    if (!mod || !mod.render) { toast('功能不存在'); return; }
    mod.render();
  }

  function handleToolbar(act, el) {
    var cur = App.current;
    if (cur === 'workorders') {
      if (act === 'new') { editId = null; App.workorders.form(null); }
      else if (act === 'wdPrev') { var d = new Date(App.workorders.state.date); d.setDate(d.getDate() - 1); App.workorders.state.date = fmt(d); App.workorders.render(); }
      else if (act === 'wdNext') { var d2 = new Date(App.workorders.state.date); d2.setDate(d2.getDate() + 1); App.workorders.state.date = fmt(d2); App.workorders.render(); }
      else if (act === 'wdDate') { App.workorders.state.date = el.value; App.workorders.render(); }
      else if (act === 'wdType') { App.workorders.state.type = el.value; App.workorders.render(); }
      else if (act === 'wdWeather') { App.workorders.weather(); }
      else if (act === 'wdCopy') { App.workorders.copy(); }
      else if (act === 'wdExport') { App.workorders.exportCsv(); }
    } else if (cur === 'attendance') {
      if (act === 'atStart') { App.attendance.state.start = el.value; }
      else if (act === 'atEnd') { App.attendance.state.end = el.value; }
      else if (act === 'atQuery') { App.attendance.build(); toast('已查询'); }
      else if (act === 'atExport') { App.attendance.exportCsv(); }
    } else if (cur === 'survey') {
      if (act === 'startSurvey') { App.survey.begin(); }
      else if (act === 'svRoad') { App.survey.state.road = el.value; }
      else if (act === 'svProject') { App.survey.state.project = el.value; }
      else if (act === 'svPerson') { App.survey.state.person = el.value; }
      else if (act === 'svDate') { App.survey.state.date = el.value; }
      else if (act === 'svStart') { App.survey.state.startPile = el.value; }
      else if (act === 'svEnd') { App.survey.state.endPile = el.value; }
      else if (act === 'allAvg') { App.survey.compute(); }
      else if (act === 'svSave') { App.survey.save(); }
    } else if (cur === 'surveydetail') {
      if (act === 'sdRoad') { App.surveydetail.state.road = el.value; }
      else if (act === 'sdQuery') { App.surveydetail.build(); toast('已查询'); }
    } else if (cur === 'surveysummary') {
      if (act === 'smExport') { App.surveysummary.exportCsv(); }
    } else if (cur === 'station') {
      if (act === 'editStation') { App.station.edit(); }
      else if (act === 'saveStation') { App.station.save(); }
    } else if (cur === 'patrollog') {
      if (act === 'new') { editId = null; App.patrollog.form(null); }
    } else if (cur === 'patrolproblem') {
      if (act === 'new') { editId = null; App.patrolproblem.form(null); }
    }
    if (GENERIC.indexOf(cur) > -1) {
      if (act === 'new') { editId = null; App[cur].form(null); }
      else if (act === 'filter') { App[cur].renderRows(el.value); }
    }
  }

  function handleRowAction(act, el) {
    var cur = App.current;
    var id = el.getAttribute('data-id');
    if (act === 'edit') {
      editId = id;
      if (GENERIC.indexOf(cur) > -1) { App[cur].form(findRow(cur, id)); }
      else if (cur === 'workorders') { App.workorders.form(findRow('workOrders', id)); }
      else if (cur === 'patrollog') { App.patrollog.form(findRow('patrolLogs', id)); }
      else if (cur === 'patrolproblem') { App.patrolproblem.form(findRow('patrolProblems', id)); }
    } else if (act === 'del') {
      if (GENERIC.indexOf(cur) > -1) { App[cur].del(id); }
      else if (cur === 'workorders') { App.workorders.del(id); }
      else if (cur === 'patrollog') { App.patrollog.del(id); }
      else if (cur === 'patrolproblem') { App.patrolproblem.del(id); }
    } else if (act === 'svDetail') {
      App.surveydetail.showDetail(id);
    }
  }

  function handleModal(act) {
    if (act === 'cancel') { closeModal(); return; }
    if (act === 'ok') {
      var cur = App.current;
      if (GENERIC.indexOf(cur) > -1) App[cur].save(editId);
      else if (cur === 'workorders') App.workorders.save(editId);
      else if (cur === 'patrollog') App.patrollog.save(editId);
      else if (cur === 'patrolproblem') App.patrolproblem.save(editId);
    } else if (act === 'saveStation') { App.station.save(); }
    else if (act === 'saveWeather') { App.workorders.saveWeather(); }
    else if (act === 'doCopy') { App.workorders.doCopy(); }
    else if (act === 'svSave') { App.survey.save(); }
    else if (act === 'allAvg') { App.survey.compute(); }
  }

  /* 登录 */
  function doLogin() {
    var u = $('#loginUser').value.trim();
    var p = $('#loginPass').value;
    var c = $('#loginCode').value.trim();
    if (!u || !p) { $('#loginError').textContent = '请输入用户名和密码'; return; }
    if (c.toLowerCase() !== captchaText.toLowerCase()) { $('#loginError').textContent = '验证码错误，请重新输入'; drawCaptcha(); $('#loginCode').value = ''; return; }
    var user = DB.get('users').find(function (x) { return x.username === u && x.password === p; });
    if (!user) { $('#loginError').textContent = '用户名或密码错误'; drawCaptcha(); return; }
    currentUser = user;
    App.survey.state.person = user.name;
    $('#loginOverlay').classList.add('hidden');
    $('#mainApp').classList.remove('hidden');
    $('#topUser').textContent = '👤 ' + user.name + '（' + user.role + '）';
    navigate('station');
    toast('欢迎登录，' + user.name);
  }
  function doLogout() {
    currentUser = null;
    $('#mainApp').classList.add('hidden');
    $('#loginOverlay').classList.remove('hidden');
    $('#loginUser').value = ''; $('#loginPass').value = ''; $('#loginCode').value = '';
    $('#loginError').textContent = '';
    drawCaptcha();
  }

  /* ---------- 事件委托 ---------- */
  function bindEvents() {
    $('#menu').addEventListener('click', function (e) {
      var g = e.target.closest('.menu-group-head');
      if (g) { g.parentElement.classList.toggle('open'); return; }
      var it = e.target.closest('.menu-item');
      if (it) navigate(it.getAttribute('data-key'));
    });
    $('#toolbar').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) handleToolbar(b.getAttribute('data-act'), b);
    });
    $('#toolbar').addEventListener('change', function (e) {
      var t = e.target.closest('[data-act]');
      if (t) handleToolbar(t.getAttribute('data-act'), t);
    });
    $('#panel').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) handleRowAction(b.getAttribute('data-act'), b);
    });
    $('#modalFoot').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) handleModal(b.getAttribute('data-act'));
    });
    $('#modalBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b) handleModal(b.getAttribute('data-act'));
    });
    $('#modalBody').addEventListener('input', function (e) {
      if (e.target && e.target.hasAttribute('data-score') && App.current === 'survey') {
        clearTimeout(window.__svT);
        window.__svT = setTimeout(function () { App.survey.compute(); }, 300);
      }
    });
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalMask').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    $('#loginBtn').addEventListener('click', doLogin);
    $('#loginPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('#loginCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $('#captchaCanvas').addEventListener('click', function () { drawCaptcha(); $('#loginCode').value = ''; });
    $('#logoutBtn').addEventListener('click', doLogout);

    /* 移动端抽屉菜单 */
    var sb = $('#sidebar'), mask = $('#sidebarMask');
    function closeSidebar() { sb.classList.remove('open'); mask.classList.remove('show'); }
    $('#menuToggle').addEventListener('click', function (e) {
      e.stopPropagation();
      var open = sb.classList.toggle('open');
      mask.classList.toggle('show', open);
    });
    mask.addEventListener('click', closeSidebar);
    w.addEventListener('resize', function () {
      if (w.innerWidth > 820) closeSidebar();
    });
    // 移动端：点击菜单项后收起抽屉，并让内容区回到顶部
    $('#menu').addEventListener('click', function () {
      var p = $('#panel'); if (p) p.scrollTop = 0;
      closeSidebar();
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    DB.ensure();
    buildMenu();
    drawCaptcha();
    bindEvents();
    var first = $('#menu .menu-group'); if (first) first.classList.add('open');
  }

  w.addEventListener('DOMContentLoaded', init);
})(window);














