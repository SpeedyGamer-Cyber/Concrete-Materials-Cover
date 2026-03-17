// EN 1992-1-1:2004 §4.4 Concrete Cover Calculator
// Theme override + auto fck from strength class
// Fixed: output timing, exposure-group consistency, dual E.1N check, init toggles

const STRENGTH_CLASSES = [
  "C12/15","C16/20","C20/25","C25/30","C30/37","C35/45",
  "C40/50","C45/55","C50/60","C55/67","C60/75","C70/85","C80/95","C90/105"
];
const EXPOSURE_CORROSION = ["X0","XC1","XC2","XC3","XC4","XD1","XD2","XD3","XS1","XS2","XS3"];
const EXPOSURE_ATTACK = ["X0","XF1","XF2","XF3","XF4","XA1","XA2","XA3"];
const REINF_TYPES = [
  "Reinforcement bars",
  "Prestressing – Post-tension (ducted)",
  "Prestressing – Pre-tension (strand/wire)"
];
const YESNO = ["No","Yes"];
const DESIGN_WORKING_LIFE = ["50","75","100"];
const QC_LEVELS = ["Normal","Special"];
const ABRASION = ["None","XM1 (+5 mm)","XM2 (+10 mm)","XM3 (+15 mm)"];
const GROUND_CAST = [
  "None",
  "Prepared ground / blinding ( Min 40 mm)",
  "Directly against soil (Min 75 mm)"
];

// Durability tables
const TABLE_44N_BARS = {
  "S1": {"X0":10, "XC1":10, "XC23":10, "XC4":15, "XD1XS1":20, "XD2XS2":25, "XD3XS3":30},
  "S2": {"X0":10, "XC1":10, "XC23":15, "XC4":20, "XD1XS1":25, "XD2XS2":30, "XD3XS3":35},
  "S3": {"X0":10, "XC1":10, "XC23":20, "XC4":25, "XD1XS1":30, "XD2XS2":35, "XD3XS3":40},
  "S4": {"X0":10, "XC1":15, "XC23":25, "XC4":30, "XD1XS1":35, "XD2XS2":40, "XD3XS3":45},
  "S5": {"X0":15, "XC1":20, "XC23":30, "XC4":35, "XD1XS1":40, "XD2XS2":45, "XD3XS3":50},
  "S6": {"X0":20, "XC1":25, "XC23":35, "XC4":40, "XD1XS1":45, "XD2XS2":50, "XD3XS3":55}
};
const TABLE_45N_PRESTRESS = {
  "S1": {"X0":10, "XC1":15, "XC23":20, "XC4":25, "XD1XS1":30, "XD2XS2":35, "XD3XS3":40},
  "S2": {"X0":10, "XC1":15, "XC23":25, "XC4":30, "XD1XS1":35, "XD2XS2":40, "XD3XS3":45},
  "S3": {"X0":10, "XC1":20, "XC23":30, "XC4":35, "XD1XS1":40, "XD2XS2":45, "XD3XS3":50},
  "S4": {"X0":10, "XC1":25, "XC23":35, "XC4":40, "XD1XS1":45, "XD2XS2":50, "XD3XS3":55},
  "S5": {"X0":15, "XC1":30, "XC23":40, "XC4":45, "XD1XS1":50, "XD2XS2":55, "XD3XS3":60},
  "S6": {"X0":20, "XC1":35, "XC23":45, "XC4":50, "XD1XS1":55, "XD2XS2":60, "XD3XS3":65}
};

/* Consistent threshold groups for structural class reductions */
const STRENGTH_THRESHOLD_BY_GROUP = {
  "X0": "C30/37",
  "XC1": "C30/37",
  "XC23": "C35/45",
  "XC4": "C40/50",
  "XD1XS1": "C40/50",
  "XD2XS2": "C40/50",
  "XD3XS3": "C45/55"
};

// EN 1992-1-1:2004 §4.4 Concrete Cover Calculator with Table E.1N Strength Check
const MIN_STRENGTH_BY_EXPOSURE_E1N = {
  "X0": "C12/15",
  "XC1": "C20/25",
  "XC2": "C25/30",
  "XC3": "C25/30",
  "XC4": "C30/37",
  "XD1": "C30/37",
  "XD2": "C30/37",
  "XD3": "C35/45",
  "XS1": "C30/37",
  "XS2": "C30/37",
  "XS3": "C35/45",
  "XF1": "C25/30",
  "XF2": "C30/37",
  "XF3": "C30/37",
  "XF4": "C35/45",
  "XA1": "C30/37",
  "XA2": "C35/45",
  "XA3": "C40/50"
};

