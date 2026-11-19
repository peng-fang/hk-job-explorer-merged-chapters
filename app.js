(() => {
  "use strict";
  const d = globalThis.guideData;
  const c = globalThis.guideCharts;
  const language = globalThis.guideLanguage;
  const {t, year: yearLabel, list, englishName, mapping} = language;
  const {esc, number, percent, money, colors, purple, rose, legend, empty} = c;
  const $ = id => document.getElementById(id);
  const main = $("content");
  const tooltip = $("chart-tooltip");
  const charts = new Map();
  const expanded = new Set();
  let chapter, observers = [];
  const item = (id, title, subtitle, question, summary) => ({
    id, get title() { return t(...title); }, get subtitle() { return t(...subtitle); },
    get question() { return t(...question); }, get summary() { return t(...summary); },
  });
  const pages = [
    item("markets",["两地对照","Two markets"],["从哪里开始找？","Where should I start?"],["两地的就业结构，有什么不同？","How do the two workforces differ?"],
      ["嘉宁先比较两地的年龄和行业结构。她用这一步找出值得深查的行业，然后查看香港的岗位分布。","Jia Ning compares age and industry profiles across the two markets. The patterns give her leads to investigate in Hong Kong."]),
    item("structure",["香港就业版图","Employment landscape"],["把行业变成岗位方向","From industries to job searches"],["香港的工作主要在哪里？","Where are Hong Kong’s jobs?"],
      ["嘉宁在全港就业规模、行业占比和职业构成之间切换。选一个年份，看看她能把哪些行业名称变成职位搜索词。","Jia Ning moves between total employment, industry shares and occupations. Pick a year to see how she turns industries into job-search terms."]),
    item("context",["求职风险与薪酬参照","Risk and pay context"],["投递前要查什么？","What should I check before applying?"],["留港前要查什么？","What should I check before staying?"],
      ["有了行业和职业的搜索方向，嘉宁想先弄清两件事。同龄人面临怎样的求职压力？行业薪酬能给自己的目标什么参照？她先查这两张图，再把问题带进个人条件试算。",
        "Jia Ning has a few industries and occupations to explore. Before applying, she checks the pressure on her age group and what industry earnings can tell her. These two views help her frame the assumptions she will test next."]),
    item("fit",["求职方向探索","Explore job options"],["试出适合自己的方向","Test what fits"],["哪些方向适合嘉宁？","Which options fit Jia Ning?"],
      ["嘉宁先查看行业和职业空缺，再用工资、工时和每月预算试算。改一项条件，看看哪些方向进入候选、还有什么要核查。","Jia Ning checks vacancies, then tests her pay, hours and budget assumptions. Change one condition to see what enters the shortlist and what still needs checking."]),
  ];
  const state = {
    marketPeriod:"latest", overviewYear:2025, riskYear:2025, age:"20 - 24", equityYear:2025,
    selected:[], vacancyMode:"count", payYear:2025, startYear:2016,
    targetPay:25000, maxHours:42, targetSurplus:6000, offer:25000, rent:10000, living:6500, deduct:2000,
  };
  const aliases = {
    "Manufacturing":"制造业","Construction":"建筑业","Import/export & wholesale":"进出口及批发",
    "Retail & accommodation":"零售、住宿及餐饮","Transportation & information":"运输及资讯",
    "Finance & professional":"金融、地产及商务","Public & social services":"公共及社会服务","Other industries":"其他行业",
    "Financing, insurance, real estate, professional and business services":"金融、保险、地产及商务",
    "Import/export trade and wholesale":"进出口及批发",
    "Public administration, social and personal services":"公共行政、社会及个人服务",
    "Retail, accommodation and food services":"零售、住宿及餐饮",
    "Transportation, storage, postal and courier services, information and communications":"运输、邮政及资讯",
    "Employees":"雇员","Employers":"雇主","Self-employed":"自雇","Unpaid family workers":"无酬家庭从业者",
    "Managers":"经理","Professionals":"专业人员","Associate professionals":"辅助专业人员",
    "Clerical support workers":"文书支援人员","Services and sales workers":"服务及销售人员",
    "Craft and related trades workers":"工艺及有关人员","Plant and machine operators and assemblers":"机械操作及装配人员",
    "Elementary occupations":"非技术工人","Other occupations":"其他职业",
    "Skilled agricultural and fishery workers":"熟练农渔工人",
    "Primary and below":"小学或以下","Secondary":"中学","Post-secondary":"专上教育",
    "SARS (2003 Q2)":"沙士 · 2003Q2","Global financial crisis (2008 Q4)":"全球金融危机 · 2008Q4",
    "COVID-19 onset (2020 Q1)":"新冠疫情初期 · 2020Q1",
    "公共教育医疗社会个人服务":"公共、教育、医疗及社会服务",
    "其他（农林采矿/公用事业/国际组织）":"其他（农林、公用等）",
  };
  const label = x => t(aliases[x] ?? x, englishName(x));
  const span = (a,b) => Array.from({length:b-a+1},(_,i)=>i+a);
  const q = row => row.year + (row.quarter-1)/4;
  const quarter = n => Math.floor(n) + "Q" + (Math.round((n % 1)*4)+1);
  const historyX = p => Number(p.slice(0,4)) + (Number(p.slice(-1))-1)/4;
  const ageLabel = key => t(key.replace(" - ","–") + " 岁", "Age " + key.replace(" - ","–"));
  const unique = data => [...new Set(data)];
  const by = (rows,key) => Map.groupBy(rows,r=>r[key]);
  const mean = xs => xs.reduce((total,v)=>total+v,0)/xs.length;
  const figure = (id,title,unit,body,note,options={}) => `<figure class="card${options.full?" span-full":""}" id="${id}">
    <div class="card-head"><div><h3>${title}</h3><p class="card-unit">${unit}</p></div>${options.control ?? ""}</div>
    ${options.key ?? ""}<div class="viz">${body}</div><figcaption>${note}</figcaption></figure>`;
  const viz = (id,fn) => {
    charts.set(id,fn);
    return `<div data-chart="${id}"></div>`;
  };
  const grid = (...items) => `<div class="grid">${items.join("")}</div>`;
  const select = (key,title,choices,render=String) => `<label class="field">${title}<select id="${key}" data-control="${key}">
    ${choices.map(v=>`<option value="${esc(v)}"${state[key]===v?" selected":""}>${esc(render(v))}</option>`).join("")}</select></label>`;
  const budgetField = (key,title,step) => `<label class="field">${title}<input id="${key}" type="number" min="0" max="${key==="maxHours"?168:10000000}" step="${step}" value="${state[key]}" data-control="${key}"></label>`;
  const controls = (...items) => `<div class="control-bar">${items.join("")}</div>`;
  const hint = (zh,en) => `<p class="mode-note">${t(zh,en)}</p>`;
  const stats = (...items) => `<div class="stats">${items.map(([value,caption])=>`<div class="stat"><strong>${value}</strong><span>${caption}</span></div>`).join("")}</div>`;
  const chip = (action,value,title,pressed) => `<button type="button" class="chip" data-action="${action}" data-value="${esc(value)}" data-focus="${esc(action+":"+value)}"${pressed===undefined?"":` aria-pressed="${pressed}"`}>${esc(title)}</button>`;
  const series = (id,sets,options) => viz(id,w=>c.series(w,sets,options));
  const lineSet = (name,points,color=purple,dash=false) => ({name,points,color,dash});
  const mk = i => String(i).padStart(2,"0");
  function next(i) {
    const transitions = [
      [
        t("找到比较线索后，香港有哪些岗位方向？","With some leads, where are Hong Kong’s jobs?"),
        t("两地结构给了嘉宁一些线索。她接着查看香港的行业与职业，把兴趣变成可搜索的职位。",
          "The two-market comparison gives Jia Ning some leads. Next, she looks at Hong Kong industries and occupations to turn interests into job-search terms."),
      ],
      [
        t("有了搜索方向，投递前要查什么？","With a direction in mind, what should I check?"),
        t("嘉宁已找到几个想查的方向。她先看同龄人的求职压力，再读行业薪酬，决定怎样安排投递和核实岗位条件。",
          "Jia Ning now has several directions to investigate. She checks the pressure on her age group and industry earnings to plan her applications and questions for employers."),
      ],
      [
        t("把查到的情况放进自己的条件，会筛出什么？","Which options fit when I test my own criteria?"),
        t("查过求职压力和薪酬参照后，嘉宁开始试算月薪、工时和生活预算。下一步，改一项条件，观察候选方向怎样变化。",
          "With the risk and pay context in mind, Jia Ning tests her pay, hours and living costs. Next, change one condition and see how the shortlist responds."),
      ],
    ];
    const [title,description] = transitions[i];
    return `<a href="#${pages[i+1].id}" class="next"><span><small>${t("继续探索","Continue exploring")} · ${mk(i+1)}</small>
      <strong>${title}</strong><span class="next-description">${description}</span></span><span aria-hidden="true">→</span></a>`;
  }

  function explore(id, title, description, content) {
    return `<details class="explore-more" data-explore="${id}"${expanded.has(id)?" open":""}>
      <summary id="${id}-summary"><span><strong>${title}</strong><span class="explore-description">${description}</span></span></summary>
      <div class="explore-content">${content}</div></details>`;
  }

  function markets() {
    const snapshot = d.markets.filter(r=>r.kind==="A_2010年龄对照");
    const current = d.markets.filter(r=>r.kind===(state.marketPeriod==="early"?"F_行业35_早期":"G_行业35_最新"));
    const paired = rows => [...by(rows,"order")].sort(([a],[b])=>a-b).map(([,rs])=>({
      name:label(rs[0].label), values:["内地","香港"].map(region=>rs.find(r=>r.region===region)?.value),
    }));
    const aged35AndOver = paired(current).map(row=>({
      ...row, values:row.values.map(value=>Number.isFinite(value) ? 100-value : value),
    }));
    const palette = [purple,rose], regions = ["内地","香港"].map(label);
    const keys = legend(regions.map((name,i)=>[name,palette[i]]));
    const era = state.marketPeriod==="early"
      ? t("内地 2010 年 · 香港 2011 年","Mainland 2010 · Hong Kong 2011")
      : t("内地 2020 年 · 香港 2021 年","Mainland 2020 · Hong Kong 2021");
    const hero = `<section class="hero"><div class="hero-copy"><p class="eyebrow">${t("香港就业市场探索器","Hong Kong Graduate Career Explorer")}</p>
      <h1>${t("毕业后，<br>留在香港？","After graduation,<br>stay in Hong Kong?")}</h1>
      <p>${t("刚在香港读完硕士的嘉宁，还没决定在哪里工作。跟她一起提问、点选图表、调整假设，看看哪些方向值得下一步查证。",
        "Jia Ning has just finished her master’s in Hong Kong and is weighing where to work. Follow her questions, explore the charts and change the assumptions to see which options are worth investigating.")}</p>
      <a class="hero-button" href="#market-compare" data-scroll="market-compare">${t("开始探索","Start exploring")} <span aria-hidden="true">↓</span></a></div>
      <img class="hero-image" src="assets/harbour.webp" alt="${t("维多利亚港傍晚的香港岛天际线，生成示意图","Generated illustration of the Hong Kong Island skyline at dusk, across Victoria Harbour")}"></section>`;
    return hero + heading(pages[0],0,"h2","market-compare")
      + grid(
        figure("ages",t("就业人口年龄结构","Employed population by age"),t("2010 年 · 各年龄段占比","2010 · Share by age group"),
          c.bars(paired(snapshot),{colors:palette,labels:regions,mirror:true,max:18,format:percent,label:t("2010年两地就业人口年龄结构镜像图","Mirrored bars comparing the age profiles of both workforces in 2010")}),
          t("每行比较同一年龄段，左为内地、右为香港。沿用原表对齐分组，仅显示列出的年龄段，各列未重归一；两地就业统计定义有差异。",
            "Each row pairs the same age group: Mainland China on the left, Hong Kong on the right. The chart uses the original aligned groups and denominators. Employment definitions differ between the two markets."),
          {key:keys}),
        figure("industry-age",t("各行业 35 岁及以上就业占比","Workers aged 35 and over by industry"),era,
          c.bars(aged35AndOver,{colors:palette,labels:regions,max:100,format:percent,label:t("两地各行业 35 岁及以上就业占比","Share of workers aged 35 and over by industry and market")}),
          t("35 岁及以上占比为 100% 减去 35 岁以下占比，分母为各地各行业的就业人数。两地统计时点相差一年，行业沿用项目合并分类。内地细分数据为项目估计，适合观察结构。",
            "The share aged 35 and over equals 100% minus the under-35 share. The denominator is each industry’s workforce in each market. The snapshots are one year apart. Industry groups are aligned, and Mainland breakdowns are estimated for broad comparisons."),
          {key:keys,control:`<div class="chip-row">${chip("marketPeriod","early",t("早期","Earlier"),state.marketPeriod==="early")}${chip("marketPeriod","latest",t("较新","More recent"),state.marketPeriod==="latest")}</div>`}))
      + next(0);
  }

  function structure() {
    const year=state.overviewYear;
    const total=d.total.find(r=>r.year===year)?.value;
    const industries=d.structure.filter(r=>r.kind==="industry_share");
    const years=unique(industries.map(r=>r.year)).sort((a,b)=>a-b);
    const sets=[...by(industries,"name")].map(([name,rs],i)=>({
      name:label(name), color:colors[i], values:years.map(y=>rs.find(r=>r.year===y)?.share),
    }));
    const biggest = sets.slice().sort((a,b)=>b.values[years.indexOf(year)]-a.values[years.indexOf(year)])[0];
    const status=d.structure.filter(r=>r.kind==="status" && r.year===year);
    const work=d.structure.filter(r=>r.kind==="occupation" && r.year===year);
    return heading(pages[1],1) + stats([number(total)+t(" 千人","k"),t(`${year} 年香港就业总量`,`Total employment in ${year}`)],
      [percent(biggest.values[years.indexOf(year)]),t(label(biggest.name)+"的就业份额",label(biggest.name)+" share")],
      [percent(status.find(r=>r.name==="Employees").status/status.reduce((a,r)=>a+r.status,0)*100),t(`${year} 年雇员占比`,`Employee share in ${year}`)])
      + controls(select("overviewYear",t("联动年份","Linked year"),span(2016,2025).reverse()),hint("点两张趋势图的 2016 年后位置，或用年份菜单同步更新截面。","Select any year from 2016 onward on either trend chart, or use the year menu to update both breakdowns."))
      + grid(
        figure("employment",t("香港就业总量","Total employment"),t("2008–2025 年 · 千人","2008–2025 · Thousands of people"),
          series("employment-line",[lineSet(t("就业总量","Total employment"),d.total.map(r=>[r.year,r.value,`${yearLabel(r.year)} · ${number(r.value)}${t(" 千人"," thousand people")}`]))],
            {xTicks:[2008,2012,2016,2020,2025],y:[0,4200],yTicks:[0,1000,2000,3000,4000],refX:year,action:"overviewYear",canSelect:x=>x>=2016,label:t("香港就业总量年度折线图","Annual total employment in Hong Kong")}),
          t("线高表示全港就业人数，竖虚线是选中的年份。早期年份供趋势比较，雇佣身份和职业构成从 2016 年起联动。",
            "The line shows total employment. The dashed line marks the selected year. Employment status and occupation breakdowns are available from 2016.")),
        figure("industry",t("行业就业占比","Employment share by industry"),t("2008–2025 年 · 占全港就业的百分比","2008–2025 · Percentage of total employment"),
          viz("industry-area",w=>c.stack(w,sets,years,year,"overviewYear")),
          t("各色带厚度代表行业的就业份额。份额增长也可能发生在全港就业总量下滑时，适合与左侧折线一起读。",
            "Band thickness shows each industry’s employment share. A share can rise while citywide employment falls. Read the two charts together."),
          {key:legend(sets.map(s=>[s.name,s.color]))}),
        figure("employment-status",t("雇佣身份构成","Employment status"),yearLabel(year)+t(" · 就业人数"," · Employed population"),
          c.donut(status.map(r=>({name:label(r.name),value:r.status}))),
          t("比较受雇、自雇等身份的结构。刚毕业时可以从雇员岗位入手，再按具体工作形式扩展搜索。",
            "Compare employees, the self-employed and other groups. Jia Ning starts with employee roles and can broaden her search to other arrangements.")),
        figure("occupation",t("职业构成","Occupational mix"),yearLabel(year)+t(" · 方块面积为就业人数"," · Area represents employment"),
          c.treemap(work.map(r=>({name:label(r.name),value:r.work}))),
          t("职业描述做什么，行业描述雇主经营什么。同一职业可以出现在多个行业。聚焦色块可读出完整名称、人数和占比。",
            "Occupations describe the work people do. An occupation can span several industries. Hover or focus on a tile for the full label, count and share.")))
      + next(1);
  }

  function riskViews() {
    const year=state.riskYear, age=state.age;
    const quarterly=d.risk.filter(r=>r.kind==="unemployment_quarterly_line");
    const ageData=d.risk.filter(r=>r.kind==="unemployment_age_heatmap");
    const ageYears=unique(ageData.map(r=>r.year)).sort((a,b)=>a-b);
    const ageNames=unique(ageData.map(r=>r.age)).sort((a,b)=>a.localeCompare(b,"zh-HK",{numeric:true}));
    const annual = mean(quarterly.filter(r=>r.year===year).map(r=>r.value));
    const ageValue=ageData.find(r=>r.year===year&&r.age===age)?.value;
    const eventSets = [...by(d.risk.filter(r=>r.kind==="crisis_recovery"),"event")].map(([n,rs],i)=>
      lineSet(label(n),rs.map(r=>[r.relative,r.value]).sort((a,b)=>a[0]-b[0]),[purple,rose,"#477b75"][i],i===1));
    const eduSets = [...by(d.risk.filter(r=>r.kind==="unemployment_education"),"education")].map(([n,rs],i)=>
      lineSet(label(n),rs.map(r=>[r.year,r.value]).sort((a,b)=>a[0]-b[0]),[purple,rose,"#477b75"][i],i===1));
    const displayYears=span(Math.max(ageYears[0],year-5),Math.min(ageYears.at(-1),year+5));
    const riskTable=heatTable(ageNames.map(a=>({name:ageLabel(a),key:a})),displayYears,
      (name,y)=>ageData.find(r=>r.year===y&&r.age===name)?.value,
      (value,a,y)=>({text:percent(value),opacity:.10+Math.min(value/18,1)*.62,action:"riskCell",key:y+"|"+a.key,selected:y===year&&a.key===age}),
      t("年龄组","Age group"),t("失业率年龄与年份热力图","Unemployment heatmap by age and year"));
    const main = figure("risk-age",t("同龄人的求职压力怎样？","What pressure does my age group face?"),
      t("年龄 × 年份热力图 · 年度失业率","Age × year heatmap · Annual unemployment"),
      controls(select("riskYear",t("风险观察年","Risk reference year"),ageYears.slice().reverse()),
        select("age",t("观察年龄","Age group"),ageNames,ageLabel))
      + `<div class="reading-summary" aria-live="polite"><strong>${percent(ageValue)}</strong>
        <span>${esc(t(`${year} 年 · ${ageLabel(age)}失业率`,`${year} unemployment · ${ageLabel(age)}`))}</span></div>`
      + riskTable,
      t("颜色越深，失业率越高。点格子同时选年龄和年份。嘉宁用群体压力安排并行投递和求职缓冲，实际求职时长还需结合岗位与个人情况判断。",
        "Darker cells show higher unemployment. Select a cell to choose age and year together. Jia Ning uses this context to plan parallel applications and allow some buffer. Search duration also depends on the role and applicant."));
    const detail = stats(
      [percent(annual),t(`${year} 年四个季度失业率的算术平均`,`${year} average of quarterly unemployment rates`)],
      [percent(ageValue),t(`${year} 年 · ${ageLabel(age)}失业率`,`${year} unemployment · ${ageLabel(age)}`)],
      [percent(quarterly.at(-1).value),quarter(q(quarterly.at(-1)))+t(" 全港失业率"," Hong Kong unemployment")])
      + hint("点季度或教育折线，可联动上方的风险观察年。","Select a point on the quarterly or education chart to update the risk reference year above.")
      + grid(
        figure("quarters",t("全港季度失业率","Hong Kong unemployment by quarter"),"1985Q1–2026Q2 · %",
          series("quarter-line",[lineSet(t("失业率","Unemployment rate"),quarterly.map(r=>[q(r),r.value,quarter(q(r))+" · "+percent(r.value)]))],
            {xTicks:[1985,1995,2005,2015,2026],y:[0,10],yFormat:percent,refX:year,action:"riskYear",canSelect:x=>x<2026,label:t("全港季度失业率折线图","Line chart of Hong Kong’s quarterly unemployment rate")}),
          t("折线上的峰值定位市场承压阶段。年龄及教育的年度资料截至 2025 年，点 2026 年季度可读该点数据。",
            "Peaks show periods of labour market pressure. Annual age and education data end in 2025. Hover over the 2026 quarters to read their rates.")),
        figure("crises",t("危机后的恢复路径","Recovery after past downturns"),t("事件相对季度 · 失业率变化（百分点）","Quarters from event · Change in unemployment (percentage points)"),
          series("event-line",eventSets,{xTicks:[-8,-4,0,4,8,12,16],y:[-4,4],refX:0,refY:0,label:t("三次危机失业率变化对齐图","Unemployment changes aligned to three downturns"),xFormat:n=>n>0?"+"+n:String(n)}),
          t("第 0 季度为事件发生季。每条线减去该事件前一季的失业率，低于 0 表示低于该基准。适合比较恢复过程，无法分离单一冲击的因果影响。",
            "Quarter 0 is the event quarter. Each line subtracts the unemployment rate one quarter before its event. Values below zero are below that baseline. The chart shows timing and scale, while other influences may also explain the changes."),
          {key:legend(eventSets.map(s=>[s.name,s.color]))}),
        figure("risk-education",t("不同教育组的失业率","Unemployment by education level"),t("年度失业率 · 三个汇总教育组","Annual unemployment · Three broad education groups"),
          series("education-line",eduSets,{xTicks:[1985,1995,2005,2015,2025],y:[0,10],yFormat:percent,refX:year,action:"riskYear",label:t("不同教育组失业率折线图","Line chart of unemployment by education level")}),
          t("按最高教育程度比较三个总体序列。专上教育包括学位与非学位，也包括不同年龄与年资的人。",
            "Groups are based on highest education attained. Post-secondary includes degree and non-degree qualifications, with a wide range of ages and experience."),
          {key:legend(eduSets.map(s=>[s.name,s.color])),full:true}));
    return {main, detail};
  }

  function payContextViews() {
    const year = state.equityYear;
    const snapshot = d.equity.filter(r=>r.year===year);
    const overall = d.equity.filter(r=>r.kind==="overall");
    const sexes = ["Female","Male"];
    const sexNames = [t("女性","Women"),t("男性","Men")], palette=[rose,purple], keys=legend(sexNames.map((n,i)=>[n,palette[i]]));
    const bands = snapshot.filter(r=>r.kind==="industry");
    const ages = snapshot.filter(r=>r.kind==="age_group");
    const getOverall = sex => snapshot.find(r=>r.kind==="overall"&&r.sex===sex)?.pay;
    const genderSets = (rows,field,x) => sexes.map((sex,i)=>
      lineSet(sexNames[i],rows.filter(r=>r.sex===sex).map(r=>[x(r),r[field],
        field==="participation"?`${sexNames[i]} · ${ageLabel(r.name)} · ${percent(r[field])}`: `${sexNames[i]} · ${yearLabel(r.year)} · ${money(r[field])}`
      ]).sort((a,b)=>a[0]-b[0]),palette[i],i===0));
    const female=getOverall("Female"), male=getOverall("Male");
    const industry=[...by(bands,"name")].map(([name,rs])=>({name:label(name),values:sexes.map(s=>rs.find(r=>r.sex===s)?.pay)}));
    const ageNames=unique(ages.map(r=>r.name)).sort((a,b)=>a.localeCompare(b,"zh-HK",{numeric:true}));
    const ageTicks=ageNames.map((_,i)=>i).filter(i=>i%2===0);
    const main = figure("income-industry",t("行业薪酬能怎样参考？","How should I interpret industry pay?"),
      t("男女月收入成对横条 · 港元／月","Paired bars for women and men · HKD per month"),
      controls(select("equityYear",t("薪酬参照年","Earnings reference year"),span(2008,2025).reverse()))
      + keys
      + c.bars(industry,{labels:sexNames,colors:palette,max:Math.max(35000,...industry.flatMap(r=>r.values).filter(Number.isFinite)),format:number,label:t("同年各行业男女月收入中位数对照","Grouped bars comparing women’s and men’s median earnings by industry")}),
      t("每行比较同一行业的两个就业群体。职业、年资、工时和全职比例都可能影响中位数。嘉宁据此追问目标岗位的职级、薪酬带及实际工时。",
        "Each row compares two employed groups in the same industry. Occupation, experience, hours and full-time share may affect the medians. Jia Ning uses these differences to ask about the role’s grade, pay band and actual hours."));
    const detail = stats([money(female),t(`${year} 年女性月收入中位数`,`Women’s median monthly earnings, ${year}`)],
      [money(male),t(`${year} 年男性月收入中位数`,`Men’s median monthly earnings, ${year}`)],
      [percent((male-female)/male*100),t("总体差额 ÷ 男性中位数","Overall gap as a share of the men’s median")])
      + hint("点收入趋势的年份，同步更新上方的行业收入和下方的劳动参与率。","Select a year on the earnings trend to update the industry comparison above and participation rates below.")
      + grid(
        figure("income-trend",t("男女总体月收入走势","Median monthly earnings by gender"),t("1985–2025 年 · 港元／月","1985–2025 · HKD per month"),
          series("income-line",genderSets(overall,"pay",r=>r.year),{xTicks:[1985,1995,2005,2015,2025],y:[0,30000],
            yTicks:[0,10000,20000,30000],yFormat:n=>number(n/1000)+"k",refX:year,action:"equityYear",canSelect:x=>x>=2008,label:t("男女总体月收入各年中位数折线图","Lines for women’s and men’s annual medians of monthly earnings")}),
          t("线条展示男女各自就业群体的名义月收入中位数。点击 2008–2025 年数据点可联动当年截面。",
            "Both lines show nominal monthly earnings for employed people. Select a point from 2008 to 2025 to update the other views."),
          {key:keys}),
        figure("participation",t("按年龄分组的劳动参与率","Labour force participation by age"),yearLabel(year)+t(" · 劳动力占同组人口的比例"," · Labour force as a share of each age group"),
          series("participation-points",genderSets(ages,"participation",r=>ageNames.indexOf(r.name)),
            {x:[0,ageNames.length-1],xTicks:ageTicks,xFormat:i=>ageNames[i].replace(" - ","–"),y:[0,100],
              yFormat:percent,pointsOnly:true,label:t("男女分年龄组劳动参与率散点图","Labour force participation by age and gender")}),
          t("劳动参与包括就业者和失业者。譬如仍在读书的人可能不在劳动力内，所以参与率与找到工作的概率是两个指标。",
            "The labour force includes employed and unemployed people. Students who are neither working nor looking for work may fall outside it."),
          {key:keys}));
    return {main, detail};
  }

  function context() {
    const risk = riskViews();
    const pay = payContextViews();
    return heading(pages[2],2)
      + `<div class="grid context-main">${risk.main}${pay.main}</div>`
      + `<div class="context-followup"><strong>${t("带着两个问题继续探索","Two questions to carry forward")}</strong>
        <p>${t("我能为求职预留怎样的缓冲？实际岗位的薪酬和工时是否适合我？嘉宁把这些问题带进下一章，按自己的生活条件试算。",
          "What buffer can I allow for the search? Would the actual role’s pay and hours work for me? Jia Ning takes these questions into the next chapter and tests her living assumptions.")}</p></div>`
      + explore("risk-background",t("追问求职压力怎样随市场变化","Explore how market pressure changes"),
        t("季度失业率、危机恢复与教育组趋势","Quarterly unemployment, crisis recovery and education groups"),risk.detail)
      + explore("pay-background",t("追问收入和劳动参与怎样变化","Explore earnings and participation over time"),
        t("男女收入走势与年龄劳动参与率","Earnings by gender and participation by age"),pay.detail)
      + next(2);
  }

  function heatTable(rows, cols, read, format, corner, description) {
    return `<div class="table-scroll" tabindex="0" aria-label="${esc(description + t("，可横向滚动",", scrolls horizontally"))}"><table class="heat" aria-label="${esc(description)}">
      <thead><tr><th scope="col">${corner}</th>${cols.map(x=>`<th scope="col">${esc(x.name ?? x)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>`<tr><th scope="row">${esc(r.name)}</th>${cols.map(x=>{
        const value=read(r.key,x.id ?? x), f=format(value,r,x);
        if(!Number.isFinite(value)) return "<td>—</td>";
        const tip=r.name+" · "+(x.name ?? x)+" · "+f.text;
        return `<td><button type="button" data-action="${f.action}" data-value="${esc(f.key)}" data-focus="${esc(f.action+":"+f.key)}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" aria-pressed="${f.selected}" style="background:rgba(117,63,133,${f.opacity});color:${f.opacity>.62?"white":"#27192c"}">${f.text}</button></td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function candidate(row) {
    const outgoings = state.rent+state.living+state.deduct;
    const surplus=Number.isFinite(row.pay50)?row.pay50-outgoings:null;
    const missing=![row.pay50,row.hours50,surplus].every(Number.isFinite);
    const issues = [
      Number.isFinite(row.pay50)&&row.pay50<state.targetPay?t("月薪低于目标","Pay below target"):null,
      Number.isFinite(row.hours50)&&row.hours50>state.maxHours?t("工时高于上限","Hours above limit"):null,
      Number.isFinite(surplus)&&surplus<state.targetSurplus?t("月结余低于目标","Surplus below target"):null,
      missing?t("缺少工资或工时数据","Pay or hours data missing"):null,
    ].filter(Boolean);
    return {...row,surplus,issues,match:!issues.length,missing,demand:d.demand.find(x=>x.id===row.id)};
  }

  function intervals(rows, type) {
    const median = type+"50";
    const orderedRows = rows.slice().sort((a,b)=>{
      const first = a[median] ?? -Infinity;
      const second = b[median] ?? -Infinity;
      return first===second ? 0 : second-first;
    });
    const pay=type==="pay", target=pay?state.targetPay:state.maxHours;
    const step=pay?10000:10;
    const upper=Math.max(pay?50000:60,target, ...rows.map(r=>r[type+"75"] ?? 0));
    const upperTick=Math.ceil(upper/step)*step;
    const low=pay?0:Math.min(30,target,...rows.map(r=>r.hours25 ?? 30));
    const high = upperTick===low ? upperTick+step : upperTick;
    const position=v=>((v-low)/(high-low)*100);
    const shortTarget=pay?money(target):number(target)+t(" 小时"," hours");
    const targetName=pay?t("期望月薪","Target monthly pay"):t("期望每周工时上限","Weekly hours limit");
    return `<div class="legend"><span><i style="background:#cdb5de"></i>P25–P75</span><span><i style="background:${rose}"></i>P50</span><span>${t("虚线","Dashed line")} · ${targetName} ${shortTarget}</span></div>
      ${orderedRows.map(r=>{
        const a=r[type+"25"], m=r[type+"50"], b=r[type+"75"];
        const tip=label(r.name)+" · "+[a,m,b].map(number).join(" / ")+" · "+(pay?t("港元／月","HKD/month"):t("小时／周","hours/week"));
        return `<div class="range-lane"><span class="range-name">${esc(label(r.name))}</span><div class="range-track">
          <span class="range-ref" style="left:${position(target)}%"></span>
          ${[a,b].every(Number.isFinite)?`<span class="range-band" style="left:${position(a)}%;width:${position(b)-position(a)}%" data-tip="${esc(tip)}"></span>`:""}
          ${Number.isFinite(m) ? `<button type="button" class="range-point" style="left:${position(m)}%" data-tip="${esc(tip)}" aria-label="${esc(tip+(pay?t(" · 带入预算"," · Use in budget"):""))}"
              ${pay?` data-action="offerMedian" data-value="${m}" data-focus="${esc("offerMedian:"+m+":"+r.name)}"`:""}></button>
            <span class="range-value${position(m)>68?" left":""}" style="left:${position(m)}%">${number(m)}</span>` : `<span class="range-value">${t("缺测","No data")}</span>`}
          </div></div>`;
      }).join("")}
      <div class="range-axis">${span(0,4).map(i=>`<span>${number(low+(high-low)*i/4)}</span>`).join("")}</div>`;
  }

  function fit() {
    const picked=state.selected;
    const chosen=d.demand.filter(r=>!picked.length||picked.includes(r.id));
    const active=new Set(chosen.map(x=>x.id));
    const rows=d.pay.filter(r=>r.year===state.payYear&&active.has(r.id)).map(candidate);
    const ranked=rows.slice().sort((a,b)=>Number(b.match)-Number(a.match)||Number(a.missing)-Number(b.missing)
      ||a.issues.length-b.issues.length||(b.surplus ?? -Infinity)-(a.surplus ?? -Infinity)||a.name.localeCompare(b.name,"zh-Hans"));
    const matched=ranked.filter(r=>r.match);
    const budget=state.offer-state.rent-state.living-state.deduct;
    const demandLabels=unique(d.occupations.map(r=>r.name)).map(n=>({name:label(n),key:n}));
    const max = Math.max(1,...d.occupations.map(r=>r.count ?? 0));
    const isCount=state.vacancyMode==="count";
    const heat=heatTable(demandLabels,chosen.map(r=>({id:r.id,name:label(r.name)})),
      (occupation,id)=>d.occupations.find(r=>r.id===id&&r.name===occupation)?.[state.vacancyMode],
      (v,_,r)=>({text:isCount?number(v):percent(v*100),opacity:.12+.66*Math.sqrt(v/(isCount?max:1)),
        action:"selectIndustry",key:r.id,selected:picked.includes(r.id)}),
      t("职业组","Occupation"),t("行业职业空缺热力图","Vacancy heatmap by industry and occupation"));
    const end=Math.max(...d.history.map(r=>historyX(r.period)));
    const history=chosen.map((item,i)=>{
      const data=d.history.filter(r=>r.id===item.id&&historyX(r.period)>=state.startYear)
        .map(r=>[historyX(r.period),r.value,`${label(item.name)} · ${r.period} · ${t("指数","Index")} ${number(r.value)}`]).sort((a,b)=>a[0]-b[0]);
      return lineSet(label(item.name),data,colors[i%colors.length],i%3===1);
    });
    const hValues=history.flatMap(s=>s.points.map(p=>p[1])).filter(Number.isFinite);
    const histMin=Math.floor(Math.min(100,...hValues)/10)*10;
    const histMax=Math.ceil(Math.max(110,...hValues)/10)*10;
    const histYears=span(state.startYear,Math.floor(end)).filter((y,i,a)=>a.length<=6||i%2===0||i===a.length-1);
    const status = matched.length ? t("优先查证：","Investigate first: ")+list(matched.map(r=>label(r.name)))
      : t("目前没有同时满足三项条件的方向。","No options meet all three criteria.");
    const selectionDescription = picked.length ? list(chosen.map(r=>label(r.name))) : t("全部纳入（10 个行业大类）","All 10 broad industries");
    const table = `<div class="table-scroll" tabindex="0" aria-label="${t("候选方向对照，可横向滚动","Shortlist comparison, scrolls horizontally")}"><table class="compact-table"><thead><tr>
      <th scope="col">${t("细分行业","Industry segment")}</th><th scope="col">${t("月薪 P50<br>港元","Median monthly pay<br>HKD")}</th>
      <th scope="col">${t("周工时 P50<br>小时","Median weekly hours")}</th><th scope="col">${t("月结余<br>港元","Monthly surplus<br>HKD")}</th>
      <th scope="col">${t("空缺率<br>行业大类","Vacancy rate<br>Broad industry")}</th><th scope="col">${t("用工同比<br>行业大类","Employment YoY<br>Broad industry")}</th>
      <th scope="col" class="status-cell">${t("期望匹配","Fit with criteria")}</th></tr></thead>
      <tbody>${ranked.map(r=>`<tr data-industry="${esc(r.id)}"><th scope="row">${esc(label(r.name))}<span class="subcell" data-tip="${esc(mapping(r.mapping,label(r.demand.name)))}">${esc(label(r.demand.name))}</span></th>
        <td>${number(r.pay50)}</td><td>${number(r.hours50)}</td><td>${number(r.surplus)}</td>
        <td>${percent(r.demand.rate*100)}</td><td>${percent(r.demand.yoy*100)}</td>
        <td class="status-cell"><strong class="${r.match?"good":"check"}">${r.match?t("符合期望","Meets criteria"):r.missing?t("待补资料","Data needed"):t("未达期望","Below criteria")}</strong>
          <span class="subcell">${r.match?t("核对职位报价及实际工时","Verify offer and actual hours"):r.issues.join(" · ")}</span></td></tr>`).join("")}</tbody></table></div>`;
    return heading(pages[3],3) + stats([rows.length+t(" 个",""),t("当前筛选的薪酬细分行业","Industry segments in view")],
      [matched.length+t(" 个",""),t("同时满足月薪、工时和结余","Meet pay, hours and surplus criteria")],
      [money(budget),t("按当前 Offer 假设计算的月结余","Monthly surplus with the current offer")])
      + `<div class="decision" aria-live="polite"><strong>${esc(status)}</strong>
          <p>${t("当前行业范围：","Showing: ")}${esc(selectionDescription)}${t("。表内结余按行业月薪 P50 估算，预算图按个人 Offer 假设计算。",
            ". Shortlist estimates use each industry’s median pay. The budget chart uses the offer you enter.")}</p>
          <div class="chip-row">${chip("case","jia",t("载入嘉宁的演示方案","Load Jia Ning’s example"))}${chip("resetIndustries","all",t("看全部行业","Show all industries"))}</div></div>`
      + `<section aria-labelledby="find-heading"><header class="subhead"><h2 id="find-heading">${t("哪里有空缺？","Where are the vacancies?")}</h2></header>`
      + controls(`<label class="field">${t("单选行业","Select one industry")}<select id="industry" data-control="industry">
          <option value="all"${!picked.length?" selected":""}>${t("全部行业","All industries")}</option>
          ${picked.length>1?`<option value="multiple" selected disabled>${t("已多选行业","Multiple industries selected")}</option>`:""}
          ${d.demand.map(x=>`<option value="${x.id}"${picked.length===1&&picked[0]===x.id?" selected":""}>${esc(label(x.name))}</option>`).join("")}</select></label>`,
          `<div class="chip-row" role="group" aria-label="${t("多选行业","Select multiple industries")}">${d.demand.map(x=>chip("toggleIndustry",x.id,label(x.name),picked.includes(x.id))).join("")}</div>`)
      + grid(
        figure("map",t("招聘机会地图","Hiring opportunities"),t("2026Q2 · 横轴空缺率 · 纵轴用工同比","2026 Q2 · Vacancy rate (x) · Employment change year on year (y)"),
          viz("map-bubbles",w=>c.bubbles(w,d.demand.map(r=>({...r,name:label(r.name)})),picked)),
          t("圆面积表示空缺人数。横虚线表示同比 0%，竖虚线表示调查总体空缺率 1.7%。点气泡单选，Ctrl／⌘ 点按或用行业按钮多选，更新空缺表、薪酬、工时、历史和候选清单。",
            "Bubble area shows vacancy count. The horizontal line marks zero growth. The vertical line marks the survey-wide vacancy rate of 1.7%. Select a bubble, or Ctrl/Cmd-click to add industries. The linked charts and shortlist follow your selection."),
          {key:legend([[t("用工增加","Employment up"),purple],[t("用工减少","Employment down"),rose]])}),
        figure("vacancies",t("行业 × 职业空缺","Vacancies by industry and occupation"),t("2026Q2 · 行业大类与九个职业组","2026 Q2 · Broad industries and nine occupation groups"),
          heat,t("空缺人数回答「有多少」，行业内占比回答「主要招什么」。点格子以所属行业重新筛选，职业口径保留为调查职业组。",
            "Count shows how many vacancies there are. Share shows the mix of vacancies within an industry. Select a cell to filter by its industry."),
          {control:select("vacancyMode",t("单元格显示","Show in cells"),["count","share"],v=>v==="count"?t("空缺人数","Vacancy count"):t("行业内占比","Share within industry"))}))
      + `</section><section aria-labelledby="conditions-heading"><header class="subhead"><h2 id="conditions-heading">${t("待遇能否支撑留港？","Would the pay and hours work for me?")}</h2></header>`
      + `<form class="control-bar" data-budget-form>${select("payYear",t("工资参考年","Pay reference year"),span(2016,2025).reverse())}
        ${budgetField("targetPay",t("期望月薪（港元）","Target monthly pay (HKD)"),1)}${budgetField("maxHours",t("期望每周工时上限","Weekly hours limit"),.1)}
        ${budgetField("targetSurplus",t("期望月结余（港元）","Target monthly surplus (HKD)"),1)}
        <button class="chip apply-budget" type="submit" id="apply-targets">${t("更新目标","Apply criteria")}</button></form>`
      + grid(
        figure("pay-range",t("月薪分位区间","Monthly pay range"),t(`${state.payYear} 年 5–6 月 · 全职雇员 · 港元／月`,`May–June ${state.payYear} · Full-time employees · HKD/month`),
          intervals(rows,"pay"),t("浅紫线段是第 25 至 75 百分位，保留行业中间一半的范围；圆点是中位数。点圆点可将该行业月薪带入预算。",
            "The pale band runs from the 25th to the 75th percentile, covering the middle half. The dot is the median. Select it to use that value in the budget.")),
        figure("hours-range",t("每周工时区间","Weekly hours range"),t(`${state.payYear} 年 5–6 月 · 全职雇员 · 小时／周`,`May–June ${state.payYear} · Full-time employees · Hours/week`),
          intervals(rows,"hours"),t("虚线是你设定的每周工时上限。即使中位数达标，仍可用整个区间判断是否要在面试中先问加班。",
            "The dashed line marks your weekly hours limit. Read the full range to decide whether to ask about overtime, even if the median fits.")),
        figure("budget",t("个人生活预算","Monthly budget"),t("可编辑示例 · 港元／月","Editable scenario · HKD per month"),
          `<form class="control-bar" data-budget-form>${budgetField("offer",t("Offer 月薪","Monthly offer"),1)}${budgetField("rent",t("每月房租","Monthly rent"),1)}
          ${budgetField("living",t("生活交通","Living and transport"),1)}${budgetField("deduct",t("预留扣款","Set-aside for deductions"),1)}
          <button class="chip apply-budget" type="submit" id="apply-budget">${t("更新预算","Apply budget")}</button></form>`
          +viz("budget-waterfall",w=>c.waterfall(w,state)),
          t("从 Offer 月薪扣去三项开支。预留扣款由你填写；可把预计税款和强积金统一填入，实际金额以适用规定和合约为准。",
            "The budget subtracts three expenses from the assumed offer. Enter your own allowance for items such as tax and MPF. Actual deductions depend on the applicable rules and contract."),
          {full:true}))
      + `</section><section aria-labelledby="shortlist-heading"><header class="subhead"><h2 id="shortlist-heading">${t("哪些方向值得优先查证？","Which options should I investigate first?")}</h2></header>`
      + grid(
        figure("history",t("行业用工走势","Employment trends by industry"),t("季度 · 以 2016Q1 为 100","Quarterly index · 2016 Q1 = 100"),
          series("history-line",history,{x:[state.startYear,end],xTicks:histYears,y:[histMin,histMax],refY:100,
            xFormat:String,label:t("所选行业季度用工指数折线图","Quarterly employment index for selected industries")}),
          t("指数是当季就业人数除以该行业 2016Q1 人数后乘 100。选择起始年只缩短展示范围，基期保持原值。线条描述行业规模，无法估计个人失业风险。",
            "The index divides employment in each quarter by that industry’s 2016 Q1 count and multiplies by 100. Changing the start year changes only the viewing window. The lines describe industry employment levels."),
          {control:select("startYear",t("历史起始年","History start year"),span(2016,2025)),key:legend(history.map(s=>[s.name,s.color])),full:true}),
        figure("candidates",t("候选方向对照","Shortlist comparison"),t("三项门槛都达到的方向排在前面","Options that meet all three criteria appear first"),
          ranked.length?table:empty(t("所选行业没有该参考年的工资、工时记录。","Pay and hours data are unavailable for the selected industries and year.")),
          t("公司面试时还需核对实际薪酬、工时、签证及工作安排。空缺率为「空缺人数 ÷（就业人数＋空缺人数）」，用工同比为「本季就业人数 ÷ 上年同季就业人数 − 1」，换算为百分比后展示。",
            "Verify actual pay, hours, work eligibility and terms. Vacancy rate is vacancies ÷ (employment + vacancies). Employment YoY is employment this quarter ÷ employment in the same quarter last year − 1. Both are shown as percentages."),
          {full:true}))
      + "</section>";
  }

  function sources() {
    const census = (url,zh,en)=>`<a href="https://www.stats.gov.cn/sj/pcsj/rkpc/${url}">${t(zh,en)}</a>`;
    const hk = (code,zh,en)=>`<a href="https://www.censtatd.gov.hk/en/web_table.html?id=${code}">${code} · ${t(zh,en)}</a>`;
    return `<header class="chapter-header"><h1>${t("数据来源与统计口径","Data and methods")}</h1>
    <p>${t("图表由项目整合 Excel 中的 Tableau 提取数据生成。各章按其调查范围和观察期展示。",
      "The charts use Tableau extracts from the project’s consolidated workbook. Each chapter follows the source survey’s coverage and reference period.")}</p></header>
    <section class="card source-card">
      <h3>${t("两地对照","Two markets")}</h3>
      <ul><li>${census("5rp/html/l0404.htm","内地 2010 年人口普查","Mainland China 2010 Census")} ·
      ${census("6rp/html/B0402a.htm","内地 2020 年人口普查","Mainland China 2020 Census")}${t("。各行业 35 岁及以上占比由原项目的 35 岁以下占比取补数，沿用原有行业分类、时点和估计。",
        ". Shares aged 35 and over are complements of the original under-35 shares. They use the original project’s industry groupings, reference years and estimates.")}</li>
      <li>${hk("210-06201","香港政府统计处劳动人口表","Hong Kong C&SD labour force table")}${t("提供劳动人口背景。两地行业、年龄定义及年份见整合 Excel 的「00_口径限制」。",
        " provides labour force context. See the consolidated workbook’s 00 methods sheet for definitions and reference years.")}</li></ul>
      <h3>${t("香港就业、失业与收入","Hong Kong employment, unemployment and earnings")}</h3>
      <ul><li>${t("就业规模和构成来自整合 Excel 的 <code>01_01</code>、<code>01_02</code> 工作表。失业率、年龄和教育数据来自 <code>04_05</code>。",
        "Employment levels and breakdowns come from sheets <code>01_01</code> and <code>01_02</code>. Unemployment, age and education data come from <code>04_05</code>.")}</li>
      <li>${t("求职风险与薪酬参照中的性别数据来自 <code>03_04</code>。参考统计处","The gender comparisons in Risk and pay context use sheet <code>03_04</code>. Reference tables")}
        ${hk("210-06201","劳动参与","Participation")} · ${hk("210-06316","行业月入","Monthly earnings by industry")}${t("。网站保留名义收入及各数据集的调查定义。",
        ". Earnings are nominal. The source survey definitions apply.")}</li></ul>
      <h3>${t("求职方向探索","Job options")}</h3>
      <ul><li>${hk("215-16001","机构就业及空缺","Establishment employment and vacancies")} · ${hk("215-16007","行业 × 职业空缺","Vacancies by industry and occupation")}${t("。需求截面为 2026Q2，只涵盖调查行业，不含公务员。",
        ". The demand snapshot is 2026 Q2 and covers surveyed industries, excluding civil servants.")}</li>
      <li>${hk("220-23015","全职月薪分布","Full-time monthly pay distribution")} · ${hk("220-23034","全职工时分布","Full-time working hours distribution")}${t("。采用 2016–2025 年各年 5–6 月数据。大类和细分行业对应关系见项目数据说明。",
        ". These use May–June observations for 2016–2025. The project notes explain the mappings between broad industries and detailed segments.")}</li>
      <li>${t("匹配采用 P50。月薪须达到下限，工时须不高于上限，月结余须达到下限。匹配项优先，随后按未达项数、估算结余排序，缺资料项排后。数据缺失显示为破折号或「待补资料」。",
        "The shortlist uses medians (P50). An option qualifies when it meets the minimum pay and surplus and stays within the hours limit. Other options are ordered by unmet criteria and estimated surplus, with missing data last.")}</li></ul>
      <h3>${t("项目参考","Project reference")}</h3><p>${t("图表卡片和市场探索的呈现参考组员的","Chart cards and the market exploration layout draw on the team’s")}
        <a href="https://github.com/ketianli082-stack/hong-kong-job-market-explorer">Hong Kong Job Market Explorer</a>${t("。嘉宁是演示用的虚构人物，封面为生成图像。",
        ". Jia Ning is fictional. The cover image is generated.")}</p>
    </section>`;
  }

  function heading(page,index,tag="h1",id="") {
    return `<header class="chapter-header"${id?` id="${id}"`:""}><div class="eyebrow">${mk(index)} / ${page.title}</div>
      <${tag}>${page.question}</${tag}><p>${page.summary}</p></header>`;
  }

  const renderPage = {markets,structure,context,fit,sources};

  function renderInterface() {
    const title = t("香港就业市场探索器","Hong Kong Graduate Career Explorer");
    document.documentElement.lang = language.code();
    document.title = t("毕业后，留在香港？","After graduation, stay in Hong Kong?") + " | " + title + t(" · 风险与薪酬合并版"," · Risk and pay edition");
    document.querySelector('meta[name="description"]').content = t(
      "跟着嘉宁探索两地就业结构、香港行业、失业风险和薪酬，并试出适合自己的求职方向。",
      "Explore two labour markets with Jia Ning, then test which Hong Kong job options fit your priorities.");
    $("language").value = language.code();
    $("chapters").setAttribute("aria-label",t("章节","Chapters"));
    $("brand-title").textContent = title;
    $("footer-title").textContent = title;
    $("version-label").textContent = t(" · 风险与薪酬合并版"," · Risk and pay edition");
    $("skip-link").textContent = t("跳至图表","Skip to charts");
    $("source-link-text").textContent = t("数据与统计口径","Data and methods");
    $("language-label").textContent = t("语言","Language");
    $("top-action-text").textContent = t("探索求职方向","Explore job options");
    $("footer-sources").textContent = t("数据来源与使用说明","Data sources and notes");
  }

  function render(focusKey) {
    for (const detail of main.querySelectorAll("details[data-explore]")) {
      if (detail.open) expanded.add(detail.dataset.explore);
      else expanded.delete(detail.dataset.explore);
    }
    observers.forEach(ob => ob.disconnect());
    observers = [];
    charts.clear();
    tooltip.hidden=true;
    const activePage=pages.find(p=>p.id===chapter);
    const title=activePage?.title ?? t("数据与统计口径","Data and methods");
    $("breadcrumb").innerHTML = `${t("风险与薪酬合并版","Risk and pay edition")} <span aria-hidden="true">/</span> ${title}`;
    $("chapters").className="chapter-nav";
    $("chapters").innerHTML=pages.map((p,i)=>`<a href="#${p.id}"${p.id===chapter?' aria-current="page"':""}>
      <span class="nav-number">${mk(i)}</span><span><strong>${p.title}</strong><small>${p.subtitle}</small></span></a>`).join("");
    main.innerHTML=renderPage[chapter]();
    main.querySelectorAll("[data-chart]").forEach(el=>{
      const callback=charts.get(el.dataset.chart);
      let last=0;
      const draw=()=>{
        const w=Math.floor(el.clientWidth);
        if(w>0 && w!==last) { last=w; el.innerHTML=callback(w); }
      };
      draw();
      const observer=new ResizeObserver(draw);
      observer.observe(el);
      observers.push(observer);
    });
    const updated=focusKey && (document.getElementById(focusKey) || [...main.querySelectorAll("[data-focus]")].find(el=>el.dataset.focus===focusKey));
    if(updated) updated.focus({preventScroll:true});
  }

  function route() {
    const id=location.hash.slice(1);
    if(id==="content") { main.focus(); return; }
    const match=Object.hasOwn(renderPage,id) ? id : "markets";
    if(match===chapter) return;
    chapter=match;
    render();
    window.scrollTo(0,0);
    main.focus({preventScroll:true});
  }

  function choose(id,multiple) {
    const selected=state.selected;
    state.selected=multiple
      ? selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]
      : selected.length===1&&selected[0]===id?[]:[id];
  }
  function action(e,el) {
    const key=el.dataset.action, value=el.dataset.value;
    if(key==="marketPeriod") state.marketPeriod=value;
    if(key==="overviewYear") {
      if (+value<2016) return;
      state.overviewYear=+value;
    }
    if(key==="equityYear") {
      if (+value<2008) return;
      state.equityYear=+value;
    }
    if(key==="riskYear") {
      if (Math.floor(+value)>2025) return;
      state.riskYear=Math.floor(+value);
    }
    if(key==="riskCell") {
      const [year,age]=value.split("|");
      state.riskYear=+year;
      state.age=age;
    }
    if(key==="bubble"||key==="selectIndustry") choose(value,e.ctrlKey||e.metaKey);
    if(key==="toggleIndustry") choose(value,true);
    if(key==="resetIndustries") state.selected=[];
    if(key==="offerMedian") state.offer=+value;
    if(key==="case") Object.assign(state,{
      selected:["ind_K","ind_M_N","ind_I","ind_L"],payYear:2025,startYear:2016,vacancyMode:"count",
      targetPay:25000,maxHours:42,targetSurplus:6000,offer:25000,rent:10000,living:6500,deduct:2000,
    });
    render(el.dataset.focus);
  }

  main.addEventListener("click",e=>{
    const scroll=e.target.closest("[data-scroll]");
    if(scroll) {
      e.preventDefault();
      $(scroll.dataset.scroll).scrollIntoView({block:"start"});
      return;
    }
    const target=e.target.closest("[data-action]");
    if(target) action(e,target);
  });
  main.addEventListener("keydown",e=>{
    const target=e.target.closest("svg [data-action]");
    if(target&&(e.key==="Enter"||e.key===" ")) { e.preventDefault(); action(e,target); }
    if(e.key==="Escape") tooltip.hidden=true;
  });
  main.addEventListener("change",e=>{
    const key=e.target.dataset.control;
    if(!key || e.target.type==="number") return;
    if(key==="industry") state.selected=e.target.value==="all"?[]:[e.target.value];
    else if(typeof state[key]==="number") {
      if(e.target.value==="") { e.target.value=state[key]; return; }
      const want=Number(e.target.value);
      if(!Number.isFinite(want)) { e.target.value=state[key]; return; }
      state[key]=want;
    } else state[key]=e.target.value;
    render(e.target.id);
  });
  main.addEventListener("submit",e=>{
    if(!e.target.matches("[data-budget-form]")) return;
    e.preventDefault();
    for(const input of e.target.querySelectorAll("input[type=number]")) {
      if(input.value!=="") state[input.dataset.control]=input.valueAsNumber;
    }
    render(e.submitter?.id);
  });
  function showTip(el,event) {
    if(!el) return;
    const rect=el.getBoundingClientRect();
    const x=event?.clientX ?? rect.left+rect.width/2;
    const y=event?.clientY ?? rect.bottom;
    tooltip.textContent=el.dataset.tip;
    tooltip.hidden=false;
    const padding=8;
    tooltip.style.left=Math.max(padding,Math.min(x+12,innerWidth-tooltip.offsetWidth-padding))+"px";
    tooltip.style.top=(y+tooltip.offsetHeight+14>innerHeight?Math.max(padding,y-tooltip.offsetHeight-10):y+12)+"px";
  }
  main.addEventListener("pointermove",e=>{
    const hit=e.target.closest("[data-tip]");
    if(hit) showTip(hit,e); else tooltip.hidden=true;
  });
  main.addEventListener("pointerleave",()=>{ tooltip.hidden=true; });
  main.addEventListener("focusin",e=>showTip(e.target.closest("[data-tip]")));
  main.addEventListener("focusout",()=>{ tooltip.hidden=true; });
  $("language").addEventListener("change",e=>{
    const drafts=[...main.querySelectorAll('input[type="number"]')].map(input=>[input.id,input.value]);
    language.set(e.target.value);
    renderInterface();
    render("language");
    for(const [id,value] of drafts) $(id).value=value;
  });
  window.addEventListener("scroll",()=>{ tooltip.hidden=true; },{passive:true});
  window.addEventListener("hashchange",route);
  renderInterface();
  route();
})();
