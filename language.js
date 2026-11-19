(() => {
  "use strict";

  const storageKey = "hk-merged-chapters-language";
  const isSupported = code => code === "zh-Hans" || code === "en";
  function readPreference() {
    try { return localStorage.getItem(storageKey); }
    catch { return null; }
  }
  const shared = new URLSearchParams(location.search).get("lang");
  const preference = readPreference();
  let language = isSupported(shared) ? shared : isSupported(preference) ? preference : "zh-Hans";

  function set(code) {
    if (!isSupported(code)) return;
    language = code;
    try { localStorage.setItem(storageKey, code); }
    catch { /* The current tab can still switch languages. */ }
    const url = new URL(location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", code);
      history.replaceState(history.state, "", url);
    }
  }

  const t = (chinese, english) => language === "en" ? english : chinese;
  const code = () => language;
  const year = n => t(`${n} 年`, String(n));
  const list = items => items.join(t("、", ", "));

  const englishNames = {
    "内地":"Mainland China","香港":"Hong Kong",
    "制造业":"Manufacturing","建筑业":"Construction","批发零售/进出口":"Trade and retail",
    "运输仓储邮政":"Transport, storage and postal services","住宿餐饮":"Accommodation and food",
    "信息通讯":"Information and communications","金融地产商务":"Finance, real estate and business",
    "公共教育医疗社会个人服务":"Public, education, health and social services",
    "其他（农林采矿/公用事业/国际组织）":"Other industries",
    "进出口及批发":"Import/export and wholesale","零售业":"Retail trade","运输及邮政":"Transport and postal services",
    "住宿及餐饮":"Accommodation and food","资讯及通讯":"Information and communications",
    "金融及保险":"Financing and insurance","地产业":"Real estate",
    "专业及商业服务":"Professional and business services","社会及个人服务":"Social and personal services",
    "制造业（不含食品加工）":"Manufacturing (excl. food processing)","进出口贸易":"Import and export trade",
    "批发业":"Wholesale","陆路运输":"Land transport","本地速递":"Local courier services",
    "其他运输及邮政":"Other transport and postal services","住宿服务":"Accommodation services","餐饮服务":"Food and beverage services",
    "地产活动（不含维护管理）":"Real estate activities (excl. maintenance and management)",
    "专业及科研技术":"Professional, scientific and technical services",
    "行政及支援服务":"Administrative and support services","教育及非政府公共行政":"Education and non-government public administration",
    "医疗及美容服务":"Health and beauty services","安老院舍":"Residential care homes for the elderly",
    "美发及其他个人服务":"Hairdressing and other personal services",
    "Financing, insurance, real estate, professional and business services":"Finance, real estate and business services",
    "Transportation, storage, postal and courier services, information and communications":"Transport, postal and information services",
  };
  const mappingNotes = {
    "AEHS制造业不含食品加工；空缺为整个制造业。":"The wage survey excludes food processing. Vacancy figures cover all manufacturing.",
    "空缺为进出口及批发合计；工资为其中一个细分。":"Vacancies cover import/export and wholesale combined. Pay covers this segment only.",
    "两项调查总体不同；作为行业参照。":"The surveys cover different populations. Use the demand figures as industry context.",
    "空缺为运输、仓储、邮政及速递合计；工资为细分。":"Vacancies cover transport, storage, postal and courier services combined. Pay covers this segment only.",
    "空缺为住宿及餐饮合计；工资为细分。2019年前分类不同，不回填。":"Vacancies cover accommodation and food services combined. Pay covers this segment only. Classification differed before 2019, so those years are left blank.",
    "AEHS地产活动不含地产维护管理；空缺为整个地产业。":"The wage survey excludes real estate maintenance and management. Vacancies cover the full real estate industry.",
    "空缺为专业及商业服务合计；工资为细分。":"Vacancies cover professional and business services combined. Pay covers this segment only.",
    "空缺为专业及商业服务合计；工资为细分；请参阅AEHS分类附注。":"Vacancies cover professional and business services combined. See the wage survey notes for this segment's definition.",
    "空缺为P–S合计；工资仅为所列细分，细分清单不穷尽P–S。":"Vacancies cover industry sections P–S combined. Pay covers this segment only, and the listed segments do not exhaust P–S.",
  };
  const englishName = name => englishNames[name] ?? name;
  const mapping = (note, industry) => note
    ? t(note, mappingNotes[note] ?? "Vacancies are shown for the broad industry. Pay and hours cover the listed segment.")
    : industry;

  globalThis.guideLanguage = { t, set, code, year, list, englishName, mapping };
})();