const el = id => document.getElementById(id);

let eventsBound = false;

function resetResultsDisplay() {
  el("output").textContent = `Fill inputs and click “Calculate cover”.`;
  el("kpiCnom").textContent = "–";
  el("kpiCmin").textContent = "–";
  el("kpiSclass").textContent = "–";
}

function ensureFieldMessage(id) {
  const input = el(id);
  if (!input) return null;

  let msg = input.parentElement.querySelector(".field-msg[data-for='" + id + "']");
  if (!msg) {
    msg = document.createElement("small");
    msg.className = "field-msg hidden";
    msg.setAttribute("data-for", id);
    msg.setAttribute("aria-live", "polite");
    input.insertAdjacentElement("afterend", msg);
  }
  return msg;
}

function setFieldValidation(id, kind, text) {
  const input = el(id);
  const msg = ensureFieldMessage(id);
  if (!input || !msg) return;

  msg.textContent = text || "";
  msg.classList.toggle("hidden", !text);
  msg.classList.remove("warn", "error");
  input.classList.remove("input-warn", "input-error");

  if (kind === "warn") {
    msg.classList.add("warn");
    input.classList.add("input-warn");
  } else if (kind === "error") {
    msg.classList.add("error");
    input.classList.add("input-error");
  }
}

function clearFieldValidation(id) {
  setFieldValidation(id, null, "");
}

function validatePositiveNumber(id, label) {
  const input = el(id);
  if (!input) return { ok: true };

  const value = Number(input.value);
  if (!isFinite(value)) {
    const message = `${label} must be a valid number.`;
    setFieldValidation(id, "error", message);
    return { ok: false, message };
  }
  if (value <= 0) {
    const message = `${label} must be greater than 0.`;
    setFieldValidation(id, "error", message);
    return { ok: false, message };
  }

  clearFieldValidation(id);
  return { ok: true };
}

function validateNumericInputs() {
  const steel = el("steelType").value;
  const checks = [];

  checks.push(validatePositiveNumber("aggSize", "Nominal aggregate size"));

  if (steel === "Reinforcement bars") {
    checks.push(validatePositiveNumber("barPhi", "Bar / Strand diameter φ"));
  } else if (steel === "Prestressing – Post-tension (ducted)") {
    const shape = el("ductShape").value;
    if (shape === "Circular") {
      checks.push(validatePositiveNumber("dCirc", "Duct diameter"));
      clearFieldValidation("rectA");
      clearFieldValidation("rectB");
    } else {
      checks.push(validatePositiveNumber("rectA", "Rect duct a"));
      checks.push(validatePositiveNumber("rectB", "Rect duct b"));
      clearFieldValidation("dCirc");
    }
    clearFieldValidation("barPhi");
    clearFieldValidation("prePhi");
  } else {
    checks.push(validatePositiveNumber("prePhi", "Bar / Wire diameter φ"));
    clearFieldValidation("barPhi");
    clearFieldValidation("dCirc");
    clearFieldValidation("rectA");
    clearFieldValidation("rectB");
  }

  if (steel === "Reinforcement bars") {
    clearFieldValidation("dCirc");
    clearFieldValidation("rectA");
    clearFieldValidation("rectB");
    clearFieldValidation("prePhi");
  } else if (steel === "Prestressing – Pre-tension (strand/wire)") {
    clearFieldValidation("barPhi");
    clearFieldValidation("dCirc");
    clearFieldValidation("rectA");
    clearFieldValidation("rectB");
  }

  const firstError = checks.find(x => !x.ok);
  return firstError || { ok: true };
}

