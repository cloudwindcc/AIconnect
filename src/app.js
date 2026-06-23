import {
  getSession,
  loadConfig as fetchRemoteConfig,
  loadDataset,
  registerVisitor,
  saveConfig as persistRemoteConfig,
  saveDataset,
} from "./api/client.js";
import { applyNetworkMetrics, linkWidth as scaledLinkWidth } from "./domain/metrics.js";
import { escapeAttr as safeAttr, escapeHtml as safeHtml } from "./security/html.js";

(() => {
  const REGIONS = [
    { name: "中国大陆", color: "#2f80ed" },
    { name: "香港", color: "#9b51e0" },
    { name: "菲律宾", color: "#1d9bf0" },
    { name: "新加坡", color: "#00a37a" },
    { name: "美国", color: "#eb5757" },
    { name: "欧洲", color: "#f2994a" },
    { name: "中东", color: "#b7791f" },
    { name: "东南亚", color: "#27ae60" },
    { name: "日本", color: "#344054" },
    { name: "韩国", color: "#0f7c80" },
  ];

  const REGION_COORDS = {
    中国大陆: { lon: 104, lat: 35 },
    香港: { lon: 114.2, lat: 22.3 },
    菲律宾: { lon: 122.6, lat: 12.8 },
    新加坡: { lon: 103.8, lat: 1.35 },
    美国: { lon: -98, lat: 38 },
    欧洲: { lon: 10, lat: 50 },
    中东: { lon: 45, lat: 25 },
    东南亚: { lon: 106, lat: 12 },
    日本: { lon: 139.7, lat: 36 },
    韩国: { lon: 127.8, lat: 36.5 },
  };

  const CITY_COORDS = {
    北京: { lon: 116.4, lat: 39.9 },
    上海: { lon: 121.47, lat: 31.23 },
    深圳: { lon: 114.06, lat: 22.55 },
    广州: { lon: 113.26, lat: 23.13 },
    东莞: { lon: 113.75, lat: 23.04 },
    苏州: { lon: 120.58, lat: 31.3 },
    杭州: { lon: 120.16, lat: 30.25 },
    宁波: { lon: 121.55, lat: 29.87 },
    厦门: { lon: 118.09, lat: 24.48 },
    成都: { lon: 104.07, lat: 30.67 },
    武汉: { lon: 114.31, lat: 30.59 },
    南京: { lon: 118.8, lat: 32.06 },
    无锡: { lon: 120.31, lat: 31.49 },
    佛山: { lon: 113.12, lat: 23.02 },
    珠海: { lon: 113.57, lat: 22.27 },
    中山: { lon: 113.39, lat: 22.52 },
    惠州: { lon: 114.42, lat: 23.11 },
    天津: { lon: 117.2, lat: 39.08 },
    青岛: { lon: 120.38, lat: 36.07 },
    合肥: { lon: 117.23, lat: 31.82 },
    重庆: { lon: 106.55, lat: 29.56 },
    西安: { lon: 108.94, lat: 34.34 },
    长沙: { lon: 112.94, lat: 28.23 },
    郑州: { lon: 113.62, lat: 34.75 },
    马尼拉: { lon: 120.98, lat: 14.6 },
    宿务: { lon: 123.89, lat: 10.32 },
    香港: { lon: 114.2, lat: 22.3 },
  };

  const WORLD_GEOJSON_URL = "https://cdn.jsdelivr.net/gh/holtzy/D3-graph-gallery@master/DATA/world.geojson";
  const LOCAL_VISITOR_KEY = "3hk-hub-visitor-session";
  const SIMPLE_NODE_HIT_RADIUS = 13;

  const NODE_CLUSTER_COLORS = {
    中国大陆: "#178a2f",
    香港: "#d9234f",
    菲律宾: "#204bd8",
    新加坡: "#21a96b",
    美国: "#e02424",
    欧洲: "#7c3aed",
    中东: "#d0b321",
    东南亚: "#36b86f",
    日本: "#2563eb",
    韩国: "#00a7a7",
    advisor: "#111827",
  };

  const MAP_LAND_SHAPES = [
    [
      [73.4, 39.5], [78, 49.5], [87, 49.1], [95, 44.2], [103, 45.4], [111, 49.2], [120.4, 46.5], [124.2, 41.8],
      [121.4, 37.4], [122.1, 31.7], [119.1, 26.1], [114.1, 22.4], [110.4, 20.2], [106.8, 21.8], [101.7, 23.4],
      [96, 27.8], [90.1, 28.4], [84.6, 31.2], [80, 35.2],
    ],
    [
      [109.2, 20.6], [111.1, 20.3], [111.4, 18.7], [109.9, 18.1], [108.7, 19],
    ],
    [
      [120.4, 25.2], [122.1, 24.1], [121.6, 21.9], [120.3, 22.7],
    ],
    [
      [119.3, 18.8], [121.1, 19.4], [123.3, 17.6], [123.7, 15.3], [122.1, 13.6], [120.2, 14.3], [119.1, 16.4],
    ],
    [
      [121.5, 12.7], [124.5, 12.3], [125.1, 10.5], [123.3, 9.4], [121.1, 10.2],
    ],
    [
      [123.6, 9.2], [126.7, 8.1], [126.2, 6.1], [124.5, 5.2], [122.7, 6.4], [123, 8.5],
    ],
  ];

  const OPPORTUNITY_TYPES = [
    "采购",
    "供应链",
    "融资",
    "香港上市",
    "技术合作",
    "客户拓展",
    "投资并购",
    "渠道出海",
  ];

  const INDUSTRIES = {
    新能源: {
      business: ["储能系统", "动力电池材料", "光伏逆变器", "充电桩设备"],
      needs: ["中东客户", "融资", "供应链降本", "香港上市", "渠道出海"],
      resources: ["电池模组", "储能方案", "海外EPC", "工厂产能", "工程交付"],
    },
    消费电子: {
      business: ["智能硬件", "穿戴设备", "ODM制造", "电子元件"],
      needs: ["采购渠道", "低成本供应商", "海外客户", "技术合作"],
      resources: ["低成本制造", "供应链管理", "海外大客户", "电子元件", "品质管控"],
    },
    医疗器械: {
      business: ["影像设备", "耗材生产", "康复设备", "IVD检测"],
      needs: ["海外注册", "医院渠道", "融资", "技术合作"],
      resources: ["临床资源", "注册经验", "医院渠道", "研发团队", "制造资质"],
    },
    工业自动化: {
      business: ["机器人集成", "工业视觉", "控制系统", "智能产线"],
      needs: ["客户拓展", "技术合作", "供应链降本", "融资"],
      resources: ["自动化方案", "工程交付", "工业客户", "软件平台", "系统集成"],
    },
    SaaS: {
      business: ["企业协同", "销售CRM", "风控系统", "数据中台"],
      needs: ["大客户", "融资", "生态合作", "海外市场"],
      resources: ["软件平台", "订阅收入", "数据能力", "企业客户", "技术团队"],
    },
    半导体: {
      business: ["功率器件", "EDA工具", "封测服务", "传感芯片"],
      needs: ["战略投资", "客户验证", "供应链安全", "技术合作"],
      resources: ["芯片设计", "封测产能", "专利组合", "工程团队", "头部客户"],
    },
    跨境电商: {
      business: ["品牌出海", "独立站运营", "海外仓", "平台招商"],
      needs: ["供应链降本", "中东客户", "东南亚渠道", "融资"],
      resources: ["海外仓", "流量运营", "采购网络", "渠道出海", "品牌运营"],
    },
    食品饮料: {
      business: ["功能饮品", "预制食品", "休闲零食", "健康原料"],
      needs: ["渠道拓展", "采购渠道", "品牌合作", "融资"],
      resources: ["零售渠道", "供应链管理", "品牌营销", "工厂产能", "原料采购"],
    },
    物流: {
      business: ["跨境物流", "冷链运输", "仓配一体", "港口服务"],
      needs: ["大客户", "技术升级", "融资", "海外网络"],
      resources: ["仓储网络", "运输车队", "海外清关", "平台系统", "港口资源"],
    },
    金融科技: {
      business: ["支付系统", "供应链金融", "财富科技", "风控模型"],
      needs: ["金融牌照", "技术合作", "战略投资", "海外市场"],
      resources: ["风控模型", "金融机构", "支付网络", "合规团队", "数据能力"],
    },
  };

  const ADVISORS = [
    {
      id: "a1",
      type: "advisor",
      name: "林若愚",
      title: "产业基金合伙人",
      organization: "源启资本",
      countryRegion: "香港",
      capabilities: ["基金", "融资", "投资并购", "战略投资"],
      industries: ["新能源", "半导体", "工业自动化"],
      regions: ["中国大陆", "香港", "新加坡"],
      relationshipStrength: 86,
      cases: ["协助储能企业完成B轮融资", "撮合半导体公司战略投资"],
    },
    {
      id: "a2",
      type: "advisor",
      name: "陈明远",
      title: "供应链转型顾问",
      organization: "凌越咨询",
      countryRegion: "中国大陆",
      capabilities: ["供应链", "采购", "低成本供应商", "工厂产能"],
      industries: ["消费电子", "食品饮料", "工业自动化"],
      regions: ["中国大陆", "东南亚", "韩国"],
      relationshipStrength: 78,
      cases: ["协助电子品牌完成供应链降本", "导入越南制造资源"],
    },
    {
      id: "a3",
      type: "advisor",
      name: "Sophie Chan",
      title: "香港资本市场顾问",
      organization: "Harbor Listing Partners",
      countryRegion: "香港",
      capabilities: ["香港上市", "融资", "合规", "金融机构"],
      industries: ["医疗器械", "SaaS", "金融科技", "新能源"],
      regions: ["香港", "中国大陆", "新加坡"],
      relationshipStrength: 82,
      cases: ["辅导医疗器械公司筹备港股上市", "连接投行和审计资源"],
    },
    {
      id: "a4",
      type: "advisor",
      name: "阿米尔·哈立德",
      title: "中东市场拓展顾问",
      organization: "Gulf Bridge Advisory",
      countryRegion: "中东",
      capabilities: ["中东客户", "政府采购", "渠道出海", "能源客户"],
      industries: ["新能源", "物流", "食品饮料", "跨境电商"],
      regions: ["中东", "中国大陆", "新加坡"],
      relationshipStrength: 88,
      cases: ["导入中东能源客户", "协助消费品牌进入海湾市场"],
    },
    {
      id: "a5",
      type: "advisor",
      name: "王沁",
      title: "技术转化与产业合作顾问",
      organization: "清科产业实验室",
      countryRegion: "中国大陆",
      capabilities: ["技术合作", "研发团队", "专利组合", "产业客户"],
      industries: ["半导体", "医疗器械", "工业自动化", "SaaS"],
      regions: ["中国大陆", "日本", "韩国", "欧洲"],
      relationshipStrength: 75,
      cases: ["促成工业视觉联合研发", "连接高校专利与产业客户"],
    },
  ];

  const SAMPLE_INPUTS = [
    "今天见了一家深圳新能源公司，年收入大概8亿，想找中东客户，也考虑香港上市。",
    "有一家苏州半导体企业，收入约3.5亿，正在找战略投资，也希望接触汽车电子客户。",
    "上海医疗器械公司年收入1.2亿，有影像设备，想做海外注册和融资。",
    "杭州SaaS平台收入6000万，想找大客户和新加坡市场伙伴。",
    "广州消费电子企业收入12亿，希望找东南亚低成本供应商，也需要采购网络。",
  ];

  const DEFAULT_RULE_CONFIG = {
    needWeight: 1,
    industryWeight: 0.55,
    regionWeight: 0.75,
    scaleWeight: 0.65,
    advisorWeight: 1,
    strongMatchThreshold: 2,
  };

  const DEFAULT_AI_CONFIG = {
    enabled: true,
    provider: "OpenAI",
    baseUrl: "/api/analyze-opportunities",
    model: "gpt-4.1-mini",
    apiKey: "",
    prompt:
      "你是 3HK Hub 的产业机会网络分析引擎。请基于公司画像、顾问能力、行业、地区、需求、资源、Hub Score、Bridge Path、Trust Edge 和历史证据，输出结构化JSON。必须包含：opportunities数组；每项包含candidate_id、opportunity_type、recommended_advisor、estimated_value、probability、confidence、expected_value、evidence、risk_factors、summary、next_step。不要新增不存在的candidate_id。",
  };

  const els = {
    canvas: document.getElementById("graphCanvas"),
    tooltip: document.getElementById("tooltip"),
    regionFilter: document.getElementById("regionFilter"),
    typeFilter: document.getElementById("typeFilter"),
    valueFilter: document.getElementById("valueFilter"),
    searchInput: document.getElementById("searchInput"),
    showPotential: document.getElementById("showPotential"),
    showActive: document.getElementById("showActive"),
    resetView: document.getElementById("resetView"),
    detailPanel: document.getElementById("detailPanel"),
    selectionBadge: document.getElementById("selectionBadge"),
    companyCount: document.getElementById("companyCount"),
    advisorCount: document.getElementById("advisorCount"),
    opportunityCount: document.getElementById("opportunityCount"),
    expectedTotal: document.getElementById("expectedTotal"),
    regionLegend: document.getElementById("regionLegend"),
    topList: document.getElementById("topList"),
    viewerModeButton: document.getElementById("viewerModeButton"),
    adminModeButton: document.getElementById("adminModeButton"),
    visitorRegisterButton: document.getElementById("visitorRegisterButton"),
    aiInput: document.getElementById("aiInput"),
    parseButton: document.getElementById("parseButton"),
    sampleButton: document.getElementById("sampleButton"),
    voiceButton: document.getElementById("voiceButton"),
    aiResult: document.getElementById("aiResult"),
    dataTable: document.getElementById("dataTable"),
    tableSummary: document.getElementById("tableSummary"),
    addCompanyButton: document.getElementById("addCompanyButton"),
    addAdvisorButton: document.getElementById("addAdvisorButton"),
    importButton: document.getElementById("importButton"),
    importFile: document.getElementById("importFile"),
    importExcelButton: document.getElementById("importExcelButton"),
    importExcelFile: document.getElementById("importExcelFile"),
    exportExcelButton: document.getElementById("exportExcelButton"),
    saveLocalButton: document.getElementById("saveLocalButton"),
    resetDataButton: document.getElementById("resetDataButton"),
    exportButton: document.getElementById("exportButton"),
    editModal: document.getElementById("editModal"),
    editTitle: document.getElementById("editTitle"),
    editForm: document.getElementById("editForm"),
    closeEditButton: document.getElementById("closeEditButton"),
    mainView: document.getElementById("mainView"),
    adminView: document.getElementById("adminView"),
    openAdminButton: document.getElementById("openAdminButton"),
    backToMainButton: document.getElementById("backToMainButton"),
    saveAdminConfig: document.getElementById("saveAdminConfig"),
    resetAdminConfig: document.getElementById("resetAdminConfig"),
    aiEnabled: document.getElementById("aiEnabled"),
    needWeight: document.getElementById("needWeight"),
    industryWeight: document.getElementById("industryWeight"),
    regionWeight: document.getElementById("regionWeight"),
    scaleWeight: document.getElementById("scaleWeight"),
    advisorWeight: document.getElementById("advisorWeight"),
    strongMatchThreshold: document.getElementById("strongMatchThreshold"),
    apiProvider: document.getElementById("apiProvider"),
    apiBaseUrl: document.getElementById("apiBaseUrl"),
    apiModel: document.getElementById("apiModel"),
    apiKey: document.getElementById("apiKey"),
    matchPrompt: document.getElementById("matchPrompt"),
    promptPreview: document.getElementById("promptPreview"),
    opportunityContextMenu: document.getElementById("opportunityContextMenu"),
    analyzeOpportunityButton: document.getElementById("analyzeOpportunityButton"),
    openProductGuideButton: document.getElementById("openProductGuideButton"),
    productGuideModal: document.getElementById("productGuideModal"),
    closeProductGuideButton: document.getElementById("closeProductGuideButton"),
    loginModal: document.getElementById("loginModal"),
    loginForm: document.getElementById("loginForm"),
    closeLoginButton: document.getElementById("closeLoginButton"),
    cancelLoginButton: document.getElementById("cancelLoginButton"),
    adminUsername: document.getElementById("adminUsername"),
    adminPassword: document.getElementById("adminPassword"),
    loginError: document.getElementById("loginError"),
    visitorModal: document.getElementById("visitorModal"),
    visitorForm: document.getElementById("visitorForm"),
    closeVisitorButton: document.getElementById("closeVisitorButton"),
    cancelVisitorButton: document.getElementById("cancelVisitorButton"),
    visitorEmail: document.getElementById("visitorEmail"),
    visitorName: document.getElementById("visitorName"),
    visitorOrganization: document.getElementById("visitorOrganization"),
    visitorInterest: document.getElementById("visitorInterest"),
    visitorError: document.getElementById("visitorError"),
    reportModal: document.getElementById("reportModal"),
    reportTitle: document.getElementById("reportTitle"),
    reportMeta: document.getElementById("reportMeta"),
    reportBody: document.getElementById("reportBody"),
    closeReportButton: document.getElementById("closeReportButton"),
    saveReportButton: document.getElementById("saveReportButton"),
    downloadReportButton: document.getElementById("downloadReportButton"),
  };

  const ctx = els.canvas.getContext("2d");
  const rng = mulberry32(20260509);
  const state = {
    companies: [],
    advisors: structuredClone(ADVISORS),
    opportunities: [],
    advisorLinks: [],
    nodes: [],
    links: [],
    nodeById: new Map(),
    opportunityById: new Map(),
    filters: {
      region: "全部",
      opportunityType: "全部",
      minExpectedValue: 0,
      showPotential: true,
      showActive: true,
      query: "",
    },
    ruleConfig: structuredClone(DEFAULT_RULE_CONFIG),
    aiConfig: structuredClone(DEFAULT_AI_CONFIG),
    accessRole: "viewer",
    session: { authenticated: false, admin: false, email: null, visitor: null },
    activeTab: "opportunities",
    editing: null,
    hover: null,
    selection: null,
    camera: { x: 0, y: 0, k: 1 },
    pointer: { x: 0, y: 0, worldX: 0, worldY: 0 },
    draggingNode: null,
    panning: false,
    lastPointer: null,
    contextOpportunityId: null,
    currentReport: null,
    worldMapFeatures: [],
    worldMapLoaded: false,
    width: 0,
    height: 0,
    layoutReady: false,
    needsRedraw: true,
    simulationActive: true,
  };

  init();

  async function init() {
    await refreshSession();
    await loadAdminConfig();
    const saved = await loadSavedData();
    if (saved) {
      state.companies = saved.companies;
      state.advisors = saved.advisors;
      normalizeData();
      state.opportunities = saved.opportunities.length
        ? saved.opportunities
        : generateOpportunities(state.companies, state.advisors, opportunityCountFor(state.companies));
      state.advisorLinks = generateAdvisorLinks(state.companies, state.advisors);
    } else {
      state.companies = generateCompanies(50);
      state.opportunities = generateOpportunities(state.companies, state.advisors, 48);
      state.advisorLinks = generateAdvisorLinks(state.companies, state.advisors);
    }
    rebuildGraph();
    setupFilters();
    renderRegionLegend();
    bindEvents();
    renderAdminConfig();
    renderRoute();
    resizeCanvas();
    seedPositions();
    renderAll();
    applyAccessControl();
    loadWorldMap();
    requestAnimationFrame(frame);
  }

  async function refreshSession() {
    const remoteSession = await getSession();
    const localVisitor = loadLocalVisitorSession();
    state.session = shouldUseLocalVisitor(remoteSession, localVisitor) ? localVisitor : normalizeSession(remoteSession);
    state.accessRole = state.session.admin ? "admin" : "viewer";
  }

  function shouldUseLocalVisitor(remoteSession, localVisitor) {
    if (!localVisitor) return false;
    if (!remoteSession?.authenticated) return true;
    return !remoteSession.admin && !remoteSession.visitor && remoteSession.authProvider === "public-viewer";
  }

  function normalizeSession(session = {}) {
    return {
      authenticated: Boolean(session.authenticated),
      admin: Boolean(session.admin),
      email: session.email || session.visitor?.email || null,
      visitor: session.visitor || null,
      authProvider: session.authProvider || "public-viewer",
    };
  }

  function loadLocalVisitorSession() {
    try {
      const raw = localStorage.getItem(LOCAL_VISITOR_KEY);
      if (!raw) return null;
      const visitor = JSON.parse(raw);
      if (!visitor?.email || !isValidEmail(visitor.email)) return null;
      return normalizeSession({
        authenticated: true,
        admin: false,
        email: visitor.email,
        visitor,
        authProvider: "local-visitor",
      });
    } catch (error) {
      console.warn("Failed to load local visitor session", error);
      return null;
    }
  }

  function normalizeVisitorPayload(payload) {
    const email = String(payload.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return null;
    return {
      email,
      name: compactText(payload.name, 80),
      organization: compactText(payload.organization, 120),
      interest: compactText(payload.interest, 160),
    };
  }

  function createLocalVisitorSession(visitor) {
    const profile = {
      id: `local-visitor-${Date.now()}`,
      email: visitor.email,
      name: visitor.name,
      organization: visitor.organization,
      interest: visitor.interest,
      registeredAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(LOCAL_VISITOR_KEY, JSON.stringify(profile));
    } catch (error) {
      console.warn("Failed to store local visitor session", error);
    }
    return normalizeSession({
      authenticated: true,
      admin: false,
      email: profile.email,
      visitor: profile,
      authProvider: "local-visitor",
    });
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function compactText(value, maxLength) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
  }

  async function loadWorldMap() {
    try {
      const response = await fetch(WORLD_GEOJSON_URL, { cache: "force-cache" });
      if (!response.ok) throw new Error(`地图加载失败：${response.status}`);
      const geojson = await response.json();
      state.worldMapFeatures = Array.isArray(geojson.features) ? geojson.features : [];
      state.worldMapLoaded = state.worldMapFeatures.length > 0;
      state.needsRedraw = true;
    } catch (error) {
      console.warn("Failed to load world map, using fallback shapes", error);
      state.worldMapLoaded = false;
      state.needsRedraw = true;
    }
  }

  function mulberry32(seed) {
    return function seededRandom() {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list) {
    return list[Math.floor(rng() * list.length)];
  }

  function sample(list, count) {
    const copy = [...list];
    const result = [];
    while (copy.length && result.length < count) {
      result.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    }
    return result;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function generateCompanies(count) {
    const cities = [
      "深圳",
      "上海",
      "北京",
      "苏州",
      "杭州",
      "广州",
      "东莞",
      "南京",
      "无锡",
      "佛山",
      "珠海",
      "成都",
      "武汉",
      "厦门",
      "宁波",
      "香港",
      "新加坡",
      "迪拜",
      "首尔",
      "东京",
      "慕尼黑",
      "硅谷",
    ];
    const brands = [
      "星桥",
      "云衡",
      "启航",
      "恒澜",
      "锐成",
      "蓝科",
      "联创",
      "泰合",
      "智源",
      "盛维",
      "朗越",
      "北辰",
      "海纳",
      "瀚宇",
      "远拓",
      "中科",
      "领航",
      "华晟",
      "柏森",
      "明曜",
    ];
    const entityTypes = ["科技有限公司", "产业集团", "智能制造公司", "国际贸易公司", "创新科技公司"];
    const industries = Object.keys(INDUSTRIES);
    const companies = [];

    for (let i = 1; i <= count; i += 1) {
      const industry = pick(industries);
      const region = pick(REGIONS).name;
      const city = pick(cities);
      const brand = pick(brands);
      const business = pick(INDUSTRIES[industry].business);
      const revenue = generateRevenue();
      const needs = sample(INDUSTRIES[industry].needs, 2 + Math.floor(rng() * 2));
      const resources = sample(INDUSTRIES[industry].resources, 2 + Math.floor(rng() * 2));
      const company = {
        id: `c${i}`,
        type: "company",
        name: `${city}${brand}${business}${entityTypes[i % entityTypes.length]}`,
        countryRegion: region,
        city: companyCityForRegion(region, city),
        industry,
        mainBusiness: business,
        revenue,
        employeeCount: Math.round(clamp(revenue / 950000 + rng() * 1200, 80, 18000)),
        companyStage: revenue > 3000000000 ? "成熟期" : revenue > 900000000 ? "成长期" : "扩张期",
        painPoints: generatePainPoints(industry, needs),
        needs,
        resources,
        source: "Demo模拟数据",
        confidenceScore: Math.round(72 + rng() * 24),
        createdAt: "2026-05-09",
        isNew: false,
      };
      company.radius = graphNodeRadius(company);
      companies.push(company);
    }

    return companies;
  }

  function generateRevenue() {
    const min = Math.log(50000000);
    const max = Math.log(16000000000);
    const value = Math.exp(min + rng() * (max - min));
    return Math.round(value / 10000000) * 10000000;
  }

  function generatePainPoints(industry, needs) {
    const base = {
      新能源: ["海外项目落地周期长", "现金流占用高", "渠道信任成本高"],
      消费电子: ["供应链波动", "订单集中度高", "价格竞争激烈"],
      医疗器械: ["注册周期长", "医院渠道进入难", "研发投入高"],
      工业自动化: ["项目交付周期长", "客户验证成本高", "规模化销售不足"],
      SaaS: ["大客户获取成本高", "续费压力", "海外本地化不足"],
      半导体: ["客户认证周期长", "研发投入高", "供应链安全压力"],
      跨境电商: ["流量成本高", "库存周转压力", "本地渠道不足"],
      食品饮料: ["渠道费用高", "品牌认知不足", "原料价格波动"],
      物流: ["网络覆盖不足", "履约成本高", "系统数字化不足"],
      金融科技: ["合规要求高", "金融机构触达难", "数据安全压力"],
    };
    return [...sample(base[industry], 2), ...needs.slice(0, 1).map((need) => `${need}资源不足`)];
  }

  function generateOpportunities(companies, advisors, count) {
    const candidates = [];
    for (let i = 0; i < companies.length; i += 1) {
      for (let j = i + 1; j < companies.length; j += 1) {
        const a = companies[i];
        const b = companies[j];
        const ab = evaluateOpportunity(a, b, advisors);
        const ba = evaluateOpportunity(b, a, advisors);
        candidates.push(ab.score >= ba.score ? ab : ba);
      }
    }

    const sorted = candidates.sort((a, b) => b.score - a.score);
    const strongMatches = sorted.filter((item) => item.score > state.ruleConfig.strongMatchThreshold);

    return (strongMatches.length >= count ? strongMatches : sorted)
      .slice(0, count)
      .map((item, index) => ({
        ...item,
        id: `o${index + 1}`,
        status: index < 28 && item.probability > 0.38 ? "active" : "potential",
      }));
  }

  function evaluateOpportunity(source, target, advisors) {
    const type = inferOpportunityType(source, target);
    let score = 0;
    const matchedNeeds = [];
    const evidence = [];

    for (const need of source.needs) {
      for (const resource of target.resources) {
        const similarity = keywordMatchScore(need, resource);
        if (similarity > 0) {
          score += similarity * state.ruleConfig.needWeight;
          matchedNeeds.push(need);
          evidence.push(`${source.name}需要${need}，${target.name}具备${resource}`);
        }
      }
    }

    if (source.industry === target.industry) {
      score += state.ruleConfig.industryWeight;
      evidence.push("双方处于同一行业，业务语言和采购标准接近");
    }

    if (source.countryRegion !== target.countryRegion && source.needs.some(isCrossBorderNeed)) {
      score += state.ruleConfig.regionWeight;
      evidence.push("存在跨区域拓展需求");
    }

    if (source.revenue > target.revenue * 1.8 && ["采购", "供应链"].includes(type)) {
      score += state.ruleConfig.scaleWeight;
      evidence.push("需求方规模较大，供应商承接空间较明确");
    }

    const advisor = chooseAdvisor(source, target, type, advisors);
    if (advisor) {
      score += (advisor.relationshipStrength / 160) * state.ruleConfig.advisorWeight;
      evidence.push(`${advisor.name}覆盖${type}相关资源`);
    }

    const baseValue = Math.min(source.revenue, target.revenue) * (0.012 + rng() * 0.055);
    const estimatedValue = Math.max(300000, Math.round(baseValue / 100000) * 100000);
    const probability = clamp(0.16 + score * 0.07 + rng() * 0.08, 0.12, 0.82);
    const confidence = clamp(0.62 + score * 0.035, 0.55, 0.93);
    const expectedValue = Math.round(estimatedValue * probability * confidence);

    return {
      sourceCompanyId: source.id,
      targetCompanyId: target.id,
      advisorId: advisor?.id ?? null,
      opportunityType: type,
      description: buildOpportunityDescription(source, target, type),
      estimatedValue,
      probability,
      confidence,
      expectedValue,
      priorityScore: Math.round(score * 18 + probability * 30),
      evidence: evidence.slice(0, 3),
      matchedNeeds: [...new Set(matchedNeeds)],
      remark: "",
      followUps: normalizeFollowUps(),
      score,
    };
  }

  function keywordMatchScore(need, resource) {
    const directPairs = [
      ["中东客户", "中东客户", 1.4],
      ["中东客户", "政府采购", 1.25],
      ["中东客户", "能源客户", 1.1],
      ["海外客户", "海外大客户", 1.25],
      ["海外市场", "渠道出海", 1.1],
      ["东南亚渠道", "采购网络", 1.1],
      ["采购渠道", "采购网络", 1.25],
      ["低成本供应商", "低成本制造", 1.35],
      ["供应链降本", "供应链管理", 1.2],
      ["供应链降本", "低成本制造", 1.2],
      ["融资", "金融机构", 1.25],
      ["融资", "订阅收入", 0.55],
      ["战略投资", "专利组合", 0.8],
      ["香港上市", "金融机构", 1.0],
      ["技术合作", "研发团队", 1.25],
      ["技术合作", "技术团队", 1.05],
      ["客户拓展", "工业客户", 1.25],
      ["大客户", "企业客户", 1.25],
      ["医院渠道", "医院渠道", 1.35],
      ["海外注册", "注册经验", 1.35],
      ["金融牌照", "合规团队", 1.05],
    ];
    for (const [n, r, score] of directPairs) {
      if (need.includes(n) && resource.includes(r)) return score;
    }
    if (need === resource) return 1;
    if (need.slice(0, 2) === resource.slice(0, 2)) return 0.45;
    return 0;
  }

  function isCrossBorderNeed(need) {
    return ["海外", "中东", "东南亚", "渠道出海", "香港"].some((keyword) => need.includes(keyword));
  }

  function inferOpportunityType(source, target) {
    const needs = source.needs.join(" ");
    if (/上市|IPO/.test(needs)) return "香港上市";
    if (/融资|投资/.test(needs)) return "融资";
    if (/供应链|供应商|采购/.test(needs)) return needs.includes("采购") ? "采购" : "供应链";
    if (/技术|研发/.test(needs)) return "技术合作";
    if (/中东|海外|东南亚|渠道/.test(needs)) return "渠道出海";
    if (/客户|大客户/.test(needs)) return "客户拓展";
    if (source.industry === target.industry && source.revenue > target.revenue * 3) return "投资并购";
    return "客户拓展";
  }

  function chooseAdvisor(source, target, type, advisors) {
    const scored = advisors
      .map((advisor) => {
        let score = 0;
        if (advisor.capabilities.includes(type)) score += 3;
        if (type === "融资" && advisor.capabilities.includes("基金")) score += 2;
        if (type === "采购" && advisor.capabilities.includes("采购")) score += 2;
        if (type === "供应链" && advisor.capabilities.includes("供应链")) score += 2;
        if (type === "渠道出海" && advisor.capabilities.includes("渠道出海")) score += 2;
        if (type === "香港上市" && advisor.capabilities.includes("香港上市")) score += 3;
        if (type === "技术合作" && advisor.capabilities.includes("技术合作")) score += 3;
        if (advisor.industries.includes(source.industry)) score += 1.2;
        if (advisor.industries.includes(target.industry)) score += 0.8;
        if (advisor.regions.includes(source.countryRegion)) score += 0.8;
        if (advisor.regions.includes(target.countryRegion)) score += 0.8;
        return { advisor, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.score > 2.2 ? scored[0].advisor : null;
  }

  function buildOpportunityDescription(source, target, type) {
    const phrases = {
      采购: `${source.name}可向${target.name}评估采购合作`,
      供应链: `${source.name}与${target.name}存在供应链协同空间`,
      融资: `${target.name}资源可支持${source.name}融资推进`,
      香港上市: `${source.name}可评估香港上市路径和中介资源`,
      技术合作: `${source.name}与${target.name}可探索联合研发或技术验证`,
      客户拓展: `${target.name}可成为${source.name}的潜在客户或渠道伙伴`,
      投资并购: `${source.name}可评估对${target.name}的战略投资可能`,
      渠道出海: `${source.name}可借助${target.name}拓展海外渠道`,
    };
    return phrases[type] ?? `${source.name}与${target.name}存在合作机会`;
  }

  function generateAdvisorLinks(companies, advisors) {
    const links = [];
    advisors.forEach((advisor) => {
      const matches = companies
        .map((company) => {
          let score = 0;
          if (advisor.industries.includes(company.industry)) score += 2;
          if (advisor.regions.includes(company.countryRegion)) score += 1.2;
          for (const capability of advisor.capabilities) {
            if (company.needs.some((need) => keywordMatchScore(need, capability) > 0 || capability.includes(need))) {
              score += 1.5;
            }
          }
          return { company, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      matches.forEach(({ company, score }, index) => {
        links.push({
          id: `r-${advisor.id}-${company.id}`,
          type: "advisor",
          sourceId: advisor.id,
          targetId: company.id,
          relationshipType: "顾问资源",
          strength: clamp(score / 5, 0.25, 1),
          rank: index + 1,
        });
      });
    });
    return links;
  }

  function rebuildGraph() {
    applyNetworkMetrics(state);
    state.nodes = [...state.companies, ...state.advisors];
    state.nodeById = new Map(state.nodes.map((node) => [node.id, node]));
    state.opportunityById = new Map(state.opportunities.map((item) => [item.id, item]));
    state.links = [
      ...state.opportunities.map((opportunity) => ({
        id: opportunity.id,
        type: "opportunity",
        sourceId: opportunity.sourceCompanyId,
        targetId: opportunity.targetCompanyId,
        opportunityId: opportunity.id,
      })),
      ...state.advisorLinks,
    ];
    state.links.forEach((link) => {
      link.source = state.nodeById.get(link.sourceId);
      link.target = state.nodeById.get(link.targetId);
    });
  }

  function setupFilters() {
    els.regionFilter.innerHTML = [
      `<option value="全部">全部地区</option>`,
      ...REGIONS.map((region) => `<option value="${region.name}">${region.name}</option>`),
    ].join("");
    els.typeFilter.innerHTML = [
      `<option value="全部">全部机会</option>`,
      ...OPPORTUNITY_TYPES.map((type) => `<option value="${type}">${type}</option>`),
    ].join("");
  }

  function renderRegionLegend() {
    els.regionLegend.innerHTML = "";
    els.regionLegend.hidden = true;
  }

  function bindEvents() {
    window.addEventListener("resize", () => {
      resizeCanvas();
      state.needsRedraw = true;
    });

    els.regionFilter.addEventListener("change", () => {
      state.filters.region = els.regionFilter.value;
      renderAll();
    });
    els.typeFilter.addEventListener("change", () => {
      state.filters.opportunityType = els.typeFilter.value;
      renderAll();
    });
    els.valueFilter.addEventListener("change", () => {
      state.filters.minExpectedValue = Number(els.valueFilter.value);
      renderAll();
    });
    els.searchInput.addEventListener("input", () => {
      state.filters.query = els.searchInput.value.trim().toLowerCase();
      renderAll();
    });
    els.showPotential.addEventListener("click", () => toggleStatusFilter("potential"));
    els.showActive.addEventListener("click", () => toggleStatusFilter("active"));
    els.resetView.addEventListener("click", resetView);
    els.viewerModeButton.addEventListener("click", () => setAccessRole("viewer"));
    els.adminModeButton.addEventListener("click", requestAdminLogin);
    els.visitorRegisterButton.addEventListener("click", openVisitorModal);

    if (window.PointerEvent) {
      els.canvas.addEventListener("pointerdown", onPointerDown);
      els.canvas.addEventListener("pointermove", onPointerMove);
      els.canvas.addEventListener("pointerup", onPointerUp);
      els.canvas.addEventListener("pointercancel", onPointerLeave);
      els.canvas.addEventListener("pointerleave", onPointerLeave);
    } else {
      els.canvas.addEventListener("mousedown", onPointerDown);
      els.canvas.addEventListener("mousemove", onPointerMove);
      els.canvas.addEventListener("mouseup", onPointerUp);
      els.canvas.addEventListener("mouseleave", onPointerLeave);
    }
    els.canvas.addEventListener("wheel", onWheel, { passive: false });
    els.canvas.addEventListener("click", onCanvasClick);
    els.canvas.addEventListener("contextmenu", onCanvasContextMenu);
    document.addEventListener("click", hideOpportunityContextMenu);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideOpportunityContextMenu();
        closeReportModal();
        closeVisitorModal();
        closeProductGuideModal();
      }
    });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
        tab.classList.add("active");
        state.activeTab = tab.dataset.tab;
        renderTable();
      });
    });

    els.parseButton.addEventListener("click", handleAiInput);
    els.sampleButton.addEventListener("click", () => {
      const current = els.aiInput.value;
      let next = pick(SAMPLE_INPUTS);
      if (next === current) next = pick(SAMPLE_INPUTS);
      els.aiInput.value = next;
    });
    els.voiceButton.addEventListener("click", startVoiceInput);
    els.addCompanyButton.addEventListener("click", () => openCompanyEditor());
    els.addAdvisorButton.addEventListener("click", () => openAdvisorEditor());
    els.importButton.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", importJson);
    els.importExcelButton.addEventListener("click", () => els.importExcelFile.click());
    els.importExcelFile.addEventListener("change", importExcel);
    els.exportExcelButton.addEventListener("click", exportExcel);
    els.saveLocalButton.addEventListener("click", () => {
      if (!requireAdmin()) return;
      saveData();
      flashTableSummary("已保存到本地浏览器");
    });
    els.resetDataButton.addEventListener("click", resetDemoData);
    els.exportButton.addEventListener("click", exportJson);
    els.analyzeOpportunityButton.addEventListener("click", analyzeContextOpportunity);
    els.openProductGuideButton.addEventListener("click", openProductGuideModal);
    els.closeProductGuideButton.addEventListener("click", closeProductGuideModal);
    els.productGuideModal.addEventListener("click", (event) => {
      if (event.target === els.productGuideModal) closeProductGuideModal();
    });
    els.closeReportButton.addEventListener("click", closeReportModal);
    els.reportModal.addEventListener("click", (event) => {
      if (event.target === els.reportModal) closeReportModal();
    });
    els.saveReportButton.addEventListener("click", saveCurrentReport);
    els.downloadReportButton.addEventListener("click", downloadCurrentReport);
    els.loginForm.addEventListener("submit", handleAdminLogin);
    els.closeLoginButton.addEventListener("click", closeLoginModal);
    els.cancelLoginButton.addEventListener("click", closeLoginModal);
    els.loginModal.addEventListener("click", (event) => {
      if (event.target === els.loginModal) closeLoginModal();
    });
    els.visitorForm.addEventListener("submit", handleVisitorRegister);
    els.closeVisitorButton.addEventListener("click", closeVisitorModal);
    els.cancelVisitorButton.addEventListener("click", closeVisitorModal);
    els.visitorModal.addEventListener("click", (event) => {
      if (event.target === els.visitorModal) closeVisitorModal();
    });
    els.closeEditButton.addEventListener("click", closeEditor);
    els.editModal.addEventListener("click", (event) => {
      if (event.target === els.editModal) closeEditor();
    });
    els.openAdminButton.addEventListener("click", () => {
      if (!isAdmin()) {
        requestAdminLogin();
        return;
      }
      window.location.hash = window.location.hash.replace("#", "") === "admin" ? "" : "admin";
      renderRoute();
    });
    els.backToMainButton.addEventListener("click", () => {
      window.location.hash = "";
      renderRoute();
    });
    window.addEventListener("hashchange", renderRoute);
    els.saveAdminConfig.addEventListener("click", saveAdminConfigFromForm);
    els.resetAdminConfig.addEventListener("click", resetAdminConfig);
    [
      els.aiEnabled,
      els.needWeight,
      els.industryWeight,
      els.regionWeight,
      els.scaleWeight,
      els.advisorWeight,
      els.strongMatchThreshold,
      els.apiProvider,
      els.apiBaseUrl,
      els.apiModel,
      els.apiKey,
      els.matchPrompt,
    ].forEach((input) => input.addEventListener("input", updatePromptPreview));
  }

  function toggleStatusFilter(status) {
    if (status === "potential") {
      state.filters.showPotential = !state.filters.showPotential;
      els.showPotential.classList.toggle("active", state.filters.showPotential);
    } else {
      state.filters.showActive = !state.filters.showActive;
      els.showActive.classList.toggle("active", state.filters.showActive);
    }
    renderAll();
  }

  function setAccessRole(role) {
    state.accessRole = role === "admin" && state.session.admin ? "admin" : "viewer";
    if (!isAdmin() && window.location.hash.replace("#", "") === "admin") {
      window.location.hash = "";
    }
    applyAccessControl();
    renderTable();
  }

  function isAdmin() {
    return state.accessRole === "admin" && state.session.admin === true;
  }

  function requireAdmin() {
    if (isAdmin()) return true;
    flashTableSummary("当前为访客权限，只能查看");
    return false;
  }

  function applyAccessControl() {
    const admin = isAdmin();
    const visitor = !admin && Boolean(state.session.visitor);
    els.viewerModeButton.classList.toggle("active", !admin);
    els.adminModeButton.classList.toggle("active", admin);
    els.viewerModeButton.textContent = visitor ? "访客已登录" : "访客";
    els.adminModeButton.textContent = admin ? "管理员已登录" : "管理员";
    els.visitorRegisterButton.textContent = visitor ? "访客资料" : "访客注册";
    els.visitorRegisterButton.classList.toggle("active", visitor);
    els.visitorRegisterButton.title = visitor ? `当前访客：${state.session.email}` : "使用邮箱注册访客身份";
    document.querySelectorAll("[data-admin-only]").forEach((element) => {
      element.hidden = !admin;
    });
  }

  function requestAdminLogin() {
    if (isAdmin()) {
      setAccessRole("admin");
      return;
    }
    openLoginModal();
  }

  function openLoginModal() {
    els.loginError.textContent = "";
    els.loginError.textContent = "未检测到 Cloudflare Access 管理员身份。请先通过 hub.3hk.xyz 的 Access 策略登录。";
    if (els.adminUsername) els.adminUsername.value = "";
    if (els.adminPassword) els.adminPassword.value = "";
    els.loginModal.hidden = false;
  }

  function closeLoginModal() {
    els.loginModal.hidden = true;
    els.loginError.textContent = "";
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    await refreshSession();
    if (state.session.admin) {
      state.accessRole = "admin";
      closeLoginModal();
      applyAccessControl();
      renderTable();
      flashTableSummary("Cloudflare Access 管理员身份已确认");
      return;
    }
    els.loginError.textContent = "仍未检测到管理员身份。请检查 Cloudflare Access 策略或 ADMIN_EMAILS 配置。";
  }

  function openProductGuideModal() {
    els.productGuideModal.hidden = false;
    window.setTimeout(() => els.closeProductGuideButton.focus(), 0);
  }

  function closeProductGuideModal() {
    els.productGuideModal.hidden = true;
  }

  function openVisitorModal() {
    const visitor = state.session.visitor || {};
    els.visitorEmail.value = visitor.email || state.session.email || "";
    els.visitorName.value = visitor.name || "";
    els.visitorOrganization.value = visitor.organization || "";
    els.visitorInterest.value = visitor.interest || "";
    els.visitorError.textContent = "";
    els.visitorModal.hidden = false;
    window.setTimeout(() => els.visitorEmail.focus(), 0);
  }

  function closeVisitorModal() {
    els.visitorModal.hidden = true;
    els.visitorError.textContent = "";
  }

  async function handleVisitorRegister(event) {
    event.preventDefault();
    const payload = {
      email: els.visitorEmail.value,
      name: els.visitorName.value,
      organization: els.visitorOrganization.value,
      interest: els.visitorInterest.value,
    };
    const normalized = normalizeVisitorPayload(payload);
    if (!normalized) {
      els.visitorError.textContent = "请输入有效邮箱。";
      return;
    }

    const submitButton = els.visitorForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    els.visitorError.textContent = "正在注册...";
    try {
      const remoteSession = await registerVisitor(normalized);
      state.session = normalizeSession(remoteSession);
      localStorage.removeItem(LOCAL_VISITOR_KEY);
      flashTableSummary("访客注册成功，已自动登录");
    } catch (error) {
      if (!isLocalApiFallback(error)) {
        els.visitorError.textContent = error.message || "注册失败，请稍后重试。";
        return;
      }
      console.warn("Visitor registration API unavailable, using local visitor session", error);
      state.session = createLocalVisitorSession(normalized);
      flashTableSummary("访客注册成功，已在本地自动登录");
    } finally {
      submitButton.disabled = false;
    }
    state.accessRole = "viewer";
    closeVisitorModal();
    applyAccessControl();
    renderTable();
  }

  function isLocalApiFallback(error) {
    const message = String(error?.message || "");
    const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    return message.includes("API response was not JSON") || message.includes("Failed to fetch") || (localHost && message.includes("404"));
  }

  function renderRoute() {
    const adminRoute = window.location.hash.replace("#", "") === "admin";
    if (adminRoute && !isAdmin()) {
      window.location.hash = "";
      return;
    }
    els.mainView.hidden = adminRoute;
    els.adminView.hidden = !adminRoute;
    els.openAdminButton.textContent = adminRoute ? "返回图谱" : "后台配置";
    if (adminRoute) {
      renderAdminConfig();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.setTimeout(() => {
        resizeCanvas();
        state.needsRedraw = true;
      }, 0);
    }
  }

  function resizeCanvas() {
    const rect = els.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const previousWidth = state.width;
    const previousHeight = state.height;
    const isSmallScreen = window.innerWidth <= 760;
    state.width = Math.max(isSmallScreen ? 320 : 760, rect.width);
    state.height = Math.max(isSmallScreen ? 340 : 590, rect.height);
    els.canvas.width = Math.round(state.width * dpr);
    els.canvas.height = Math.round(state.height * dpr);
    els.canvas.style.width = `${state.width}px`;
    els.canvas.style.height = `${state.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sizeChanged = Math.abs(previousWidth - state.width) > 120 || Math.abs(previousHeight - state.height) > 120;
    if (state.layoutReady && sizeChanged) {
      seedPositions();
      resetView();
    } else if (!state.camera.x && !state.camera.y) {
      resetView();
    }
  }

  function seedPositions() {
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    const regionAnchors = buildRegionAnchors();

    let advisorIndex = 0;
    state.nodes.forEach((node) => {
      let anchor = node.type === "company" ? companyAnchor(node, regionAnchors) : (regionAnchors.get(node.countryRegion) ?? { x: centerX, y: centerY });
      if (node.type === "advisor") {
        const offset = advisorIndex - (state.advisors.length - 1) / 2;
        anchor = {
          x: clamp(anchor.x + offset * 16, 70, state.width - 70),
          y: clamp(anchor.y - 42, 70, state.height - 70),
        };
        advisorIndex += 1;
      }
      node.x = anchor.x + (rng() - 0.5) * (node.type === "advisor" ? 58 : 96);
      node.y = anchor.y + (rng() - 0.5) * (node.type === "advisor" ? 46 : 76);
      node.vx = 0;
      node.vy = 0;
      node.anchor = anchor;
      node.radius = graphNodeRadius(node);
    });

    for (let i = 0; i < 280; i += 1) {
      runSimulationStep();
    }
    state.layoutReady = true;
  }

  function buildRegionAnchors() {
    const anchors = new Map();
    REGIONS.forEach((region) => {
      const coord = REGION_COORDS[region.name];
      if (coord) anchors.set(region.name, projectGeo(coord.lon, coord.lat));
    });
    return anchors;
  }

  function companyAnchor(company, regionAnchors) {
    const cityCoord = cityCoordinate(company);
    if (cityCoord) return projectGeo(cityCoord.lon, cityCoord.lat);
    return regionAnchors.get(company.countryRegion) ?? projectGeo(REGION_COORDS.中国大陆.lon, REGION_COORDS.中国大陆.lat);
  }

  function cityCoordinate(company) {
    if (!company) return null;
    const city = normalizeCompanyCity(company.city);
    if (city && CITY_COORDS[city]) return CITY_COORDS[city];
    if (company.countryRegion === "中国大陆") {
      const inferred = inferCityFromText(company.name);
      if (inferred && CITY_COORDS[inferred]) return CITY_COORDS[inferred];
    }
    if (company.countryRegion === "香港") return CITY_COORDS.香港;
    if (company.countryRegion === "菲律宾") return CITY_COORDS[normalizeCompanyCity(company.city)] || REGION_COORDS.菲律宾;
    return null;
  }

  function mapBounds() {
    const lonMin = -180;
    const lonMax = 180;
    const latMin = -60;
    const latMax = 83;
    const availableWidth = state.width * 0.92;
    const availableHeight = state.height * 0.62;
    const aspect = (lonMax - lonMin) / (latMax - latMin);
    let width = availableWidth;
    let height = width / aspect;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * aspect;
    }
    return {
      x: (state.width - width) / 2,
      y: state.height * 0.16,
      width,
      height,
      lonMin,
      lonMax,
      latMin,
      latMax,
    };
  }

  function projectGeo(lon, lat) {
    const bounds = mapBounds();
    const x = bounds.x + ((lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * bounds.width;
    const y = bounds.y + ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * bounds.height;
    return { x, y };
  }

  function resetView() {
    state.camera = {
      x: state.width * 0.02,
      y: state.height * 0.02,
      k: 0.96,
    };
    state.needsRedraw = true;
  }

  function frame() {
    if (state.simulationActive) {
      runSimulationStep();
      state.needsRedraw = true;
    }
    if (state.needsRedraw) {
      draw();
      state.needsRedraw = false;
    }
    requestAnimationFrame(frame);
  }

  function runSimulationStep() {
    const nodes = state.nodes;
    const visible = getVisibleNodeSet();
    const visibleLinks = getVisibleLinks(visible);

    for (const link of visibleLinks) {
      if (!link.source || !link.target) continue;
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired = link.type === "advisor" ? 210 : 165 + Math.min(115, opportunityForLink(link)?.estimatedValue / 280000);
      const strength = link.type === "advisor" ? 0.0019 : 0.0032;
      const force = (distance - desired) * strength;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      if (!link.source.pinned) {
        link.source.vx += fx;
        link.source.vy += fy;
      }
      if (!link.target.pinned) {
        link.target.vx -= fx;
        link.target.vy -= fy;
      }
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!visible.has(a.id)) continue;
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (!visible.has(b.id)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = Math.max(dx * dx + dy * dy, 64);
        const dist = Math.sqrt(distSq);
        const minDist = a.radius + b.radius + 36;
        const force = dist < minDist ? (minDist - dist) * 0.026 : 135 / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!a.pinned) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!b.pinned) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    for (const node of nodes) {
      if (!visible.has(node.id)) continue;
      const anchorStrength = node.type === "advisor" ? 0.0065 : 0.0052;
      if (!node.pinned && node.anchor) {
        node.vx += (node.anchor.x - node.x) * anchorStrength;
        node.vy += (node.anchor.y - node.y) * anchorStrength;
      }
      node.vx *= 0.84;
      node.vy *= 0.84;
      if (!node.pinned) {
        node.x += node.vx;
        node.y += node.vy;
      }
      node.x = clamp(node.x, 70, state.width - 70);
      node.y = clamp(node.y, 70, state.height - 70);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);
    const visible = getVisibleNodeSet();
    const visibleLinks = getVisibleLinks(visible);

    ctx.save();
    ctx.translate(state.camera.x, state.camera.y);
    ctx.scale(state.camera.k, state.camera.k);

    drawMapBackground();
    drawLinks(visibleLinks);
    drawNodes(visible);

    ctx.restore();
  }

  function drawMapBackground() {
    const bounds = mapBounds();
    ctx.save();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
    ctx.lineWidth = 0.6;
    for (let lon = -120; lon <= 120; lon += 60) {
      const top = projectGeo(lon, bounds.latMax);
      const bottom = projectGeo(lon, bounds.latMin);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.stroke();
    }
    for (let lat = -40; lat <= 80; lat += 20) {
      const left = projectGeo(bounds.lonMin, lat);
      const right = projectGeo(bounds.lonMax, lat);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }

    if (state.worldMapLoaded) {
      drawGeoJsonMap();
    } else {
      drawFallbackMapShapes();
    }

    ctx.font = "600 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    REGIONS.forEach((region) => {
      const coord = REGION_COORDS[region.name];
      if (!coord) return;
      const point = projectGeo(coord.lon, coord.lat);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
      ctx.fill();
      ctx.fillStyle = "rgba(71, 85, 105, 0.52)";
      ctx.fillText(region.name, point.x, point.y - 13);
    });

    Object.entries(CITY_COORDS).forEach(([city, coord]) => {
      if (!["北京", "上海", "深圳", "广州", "东莞", "苏州", "杭州", "宁波", "厦门", "成都", "武汉", "南京", "马尼拉", "宿务"].includes(city)) return;
      const point = projectGeo(coord.lon, coord.lat);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 116, 139, 0.26)";
      ctx.fill();
      ctx.fillStyle = "rgba(71, 85, 105, 0.38)";
      ctx.fillText(city, point.x, point.y + 10);
    });

    ctx.restore();
  }

  function drawGeoJsonMap() {
    ctx.fillStyle = "rgba(226, 232, 240, 0.42)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.34)";
    ctx.lineWidth = 0.55;

    state.worldMapFeatures.forEach((feature) => {
      const geometry = feature.geometry;
      if (!geometry) return;
      if (geometry.type === "Polygon") drawGeoPolygon(geometry.coordinates);
      if (geometry.type === "MultiPolygon") geometry.coordinates.forEach(drawGeoPolygon);
    });
  }

  function drawGeoPolygon(rings) {
    if (!Array.isArray(rings)) return;
    ctx.beginPath();
    let hasPoints = false;
    rings.forEach((ring) => {
      if (!Array.isArray(ring) || ring.length < 3) return;
      ring.forEach(([lon, lat], index) => {
        const point = projectGeo(lon, lat);
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      hasPoints = true;
    });
    if (!hasPoints) return;
    ctx.fill();
    ctx.stroke();
  }

  function drawFallbackMapShapes() {
    MAP_LAND_SHAPES.forEach((shape) => {
      ctx.beginPath();
      shape.forEach(([lon, lat], index) => {
        const point = projectGeo(lon, lat);
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(226, 232, 240, 0.42)";
      ctx.fill();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.34)";
      ctx.lineWidth = 0.55;
      ctx.stroke();
    });
  }

  function drawLinks(links) {
    for (const link of links) {
      if (!link.source || !link.target) continue;
      const opportunity = opportunityForLink(link);
      const isSelected = state.selection?.type === "opportunity" && state.selection.id === link.id;
      const isHover = state.hover?.type === "link" && state.hover.id === link.id;

      if (link.type === "advisor") {
        ctx.setLineDash([]);
        ctx.lineWidth = isHover ? 1.1 : 0.45;
        ctx.strokeStyle = isHover ? "rgba(51, 65, 85, 0.46)" : "rgba(100, 116, 139, 0.16)";
      } else {
        ctx.setLineDash(opportunity.status === "potential" ? [4, 5] : []);
        ctx.lineWidth = graphLinkWidth(opportunity, isSelected || isHover);
        ctx.strokeStyle = isSelected || isHover ? "rgba(15, 23, 42, 0.5)" : "rgba(71, 85, 105, 0.18)";
      }
      drawCurvedLink(link);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawNodes(visible) {
    const query = state.filters.query;
    const sorted = [...state.nodes].sort((a, b) => (a.type === "advisor" ? 1 : 0) - (b.type === "advisor" ? 1 : 0));
    for (const node of sorted) {
      if (!visible.has(node.id)) continue;
      const isSelected = state.selection?.id === node.id;
      const isHover = state.hover?.type === "node" && state.hover.id === node.id;
      const isQueryHit = query && matchesQuery(node, query);

      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeClusterColor(node, isSelected || isHover || isQueryHit);
      ctx.fill();

      if (isSelected || isHover || isQueryHit || node.type === "advisor" || isLabelNode(node)) {
        drawNodeLabel(node, isSelected || isHover);
      }
      ctx.restore();
    }
  }

  function drawRoundRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function drawNodeLabel(node, strong) {
    const label = node.type === "advisor" ? shortAdvisorName(node) : shortCompanyName(node, strong);
    ctx.font = `${strong ? 700 : 500} ${strong ? 13 : 10}px Inter, Arial, sans-serif`;
    const y = node.y + node.radius + (strong ? 10 : 7);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = strong ? 4 : 3;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.strokeText(label, node.x, y);
    ctx.fillStyle = strong ? "#111827" : "rgba(15, 23, 42, 0.78)";
    ctx.fillText(label, node.x, y);
  }

  function getVisibleNodeSet() {
    const visible = new Set();
    const query = state.filters.query;

    for (const node of state.nodes) {
      if (node.type === "company") {
        if (state.filters.region !== "全部" && node.countryRegion !== state.filters.region) continue;
        if (query && !matchesQuery(node, query)) continue;
      } else if (query && !matchesQuery(node, query)) {
        continue;
      }
      visible.add(node.id);
    }

    for (const link of state.links) {
      const opportunity = opportunityForLink(link);
      if (link.type === "opportunity" && !passesOpportunityFilter(opportunity)) continue;
      if (!link.source || !link.target) continue;
      if (visible.has(link.source.id) || visible.has(link.target.id)) {
        if (link.source.type === "advisor" || link.target.type === "advisor") {
          visible.add(link.source.id);
          visible.add(link.target.id);
        }
      }
    }

    return visible;
  }

  function getVisibleLinks(visible) {
    return state.links.filter((link) => {
      if (!link.source || !link.target) return false;
      if (!visible.has(link.source.id) || !visible.has(link.target.id)) return false;
      if (link.type === "advisor") return state.filters.opportunityType === "全部";
      return passesOpportunityFilter(opportunityForLink(link));
    });
  }

  function passesOpportunityFilter(opportunity) {
    if (!opportunity) return false;
    if (opportunity.status === "potential" && !state.filters.showPotential) return false;
    if (opportunity.status === "active" && !state.filters.showActive) return false;
    if (state.filters.opportunityType !== "全部" && opportunity.opportunityType !== state.filters.opportunityType) return false;
    if (opportunity.expectedValue < state.filters.minExpectedValue) return false;
    return true;
  }

  function matchesQuery(node, query) {
    const text =
      node.type === "company"
        ? [
            node.name,
            node.countryRegion,
            node.city,
            node.industry,
            node.mainBusiness,
            node.needs.join(" "),
            node.resources.join(" "),
            node.painPoints.join(" "),
          ].join(" ")
        : [
            node.name,
            node.countryRegion,
            node.title,
            node.organization,
            node.capabilities.join(" "),
            node.industries.join(" "),
          ].join(" ");
    return text.toLowerCase().includes(query);
  }

  function opportunityForLink(link) {
    return link.type === "opportunity" ? state.opportunityById.get(link.opportunityId ?? link.id) : null;
  }

  function graphNodeRadius(node) {
    if (node.type === "advisor") {
      return clamp(5.2 + (Number(node.relationshipStrength) || 0) / 55, 5.4, 7.4);
    }
    const hub = Math.max(0, Number(node.hubScore) || 0);
    const degree = Math.max(0, Number(node.degree) || 0);
    return clamp(3.1 + Math.sqrt(hub) * 0.62 + Math.min(degree, 8) * 0.12, 3.4, 10.8);
  }

  function graphLinkWidth(opportunity, highlighted) {
    if (highlighted) return 1.35;
    return clamp(0.28 + linkWidth(opportunity?.estimatedValue || 0) * 0.12, 0.38, 0.95);
  }

  function drawCurvedLink(link) {
    const dx = link.target.x - link.source.x;
    const dy = link.target.y - link.source.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const curveSeed = (hashString(link.id) % 200) / 100 - 1;
    const curve = curveSeed * clamp(distance * 0.08, 12, 44);
    const midX = (link.source.x + link.target.x) / 2;
    const midY = (link.source.y + link.target.y) / 2;
    const controlX = midX + (-dy / distance) * curve;
    const controlY = midY + (dx / distance) * curve;

    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.quadraticCurveTo(controlX, controlY, link.target.x, link.target.y);
  }

  function nodeClusterColor(node, highlighted) {
    const color = node.type === "advisor" ? NODE_CLUSTER_COLORS.advisor : NODE_CLUSTER_COLORS[node.countryRegion] || "#64748b";
    return withAlpha(color, highlighted ? 0.95 : 0.84);
  }

  function isLabelNode(node) {
    if (node.type !== "company") return false;
    return (
      Number(node.hubScore) >= 25 ||
      Number(node.degree) >= 4 ||
      (Number(node.expectedValueRank) > 0 && Number(node.expectedValueRank) <= 8)
    );
  }

  function linkWidth(value) {
    return scaledLinkWidth(value);
  }

  function withAlpha(hex, alpha) {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function trimLabel(label, max) {
    return label.length > max ? `${label.slice(0, max)}…` : label;
  }

  function shortAdvisorName(advisor) {
    const name = String(advisor.name || "顾问").trim();
    if (/^[A-Za-z\s]+$/.test(name)) return name.split(/\s+/).slice(0, 2).join(" ");
    return trimLabel(name, 7);
  }

  function shortCompanyName(company, strong) {
    const name = String(company.name || "公司").trim();
    const city = normalizeCompanyCity(company.city) || inferCityFromText(name) || "";
    let base = city && name.startsWith(city) ? name.slice(city.length) : name;
    const business = String(company.mainBusiness || "").trim();
    if (business) base = base.replace(business, "");
    base = base
      .replace(/(有限责任公司|科技有限公司|智能制造公司|国际贸易公司|创新科技公司|产业集团|有限公司|集团|公司)$/g, "")
      .replace(/(有限责任|科技|智能制造|国际贸易|创新科技|产业)$/g, "")
      .trim();
    if (!base || base.length < 2) base = city ? `${city}${base || name.slice(0, 2)}` : name;
    return trimLabel(base, strong ? 10 : 6);
  }

  function hashString(value) {
    return String(value || "")
      .split("")
      .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0) >>> 0;
  }

  function onPointerDown(event) {
    if (event.pointerId !== undefined) {
      els.canvas.setPointerCapture?.(event.pointerId);
    }
    const point = getPointer(event);
    const node = hitNode(point.worldX, point.worldY);
    state.lastPointer = point;
    if (node) {
      state.draggingNode = node;
      node.pinned = true;
    } else {
      state.panning = true;
    }
  }

  function onPointerMove(event) {
    const point = getPointer(event);
    state.pointer = point;

    if (state.draggingNode) {
      state.draggingNode.x = point.worldX;
      state.draggingNode.y = point.worldY;
      state.draggingNode.vx = 0;
      state.draggingNode.vy = 0;
      state.needsRedraw = true;
      return;
    }

    if (state.panning && state.lastPointer) {
      state.camera.x += point.x - state.lastPointer.x;
      state.camera.y += point.y - state.lastPointer.y;
      state.lastPointer = point;
      state.needsRedraw = true;
      return;
    }

    const hoverNode = hitNode(point.worldX, point.worldY);
    const hoverLink = hoverNode ? null : hitLink(point.worldX, point.worldY);
    const nextHover = hoverNode
      ? { type: "node", id: hoverNode.id, node: hoverNode }
      : hoverLink
        ? { type: "link", id: hoverLink.id, link: hoverLink }
        : null;
    if (JSON.stringify(nextHover?.id) !== JSON.stringify(state.hover?.id) || nextHover?.type !== state.hover?.type) {
      state.hover = nextHover;
      state.needsRedraw = true;
      renderTooltip(point, nextHover);
    } else {
      renderTooltip(point, nextHover);
    }
  }

  function onPointerUp() {
    if (state.draggingNode) {
      state.draggingNode.pinned = false;
    }
    state.draggingNode = null;
    state.panning = false;
    state.lastPointer = null;
  }

  function onPointerLeave() {
    state.hover = null;
    state.draggingNode = null;
    state.panning = false;
    els.tooltip.hidden = true;
    state.needsRedraw = true;
  }

  function onWheel(event) {
    event.preventDefault();
    const point = getPointer(event);
    const oldK = state.camera.k;
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    const newK = clamp(oldK * factor, 0.45, 2.7);
    state.camera.x = point.x - (point.worldX * newK);
    state.camera.y = point.y - (point.worldY * newK);
    state.camera.k = newK;
    state.needsRedraw = true;
  }

  function onCanvasClick(event) {
    if (state.draggingNode || state.panning) return;
    const point = getPointer(event);
    const node = hitNode(point.worldX, point.worldY);
    if (node) {
      state.selection = { type: "node", id: node.id };
      renderDetail(node);
      state.needsRedraw = true;
      return;
    }
    const link = hitLink(point.worldX, point.worldY);
    if (link?.type === "opportunity") {
      state.selection = { type: "opportunity", id: link.id };
      renderDetail(state.opportunityById.get(link.id));
      state.needsRedraw = true;
      return;
    }
    state.selection = null;
    renderDetail(null);
    state.needsRedraw = true;
  }

  function onCanvasContextMenu(event) {
    event.preventDefault();
    if (!isAdmin()) {
      hideOpportunityContextMenu();
      flashTableSummary("当前为访客权限，只能查看");
      return;
    }
    const point = getPointer(event);
    const link = hitLink(point.worldX, point.worldY);
    if (link?.type !== "opportunity") {
      hideOpportunityContextMenu();
      return;
    }
    const opportunity = state.opportunityById.get(link.id);
    if (!opportunity) {
      hideOpportunityContextMenu();
      return;
    }
    state.contextOpportunityId = opportunity.id;
    state.selection = { type: "opportunity", id: opportunity.id };
    renderDetail(opportunity);
    state.needsRedraw = true;
    showOpportunityContextMenu(event.clientX, event.clientY);
  }

  function showOpportunityContextMenu(x, y) {
    const width = 164;
    const height = 48;
    els.opportunityContextMenu.style.left = `${Math.min(x, window.innerWidth - width - 8)}px`;
    els.opportunityContextMenu.style.top = `${Math.min(y, window.innerHeight - height - 8)}px`;
    els.opportunityContextMenu.hidden = false;
  }

  function hideOpportunityContextMenu() {
    els.opportunityContextMenu.hidden = true;
  }

  async function analyzeContextOpportunity(event) {
    event.stopPropagation();
    const opportunity = state.opportunityById.get(state.contextOpportunityId);
    hideOpportunityContextMenu();
    if (!opportunity) return;
    await analyzeOpportunityReport(opportunity);
  }

  async function analyzeOpportunityReport(opportunity) {
    openReportLoading(opportunity);
    try {
      const aiPayload = await callAiReportApi(buildOpportunityReportPayload(opportunity));
      openReportModal(normalizeOpportunityReport(aiPayload, opportunity));
    } catch (error) {
      console.warn("AI report failed, using local report", error);
      openReportModal(buildFallbackOpportunityReport(opportunity, error.message));
    }
  }

  function openReportLoading(opportunity) {
    const source = state.nodeById.get(opportunity.sourceCompanyId);
    const target = state.nodeById.get(opportunity.targetCompanyId);
    state.currentReport = null;
    els.reportTitle.textContent = "项目机会分析报告";
    els.reportMeta.textContent = `${source?.name || "来源公司"} → ${target?.name || "目标公司"}`;
    els.reportBody.innerHTML = `<p>正在生成 AI 简要报告...</p>`;
    els.reportModal.hidden = false;
  }

  function closeReportModal() {
    els.reportModal.hidden = true;
  }

  function openReportModal(report) {
    state.currentReport = report;
    els.reportTitle.textContent = report.title;
    els.reportMeta.textContent = `${report.sourceName} → ${report.targetName} · ${report.generatedAt}`;
    els.reportBody.innerHTML = renderReportHtml(report);
    els.reportModal.hidden = false;
  }

  function buildOpportunityReportPayload(opportunity) {
    const source = state.nodeById.get(opportunity.sourceCompanyId);
    const target = state.nodeById.get(opportunity.targetCompanyId);
    const advisor = opportunity.advisorId ? state.nodeById.get(opportunity.advisorId) : null;
    return {
      mode: "opportunity_report",
      model: state.aiConfig.model || DEFAULT_AI_CONFIG.model,
      prompt:
        "你是项目机会分析顾问。请输出简洁、可直接给管理者阅读的JSON报告，重点判断机会逻辑、价值、风险、下一步动作。",
      opportunity: {
        id: opportunity.id,
        type: opportunity.opportunityType,
        status: statusText(opportunity.status),
        description: opportunity.description,
        estimated_value: opportunity.estimatedValue,
        probability: opportunity.probability,
        confidence: opportunity.confidence,
        expected_value: opportunity.expectedValue,
        hub_score: opportunity.hubScore || 0,
        expected_value_rank: opportunity.expectedValueRank || null,
        evidence: opportunity.evidence,
        matched_needs: opportunity.matchedNeeds,
        risk_factors: opportunity.riskFactors || [],
        ai_summary: opportunity.aiSummary || "",
        ai_next_step: opportunity.aiNextStep || "",
        source_company: serializeCompanyForAi(source),
        target_company: serializeCompanyForAi(target),
        advisor: advisor ? serializeAdvisorForAi(advisor) : null,
      },
      output_schema: {
        report: {
          title: "string",
          executive_summary: "string",
          opportunity_logic: ["string"],
          value_assessment: "string",
          risks: ["string"],
          recommended_actions: ["string"],
          advisor_plan: "string",
          closing_note: "string",
        },
      },
    };
  }

  async function callAiReportApi(payload) {
    if (!state.aiConfig.enabled) throw new Error("未启用AI分析");
    const baseUrl = (state.aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl).trim();
    if (!baseUrl) throw new Error("未配置AI API地址");

    if (isProxyAiEndpoint(baseUrl)) {
      return extractReportJson(await postJson(baseUrl, payload));
    }
    throw new Error("生产环境只允许使用后端代理 /api/analyze-opportunities");
  }

  function extractReportJson(data) {
    if (data?.report) return data;
    const content = data?.choices?.[0]?.message?.content ?? data?.output_text ?? data?.content;
    if (!content) throw new Error("AI接口没有返回报告内容");
    return parseJsonFromText(content);
  }

  function createReportSystemPrompt(prompt) {
    return `${prompt || "你是项目机会分析顾问。"}

只返回JSON，不要输出Markdown。必须返回 report 对象，包含 title、executive_summary、opportunity_logic、value_assessment、risks、recommended_actions、advisor_plan、closing_note。`;
  }

  function normalizeOpportunityReport(aiPayload, opportunity) {
    const report = aiPayload.report || aiPayload;
    const base = buildFallbackOpportunityReport(opportunity, "");
    return {
      ...base,
      title: String(report.title || base.title).slice(0, 80),
      executiveSummary: String(report.executive_summary ?? report.executiveSummary ?? base.executiveSummary),
      opportunityLogic: arrayFromValue(report.opportunity_logic ?? report.opportunityLogic).length
        ? arrayFromValue(report.opportunity_logic ?? report.opportunityLogic)
        : base.opportunityLogic,
      valueAssessment: String(report.value_assessment ?? report.valueAssessment ?? base.valueAssessment),
      risks: arrayFromValue(report.risks ?? report.risk_factors ?? report.riskFactors).length
        ? arrayFromValue(report.risks ?? report.risk_factors ?? report.riskFactors)
        : base.risks,
      recommendedActions: arrayFromValue(report.recommended_actions ?? report.recommendedActions).length
        ? arrayFromValue(report.recommended_actions ?? report.recommendedActions)
        : base.recommendedActions,
      advisorPlan: String(report.advisor_plan ?? report.advisorPlan ?? base.advisorPlan),
      closingNote: String(report.closing_note ?? report.closingNote ?? base.closingNote),
      aiModel: aiPayload.model || state.aiConfig.model || DEFAULT_AI_CONFIG.model,
      statusNote: "AI生成",
    };
  }

  function buildFallbackOpportunityReport(opportunity, reason) {
    const source = state.nodeById.get(opportunity.sourceCompanyId);
    const target = state.nodeById.get(opportunity.targetCompanyId);
    const advisor = opportunity.advisorId ? state.nodeById.get(opportunity.advisorId) : null;
    const risks = arrayFromValue(opportunity.riskFactors);
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `report-${Date.now()}`,
      opportunityId: opportunity.id,
      title: `${opportunity.opportunityType}项目机会分析报告`,
      generatedAt: new Date().toLocaleString("zh-CN"),
      sourceName: source?.name || "来源公司",
      targetName: target?.name || "目标公司",
      advisorName: advisor?.name || "待确认",
      opportunityType: opportunity.opportunityType,
      estimatedValue: opportunity.estimatedValue,
      probability: opportunity.probability,
      expectedValue: opportunity.expectedValue,
      executiveSummary:
        opportunity.aiSummary ||
        `${source?.name || "来源公司"}与${target?.name || "目标公司"}存在${opportunity.opportunityType}机会，当前期望值约${formatOpportunityMoney(opportunity.expectedValue)}。`,
      opportunityLogic: opportunity.evidence?.length
        ? opportunity.evidence
        : [opportunity.description || "双方需求和资源存在可验证的业务连接点。"],
      valueAssessment: `机会规模约${formatOpportunityMoney(opportunity.estimatedValue)}，成交概率${formatPercent(opportunity.probability)}，期望值约${formatOpportunityMoney(opportunity.expectedValue)}。`,
      risks: risks.length ? risks : ["需进一步核验需求真实性、决策链路、预算周期和履约条件。"],
      recommendedActions: [
        opportunity.aiNextStep || "安排双方15-30分钟初步沟通，确认需求、预算和时间表。",
        advisor ? `由${advisor.name}补充资源背书和关键联系人。` : "补充合适顾问或关键联系人。",
        "形成一页式机会卡片，记录推进状态和下一次触达时间。",
      ],
      advisorPlan: advisor ? `${advisor.name}可作为推荐顾问，优先补充关系路径和历史案例。` : "当前尚未匹配明确顾问，建议补充行业和区域顾问资源。",
      closingNote: reason ? `AI报告生成未完成，已生成本地简报。原因：${reason}` : "建议进入机会池持续跟踪。",
      aiModel: state.aiConfig.model || DEFAULT_AI_CONFIG.model,
      statusNote: reason ? "本地生成" : "AI生成",
    };
  }

  function renderReportHtml(report) {
    return `
      <p><strong>报告类型：</strong>${escapeHtml(report.statusNote)} · ${escapeHtml(report.aiModel || "")}</p>
      <p><strong>机会类型：</strong>${escapeHtml(report.opportunityType)}　<strong>推荐顾问：</strong>${escapeHtml(report.advisorName)}</p>
      <p><strong>机会规模：</strong>${formatOpportunityMoney(report.estimatedValue)}　<strong>成交概率：</strong>${formatPercent(report.probability)}　<strong>期望值：</strong>${formatOpportunityMoney(report.expectedValue)}</p>
      <h3>摘要</h3>
      <p>${escapeHtml(report.executiveSummary)}</p>
      <h3>机会逻辑</h3>
      ${renderReportList(report.opportunityLogic)}
      <h3>价值判断</h3>
      <p>${escapeHtml(report.valueAssessment)}</p>
      <h3>主要风险</h3>
      ${renderReportList(report.risks)}
      <h3>建议动作</h3>
      ${renderReportList(report.recommendedActions, "ol")}
      <h3>顾问推进方案</h3>
      <p>${escapeHtml(report.advisorPlan)}</p>
      <h3>备注</h3>
      <p>${escapeHtml(report.closingNote)}</p>
    `;
  }

  function renderReportList(items, tagName = "ul") {
    const list = arrayFromValue(items);
    if (!list.length) return "<p>暂无。</p>";
    const tag = tagName === "ol" ? "ol" : "ul";
    return `<${tag}>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
  }

  async function saveCurrentReport() {
    if (!requireAdmin()) return;
    if (!state.currentReport) return;
    try {
      await postJson("/api/reports", state.currentReport);
    } catch (error) {
      console.warn("Failed to persist remote report, using local fallback", error);
      const reports = loadSavedReports();
      reports.unshift(state.currentReport);
      localStorage.setItem("3hk-hub-opportunity-reports", JSON.stringify(reports.slice(0, 30)));
    }
    els.reportMeta.textContent = `${state.currentReport.sourceName} → ${state.currentReport.targetName} · 已保存`;
  }

  function loadSavedReports() {
    try {
      const raw = localStorage.getItem("3hk-hub-opportunity-reports") || localStorage.getItem("aiconnect-opportunity-reports");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Failed to load saved reports", error);
      return [];
    }
  }

  function downloadCurrentReport() {
    if (!requireAdmin()) return;
    if (!state.currentReport) return;
    const report = state.currentReport;
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(report.title)}</title>
  <style>
    body { font-family: "Microsoft YaHei", Arial, sans-serif; color: #111827; line-height: 1.7; }
    h1 { font-size: 22px; }
    h2 { margin-top: 22px; font-size: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
    p, li { font-size: 12pt; }
    .meta { color: #4b5563; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
  <p class="meta">${escapeHtml(report.sourceName)} → ${escapeHtml(report.targetName)} · ${escapeHtml(report.generatedAt)}</p>
  ${renderReportHtml(report).replaceAll("<h3>", "<h2>").replaceAll("</h3>", "</h2>")}
</body>
</html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(report.title)}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function safeFileName(value) {
    return String(value || "项目机会分析报告")
      .replace(/[\\/:*?"<>|]/g, "")
      .slice(0, 48);
  }

  function getPointer(event) {
    const rect = els.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return {
      x,
      y,
      worldX: (x - state.camera.x) / state.camera.k,
      worldY: (y - state.camera.y) / state.camera.k,
    };
  }

  function hitNode(x, y) {
    const visible = getVisibleNodeSet();
    for (let i = state.nodes.length - 1; i >= 0; i -= 1) {
      const node = state.nodes[i];
      if (!visible.has(node.id)) continue;
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= SIMPLE_NODE_HIT_RADIUS) return node;
    }
    return null;
  }

  function hitLink(x, y) {
    const visible = getVisibleNodeSet();
    const links = getVisibleLinks(visible).filter((link) => link.type === "opportunity");
    let closest = null;
    let closestDistance = Infinity;
    for (const link of links) {
      const distance = pointToSegmentDistance(x, y, link.source.x, link.source.y, link.target.x, link.target.y);
      const opportunity = opportunityForLink(link);
      const tolerance = 6 + linkWidth(opportunity.estimatedValue) / 2;
      if (distance < tolerance && distance < closestDistance) {
        closest = link;
        closestDistance = distance;
      }
    }
    return closest;
  }

  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    const x = x1 + t * dx;
    const y = y1 + t * dy;
    return Math.hypot(px - x, py - y);
  }

  function renderTooltip(point, hover) {
    if (!hover) {
      els.tooltip.hidden = true;
      return;
    }
    let html = "";
    if (hover.type === "node") {
        const node = hover.node;
        html =
          node.type === "company"
            ? `<strong>${escapeHtml(node.name)}</strong>${escapeHtml(node.industry)}｜${escapeHtml(node.countryRegion)}${node.city ? `｜${escapeHtml(node.city)}` : ""}<br>营收：${formatRevenueMoney(node.revenue)}<br>Hub Score：${formatNumber(node.hubScore || 0)}<br>需求：${node.needs.map(escapeHtml).join("、")}`
            : `<strong>${escapeHtml(node.name)}</strong>${escapeHtml(node.title)}<br>${escapeHtml(node.organization)}<br>Hub Score：${formatNumber(node.hubScore || 0)}<br>能力：${node.capabilities.map(escapeHtml).join("、")}`;
    } else {
      const opportunity = opportunityForLink(hover.link);
      const source = state.nodeById.get(opportunity.sourceCompanyId);
      const target = state.nodeById.get(opportunity.targetCompanyId);
      html = `<strong>${escapeHtml(opportunity.opportunityType)}｜${statusText(opportunity.status)}</strong>${escapeHtml(source.name)}<br>→ ${escapeHtml(target.name)}<br>规模：${formatOpportunityMoney(opportunity.estimatedValue)}，概率：${formatPercent(opportunity.probability)}<br>Hub Score：${formatNumber(opportunity.hubScore || 0)}`;
    }
    els.tooltip.innerHTML = html;
    els.tooltip.style.left = `${Math.min(point.x + 14, state.width - 280)}px`;
    els.tooltip.style.top = `${Math.min(point.y + 14, state.height - 130)}px`;
    els.tooltip.hidden = false;
  }

  function renderAll() {
    renderStats();
    renderTopList();
    renderTable();
    state.needsRedraw = true;
  }

  function renderStats() {
    const totalExpected = state.opportunities.reduce((sum, item) => sum + item.expectedValue, 0);
    els.companyCount.textContent = state.companies.length;
    els.advisorCount.textContent = state.advisors.length;
    els.opportunityCount.textContent = state.opportunities.length;
    els.expectedTotal.textContent = formatOpportunityStatMoney(totalExpected);
  }

  function renderTopList() {
    const top = [...state.opportunities]
      .sort((a, b) => (b.hubScore || 0) - (a.hubScore || 0) || b.expectedValue - a.expectedValue)
      .slice(0, 5);
    els.topList.innerHTML = top
      .map((item) => {
        const source = state.nodeById.get(item.sourceCompanyId);
        const target = state.nodeById.get(item.targetCompanyId);
        return `<div class="top-item" data-id="${item.id}">
          <strong>${escapeHtml(item.opportunityType)}｜Hub ${formatNumber(item.hubScore || 0)}</strong>
          <span>${escapeHtml(trimLabel(source.name, 13))} → ${escapeHtml(trimLabel(target.name, 13))}</span>
          <span>${statusText(item.status)}，期望值 ${formatOpportunityMoney(item.expectedValue)}</span>
        </div>`;
      })
      .join("");
    els.topList.querySelectorAll(".top-item").forEach((item) => {
      item.addEventListener("click", () => {
        const opportunity = state.opportunityById.get(item.dataset.id);
        state.selection = { type: "opportunity", id: item.dataset.id };
        renderDetail(opportunity);
        focusOpportunity(opportunity);
        state.needsRedraw = true;
      });
    });
  }

  function focusOpportunity(opportunity) {
    const source = state.nodeById.get(opportunity.sourceCompanyId);
    const target = state.nodeById.get(opportunity.targetCompanyId);
    if (!source || !target) return;
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    state.camera.x = state.width / 2 - midX * state.camera.k;
    state.camera.y = state.height / 2 - midY * state.camera.k;
  }

  function renderDetail(item) {
    if (!item) {
      els.selectionBadge.textContent = "未选择";
      els.detailPanel.className = "detail-empty";
      els.detailPanel.innerHTML = "点击图谱节点或连线查看详情。";
      return;
    }
    els.detailPanel.className = "";
    if (item.type === "company") renderCompanyDetail(item);
    else if (item.type === "advisor") renderAdvisorDetail(item);
    else renderOpportunityDetail(item);
  }

  function renderCompanyDetail(company) {
    els.selectionBadge.textContent = "公司";
    const related = state.opportunities.filter(
      (item) => item.sourceCompanyId === company.id || item.targetCompanyId === company.id,
    );
    els.detailPanel.innerHTML = `
      <div class="detail-title">
        <h3>${escapeHtml(company.name)}</h3>
        <span class="node-kind">${escapeHtml(company.industry)}</span>
      </div>
      <div class="kv">
        <span>地区</span><strong>${escapeHtml(company.countryRegion)}</strong>
        <span>城市</span><strong>${escapeHtml(company.city || "未填写")}</strong>
        <span>主营业务</span><strong>${escapeHtml(company.mainBusiness)}</strong>
        <span>年收入</span><strong>${formatRevenueMoney(company.revenue)}</strong>
        <span>员工数</span><strong>${formatNumber(company.employeeCount)}</strong>
        <span>阶段</span><strong>${escapeHtml(company.companyStage)}</strong>
        <span>机会数</span><strong>${related.length}</strong>
        <span>Hub Score</span><strong>${formatNumber(company.hubScore || 0)}</strong>
        <span>Degree</span><strong>${formatNumber(company.degree || 0)}</strong>
        <span>Bridge Score</span><strong>${formatNumber(company.bridgeScore || 0)}</strong>
      </div>
      <div class="tag-list">${company.needs.map((tag) => `<span class="tag">需求：${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="tag-list">${company.resources.map((tag) => `<span class="tag">资源：${escapeHtml(tag)}</span>`).join("")}</div>
    `;
  }

  function renderAdvisorDetail(advisor) {
    els.selectionBadge.textContent = "顾问";
    const related = state.opportunities.filter((item) => item.advisorId === advisor.id);
    els.detailPanel.innerHTML = `
      <div class="detail-title">
        <h3>${escapeHtml(advisor.name)}</h3>
        <span class="node-kind">${escapeHtml(advisor.countryRegion)}</span>
      </div>
      <div class="kv">
        <span>头衔</span><strong>${escapeHtml(advisor.title)}</strong>
        <span>任职单位</span><strong>${escapeHtml(advisor.organization)}</strong>
        <span>关系强度</span><strong>${advisor.relationshipStrength}/100</strong>
        <span>覆盖机会</span><strong>${related.length}</strong>
        <span>Hub Score</span><strong>${formatNumber(advisor.hubScore || 0)}</strong>
        <span>Degree</span><strong>${formatNumber(advisor.degree || 0)}</strong>
        <span>Bridge Score</span><strong>${formatNumber(advisor.bridgeScore || 0)}</strong>
      </div>
      <div class="tag-list">${advisor.capabilities.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="tag-list">${advisor.industries.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    `;
  }

  function renderOpportunityDetail(opportunity) {
    els.selectionBadge.textContent = "机会";
    const source = state.nodeById.get(opportunity.sourceCompanyId);
    const target = state.nodeById.get(opportunity.targetCompanyId);
    const advisor = opportunity.advisorId ? state.nodeById.get(opportunity.advisorId) : null;
    els.detailPanel.innerHTML = `
      <div class="detail-title">
        <h3>${escapeHtml(opportunity.opportunityType)}</h3>
        <span class="node-kind">${statusText(opportunity.status)}</span>
      </div>
      <p>${escapeHtml(opportunity.description)}</p>
      <div class="kv">
        <span>来源公司</span><strong>${escapeHtml(source.name)}</strong>
        <span>目标公司</span><strong>${escapeHtml(target.name)}</strong>
        <span>推荐顾问</span><strong>${escapeHtml(advisor ? advisor.name : "待确认")}</strong>
        <span>机会规模</span><strong>${formatOpportunityMoney(opportunity.estimatedValue)}</strong>
        <span>成交概率</span><strong>${formatPercent(opportunity.probability)}</strong>
        <span>期望值</span><strong>${formatOpportunityMoney(opportunity.expectedValue)}</strong>
        <span>Hub Score</span><strong>${formatNumber(opportunity.hubScore || 0)}</strong>
        <span>价值排名</span><strong>${opportunity.expectedValueRank ? `#${opportunity.expectedValueRank}` : "未排序"}</strong>
        <span>备注</span><strong>${escapeHtml(opportunity.remark || "暂无")}</strong>
      </div>
      <div class="tag-list">${opportunity.evidence.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
      ${renderFollowUps(opportunity)}
      ${renderAiAnalysisDetail(opportunity)}
    `;
  }

  function renderFollowUps(opportunity) {
    const followUps = normalizeFollowUps(opportunity.followUps);
    if (!followUps.some(Boolean)) return "";
    return `<div class="followup-list">
      ${followUps.map((item, index) => `<div><span>跟进${index + 1}</span><strong>${escapeHtml(item || "未记录")}</strong></div>`).join("")}
    </div>`;
  }

  function renderAiAnalysisDetail(opportunity) {
    if (!opportunity.aiAnalyzedAt && !opportunity.riskFactors?.length) return "";
    const risks = arrayFromValue(opportunity.riskFactors);
    return `
      <div class="ai-analysis">
        <div class="ai-analysis-title">AI分析</div>
        ${opportunity.aiSummary ? `<p>${escapeHtml(opportunity.aiSummary)}</p>` : ""}
        ${opportunity.aiNextStep ? `<p><strong>下一步：</strong>${escapeHtml(opportunity.aiNextStep)}</p>` : ""}
        ${risks.length ? `<div class="tag-list">${risks.map((item) => `<span class="tag risk-tag">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
        ${opportunity.aiModel ? `<small>${escapeHtml(opportunity.aiModel)} · ${escapeHtml(opportunity.aiAnalyzedAt || "")}</small>` : ""}
      </div>
    `;
  }

  function renderTable() {
    if (state.activeTab === "companies") renderCompanyTable();
    if (state.activeTab === "advisors") renderAdvisorTable();
    if (state.activeTab === "opportunities") renderOpportunityTable();
  }

  function renderCompanyTable() {
    els.tableSummary.textContent = `公司数据库：${state.companies.length} 条`;
    const actionHeader = isAdmin() ? "<th>操作</th>" : "";
    const rows = state.companies
      .slice()
      .sort((a, b) => b.revenue - a.revenue)
      .map(
        (company) => `<tr>
          <td>${escapeHtml(company.name)}</td>
          <td>${escapeHtml(company.countryRegion)}</td>
          <td>${escapeHtml(company.city || "")}</td>
          <td>${escapeHtml(company.industry)}</td>
          <td>${escapeHtml(company.mainBusiness)}</td>
          <td class="money">${formatRevenueMoney(company.revenue)}</td>
          <td>${company.needs.map(escapeHtml).join("、")}</td>
          <td>${company.resources.map(escapeHtml).join("、")}</td>
          <td>${company.confidenceScore}</td>
          <td>${formatNumber(company.hubScore || 0)}</td>
          <td>${formatNumber(company.degree || 0)}</td>
          <td>${formatNumber(company.bridgeScore || 0)}</td>
          ${
            isAdmin()
              ? `<td class="row-actions">
            <button type="button" data-action="edit-company" data-id="${company.id}">编辑</button>
            <button type="button" data-action="delete-company" data-id="${company.id}">删除</button>
          </td>`
              : ""
          }
        </tr>`,
      )
      .join("");
    els.dataTable.innerHTML = `
      <thead><tr>
        <th>公司名称</th><th>地区</th><th>城市</th><th>行业</th><th>主营业务</th><th>收入规模（亿人民币）</th><th>痛点/需求</th><th>资源</th><th>可信度</th><th>Hub Score</th><th>Degree</th><th>Bridge</th>${actionHeader}
      </tr></thead>
      <tbody>${rows}</tbody>`;
    bindTableActions();
  }

  function renderAdvisorTable() {
    els.tableSummary.textContent = `顾问数据库：${state.advisors.length} 条`;
    const actionHeader = isAdmin() ? "<th>操作</th>" : "";
    const rows = state.advisors
      .map(
        (advisor) => `<tr>
          <td>${escapeHtml(advisor.name)}</td>
          <td>${escapeHtml(advisor.title)}</td>
          <td>${escapeHtml(advisor.organization)}</td>
          <td>${escapeHtml(advisor.countryRegion)}</td>
          <td>${advisor.capabilities.map(escapeHtml).join("、")}</td>
          <td>${advisor.industries.map(escapeHtml).join("、")}</td>
          <td>${advisor.regions.map(escapeHtml).join("、")}</td>
          <td>${advisor.relationshipStrength}</td>
          <td>${formatNumber(advisor.hubScore || 0)}</td>
          <td>${formatNumber(advisor.degree || 0)}</td>
          <td>${formatNumber(advisor.bridgeScore || 0)}</td>
          ${
            isAdmin()
              ? `<td class="row-actions">
            <button type="button" data-action="edit-advisor" data-id="${advisor.id}">编辑</button>
            <button type="button" data-action="delete-advisor" data-id="${advisor.id}">删除</button>
          </td>`
              : ""
          }
        </tr>`,
      )
      .join("");
    els.dataTable.innerHTML = `
      <thead><tr>
        <th>姓名</th><th>头衔</th><th>任职单位</th><th>地区</th><th>关键能力</th><th>覆盖行业</th><th>覆盖区域</th><th>关系强度</th><th>Hub Score</th><th>Degree</th><th>Bridge</th>${actionHeader}
      </tr></thead>
      <tbody>${rows}</tbody>`;
    bindTableActions();
  }

  function bindTableActions() {
    els.dataTable.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const { action, id } = button.dataset;
        if (action === "edit-company") openCompanyEditor(state.companies.find((item) => item.id === id));
        if (action === "edit-advisor") openAdvisorEditor(state.advisors.find((item) => item.id === id));
        if (action === "delete-company") deleteCompany(id);
        if (action === "delete-advisor") deleteAdvisor(id);
      });
    });
  }

  function openCompanyEditor(company = null) {
    if (!requireAdmin()) return;
    state.editing = { type: "company", id: company?.id ?? null };
    els.editTitle.textContent = company ? "编辑公司" : "新增公司";
    els.editForm.innerHTML = `
      <label><span>公司名称</span><input name="name" required value="${escapeAttr(company?.name ?? "")}" /></label>
      <label><span>国家/地区</span><input name="countryRegion" required value="${escapeAttr(company?.countryRegion ?? "中国大陆")}" /></label>
      <label><span>城市</span><input name="city" value="${escapeAttr(company?.city ?? "")}" placeholder="苏州 / 东莞 / 杭州 / 上海 / 深圳" /></label>
      <label><span>行业</span><input name="industry" required value="${escapeAttr(company?.industry ?? "新能源")}" /></label>
      <label><span>主营业务</span><input name="mainBusiness" required value="${escapeAttr(company?.mainBusiness ?? "")}" /></label>
      <label><span>年收入（亿人民币）</span><input name="revenue" required value="${escapeAttr(company ? toYi(company.revenue) : "")}" placeholder="8 或 8亿" /></label>
      <label><span>员工数</span><input name="employeeCount" value="${escapeAttr(company ? String(company.employeeCount) : "")}" /></label>
      <label><span>阶段</span><input name="companyStage" value="${escapeAttr(company?.companyStage ?? "扩张期")}" /></label>
      <label><span>需求/痛点</span><textarea name="needs" rows="3">${escapeHtml((company?.needs ?? []).join("、"))}</textarea></label>
      <label><span>资源能力</span><textarea name="resources" rows="3">${escapeHtml((company?.resources ?? []).join("、"))}</textarea></label>
      <label><span>可信度</span><input name="confidenceScore" value="${escapeAttr(company ? String(company.confidenceScore) : "85")}" /></label>
      <div class="edit-actions">
        <button class="primary" type="submit">保存并重新匹配</button>
        <button type="button" data-close-editor>取消</button>
      </div>`;
    els.editForm.onsubmit = saveCompanyFromEditor;
    els.editForm.querySelector("[data-close-editor]").addEventListener("click", closeEditor);
    els.editModal.hidden = false;
  }

  function openAdvisorEditor(advisor = null) {
    if (!requireAdmin()) return;
    state.editing = { type: "advisor", id: advisor?.id ?? null };
    els.editTitle.textContent = advisor ? "编辑顾问" : "新增顾问";
    els.editForm.innerHTML = `
      <label><span>姓名</span><input name="name" required value="${escapeAttr(advisor?.name ?? "")}" /></label>
      <label><span>头衔</span><input name="title" value="${escapeAttr(advisor?.title ?? "")}" /></label>
      <label><span>任职单位</span><input name="organization" value="${escapeAttr(advisor?.organization ?? "")}" /></label>
      <label><span>国家/地区</span><input name="countryRegion" value="${escapeAttr(advisor?.countryRegion ?? "中国大陆")}" /></label>
      <label><span>关键能力</span><textarea name="capabilities" rows="3">${escapeHtml((advisor?.capabilities ?? []).join("、"))}</textarea></label>
      <label><span>覆盖行业</span><textarea name="industries" rows="3">${escapeHtml((advisor?.industries ?? []).join("、"))}</textarea></label>
      <label><span>覆盖区域</span><textarea name="regions" rows="3">${escapeHtml((advisor?.regions ?? []).join("、"))}</textarea></label>
      <label><span>关系强度</span><input name="relationshipStrength" value="${escapeAttr(advisor ? String(advisor.relationshipStrength) : "75")}" /></label>
      <label><span>案例</span><textarea name="cases" rows="3">${escapeHtml((advisor?.cases ?? []).join("、"))}</textarea></label>
      <div class="edit-actions">
        <button class="primary" type="submit">保存并重新匹配</button>
        <button type="button" data-close-editor>取消</button>
      </div>`;
    els.editForm.onsubmit = saveAdvisorFromEditor;
    els.editForm.querySelector("[data-close-editor]").addEventListener("click", closeEditor);
    els.editModal.hidden = false;
  }

  function saveCompanyFromEditor(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(els.editForm).entries());
    const company = {
      id: state.editing.id ?? nextId("c", state.companies),
      type: "company",
      name: data.name.trim(),
      countryRegion: data.countryRegion.trim(),
      city: normalizeCompanyCity(data.city),
      industry: data.industry.trim(),
      mainBusiness: data.mainBusiness.trim(),
      revenue: parseRevenueInput(data.revenue),
      employeeCount: Number(data.employeeCount) || 0,
      companyStage: data.companyStage.trim() || "扩张期",
      painPoints: splitTags(data.needs),
      needs: splitTags(data.needs),
      resources: splitTags(data.resources),
      source: "人工维护",
      confidenceScore: Number(data.confidenceScore) || 85,
      createdAt: new Date().toISOString().slice(0, 10),
      isNew: false,
    };
    company.radius = graphNodeRadius(company);
    upsertById(state.companies, company);
    closeEditor();
    recomputeDataset(true);
  }

  function saveAdvisorFromEditor(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(els.editForm).entries());
    const advisor = {
      id: state.editing.id ?? nextId("a", state.advisors),
      type: "advisor",
      name: data.name.trim(),
      title: data.title.trim(),
      organization: data.organization.trim(),
      countryRegion: data.countryRegion.trim(),
      capabilities: splitTags(data.capabilities),
      industries: splitTags(data.industries),
      regions: splitTags(data.regions),
      relationshipStrength: clamp(Number(data.relationshipStrength) || 75, 1, 100),
      cases: splitTags(data.cases),
    };
    upsertById(state.advisors, advisor);
    closeEditor();
    recomputeDataset(true);
  }

  function closeEditor() {
    state.editing = null;
    els.editModal.hidden = true;
    els.editForm.innerHTML = "";
  }

  function deleteCompany(id) {
    if (!requireAdmin()) return;
    if (!confirm("确认删除这家公司？相关机会会重新生成。")) return;
    state.companies = state.companies.filter((item) => item.id !== id);
    recomputeDataset(true);
  }

  function deleteAdvisor(id) {
    if (!requireAdmin()) return;
    if (!confirm("确认删除这位顾问？相关机会会重新生成。")) return;
    state.advisors = state.advisors.filter((item) => item.id !== id);
    recomputeDataset(true);
  }

  function renderOpportunityTable() {
    const filtered = state.opportunities.filter(passesOpportunityFilter).sort((a, b) => b.expectedValue - a.expectedValue);
    els.tableSummary.textContent = `机会池：${filtered.length} / ${state.opportunities.length} 条`;
    const rows = filtered
      .map((opportunity) => {
        const source = state.nodeById.get(opportunity.sourceCompanyId);
        const target = state.nodeById.get(opportunity.targetCompanyId);
        const advisor = opportunity.advisorId ? state.nodeById.get(opportunity.advisorId) : null;
        return `<tr>
          <td><span class="status-pill status-${escapeAttr(opportunity.status)}">${statusText(opportunity.status)}</span></td>
          <td>${escapeHtml(opportunity.opportunityType)}${opportunity.aiAnalyzedAt ? '<span class="ai-badge">AI</span>' : ""}</td>
          <td>${escapeHtml(source.name)}</td>
          <td>${escapeHtml(target.name)}</td>
          <td>${escapeHtml(advisor ? advisor.name : "待确认")}</td>
          <td class="money">${formatOpportunityMoney(opportunity.estimatedValue)}</td>
          <td>${formatPercent(opportunity.probability)}</td>
          <td class="money">${formatOpportunityMoney(opportunity.expectedValue)}</td>
          <td>${formatNumber(opportunity.hubScore || 0)}</td>
          <td>${opportunity.expectedValueRank ? `#${opportunity.expectedValueRank}` : ""}</td>
          <td>${escapeHtml(opportunity.remark || "")}</td>
          ${normalizeFollowUps(opportunity.followUps).map((item) => `<td>${escapeHtml(item)}</td>`).join("")}
        </tr>`;
      })
      .join("");
    els.dataTable.innerHTML = `
      <thead><tr>
        <th>状态</th><th>类型</th><th>来源公司</th><th>目标公司</th><th>顾问</th><th>机会规模（百万人民币）</th><th>概率</th><th>期望值（百万人民币）</th><th>Hub Score</th><th>价值排名</th><th>备注</th><th>跟进1</th><th>跟进2</th><th>跟进3</th><th>跟进4</th><th>跟进5</th>
      </tr></thead>
      <tbody>${rows}</tbody>`;
  }

  async function handleAiInput() {
    if (!requireAdmin()) return;
    const text = els.aiInput.value.trim();
    if (!text) {
      els.aiResult.textContent = "请输入企业机会信息。";
      return;
    }

    const previousButtonText = els.parseButton.textContent;
    els.parseButton.disabled = true;
    els.parseButton.textContent = "分析中...";
    els.aiResult.textContent = state.aiConfig.enabled ? "正在解析并请求 AI 分析..." : "正在按规则解析并匹配...";

    try {
      const parsed = parseOpportunityInput(text);
      const company = createCompanyFromParsed(parsed, text);
      state.companies.push(company);
      state.nodes.push(company);
      state.nodeById.set(company.id, company);

      placeNewCompany(company);
      const localCandidates = matchNewCompany(company).slice(0, 12);
      const aiResult = await analyzeCandidateOpportunities(company, localCandidates, text);
      const newOpportunities = aiResult.opportunities.slice(0, 7);
      const nextIndex = state.opportunities.length + 1;
      newOpportunities.forEach((opportunity, index) => {
        opportunity.id = `o${nextIndex + index}`;
        opportunity.status = "potential";
        state.opportunities.push(opportunity);
      });

      const newAdvisorLinks = generateAdvisorLinks([company], state.advisors);
      state.advisorLinks.push(...newAdvisorLinks);
      rebuildGraph();
      saveData();
      state.selection = { type: "node", id: company.id };
      renderDetail(company);
      renderAll();

      const highestExpectedValue = newOpportunities.length
        ? Math.max(...newOpportunities.map((item) => item.expectedValue))
        : 0;
      const analysisLabel = aiResult.usedAi ? "AI已分析" : aiResult.message;
      els.aiResult.innerHTML = `<strong>已入库：</strong>${escapeHtml(company.name)}；新增 ${newOpportunities.length} 条潜在机会。最高期望值 ${formatOpportunityMoney(
        highestExpectedValue,
      )}。<br>${escapeHtml(analysisLabel)}`;
    } catch (error) {
      els.aiResult.textContent = `解析失败：${error.message}`;
    } finally {
      els.parseButton.disabled = false;
      els.parseButton.textContent = previousButtonText;
    }
  }

  function parseOpportunityInput(text) {
    const region = detectRegion(text);
    const industry = detectIndustry(text);
    const revenue = detectRevenue(text);
    const needs = detectNeeds(text);
    const mainBusiness = pick(INDUSTRIES[industry].business);
    const nameMatch = text.match(/(?:公司名|企业名|叫|名为)([\u4e00-\u9fa5A-Za-z0-9]{2,20})/);
    const cityMatch = text.match(/(深圳|上海|北京|苏州|杭州|广州|东莞|南京|无锡|佛山|珠海|成都|武汉|厦门|宁波|香港|新加坡|迪拜|首尔|东京|马尼拉|宿务)/);
    const prefix = nameMatch?.[1] ?? `${cityMatch?.[1] ?? region}${industry}`;
    return {
      name: `${prefix}机会公司${state.companies.length + 1}`,
      region,
      city: normalizeCompanyCity(cityMatch?.[1] || (region === "香港" ? "香港" : "")),
      industry,
      revenue,
      mainBusiness,
      needs,
      resources: sample(INDUSTRIES[industry].resources, 3),
    };
  }

  function detectRegion(text) {
    if (/香港/.test(text) && !/深圳|上海|北京|苏州|杭州|广州|成都|武汉|厦门|宁波/.test(text)) return "香港";
    if (/菲律宾|马尼拉|宿务/.test(text)) return "菲律宾";
    if (/新加坡/.test(text)) return "新加坡";
    if (/中东|迪拜|沙特|海湾/.test(text)) return "中东";
    if (/东南亚|越南|泰国|印尼|马来/.test(text)) return "东南亚";
    if (/美国|硅谷/.test(text)) return "美国";
    if (/欧洲|德国|法国|英国/.test(text)) return "欧洲";
    if (/日本|东京/.test(text)) return "日本";
    if (/韩国|首尔/.test(text)) return "韩国";
    return "中国大陆";
  }

  function detectIndustry(text) {
    const rules = [
      ["新能源", /新能源|储能|光伏|电池|充电/],
      ["半导体", /半导体|芯片|封测|EDA|功率器件/],
      ["医疗器械", /医疗|器械|影像|IVD|医院|临床/],
      ["工业自动化", /工业|自动化|机器人|产线|视觉/],
      ["SaaS", /SaaS|软件|CRM|数据中台|协同/],
      ["消费电子", /消费电子|智能硬件|穿戴|电子/],
      ["跨境电商", /跨境|电商|独立站|海外仓/],
      ["食品饮料", /食品|饮料|零食|预制/],
      ["物流", /物流|仓储|冷链|港口/],
      ["金融科技", /金融科技|支付|风控|供应链金融/],
    ];
    return rules.find(([, regex]) => regex.test(text))?.[0] ?? "新能源";
  }

  function detectRevenue(text) {
    const yi = text.match(/(\d+(?:\.\d+)?)\s*亿/);
    if (yi) return Math.round(Number(yi[1]) * 100000000);
    const wan = text.match(/(\d+(?:\.\d+)?)\s*万/);
    if (wan) return Math.round(Number(wan[1]) * 10000);
    return Math.round((0.8 + rng() * 7.2) * 100000000);
  }

  function detectNeeds(text) {
    const needs = new Set();
    if (/中东|海湾|沙特|迪拜/.test(text)) needs.add("中东客户");
    if (/东南亚|越南|泰国|印尼|马来/.test(text)) needs.add("东南亚渠道");
    if (/客户|市场|渠道|出海/.test(text)) needs.add("客户拓展");
    if (/供应商|降本|采购|工厂/.test(text)) needs.add("供应链降本");
    if (/融资|基金|投资/.test(text)) needs.add("融资");
    if (/香港上市|上市|IPO/.test(text)) needs.add("香港上市");
    if (/技术|研发|专利|合作/.test(text)) needs.add("技术合作");
    if (!needs.size) needs.add("客户拓展");
    return [...needs].slice(0, 4);
  }

  function createCompanyFromParsed(parsed, rawText) {
    const company = {
      id: `c${state.companies.length + 1}`,
      type: "company",
      name: parsed.name,
      countryRegion: parsed.region,
      city: parsed.city,
      industry: parsed.industry,
      mainBusiness: parsed.mainBusiness,
      revenue: parsed.revenue,
      employeeCount: Math.round(clamp(parsed.revenue / 900000 + 150 + rng() * 900, 60, 16000)),
      companyStage: parsed.revenue > 1000000000 ? "成长期" : "扩张期",
      painPoints: generatePainPoints(parsed.industry, parsed.needs),
      needs: parsed.needs,
      resources: parsed.resources,
      source: "AI录入",
      rawInput: rawText,
      confidenceScore: 84,
      createdAt: new Date().toISOString().slice(0, 10),
      isNew: true,
    };
    company.radius = graphNodeRadius(company);
    return company;
  }

  function placeNewCompany(company) {
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    company.x = centerX + (rng() - 0.5) * 90;
    company.y = centerY + (rng() - 0.5) * 90;
    company.vx = 0;
    company.vy = 0;
    company.anchor = {
      x: centerX + (rng() - 0.5) * state.width * 0.4,
      y: centerY + (rng() - 0.5) * state.height * 0.4,
    };
  }

  function matchNewCompany(company) {
    return state.companies
      .filter((item) => item.id !== company.id)
      .flatMap((item) => [evaluateOpportunity(company, item, state.advisors), evaluateOpportunity(item, company, state.advisors)])
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .slice(0, 12);
  }

  async function analyzeCandidateOpportunities(company, candidates, rawText) {
    const candidatesWithIds = candidates.map((opportunity, index) => ({
      ...opportunity,
      candidateId: `candidate-${index + 1}`,
    }));

    if (!state.aiConfig.enabled) {
      return { usedAi: false, message: "未启用AI分析，已使用规则匹配", opportunities: candidatesWithIds };
    }

    try {
      const payload = buildAiAnalysisPayload(company, candidatesWithIds, rawText);
      const aiPayload = await callAiAnalysisApi(payload);
      return {
        usedAi: true,
        message: `AI已分析：${state.aiConfig.provider || "OpenAI-compatible"} / ${state.aiConfig.model}`,
        opportunities: mergeAiAnalysis(candidatesWithIds, aiPayload),
      };
    } catch (error) {
      console.warn("AI analysis failed, falling back to rule-based matches", error);
      return {
        usedAi: false,
        message: `AI分析未完成，已使用规则匹配：${error.message}`,
        opportunities: candidatesWithIds,
      };
    }
  }

  function buildAiAnalysisPayload(company, candidates, rawText) {
    return {
      model: state.aiConfig.model || DEFAULT_AI_CONFIG.model,
      prompt: createAiSystemPrompt(),
      rawInput: rawText,
      newCompany: serializeCompanyForAi(company),
      candidates: candidates.map((opportunity) => {
        const source = state.nodeById.get(opportunity.sourceCompanyId);
        const target = state.nodeById.get(opportunity.targetCompanyId);
        const advisor = opportunity.advisorId ? state.nodeById.get(opportunity.advisorId) : null;
        return {
          candidate_id: opportunity.candidateId,
          rule_score: trimNumber(opportunity.score || 0),
          opportunity_type: opportunity.opportunityType,
          source_company: serializeCompanyForAi(source),
          target_company: serializeCompanyForAi(target),
          recommended_advisor: advisor ? serializeAdvisorForAi(advisor) : null,
          estimated_value: opportunity.estimatedValue,
          probability: opportunity.probability,
          confidence: opportunity.confidence,
          expected_value: opportunity.expectedValue,
          hub_score: opportunity.hubScore || 0,
          expected_value_rank: opportunity.expectedValueRank || null,
          evidence: opportunity.evidence,
        };
      }),
      output_schema: {
        opportunities: [
          {
            candidate_id: "candidate-1",
            opportunity_type: "采购/供应链/融资/香港上市/技术合作/客户拓展/投资并购/渠道出海",
            recommended_advisor: "顾问姓名或空字符串",
            estimated_value: "number",
            probability: "0-1",
            confidence: "0-1",
            expected_value: "number",
            evidence: ["string"],
            risk_factors: ["string"],
            summary: "一句话机会判断",
            next_step: "下一步动作",
          },
        ],
      },
    };
  }

  function serializeCompanyForAi(company) {
    if (!company) return null;
    return {
      id: company.id,
      name: company.name,
      region: company.countryRegion,
      city: company.city || "",
      industry: company.industry,
      main_business: company.mainBusiness,
      revenue: company.revenue,
      employee_count: company.employeeCount,
      stage: company.companyStage,
      needs: company.needs,
      resources: company.resources,
      pain_points: company.painPoints,
      confidence_score: company.confidenceScore,
      hub_score: company.hubScore || 0,
      degree: company.degree || 0,
      bridge_score: company.bridgeScore || 0,
    };
  }

  function serializeAdvisorForAi(advisor) {
    return {
      id: advisor.id,
      name: advisor.name,
      title: advisor.title,
      organization: advisor.organization,
      region: advisor.countryRegion,
      capabilities: advisor.capabilities,
      industries: advisor.industries,
      regions: advisor.regions,
      relationship_strength: advisor.relationshipStrength,
      cases: advisor.cases,
      hub_score: advisor.hubScore || 0,
      degree: advisor.degree || 0,
      bridge_score: advisor.bridgeScore || 0,
    };
  }

  function createAiSystemPrompt() {
    return `${state.aiConfig.prompt || DEFAULT_AI_CONFIG.prompt}

只返回JSON，不要输出Markdown。请基于候选机会做重排和校准，不要新增不存在的candidate_id。最多返回7条机会。`;
  }

  async function callAiAnalysisApi(payload) {
    const baseUrl = (state.aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl).trim();
    if (!baseUrl) throw new Error("未配置AI API地址");

    if (isProxyAiEndpoint(baseUrl)) {
      return extractAiJson(await postJson(baseUrl, payload));
    }

    throw new Error("生产环境只允许使用后端代理 /api/analyze-opportunities");
  }

  function isProxyAiEndpoint(baseUrl) {
    return baseUrl.startsWith("/") || /\/api\/analyze-opportunities\/?$/i.test(baseUrl);
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readJsonResponse(response);
  }

  async function readJsonResponse(response) {
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error(`AI接口返回了非JSON内容：${text.slice(0, 120)}`);
    }
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `AI接口请求失败：${response.status}`);
    }
    return data;
  }

  function extractAiJson(data) {
    if (data?.opportunities) return data;
    const content = data?.choices?.[0]?.message?.content ?? data?.output_text ?? data?.content;
    if (!content) throw new Error("AI接口没有返回分析内容");
    return parseJsonFromText(content);
  }

  function parseJsonFromText(content) {
    const text = String(content).trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(text);
    } catch (error) {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
      throw new Error("AI返回内容不是有效JSON");
    }
  }

  function mergeAiAnalysis(candidates, aiPayload) {
    const byId = new Map(candidates.map((item) => [item.candidateId, item]));
    const used = new Set();
    const rows = Array.isArray(aiPayload?.opportunities) ? aiPayload.opportunities : [];
    const merged = [];

    rows.forEach((row) => {
      const candidateId = String(row.candidate_id ?? row.candidateId ?? "");
      const base = byId.get(candidateId);
      if (!base) return;
      used.add(candidateId);
      const updated = { ...base };
      const type = normalizeOpportunityType(row.opportunity_type ?? row.opportunityType);
      if (type) updated.opportunityType = type;

      const advisorId = findAdvisorId(row.recommended_advisor ?? row.recommendedAdvisor);
      if (advisorId) updated.advisorId = advisorId;

      const estimatedValue = moneyFromAi(row.estimated_value ?? row.estimatedValue);
      if (estimatedValue > 0) updated.estimatedValue = estimatedValue;

      const probability = probabilityFromAi(row.probability);
      if (Number.isFinite(probability)) updated.probability = probability;

      const confidence = probabilityFromAi(row.confidence);
      if (Number.isFinite(confidence)) updated.confidence = confidence;

      const expectedValue = moneyFromAi(row.expected_value ?? row.expectedValue);
      updated.expectedValue =
        expectedValue > 0 ? expectedValue : Math.round(updated.estimatedValue * updated.probability * updated.confidence);
      updated.priorityScore = Math.round((Number(row.priority_score ?? row.priorityScore) || updated.priorityScore || 0) + updated.expectedValue / 1000000);
      updated.evidence = arrayFromValue(row.evidence).length ? arrayFromValue(row.evidence).slice(0, 4) : updated.evidence;
      updated.riskFactors = arrayFromValue(row.risk_factors ?? row.riskFactors).slice(0, 4);
      updated.aiSummary = String(row.summary ?? row.analysis ?? "").slice(0, 280);
      updated.aiNextStep = String(row.next_step ?? row.nextStep ?? "").slice(0, 220);
      updated.aiModel = state.aiConfig.model || DEFAULT_AI_CONFIG.model;
      updated.aiAnalyzedAt = new Date().toISOString();
      merged.push(updated);
    });

    candidates.forEach((item) => {
      if (!used.has(item.candidateId)) merged.push(item);
    });

    return merged.sort((a, b) => {
      const aScore = a.aiAnalyzedAt ? a.expectedValue * 1.08 : a.expectedValue;
      const bScore = b.aiAnalyzedAt ? b.expectedValue * 1.08 : b.expectedValue;
      return bScore - aScore;
    });
  }

  function normalizeOpportunityType(value) {
    const type = String(value || "").trim();
    return OPPORTUNITY_TYPES.includes(type) ? type : null;
  }

  function findAdvisorId(value) {
    if (!value) return null;
    const name = typeof value === "string" ? value : value.name;
    if (!name) return null;
    return state.advisors.find((advisor) => name.includes(advisor.name) || advisor.name.includes(name))?.id ?? null;
  }

  function moneyFromAi(value) {
    if (Number.isFinite(Number(value))) return Math.round(Number(value));
    return Math.round(parseMoneyInput(value));
  }

  function probabilityFromAi(value) {
    if (value === undefined || value === null || value === "") return NaN;
    if (typeof value === "string" && value.includes("%")) {
      return clamp(Number(value.replace(/[^\d.]/g, "")) / 100, 0.01, 0.99);
    }
    const number = Number(String(value).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(number)) return NaN;
    return clamp(number > 1 ? number / 100 : number, 0.01, 0.99);
  }

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      els.aiResult.textContent = "当前浏览器不支持语音识别，可以直接使用文字录入。";
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      els.aiResult.textContent = "正在听写...";
      els.voiceButton.disabled = true;
    };
    recognition.onresult = (event) => {
      els.aiInput.value = event.results[0][0].transcript;
      els.aiResult.textContent = "语音已转文字，请确认后解析。";
    };
    recognition.onerror = () => {
      els.aiResult.textContent = "语音识别失败，请改用文字录入。";
    };
    recognition.onend = () => {
      els.voiceButton.disabled = false;
    };
    recognition.start();
  }

  function recomputeDataset(shouldSave) {
    normalizeData();
    state.opportunities = generateOpportunities(state.companies, state.advisors, opportunityCountFor(state.companies));
    state.advisorLinks = generateAdvisorLinks(state.companies, state.advisors);
    rebuildGraph();
    seedPositions();
    renderDetail(null);
    renderAll();
    if (shouldSave) saveData();
  }

  function normalizeData() {
    state.companies = state.companies.map((company, index) => ({
      ...company,
      id: company.id || `c${index + 1}`,
      type: "company",
      city: normalizeCompanyCity(company.city || inferCityFromText(company.name)),
      revenue: Number(company.revenue) || 0,
      employeeCount: Number(company.employeeCount) || 0,
      needs: arrayFromValue(company.needs),
      resources: arrayFromValue(company.resources),
      painPoints: arrayFromValue(company.painPoints?.length ? company.painPoints : company.needs),
      confidenceScore: Number(company.confidenceScore) || 80,
      radius: graphNodeRadius(company),
    }));
    state.advisors = state.advisors.map((advisor, index) => ({
      ...advisor,
      id: advisor.id || `a${index + 1}`,
      type: "advisor",
      capabilities: arrayFromValue(advisor.capabilities ?? advisor.resource_tags),
      industries: arrayFromValue(advisor.industries ?? advisor.industries_covered),
      regions: arrayFromValue(advisor.regions ?? advisor.regions_covered),
      cases: arrayFromValue(advisor.cases ?? advisor.past_cases),
      relationshipStrength: clamp(Number(advisor.relationshipStrength) || 70, 1, 100),
    }));
    state.opportunities = state.opportunities.map((opportunity, index) => ({
      ...opportunity,
      id: opportunity.id || `o${index + 1}`,
      estimatedValue: Number(opportunity.estimatedValue) || 0,
      probability: Number(opportunity.probability) || 0,
      confidence: Number(opportunity.confidence) || 0.65,
      expectedValue: Number(opportunity.expectedValue) || 0,
      evidence: arrayFromValue(opportunity.evidence),
      matchedNeeds: arrayFromValue(opportunity.matchedNeeds),
      riskFactors: arrayFromValue(opportunity.riskFactors ?? opportunity.risk_factors),
      remark: String(opportunity.remark ?? opportunity.note ?? opportunity.notes ?? ""),
      followUps: normalizeFollowUps(opportunity.followUps ?? [
        opportunity.followUp1 ?? opportunity.follow_up_1,
        opportunity.followUp2 ?? opportunity.follow_up_2,
        opportunity.followUp3 ?? opportunity.follow_up_3,
        opportunity.followUp4 ?? opportunity.follow_up_4,
        opportunity.followUp5 ?? opportunity.follow_up_5,
      ]),
    }));
  }

  async function saveData() {
    try {
      await saveDataset({
        companies: state.companies,
        advisors: state.advisors,
        opportunities: state.opportunities,
      });
    } catch (error) {
      console.warn("Failed to save remote data, using local fallback", error);
      try {
        localStorage.setItem(
          "3hk-hub-local-migration-data",
          JSON.stringify({
            companies: state.companies,
            advisors: state.advisors,
            opportunities: state.opportunities,
          }),
        );
      } catch (storageError) {
        console.warn("Failed to save local fallback data", storageError);
      }
    }
  }

  async function loadSavedData() {
    try {
      const remote = await loadDataset();
      if (Array.isArray(remote.companies) && Array.isArray(remote.advisors) && remote.companies.length) {
        return {
          companies: remote.companies,
          advisors: remote.advisors,
          opportunities: Array.isArray(remote.opportunities) ? remote.opportunities : [],
        };
      }
    } catch (error) {
      console.warn("Failed to load remote data, using local fallback", error);
    }
    try {
      const raw = localStorage.getItem("3hk-hub-local-migration-data") || localStorage.getItem("aiconnect-demo-data");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.companies) || !Array.isArray(parsed.advisors)) return null;
      return {
        companies: parsed.companies,
        advisors: parsed.advisors,
        opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      };
    } catch (error) {
      console.warn("Failed to load fallback data", error);
      return null;
    }
  }

  async function importExcel(event) {
    if (!requireAdmin()) {
      els.importExcelFile.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const xlsx = await ensureXlsxLibrary();
      const workbook = xlsx.read(await file.arrayBuffer(), { type: "array" });
      const imported = parseExcelWorkbook(workbook, xlsx);
      if (!imported.companies.length && !imported.advisors.length && !imported.opportunities.length) {
        throw new Error("Excel里没有识别到公司、顾问或机会数据");
      }

      if (imported.companies.length) state.companies = imported.companies;
      if (imported.advisors.length) state.advisors = imported.advisors;
      state.opportunities = imported.opportunities;
      if (imported.opportunities.length) {
        normalizeData();
        state.advisorLinks = generateAdvisorLinks(state.companies, state.advisors);
        rebuildGraph();
        seedPositions();
        renderDetail(null);
        renderAll();
        saveData();
      } else {
        recomputeDataset(true);
      }
      flashTableSummary(`Excel导入成功：${imported.companies.length || state.companies.length} 家公司`);
    } catch (error) {
      alert(`Excel导入失败：${error.message}`);
    } finally {
      els.importExcelFile.value = "";
    }
  }

  async function exportExcel() {
    if (!requireAdmin()) return;
    try {
      const xlsx = await ensureXlsxLibrary();
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(state.companies.map(companyToExcelRow)), "公司数据库");
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(state.advisors.map(advisorToExcelRow)), "顾问数据库");
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(state.opportunities.map(opportunityToExcelRow)), "机会池");
      xlsx.writeFile(workbook, `3hk-hub-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      alert(`Excel导出失败：${error.message}`);
    }
  }

  function ensureXlsxLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX库加载失败")));
      script.onerror = () => reject(new Error("XLSX库加载失败，请检查网络"));
      document.head.appendChild(script);
    });
  }

  function parseExcelWorkbook(workbook, xlsx) {
    const sheetEntries = workbook.SheetNames.map((name) => ({
      name,
      rows: xlsx.utils.sheet_to_json(workbook.Sheets[name], { defval: "" }),
    }));
    const companySheet = findSheet(sheetEntries, ["公司", "companies", "项目", "清单"]) ?? (sheetEntries.length === 1 ? sheetEntries[0] : null);
    const advisorSheet = findSheet(sheetEntries, ["顾问", "advisors"]);
    const opportunitySheet = findSheet(sheetEntries, ["机会", "opportunities"]);

    const companies = companySheet?.rows.map((row, index) => rowToCompany(row, index)).filter((item) => item.name) ?? [];
    const advisors = advisorSheet?.rows.map((row, index) => rowToAdvisor(row, index)).filter((item) => item.name) ?? [];
    const companyPool = companies.length ? companies : state.companies;
    const advisorPool = advisors.length ? advisors : state.advisors;
    const opportunities =
      opportunitySheet?.rows
        .map((row, index) => rowToOpportunity(row, index, companyPool, advisorPool))
        .filter((item) => item.sourceCompanyId && item.targetCompanyId) ?? [];

    return { companies, advisors, opportunities };
  }

  function findSheet(sheetEntries, keywords) {
    return sheetEntries.find((sheet) => keywords.some((keyword) => sheet.name.toLowerCase().includes(String(keyword).toLowerCase())));
  }

  function rowValue(row, aliases) {
    const entries = Object.entries(row);
    for (const alias of aliases) {
      const exact = entries.find(([key]) => normalizeHeader(key) === normalizeHeader(alias));
      if (exact) return exact[1];
    }
    for (const alias of aliases) {
      const fuzzy = entries.find(([key]) => normalizeHeader(key).includes(normalizeHeader(alias)));
      if (fuzzy) return fuzzy[1];
    }
    return "";
  }

  function normalizeHeader(value) {
    return String(value || "").replace(/\s+/g, "").replace(/[()（）/_-]/g, "").toLowerCase();
  }

  function normalizeCompanyCity(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const cleaned = raw.replace(/市$/, "");
    return inferCityFromText(cleaned) || cleaned;
  }

  function companyCityForRegion(region, city) {
    if (region === "中国大陆") return normalizeCompanyCity(city);
    if (region === "香港") return "香港";
    if (region === "菲律宾") return normalizeCompanyCity(city) || "马尼拉";
    return "";
  }

  function inferCityFromText(value) {
    const text = String(value || "");
    return Object.keys(CITY_COORDS).find((city) => text.includes(city)) || "";
  }

  function rowToCompany(row, index) {
    const needs = arrayFromValue(rowValue(row, ["需求", "痛点/需求", "需求痛点", "needs", "painPoints"]));
    const company = {
      id: String(rowValue(row, ["id", "公司ID", "companyId"]) || `c${index + 1}`),
      type: "company",
      name: String(rowValue(row, ["公司名称", "公司", "企业名称", "项目名称", "name"])).trim(),
      countryRegion: String(rowValue(row, ["地区", "国家地区", "国家/地区", "countryRegion", "region"]) || "中国大陆").trim(),
      city: normalizeCompanyCity(rowValue(row, ["城市", "所在城市", "city"])),
      industry: String(rowValue(row, ["行业", "industry"]) || "新能源").trim(),
      mainBusiness: String(rowValue(row, ["主营业务", "业务", "mainBusiness"]) || "").trim(),
      revenue: parseRevenueInput(rowValue(row, ["年收入（亿人民币）", "收入规模（亿人民币）", "年收入", "收入", "营收", "revenue"])),
      employeeCount: Number(rowValue(row, ["员工数", "employeeCount"])) || 0,
      companyStage: String(rowValue(row, ["阶段", "companyStage"]) || "扩张期").trim(),
      needs,
      resources: arrayFromValue(rowValue(row, ["资源", "资源能力", "resources"])),
      painPoints: arrayFromValue(rowValue(row, ["痛点", "painPoints"])).length ? arrayFromValue(rowValue(row, ["痛点", "painPoints"])) : needs,
      source: "Excel导入",
      confidenceScore: Number(rowValue(row, ["可信度", "confidenceScore"])) || 85,
      createdAt: String(rowValue(row, ["创建日期", "createdAt"]) || new Date().toISOString().slice(0, 10)),
      isNew: false,
    };
    company.radius = graphNodeRadius(company);
    return company;
  }

  function rowToAdvisor(row, index) {
    return {
      id: String(rowValue(row, ["id", "顾问ID", "advisorId"]) || `a${index + 1}`),
      type: "advisor",
      name: String(rowValue(row, ["姓名", "顾问姓名", "name"])).trim(),
      title: String(rowValue(row, ["头衔", "title"]) || "").trim(),
      organization: String(rowValue(row, ["任职单位", "机构", "organization"]) || "").trim(),
      countryRegion: String(rowValue(row, ["地区", "国家地区", "countryRegion", "region"]) || "中国大陆").trim(),
      capabilities: arrayFromValue(rowValue(row, ["关键能力", "能力", "capabilities"])),
      industries: arrayFromValue(rowValue(row, ["覆盖行业", "industries"])),
      regions: arrayFromValue(rowValue(row, ["覆盖区域", "regions"])),
      relationshipStrength: clamp(Number(rowValue(row, ["关系强度", "relationshipStrength"])) || 75, 1, 100),
      cases: arrayFromValue(rowValue(row, ["案例", "cases"])),
    };
  }

  function rowToOpportunity(row, index, companies, advisors) {
    const source = findCompanyByNameOrId(companies, rowValue(row, ["来源公司", "sourceCompany", "sourceCompanyId"]));
    const target = findCompanyByNameOrId(companies, rowValue(row, ["目标公司", "targetCompany", "targetCompanyId"]));
    const advisor = findAdvisorByNameOrId(advisors, rowValue(row, ["顾问", "推荐顾问", "advisor", "advisorId"]));
    const estimatedValue = parseOpportunityMoneyInput(rowValue(row, ["机会规模（百万人民币）", "项目机会（百万人民币）", "机会规模", "规模", "estimatedValue"]));
    const probability = probabilityFromAi(rowValue(row, ["成交概率", "概率", "probability"]));
    const confidence = probabilityFromAi(rowValue(row, ["可信度", "confidence"]));
    return {
      id: String(rowValue(row, ["id", "机会ID", "opportunityId"]) || `o${index + 1}`),
      sourceCompanyId: source?.id,
      targetCompanyId: target?.id,
      advisorId: advisor?.id ?? null,
      opportunityType: String(rowValue(row, ["类型", "机会类型", "opportunityType"]) || "客户拓展").trim(),
      description: String(rowValue(row, ["描述", "description"]) || ""),
      estimatedValue,
      probability: Number.isFinite(probability) ? probability : 0.35,
      confidence: Number.isFinite(confidence) ? confidence : 0.7,
      expectedValue: parseOpportunityMoneyInput(rowValue(row, ["期望值（百万人民币）", "期望值", "expectedValue"])) || Math.round(estimatedValue * (Number.isFinite(probability) ? probability : 0.35) * 0.7),
      priorityScore: Number(rowValue(row, ["优先级", "priorityScore"])) || 0,
      evidence: arrayFromValue(rowValue(row, ["证据", "evidence"])),
      matchedNeeds: arrayFromValue(rowValue(row, ["匹配需求", "matchedNeeds"])),
      riskFactors: arrayFromValue(rowValue(row, ["风险", "riskFactors"])),
      remark: String(rowValue(row, ["备注", "remark", "note", "notes"]) || ""),
      followUps: normalizeFollowUps([
        rowValue(row, ["跟进1", "第一次跟进", "followUp1"]),
        rowValue(row, ["跟进2", "第二次跟进", "followUp2"]),
        rowValue(row, ["跟进3", "第三次跟进", "followUp3"]),
        rowValue(row, ["跟进4", "第四次跟进", "followUp4"]),
        rowValue(row, ["跟进5", "第五次跟进", "followUp5"]),
      ]),
      status: String(rowValue(row, ["状态", "status"]) || "potential").includes("进行") ? "active" : "potential",
    };
  }

  function findCompanyByNameOrId(companies, value) {
    const key = String(value || "").trim();
    return companies.find((company) => company.id === key || company.name === key || company.name.includes(key) || key.includes(company.name));
  }

  function findAdvisorByNameOrId(advisors, value) {
    const key = String(value || "").trim();
    if (!key) return null;
    return advisors.find((advisor) => advisor.id === key || advisor.name === key || advisor.name.includes(key) || key.includes(advisor.name));
  }

  function companyToExcelRow(company) {
    return {
      公司名称: company.name,
      地区: company.countryRegion,
      城市: company.city || "",
      行业: company.industry,
      主营业务: company.mainBusiness,
      "收入规模（亿人民币）": toYi(company.revenue),
      员工数: company.employeeCount,
      阶段: company.companyStage,
      需求: arrayFromValue(company.needs).join("、"),
      资源: arrayFromValue(company.resources).join("、"),
      痛点: arrayFromValue(company.painPoints).join("、"),
      可信度: company.confidenceScore,
    };
  }

  function advisorToExcelRow(advisor) {
    return {
      姓名: advisor.name,
      头衔: advisor.title,
      任职单位: advisor.organization,
      地区: advisor.countryRegion,
      关键能力: arrayFromValue(advisor.capabilities).join("、"),
      覆盖行业: arrayFromValue(advisor.industries).join("、"),
      覆盖区域: arrayFromValue(advisor.regions).join("、"),
      关系强度: advisor.relationshipStrength,
      案例: arrayFromValue(advisor.cases).join("、"),
    };
  }

  function opportunityToExcelRow(opportunity) {
    const source = state.nodeById.get(opportunity.sourceCompanyId);
    const target = state.nodeById.get(opportunity.targetCompanyId);
    const advisor = opportunity.advisorId ? state.nodeById.get(opportunity.advisorId) : null;
    return {
      状态: statusText(opportunity.status),
      机会类型: opportunity.opportunityType,
      来源公司: source?.name || opportunity.sourceCompanyId,
      目标公司: target?.name || opportunity.targetCompanyId,
      推荐顾问: advisor?.name || "",
      "机会规模（百万人民币）": toMillion(opportunity.estimatedValue),
      成交概率: formatPercent(opportunity.probability),
      "期望值（百万人民币）": toMillion(opportunity.expectedValue),
      备注: opportunity.remark || "",
      跟进1: normalizeFollowUps(opportunity.followUps)[0],
      跟进2: normalizeFollowUps(opportunity.followUps)[1],
      跟进3: normalizeFollowUps(opportunity.followUps)[2],
      跟进4: normalizeFollowUps(opportunity.followUps)[3],
      跟进5: normalizeFollowUps(opportunity.followUps)[4],
      证据: arrayFromValue(opportunity.evidence).join("、"),
      风险: arrayFromValue(opportunity.riskFactors).join("、"),
      AI摘要: opportunity.aiSummary || "",
      下一步: opportunity.aiNextStep || "",
    };
  }

  function importJson(event) {
    if (!requireAdmin()) {
      els.importFile.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.companies) || !Array.isArray(parsed.advisors)) {
          throw new Error("JSON需要包含 companies 和 advisors 数组");
        }
        state.companies = parsed.companies;
        state.advisors = parsed.advisors;
        state.opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
        recomputeDataset(true);
        flashTableSummary("导入成功，已重新匹配");
      } catch (error) {
        alert(`导入失败：${error.message}`);
      } finally {
        els.importFile.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetDemoData() {
    if (!requireAdmin()) return;
    if (!confirm("确认重置为模拟数据？当前本地保存的数据会被覆盖。")) return;
    try {
      localStorage.removeItem("3hk-hub-local-migration-data");
      localStorage.removeItem("aiconnect-demo-data");
    } catch (error) {
      console.warn("Failed to clear local data", error);
    }
    state.companies = generateCompanies(50);
    state.advisors = structuredClone(ADVISORS);
    recomputeDataset(true);
    flashTableSummary("已重置为模拟数据");
  }

  async function loadAdminConfig() {
    try {
      const remote = await fetchRemoteConfig();
      if (remote?.ruleConfig || remote?.aiConfig) {
        state.ruleConfig = { ...DEFAULT_RULE_CONFIG, ...(remote.ruleConfig || {}) };
        state.aiConfig = { ...DEFAULT_AI_CONFIG, ...(remote.aiConfig || {}), apiKey: "" };
        return;
      }
    } catch (error) {
      console.warn("Failed to load remote admin config, using local fallback", error);
    }
    try {
      const raw = localStorage.getItem("aiconnect-admin-config");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const { apiKey, ...storedAiConfig } = parsed.aiConfig || {};
      state.ruleConfig = { ...DEFAULT_RULE_CONFIG, ...(parsed.ruleConfig || {}) };
      state.aiConfig = { ...DEFAULT_AI_CONFIG, ...storedAiConfig, apiKey: "" };
    } catch (error) {
      console.warn("Failed to load local admin config", error);
    }
  }

  function renderAdminConfig() {
    els.aiEnabled.checked = Boolean(state.aiConfig.enabled);
    els.needWeight.value = state.ruleConfig.needWeight;
    els.industryWeight.value = state.ruleConfig.industryWeight;
    els.regionWeight.value = state.ruleConfig.regionWeight;
    els.scaleWeight.value = state.ruleConfig.scaleWeight;
    els.advisorWeight.value = state.ruleConfig.advisorWeight;
    els.strongMatchThreshold.value = state.ruleConfig.strongMatchThreshold;
    els.apiProvider.value = state.aiConfig.provider;
    els.apiBaseUrl.value = state.aiConfig.baseUrl;
    els.apiModel.value = state.aiConfig.model;
    els.apiKey.value = state.aiConfig.apiKey;
    els.matchPrompt.value = state.aiConfig.prompt;
    updatePromptPreview();
  }

  async function saveAdminConfigFromForm() {
    if (!requireAdmin()) return;
    state.ruleConfig = {
      needWeight: numberFromInput(els.needWeight, DEFAULT_RULE_CONFIG.needWeight),
      industryWeight: numberFromInput(els.industryWeight, DEFAULT_RULE_CONFIG.industryWeight),
      regionWeight: numberFromInput(els.regionWeight, DEFAULT_RULE_CONFIG.regionWeight),
      scaleWeight: numberFromInput(els.scaleWeight, DEFAULT_RULE_CONFIG.scaleWeight),
      advisorWeight: numberFromInput(els.advisorWeight, DEFAULT_RULE_CONFIG.advisorWeight),
      strongMatchThreshold: numberFromInput(els.strongMatchThreshold, DEFAULT_RULE_CONFIG.strongMatchThreshold),
    };
    state.aiConfig = {
      enabled: els.aiEnabled.checked,
      provider: els.apiProvider.value.trim(),
      baseUrl: els.apiBaseUrl.value.trim(),
      model: els.apiModel.value.trim(),
      apiKey: "",
      prompt: els.matchPrompt.value.trim(),
    };
    const savedAiConfig = { ...state.aiConfig, apiKey: "" };
    try {
      await persistRemoteConfig({ ruleConfig: state.ruleConfig, aiConfig: savedAiConfig });
    } catch (error) {
      console.warn("Failed to persist remote config, using local fallback", error);
      localStorage.setItem("aiconnect-admin-config", JSON.stringify({ ruleConfig: state.ruleConfig, aiConfig: savedAiConfig }));
    }
    recomputeDataset(true);
    updatePromptPreview();
    flashTableSummary("规则和AI配置已保存，机会池已重算");
  }

  function resetAdminConfig() {
    if (!requireAdmin()) return;
    state.ruleConfig = structuredClone(DEFAULT_RULE_CONFIG);
    state.aiConfig = structuredClone(DEFAULT_AI_CONFIG);
    localStorage.removeItem("aiconnect-admin-config");
    renderAdminConfig();
    recomputeDataset(true);
    flashTableSummary("已恢复默认规则并重算");
  }

  function updatePromptPreview() {
    const source = state.companies[0];
    const target = state.companies[1];
    const advisor = state.advisors[0];
    const preview = {
      ai_enabled: els.aiEnabled.checked,
      provider: els.apiProvider.value || DEFAULT_AI_CONFIG.provider,
      model: els.apiModel.value || DEFAULT_AI_CONFIG.model,
      base_url: els.apiBaseUrl.value || DEFAULT_AI_CONFIG.baseUrl,
      api_mode: "backend_proxy_only",
      system_prompt: els.matchPrompt.value || DEFAULT_AI_CONFIG.prompt,
      input_schema: {
        source_company: source
          ? {
              name: source.name,
              industry: source.industry,
              region: source.countryRegion,
              revenue: source.revenue,
              needs: source.needs,
              resources: source.resources,
            }
          : "company_a",
        target_company: target
          ? {
              name: target.name,
              industry: target.industry,
              region: target.countryRegion,
              revenue: target.revenue,
              needs: target.needs,
              resources: target.resources,
            }
          : "company_b",
        advisor: advisor
          ? {
              name: advisor.name,
              capabilities: advisor.capabilities,
              industries: advisor.industries,
              regions: advisor.regions,
            }
          : "advisor",
      },
      expected_output: {
        opportunities: [
          {
            candidate_id: "candidate-1",
            opportunity_type: "采购/供应链/融资/香港上市/技术合作/客户拓展",
            estimated_value: "number",
            probability: "0-1",
            confidence: "0-1",
            expected_value: "number",
            evidence: ["string"],
            risk_factors: ["string"],
            summary: "string",
            next_step: "string",
          },
        ],
      },
    };
    els.promptPreview.textContent = JSON.stringify(preview, null, 2);
  }

  function numberFromInput(input, fallback) {
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function opportunityCountFor(companies) {
    return Math.min(48, Math.max(0, companies.length * 2));
  }

  function upsertById(list, item) {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) list[index] = item;
    else list.push(item);
  }

  function nextId(prefix, list) {
    const max = list.reduce((value, item) => {
      const number = Number(String(item.id || "").replace(prefix, ""));
      return Number.isFinite(number) ? Math.max(value, number) : value;
    }, 0);
    return `${prefix}${max + 1}`;
  }

  function splitTags(value) {
    return String(value || "")
      .split(/[、,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function arrayFromValue(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return splitTags(value);
  }

  function parseMoneyInput(value) {
    const text = String(value || "").trim();
    if (!text) return 0;
    if (text.includes("百万")) return Number(text.replace(/[^\d.]/g, "")) * 1000000;
    if (text.includes("亿")) return Number(text.replace(/[^\d.]/g, "")) * 100000000;
    if (text.includes("万")) return Number(text.replace(/[^\d.]/g, "")) * 10000;
    return Number(text.replace(/[^\d.]/g, "")) || 0;
  }

  function parseRevenueInput(value) {
    const text = String(value || "").trim();
    if (!text) return 0;
    if (/[亿万百万]/.test(text)) return parseMoneyInput(text);
    const number = Number(text.replace(/[^\d.]/g, "")) || 0;
    return number > 1000000 ? number : number * 100000000;
  }

  function parseOpportunityMoneyInput(value) {
    const text = String(value || "").trim();
    if (!text) return 0;
    if (/[亿万百万]/.test(text)) return parseMoneyInput(text);
    const number = Number(text.replace(/[^\d.]/g, "")) || 0;
    return number > 100000 ? number : number * 1000000;
  }

  function normalizeFollowUps(value = []) {
    const list = Array.isArray(value) ? value : arrayFromValue(value);
    return [0, 1, 2, 3, 4].map((index) => String(list[index] ?? "").trim());
  }

  function toYi(value) {
    return trimNumber((Number(value) || 0) / 100000000);
  }

  function toMillion(value) {
    return trimNumber((Number(value) || 0) / 1000000);
  }

  function flashTableSummary(message) {
    const previous = els.tableSummary.textContent;
    els.tableSummary.textContent = message;
    window.setTimeout(() => {
      renderTable();
      if (!els.tableSummary.textContent) els.tableSummary.textContent = previous;
    }, 1400);
  }

  function exportJson() {
    if (!requireAdmin()) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      companies: state.companies,
      advisors: state.advisors,
      opportunities: state.opportunities,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "3hk-hub-data.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return "0";
    if (value >= 100000000) return `${trimNumber(value / 100000000)}亿`;
    if (value >= 10000) return `${trimNumber(value / 10000)}万`;
    return `${Math.round(value)}`;
  }

  function formatRevenueMoney(value) {
    return `${toYi(value)}亿人民币`;
  }

  function formatOpportunityMoney(value) {
    return `${toMillion(value)}百万人民币`;
  }

  function formatOpportunityStatMoney(value) {
    return `${toMillion(value)}百万￥`;
  }

  function trimNumber(value) {
    return Number(value.toFixed(value >= 10 ? 1 : 2)).toString();
  }

  function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("zh-CN").format(value);
  }

  function statusText(status) {
    return status === "active" ? "合作进行中" : "潜在机会";
  }

  function escapeHtml(value) {
    return safeHtml(value);
  }

  function escapeAttr(value) {
    return safeAttr(value);
  }
})();
