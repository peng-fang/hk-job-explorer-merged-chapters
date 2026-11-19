/* Small, dependency-free chart renderers. Data and interactions live in app.js. */
(() => {
  "use strict";

  const {t,year:yearLabel} = globalThis.guideLanguage;
  const purple = "#76568d";
  const rose = "#ac4e72";
  const colors = [purple, "#b783aa", "#65928e", "#bb8b55", "#a184b3", "#797f9d", "#c6929a", "#908575", "#b5a6bd"];
  const numberFormat = new Intl.NumberFormat("zh-HK", { maximumFractionDigits: 1 });
  const fixedFormat = new Intl.NumberFormat("zh-HK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const number = n => Number.isFinite(n) ? numberFormat.format(n) : "—";
  const percent = n => Number.isFinite(n) ? fixedFormat.format(n) + "%" : "—";
  const money = n => Number.isFinite(n) ? "HK$" + number(n) : "—";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
  const mark = (tip, kind, value, pressed) => {
    if (!kind) return `data-tip="${esc(tip)}"`;
    const selected = pressed === undefined ? "" : ` aria-pressed="${pressed}"`;
    return `class="mark" role="button" tabindex="0" aria-label="${esc(tip)}"${selected} data-tip="${esc(tip)}" data-action="${esc(kind)}" data-value="${esc(value)}" data-focus="${esc(kind + ":" + value)}"`;
  };
  const svg = (w, h, label, content) => `<svg viewBox="0 0 ${w} ${h}" aria-label="${esc(label)}">${content}</svg>`;
  const line = (x, y, x2, y2, cls) => `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
  const text = (x, y, label, anchor = "middle") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}">${esc(label)}</text>`;
  const scale = (a,b,c,d) => n => c + (n-a) / (b-a || 1) * (d-c);
  const empty = message => `<p class="empty">${esc(message)}</p>`;
  const tickList = (min,max,count = 4) => Array.from({length:count+1}, (_,i) => min+(max-min)*i/count);
  const legend = entries => `<div class="legend">${entries.map(([label, color]) =>
    `<span><i style="background:${color}"></i>${esc(label)}</span>`).join("")}</div>`;

  function axes(w, h, opt) {
    const left = opt.left ?? 47, right = w - (opt.right ?? 18);
    const top = opt.top ?? 16, bottom = h - (opt.bottom ?? 31);
    const x = scale(...opt.x, left, right), y = scale(...opt.y, bottom, top);
    const grid = (opt.yTicks ?? tickList(...opt.y)).map(t =>
      line(left,y(t),right,y(t),"gridline") + text(left-7,y(t)+4,(opt.yFormat ?? number)(t),"end")).join("");
    const time = (opt.xTicks ?? tickList(...opt.x)).map(t =>
      text(x(t),bottom+19,(opt.xFormat ?? number)(t))).join("");
    return {left,right,top,bottom,x,y,grid:grid+time};
  }

  function series(w, sets, opt) {
    const h = opt.height ?? 238;
    const visible = sets.flatMap(s => s.points.filter(p => Number.isFinite(p[1])));
    if (!visible.length) return empty(t("该条件下没有数据。","No data for this selection."));
    const xs = visible.map(p=>p[0]), ys = visible.map(p=>p[1]);
    const d = {
      ...opt, x: opt.x ?? [Math.min(...xs), Math.max(...xs)],
      y: opt.y ?? [Math.min(0,...ys), Math.ceil(Math.max(...ys) / 5)*5],
    };
    const a = axes(w,h,d);
    let out = a.grid;
    if (Number.isFinite(opt.refY)) out += line(a.left,a.y(opt.refY),a.right,a.y(opt.refY),"refline");
    if (Number.isFinite(opt.refX) && opt.refX >= d.x[0] && opt.refX <= d.x[1]) {
      out += line(a.x(opt.refX),a.top,a.x(opt.refX),a.bottom,"refline");
    }
    for (const s of sets) {
      let draw = "", pen = false;
      for (const [x,y] of s.points) {
        if (!Number.isFinite(y)) { pen = false; continue; }
        draw += `${pen ? "L" : "M"}${a.x(x)},${a.y(y)} `;
        pen = true;
      }
      if (!opt.pointsOnly) {
        out += `<path d="${draw}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="5 3"' : ""}/>`;
      }
      for (const [x,y,extra] of s.points) {
        if (!Number.isFinite(y)) continue;
        const tip = extra ?? `${s.name} · ${(opt.xFormat ?? number)(x)} · ${(opt.yFormat ?? number)(y)}`;
        const selected = x === opt.refX;
        const r = selected ? 4.7 : opt.pointsOnly ? 4 : s.points.length > 55 ? 2.1 : 3.1;
        const action = !opt.canSelect || opt.canSelect(x) ? opt.action : null;
        out += `<circle cx="${a.x(x)}" cy="${a.y(y)}" r="${r}" fill="${s.color}" ${mark(tip,action,x)}/>`;
      }
    }
    return svg(w,h,opt.label,out);
  }

  function stack(w, sets, years, year, action) {
    const h = 246;
    const a = axes(w,h,{x:[years[0],years.at(-1)], y:[0,100], yFormat: percent,
      xTicks: years.filter((_,i)=>i%4===0 || i===years.length-1)});
    let base = years.map(()=>0);
    let content = a.grid;
    for (const s of sets) {
      const high = years.map((_,i)=>base[i]+(s.values[i] ?? 0));
      const top = years.map((y,i)=>`${a.x(y)},${a.y(high[i])}`);
      const bottom = years.map((y,i)=>`${a.x(y)},${a.y(base[i])}`).reverse();
      content += `<polygon points="${[...top,...bottom].join(" ")}" fill="${s.color}" opacity=".86"/>`;
      base = high;
    }
    content += line(a.x(year),a.top,a.x(year),a.bottom,"refline");
    if (action) for (const [i,y] of years.entries()) {
      const step = (a.right-a.left)/(years.length-1);
      const tip = yearLabel(y) + "\n" + sets.map(s=>s.name + " " + percent(s.values[i])).join("\n");
      content += `<rect x="${Math.max(a.left,a.x(y)-step/2)}" y="${a.top}" width="${i===0 || i===years.length-1 ? step/2 : step}" height="${a.bottom-a.top}" fill="transparent" ${mark(tip,y>=2016 ? action : null,y)}/>`;
    }
    return svg(w,h,t("各行业占全部香港就业的百分比堆叠面积图","Stacked area chart of industry shares in Hong Kong employment"),content);
  }

  function bars(rows, opt = {}) {
    const max = opt.max ?? Math.max(1, ...rows.flatMap(r=>r.values.filter(Number.isFinite)));
    const draw = (v,i,cap) => Number.isFinite(v)
      ? `<span class="bar" style="width:${Math.max(0,v/max)*cap}%;background:${opt.colors?.[i] ?? colors[i]}" data-tip="${esc((opt.labels?.[i] ?? "")+" "+(opt.format ?? number)(v))}"><b>${esc((opt.format ?? number)(v))}</b></span>`
      : '<span>—</span>';
    return `<div class="bars" role="group" aria-label="${esc(opt.label ?? t("条形图","Bar chart"))}">${rows.map(r=>{
      const tracks = opt.mirror
        ? `<div class="mirror">${r.values.map((v,i)=>`<span class="half">${draw(v,i,64)}</span>`).join("")}</div>`
        : `<div class="bars-track${r.values.length===1 ? " bar-single" : ""}">${r.values.map((v,i)=>draw(v,i,73)).join("")}</div>`;
      return `<div class="bar-row"><span class="name">${esc(r.name)}</span>${tracks}</div>`;
    }).join("")}</div>`;
  }

  function donut(rows) {
    const total = rows.reduce((n,r)=>n+r.value,0);
    let start = 0;
    const slices = rows.map((r,i)=>{
      const end = start + r.value/total*100;
      const part = `${colors[i]} ${start}% ${end}%`;
      start = end;
      return part;
    });
    return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${slices.join(",")})" aria-hidden="true"><span>${number(total)}<small>${t("千人","thousand people")}</small></span></div>
      <ul class="donut-legend">${rows.map((r,i)=>`<li><i style="background:${colors[i]}"></i><span>${esc(r.name)}</span><strong>${percent(r.value/total*100)}</strong></li>`).join("")}</ul></div>`;
  }

  function treemap(rows) {
    const ranked = rows.slice().sort((a,b)=>b.value-a.value);
    const total = ranked.reduce((a,b)=>a+b.value,0);
    function layout(group,x,y,w,h) {
      if (group.length===1) return [{...group[0],x,y,w,h}];
      const sum = group.reduce((a,b)=>a+b.value,0);
      let breakpoint=1, acc=group[0].value;
      while (breakpoint<group.length-1 && acc<sum/2) { acc+=group[breakpoint].value; breakpoint++; }
      const a=group.slice(0,breakpoint), b=group.slice(breakpoint), f=acc/sum;
      return w>=h*1.5
        ? [...layout(a,x,y,w*f,h),...layout(b,x+w*f,y,w*(1-f),h)]
        : [...layout(a,x,y,w,h*f),...layout(b,x,y+h*f,w,h*(1-f))];
    }
    return `<div class="treemap" aria-label="${t("职业人数矩形树图","Treemap of employment by occupation")}">${layout(ranked,0,0,100,100).map((r,i)=>{
      const tip = `${r.name} · ${number(r.value)}${t(" 千人"," thousand people")} · ${percent(r.value/total*100)}`;
      return `<button type="button" aria-label="${esc(tip)}" data-tip="${esc(tip)}" style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%;background:${["#d8c5e2","#eac5db","#ccbedf","#d5d5e7","#e2cfd7","#c8d8d5","#ddcbbf","#e5dce8","#dbc8d3"][i]};color:#2b2030"><span class="tile-label">${r.w*r.h>220 ? esc(r.name) : ""}</span></button>`;
    }).join("")}</div>`;
  }

  function bubbles(w, values, picked) {
    const h=254;
    const a=axes(w,h,{x:[.5,2.8],y:[-3,4],xTicks:[.5,1,1.5,2,2.5],yTicks:[-2,0,2,4],
      xFormat:percent,yFormat:percent,right:21,bottom:44});
    let content=a.grid+line(a.left,a.y(0),a.right,a.y(0),"refline")
      +line(a.x(1.7),a.top,a.x(1.7),a.bottom,"refline")
      +text(a.right,250,t("职位空缺率","Vacancy rate"),"end")+text(a.x(1.7)+5,a.top+7,t("总体 1.7%","Overall 1.7%"),"start");
    const max = Math.max(...values.map(r=>r.openings));
    for(const r of values.slice().sort((a,b)=>b.openings-a.openings)) {
      const selected = picked.includes(r.id);
      const tip = `${r.name}\n${t("空缺率","Vacancy rate")} ${percent(r.rate*100)} · ${number(r.openings)}${t(" 个"," vacancies")}\n${t("用工同比","Employment YoY")} ${percent(r.yoy*100)}`;
      content += `<circle cx="${a.x(r.rate*100)}" cy="${a.y(r.yoy*100)}" r="${Math.sqrt(r.openings/max)*22}" fill="${r.yoy>=0 ? purple : rose}" opacity="${picked.length && !selected ? .31 : .86}" ${mark(tip,"bubble",r.id,selected)}/>`;
    }
    return svg(w,h,t("招聘机会地图，横轴职位空缺率，纵轴机构用工同比","Hiring opportunities. X: vacancy rate. Y: year-on-year employment change."),content);
  }

  function waterfall(w, amounts) {
    const data = [amounts.offer,-amounts.rent,-amounts.living,-amounts.deduct];
    const steps = t(["Offer 月薪","每月房租","生活交通","预留扣款"],["Offer","Rent","Living","Set-aside"]);
    let acc=0;
    const rows = data.map((v,i)=>{
      const s = {label:steps[i],value:v,from:acc,to:acc+v};
      acc += v;
      return s;
    });
    rows.push({label:t("每月结余","Surplus"),value:acc,from:0,to:acc});
    const vals = rows.flatMap(r=>[r.from,r.to]), h=234;
    const min = Math.min(...vals), max=Math.max(...vals, 1);
    const delta = Math.max(max-min, 1000);
    const a=axes(w,h,{x:[-.6,4.6],y:[Math.min(0,min)-delta*.12,max+delta*.17],
      xTicks:[],yTicks:[min,(min+max)/2,max].filter((v,i,vs)=>!i || v!==vs[i-1]),
      yFormat:n=>number(n/1000)+"k",bottom:36,left:40});
    let content=a.grid + line(a.left,a.y(0),a.right,a.y(0),"refline");
    const width=Math.min(47,(a.right-a.left)/8);
    rows.forEach((r,i)=>{
      const x=a.x(i), high=Math.min(a.y(r.from),a.y(r.to)), low=Math.max(a.y(r.from),a.y(r.to));
      const tip = r.label + " " + money(r.value);
      content += `<rect x="${x-width/2}" y="${high}" width="${width}" height="${Math.max(low-high,1)}" fill="${i===0 || i===4 ? purple : "#bfa4ce"}" rx="3" ${mark(tip)}/>`;
      if(i<3) content+=line(x+width/2,a.y(r.to),a.x(i+1)-width/2,a.y(r.to),"gridline");
      content+=text(x,high-5,number(r.value/1000)+"k")+text(x,a.bottom+23,r.label);
    });
    return svg(w,h,t("个人生活预算瀑布图","Monthly budget waterfall chart"),content);
  }

  globalThis.guideCharts = {purple,rose,colors,number,percent,money,esc,mark,empty,legend,series,stack,bars,donut,treemap,bubbles,waterfall};
})();