/** THEME HANDLING **/
const THEME_KEY = 'theme-preference'; // 'light' | 'dark' | null (system)
const mq = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  updateThemeButton(theme);
}
function updateThemeButton(theme){
  const btn = el('themeToggle');
  if (!btn) return;
  const system = mq.matches ? 'dark' : 'light';
  const effective = theme ?? system;
  btn.textContent = effective === 'light' ? '🌞' : '🌙';
  btn.title = theme ? `Theme: ${theme} (click to toggle)` : `Theme: system (${effective}) (click to toggle)`;
}
function loadTheme(){ try { return localStorage.getItem(THEME_KEY); } catch { return null; } }
function saveTheme(theme){ try { theme ? localStorage.setItem(THEME_KEY, theme) : localStorage.removeItem(THEME_KEY); } catch {} }
function initTheme(){
  const saved = loadTheme();
  applyTheme(saved);
  mq.addEventListener?.('change', () => { if (!loadTheme()) applyTheme(null); });
  const btn = el('themeToggle');
  btn?.addEventListener('click', (ev) => {
    if (ev.altKey) { saveTheme(null); applyTheme(null); return; }
    const current = loadTheme();
    const next = (current === 'light') ? 'dark' : (current === 'dark') ? 'light' : (mq.matches ? 'light' : 'dark');
    saveTheme(next); applyTheme(next);
  });
}

/** fck mapping **/
function fckFromStrengthClass(sc){
  const m = /^C(\d+)\//i.exec(sc || '');
  return m ? Number(m[1]) : NaN;
}
function updateFckFromClass(){
  const sc = el('strClass').value;
  const fck = fckFromStrengthClass(sc);
  if (!isNaN(fck)) el('fck').value = fck.toFixed(0);
}

// Populate selects
function populateSelect(id, options, value) {
  const s = el(id);
  s.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
  if (value) s.value = value;
}

function mapExposureToColumn(expo) {
  const e = (expo || '').toUpperCase();
  if (["X0", "XC1"].includes(e)) return e;
  if (["XC2","XC3"].includes(e)) return "XC23";
  if (e === "XC4") return "XC4";
  if (["XD1","XS1"].includes(e)) return "XD1XS1";
  if (["XD2","XS2"].includes(e)) return "XD2XS2";
  if (["XD3","XS3"].includes(e)) return "XD3XS3";
  return "XC23";
}

function strengthClassRank(sc) { const idx = STRENGTH_CLASSES.indexOf(sc); return idx >= 0 ? idx : -1; }
function getAdjustedStrengthThreshold(groupKey, airEntrainmentGt4) {
  const threshold = STRENGTH_THRESHOLD_BY_GROUP[groupKey];
  if (!threshold) return null;

  // Air entrainment > 4% reduces the REQUIRED threshold by one grade
  return airEntrainmentGt4
    ? adjustStrengthClassByGrades(threshold, -1)
    : threshold;
}

function meetsStrengthThreshold(strClass, groupKey, airEntrainmentGt4 = false) {
  const threshold = getAdjustedStrengthThreshold(groupKey, airEntrainmentGt4);
  if (!threshold) return false;
  return strengthClassRank(strClass) >= strengthClassRank(threshold);
}

function adjustStrengthClassByGrades(strClass, gradeShift) {
  const idx = strengthClassRank(strClass);
  if (idx < 0) return strClass;
  const nextIdx = clamp(idx + gradeShift, 0, STRENGTH_CLASSES.length - 1);
  return STRENGTH_CLASSES[nextIdx];
}

function deriveStructuralClass(designLifeYears, strengthClass, expoCorrosion, slabGeom, qcSpecial, airEntrainmentGt4) {
  let s = 4;

  // Design working life adjustment
  if (+designLifeYears >= 100) s += 2;
  else if (+designLifeYears >= 75) s += 1;

  const colKey = mapExposureToColumn(expoCorrosion);
  const thresholdFor43N = getAdjustedStrengthThreshold(colKey, airEntrainmentGt4);

  if (thresholdFor43N && strengthClassRank(strengthClass) >= strengthClassRank(thresholdFor43N)) {
    s -= 1;
  }

  if (slabGeom) s -= 1;
  if (qcSpecial) s -= 1;

  s = Math.max(1, Math.min(6, s));
  return { sClass: `S${s}`, thresholdFor43N };
}

function cmin_b_bars(phi_mm, agg_gt_32) { let c = +phi_mm; if (agg_gt_32) c += 5.0; return c; }
const PT_DUCT_CMIN_B_CAP_MM = 80; // practice guidance cap
function cmin_b_post_tension(ductShape, d_circ, a_rect, b_rect) {
  let c;
  if (ductShape === "Circular") c = +d_circ;
  else c = Math.max(+a_rect, 0.5 * (+b_rect));
  return Math.min(c, PT_DUCT_CMIN_B_CAP_MM);
}
function cmin_b_pre_tension(d_wire, wireType) { return (wireType === "Indented wire" ? 2.5 : 1.5) * (+d_wire); }

function durabilityCover(steelType, sclass, expoCorrosion) {
  const keyCol = mapExposureToColumn(expoCorrosion);
  const table = (steelType === "Reinforcement bars") ? TABLE_44N_BARS : TABLE_45N_PRESTRESS;
  const row = table[sclass];
  if (!row) throw new Error(`Structural class ${sclass} not found in durability table.`);
  if (!(keyCol in row)) throw new Error(`Exposure column ${keyCol} not found in durability table.`);
  return +row[keyCol];
}

function checkStrengthClassAgainstExposure(strClass, exposureClass) {
  const required = MIN_STRENGTH_BY_EXPOSURE_E1N[exposureClass];
  if (!required) return { ok: true, required: null };
  const ok = strengthClassRank(strClass) >= strengthClassRank(required);
  return { ok, required };
}

/* Combine corrosion & attack checks and report governing requirement */
function combineStrengthChecks(strClass, expoCorr, expoAtt) {
  const checks = [
    { kind: 'corrosion', expo: expoCorr, ...checkStrengthClassAgainstExposure(strClass, expoCorr) },
    { kind: 'attack',    expo: expoAtt,  ...checkStrengthClassAgainstExposure(strClass, expoAtt) }
  ];
  const withReq = checks.filter(c => !!c.required);
  if (!withReq.length) return { governing: null, checks };
  withReq.sort((a,b) =>
    strengthClassRank(MIN_STRENGTH_BY_EXPOSURE_E1N[b.expo]) -
    strengthClassRank(MIN_STRENGTH_BY_EXPOSURE_E1N[a.expo])
  );
  return { governing: withReq[0], checks };
}

function abrasionIncrement(abrasion) { if (!abrasion || abrasion === "None") return 0; if (abrasion.startsWith("XM1")) return 5; if (abrasion.startsWith("XM2")) return 10; if (abrasion.startsWith("XM3")) return 15; return 0; }
function groundIncrement(choice) { if (!choice) return 0; if (choice.includes("Prepared ground")) return 40; if (choice.includes("Directly against soil")) return 75; return 0; }

function getDeltaCdevRange(qcLevel, precisePrecast) { if (precisePrecast === "Yes") return [0, 10]; if (qcLevel === "Special") return [5, 10]; return [10, 10]; }
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

function formatDeltaCdevApplicability(lo, hi) {
  return lo === hi
    ? `Δcdev = ${lo.toFixed(0)} mm`
    : `range ${lo.toFixed(0)} – ${hi.toFixed(0)} mm`;
}

function setDeltaCdevMessage(kind, text) {
  const msg = el("deltaCdevMsg");
  const inp = el("deltaCdev");
  if (!msg || !inp) return;

  msg.textContent = text || "";
  msg.classList.toggle("hidden", !text);
  msg.classList.remove("warn", "error");
  inp.classList.remove("input-warn", "input-error");

  if (kind === "warn") {
    msg.classList.add("warn");
    inp.classList.add("input-warn");
  } else if (kind === "error") {
    msg.classList.add("error");
    inp.classList.add("input-error");
  }
}

function validateDeltaCdev() {
  const inp = el("deltaCdev");
  const value = Number(inp.value);
  const [lo, hi] = getDeltaCdevRange(el("qcLevel").value, el("precisePrecast").value);

  if (!isFinite(value)) {
    setDeltaCdevMessage("error", "Enter a valid Δcdev value.");
    return { ok: false, severity: "error", message: "Enter a valid Δcdev value." };
  }

  if (value < 0) {
    setDeltaCdevMessage("error", "Δcdev cannot be negative.");
    return { ok: false, severity: "error", message: "Δcdev cannot be negative." };
  }

  if (value < lo || value > hi) {
    const applicabilityText = lo === hi
      ? `the applicable value ${lo.toFixed(0)} mm`
      : `the applicable range ${lo.toFixed(0)}–${hi.toFixed(0)} mm`;

    const message = `Warning: Δcdev = ${value.toFixed(1)} mm is outside ${applicabilityText} for the selected QC / precast option.`;
    setDeltaCdevMessage("warn", message);
    return { ok: true, severity: "warn", message };
  }  

  setDeltaCdevMessage(null, "");
  return { ok: true, severity: null, message: "" };
}

function initUI(){
  populateSelect("strClass", STRENGTH_CLASSES, "C30/37");
  populateSelect("steelType", REINF_TYPES, REINF_TYPES[0]);
  populateSelect("expoCorrosion", EXPOSURE_CORROSION, "XC3");
  populateSelect("expoAttack", EXPOSURE_ATTACK, "X0");
  populateSelect("designLife", DESIGN_WORKING_LIFE, "50");
  populateSelect("airEntrainment", YESNO, "No");
  populateSelect("slabGeom", YESNO, "No");
  populateSelect("qcLevel", QC_LEVELS, "Normal");
  populateSelect("uneven", YESNO, "No");
  populateSelect("groundCast", GROUND_CAST, "None");
  populateSelect("abrasion", ABRASION, "None");
  populateSelect("castAgainstConcrete", YESNO, "No");
  populateSelect("precisePrecast", YESNO, "No");

  updateFckFromClass();
  updateDeltaCdevLimits();
  validateDeltaCdev();
  toggleSteelFields();
  toggleDuctFields();
  validateNumericInputs();

  if (eventsBound) return;
  eventsBound = true;

  el("strClass").addEventListener("change", updateFckFromClass);

  el("steelType").addEventListener("change", () => {
    toggleSteelFields();
    validateNumericInputs();
  });

  el("ductShape").addEventListener("change", () => {
    toggleDuctFields();
    validateNumericInputs();
  });

  el("qcLevel").addEventListener("change", () => {
    updateDeltaCdevLimits();
    validateDeltaCdev();
  });

  el("precisePrecast").addEventListener("change", () => {
    updateDeltaCdevLimits();
    validateDeltaCdev();
  });

  el("deltaCdev").addEventListener("input", validateDeltaCdev);

  ["aggSize", "barPhi", "dCirc", "rectA", "rectB", "prePhi"].forEach(id => {
    const node = el(id);
    node?.addEventListener("input", validateNumericInputs);
  });

  el("calcBtn").addEventListener("click", onCalculate);

  // Safe binding so app does not fail if printBtn is absent in a local variant
  el("printBtn")?.addEventListener("click", onPrint);

  window.addEventListener("beforeprint", updatePrintFooter);

  el("resetBtn").addEventListener("click", () => setTimeout(() => {
    initUI();
    setDeltaCdevMessage(null, "");
    ["aggSize", "barPhi", "dCirc", "rectA", "rectB", "prePhi"].forEach(clearFieldValidation);
    validateNumericInputs();
    resetResultsDisplay();
  }, 0));
}

function toggleSteelFields(){
  const steel = el("steelType").value;
  const bars = el("barsFields");
  const post = el("postFields");
  const pre = el("preFields");
  bars.classList.add("hidden"); post.classList.add("hidden"); pre.classList.add("hidden");
  if (steel === "Reinforcement bars") bars.classList.remove("hidden");
  else if (steel === "Prestressing – Post-tension (ducted)") post.classList.remove("hidden");
  else pre.classList.remove("hidden");
}

function toggleDuctFields(){
  const shape = el("ductShape").value;
  if (shape === "Circular") { el("circularSet").classList.remove("hidden"); el("rectSet").classList.add("hidden"); }
  else { el("circularSet").classList.add("hidden"); el("rectSet").classList.remove("hidden"); }
}

function updateDeltaCdevLimits(){
  const qc = el("qcLevel").value;
  const pp = el("precisePrecast").value;
  const [lo, hi] = getDeltaCdevRange(qc, pp);
  const inp = el("deltaCdev");
  // Allow entry outside range so warning can be shown; negative values are handled separately
  inp.min = 0;
  inp.max = hi;
  el("dcdRange").textContent = `(${formatDeltaCdevApplicability(lo, hi)})`;
}

function readNumber(id, fallback) { const v = Number(el(id).value); return isFinite(v) ? v : fallback; }

function formatPrintDateTime() {
  const now = new Date();
  return now.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updatePrintFooter() {
  const footer = el("printFooter");
  if (!footer) return;
  footer.textContent = `Generated on ${formatPrintDateTime()}`;
}

function onPrint() {
  updatePrintFooter();
  window.print();
}

function onCalculate(){
  try{
    const sc = el("strClass").value;
    const fck = fckFromStrengthClass(sc); // auto from class
    const steel = el("steelType").value;
    const expo_corr = el("expoCorrosion").value;
    const expo_att = el("expoAttack").value;
    const designLife = readNumber("designLife", 50);
    const airEntrainmentGt4 = el("airEntrainment").value === "Yes";
    const slabGeom = el("slabGeom").value === "Yes";
    const qcSpecial = el("qcLevel").value === "Special";
    const agg_gt_32 = readNumber("aggSize", 20) > 32;
    const uneven_inc = (el("uneven").value === "Yes") ? 5 : 0;
    const g_inc = groundIncrement(el("groundCast").value);
    const abr_inc = abrasionIncrement(el("abrasion").value);
    const castAgainstConc = el("castAgainstConcrete").value === "Yes";

    const deltaValidation = validateDeltaCdev();
    if (!deltaValidation.ok && deltaValidation.severity === "error") {
      throw new Error(deltaValidation.message);
    }

    const numericValidation = validateNumericInputs();
    if (!numericValidation.ok) {
      throw new Error(numericValidation.message);
    }

    const delta_c_dev = readNumber("deltaCdev", 10);

    const { sClass: s_class, thresholdFor43N } =
      deriveStructuralClass(designLife, sc, expo_corr, slabGeom, qcSpecial, airEntrainmentGt4);   
    
    let cmin_b = 0;
    if (steel === "Reinforcement bars") {
      const phi = readNumber("barPhi", 16);
      cmin_b = cmin_b_bars(phi, agg_gt_32);
    } else if (steel === "Prestressing – Post-tension (ducted)") {
      const shape = el("ductShape").value;
      cmin_b = (shape === "Circular") ? cmin_b_post_tension("Circular", readNumber("dCirc", 65), 0, 0)
                                       : cmin_b_post_tension("Rectangular", 0, readNumber("rectA", 50), readNumber("rectB", 100));
    } else {
      const d_wire = readNumber("prePhi", 16);
      const wtype = el("preWireType").value;
      cmin_b = cmin_b_pre_tension(d_wire, wtype);
    }

    const cmin_dur = durabilityCover(
      steel === "Reinforcement bars" ? "Reinforcement bars" : "Prestressing",
      s_class, expo_corr);

    const cmin_dur_eff = cmin_dur; // gamma_st/add = 0 per guidance

    let cmin_base = Math.max(cmin_b, cmin_dur_eff, 10.0);
    let controller = (cmin_base === cmin_b) ? "bond" : (cmin_base === cmin_dur_eff) ? "durability" : "10 mm absolute min";

    let castReductionApplied = false;
    if (castAgainstConc && fck >= 25.0) { // uses auto fck
      cmin_base = Math.max(cmin_b, 10.0);
      controller = "bond (cast against other concrete reduction)";
      castReductionApplied = true;
    }

    const exec_increments = uneven_inc + abr_inc;
    const cmin_final = Math.max(cmin_base + exec_increments, g_inc);
    const cnom = cmin_final + delta_c_dev;

    const lines = [];
    lines.push("=== EN 1992-1-1 Concrete Cover (per ‘Concrete Materials – Cover’) ===");
    lines.push(`Steel type: ${steel}`);
    lines.push(`Strength class: ${sc} (fck = ${isNaN(fck) ? '-' : fck.toFixed(1)} MPa)`);
    lines.push(`Exposure (corrosion): ${expo_corr}\nExposure (attack info): ${expo_att}`);
    lines.push(`Design life: ${designLife.toFixed(0)} y \n Slab geometry: ${slabGeom ? "Yes":"No"} \n QC: ${qcSpecial ? "Special":"Normal"}`);
    lines.push(`Air entrainment > 4%: ${airEntrainmentGt4 ? "Yes" : "No"}`);
    if (thresholdFor43N) {
      lines.push(
        `Table 4.3N reference strength class for 1-class reduction: ${thresholdFor43N}` +
        (airEntrainmentGt4 ? ` (required threshold reduced by one grade due to air entrainment > 4%)` : ``)
      );
    }
    lines.push(`Derived structural class (Table 4.3N rules): ${s_class}`);   
    
    lines.push("");

    lines.push("--- Bond cover (Table 4.2) ---");
    const aggInfo = (agg_gt_32 && steel === "Reinforcement bars") ? " (+5 mm due to agg > 32 mm)" : "";
    lines.push(`c_min,b = ${cmin_b.toFixed(1)} mm${aggInfo}`);
    if (steel === "Prestressing – Post-tension (ducted)") lines.push("Note: Post-tension duct cover capped at 80 mm as per guidance.");
    if (steel === "Prestressing – Pre-tension (strand/wire)") lines.push("Note: Pre-tension: 1.5×φ for strand/plain; 2.5×φ for indented wire.");
    lines.push("");

    lines.push("--- Durability cover (Tables 4.4N / 4.5N) ---");
    lines.push(`c_min,dur (table) = ${cmin_dur.toFixed(1)} mm → effective c_min,dur,eff = ${cmin_dur_eff.toFixed(1)} mm`);
    lines.push("");

    if (castReductionApplied) lines.push("Cast against other concrete reduction applied: c_min set to bond requirement (subject to ≥C25/30, <28 days exposure, roughened).");

    lines.push(`Base c_min (before execution increments) = ${cmin_base.toFixed(1)} mm (controller: ${controller})`);
    lines.push("");

    const incs = [];
    if (uneven_inc > 0) incs.push(`Uneven surface +${uneven_inc} mm`);

    if (g_inc > 0) {
      incs.push(`Cast against ground: ${el("groundCast").value} → minimum ${g_inc} mm`);
    }

    if (abr_inc > 0) {
      incs.push(`Abrasion ${el("abrasion").value} +${abr_inc} mm`);
    }

    lines.push("Execution increments: " + (incs.length ? incs.join(", ") : "None"));   
    lines.push(`c_min (after execution increments) = ${cmin_final.toFixed(1)} mm`);
    lines.push("");

    const qcLabel = el("qcLevel").value;
    const precastLabel = el("precisePrecast").value;
    const [dcdLo, dcdHi] = getDeltaCdevRange(qcLabel, precastLabel);
      
    lines.push(
      `Δc_dev used = ${delta_c_dev.toFixed(1)} mm ` +
      `(Quality control = ${qcLabel}; ` +
      `Precast high-accuracy & reject nonconforming = ${precastLabel}; ` +
      `${formatDeltaCdevApplicability(dcdLo, dcdHi)})`
    );    
    
    if (deltaValidation.severity === "warn") lines.push(deltaValidation.message);

    lines.push(`Nominal cover: c_nom = c_min + Δc_dev = ${cmin_final.toFixed(1)} + ${delta_c_dev.toFixed(1)} = **${cnom.toFixed(1)} mm**`);
    lines.push("");

    // Dual E.1N strength check (corrosion + attack)
    const { governing, checks } = combineStrengthChecks(sc, expo_corr, expo_att);
    lines.push("--- Exposure Class Strength Check (Table E.1N) ---");
    for (const c of checks) {
      if (c.required) {
        lines.push(`[${c.kind}] ${c.expo}: requires ≥ ${c.required}; selected ${sc} → ${c.ok ? "✅ OK" : "❌ NOT OK"}`);
      } else {
        lines.push(`[${c.kind}] ${c.expo}: No minimum strength requirement defined`);
      }
    }
    if (governing && !governing.ok) {
      lines.push(`Governing: ${governing.kind} ${governing.expo} (min ${governing.required}) → ❌ Increase strength class`);
    }

    // KPIs
    el("kpiCnom").textContent = `${cnom.toFixed(1)} mm`;
    el("kpiCmin").textContent = `${cmin_final.toFixed(1)} mm`;
    el("kpiSclass").textContent = s_class;

    // FINAL: assign output at the end so all sections are included
    el("output").textContent = lines.join("\n");
  } catch (e) {
    el("output").textContent = `Error: ${e.message}`;
  }
}

// Kick-off
document.addEventListener("DOMContentLoaded", () => { initTheme(); initUI(); });
