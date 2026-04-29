/**
 * Jayesh Ahuja — Financial Companion Pro
 * Vanilla JS • No build tools required
 */

(function () {
    "use strict";

    // ---------- STATE ----------
    const state = {
        mode: "loan",        // loan | invest | advanced | basic
        subMode: "npv",      // npv | irr (advanced)
        currentStep: 0,
        inputs: {
            loan: ["", "", ""],
            invest: ["", "", ""],
            advanced: { npv: ["", ""], irr: [""] },
            basic: "0"
        },
        cashFlows: [],
        basicCalc: { prevValue: null, operator: null, waitingForSecond: false }
    };

    const META = {
        loan: [
            { label: "Principal",     hint: "Enter Loan Amount",         symbol: "₹"   },
            { label: "Interest Rate", hint: "Now enter Interest Rate",   symbol: "%"   },
            { label: "Tenure",        hint: "Finally, enter Time (Years)", symbol: "yrs" }
        ],
        invest: [
            { label: "Investment",  hint: "Enter Starting Amount",       symbol: "₹"   },
            { label: "Return Rate", hint: "Expected Annual Return",      symbol: "%"   },
            { label: "Horizon",     hint: "Investment Period (Years)",   symbol: "yrs" }
        ],
        advanced: {
            npv: [
                { label: "Discount Rate",      hint: "Enter Annual Discount Rate", symbol: "%" },
                { label: "Initial Investment", hint: "Enter Outflow (t=0)",        symbol: "₹" }
            ],
            irr: [
                { label: "Initial Investment", hint: "Enter Outflow (t=0)",        symbol: "₹" }
            ]
        },
        basic: [{ label: "Standard", hint: "Basic Calculations", symbol: "" }]
    };

    // ---------- DOM CACHE ----------
    const dom = {
        displayValue:    document.getElementById("display-value"),
        displayHint:     document.getElementById("display-hint"),
        activeLabel:     document.getElementById("active-field-label"),
        currencySymbol:  document.getElementById("currency-symbol"),
        modeIndicator:   document.getElementById("mode-indicator"),
        stepIndicator:   document.getElementById("step-indicator"),
        summaryStrip:    document.getElementById("summary-strip"),
        resultsRow:      document.getElementById("results-row"),
        insightContent:  document.getElementById("insight-content"),
        insightCard:     document.getElementById("smart-insight-card"),
        nextBtn:         document.getElementById("key-next"),
        tabBtns:         document.querySelectorAll(".tab-btn"),
        advancedControls:document.getElementById("advanced-controls"),
        subTabBtns:      document.querySelectorAll(".sub-tab"),
        cfContainer:     document.getElementById("cashflow-list-container"),
        cfList:          document.getElementById("cashflow-list"),
        btnAddCF:        document.getElementById("btn-add-cashflow"),
        bsKey:           document.getElementById("key-backspace"),
        keypad:          document.querySelector(".keypad-grid")
    };

    // ---------- INIT ----------
    function init() {
        bindEvents();
        setMode(state.mode);
    }

    function bindEvents() {
        dom.tabBtns.forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
        dom.subTabBtns.forEach(btn => btn.addEventListener("click", () => setSubMode(btn.dataset.submode)));

        dom.btnAddCF.addEventListener("click", addCashFlow);

        dom.cfList.addEventListener("click", e => {
            const btn = e.target.closest(".delete");
            if (btn) deleteCashFlow(parseInt(btn.dataset.index, 10));
        });

        dom.keypad.addEventListener("click", e => {
            const key = e.target.closest(".key");
            if (!key) return;
            handleAction(key.dataset.key);
            if (window.navigator.vibrate) window.navigator.vibrate(10);
        });

        // Physical keyboard
        window.addEventListener("keydown", e => {
            const k = e.key;
            if (/^[0-9]$/.test(k))    handleAction(k);
            else if (k === ".")       handleAction("decimal");
            else if (k === "Backspace") handleAction("backspace");
            else if (k === "Enter")   handleAction("next");
            else if (k === "+")       handleAction("add");
            else if (k === "-")       handleAction("subtract");
            else if (k === "*")       handleAction("multiply");
            else if (k === "/")     { e.preventDefault(); handleAction("divide"); }
            else if (k === "Escape")  handleAction("clear");
        });

        // Long-press backspace = clear all
        let bsTimer;
        const startLP = () => { bsTimer = setTimeout(() => handleAction("clear"), 800); };
        const cancelLP = () => clearTimeout(bsTimer);
        dom.bsKey.addEventListener("mousedown",  startLP);
        dom.bsKey.addEventListener("mouseup",    cancelLP);
        dom.bsKey.addEventListener("mouseleave", cancelLP);
        dom.bsKey.addEventListener("touchstart", startLP, { passive: true });
        dom.bsKey.addEventListener("touchend",   cancelLP);
    }

    // ---------- MODE / SUB-MODE ----------
    function setMode(mode) {
        state.mode = mode;
        state.currentStep = 0;
        dom.tabBtns.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));

        const isAdv = mode === "advanced";
        dom.advancedControls.hidden = !isAdv;
        dom.cfContainer.hidden = !isAdv;

        if (isAdv) renderCashFlows();
        updateUI();
        calculateFinancials();
    }

    function setSubMode(sub) {
        state.subMode = sub;
        state.currentStep = 0;
        dom.subTabBtns.forEach(b => b.classList.toggle("active", b.dataset.submode === sub));
        updateUI();
        calculateFinancials();
    }

    // ---------- CASH FLOWS ----------
    function addCashFlow() {
        if (state.mode !== "advanced") return;
        const arr = state.inputs.advanced[state.subMode];
        const val = parseFloat(arr[state.currentStep]) || 0;
        if (val !== 0) {
            state.cashFlows.push(val);
            arr[state.currentStep] = "";
            renderCashFlows();
            updateUI();
            calculateFinancials();
        }
    }

    function deleteCashFlow(index) {
        state.cashFlows.splice(index, 1);
        renderCashFlows();
        calculateFinancials();
    }

    function renderCashFlows() {
        dom.cfList.innerHTML = state.cashFlows.map((cf, i) => `
            <div class="cashflow-item">
                <div class="cf-info">
                    <span class="cf-year">Year ${i + 1}</span>
                    <span class="cf-amount">₹${formatIndian(cf.toString())}</span>
                </div>
                <div class="cf-actions">
                    <button class="cf-btn delete" data-index="${i}" aria-label="Remove year ${i + 1}">✕</button>
                </div>
            </div>
        `).join("");
    }

    // ---------- ACTIONS ----------
    function handleAction(action) {
        if (state.mode === "basic") return handleBasicAction(action);
        return handleFinancialAction(action);
    }

    function getCurrent() {
        if (state.mode === "advanced") return state.inputs.advanced[state.subMode][state.currentStep] || "";
        return state.inputs[state.mode][state.currentStep] || "";
    }

    function setCurrent(val) {
        if (state.mode === "advanced") state.inputs.advanced[state.subMode][state.currentStep] = val;
        else state.inputs[state.mode][state.currentStep] = val;
    }

    function handleFinancialAction(action) {
        const cur = getCurrent();

        if (/^[0-9]$/.test(action) || action === "decimal") {
            let v = cur;
            if (action === "decimal") {
                if (!v.includes(".")) v = v === "" ? "0." : v + ".";
            } else {
                v = v === "0" ? action : v + action;
            }
            setCurrent(v);
        }
        else if (action === "backspace") setCurrent(cur.slice(0, -1));
        else if (action === "toggle-sign") {
            if (cur && cur !== "0") setCurrent(cur.startsWith("-") ? cur.slice(1) : "-" + cur);
        }
        else if (action === "clear") {
            if (state.mode === "advanced") {
                state.inputs.advanced[state.subMode] = state.subMode === "npv" ? ["", ""] : [""];
                state.cashFlows = [];
                renderCashFlows();
            } else {
                state.inputs[state.mode] = ["", "", ""];
            }
            state.currentStep = 0;
        }
        else if (action === "next") {
            const isAdv = state.mode === "advanced";
            const maxSteps = isAdv ? (state.subMode === "npv" ? 1 : 0) : 2;
            if (state.currentStep < maxSteps) state.currentStep++;
            else if (isAdv) addCashFlow();
        }

        updateUI();
        calculateFinancials();
    }

    function handleBasicAction(action) {
        let val = state.inputs.basic;

        if (/^[0-9]$/.test(action) || action === "decimal") {
            if (state.basicCalc.waitingForSecond) {
                val = action === "decimal" ? "0." : action;
                state.basicCalc.waitingForSecond = false;
            } else {
                if (action === "decimal") {
                    if (!val.includes(".")) val += ".";
                } else {
                    val = val === "0" ? action : val + action;
                }
            }
            state.inputs.basic = val;
        }
        else if (["add", "subtract", "multiply", "divide"].includes(action)) processOperator(action);
        else if (action === "next") processOperator(null);
        else if (action === "backspace") state.inputs.basic = val.length > 1 ? val.slice(0, -1) : "0";
        else if (action === "toggle-sign") {
            if (val !== "0") state.inputs.basic = val.startsWith("-") ? val.slice(1) : "-" + val;
        }
        else if (action === "clear") {
            state.inputs.basic = "0";
            state.basicCalc = { prevValue: null, operator: null, waitingForSecond: false };
        }

        updateUI();
    }

    function processOperator(op) {
        const current = parseFloat(state.inputs.basic);
        if (state.basicCalc.prevValue === null) {
            state.basicCalc.prevValue = current;
        } else if (state.basicCalc.operator) {
            const res = compute(state.basicCalc.prevValue, current, state.basicCalc.operator);
            state.basicCalc.prevValue = res;
            state.inputs.basic = String(res);
        }
        state.basicCalc.operator = op;
        state.basicCalc.waitingForSecond = !!op;
    }

    function compute(a, b, op) {
        switch (op) {
            case "add":      return a + b;
            case "subtract": return a - b;
            case "multiply": return a * b;
            case "divide":   return b !== 0 ? a / b : 0;
            default:         return b;
        }
    }

    // ---------- UI ----------
    function updateUI() {
        const m = state.mode;
        const isAdv = m === "advanced";
        const meta = isAdv ? META.advanced[state.subMode][state.currentStep] : META[m][state.currentStep];
        const val = m === "basic" ? state.inputs.basic : getCurrent();

        dom.displayValue.textContent = formatIndian(val) || "0";
        dom.displayHint.textContent = meta.hint;
        dom.activeLabel.textContent = meta.label;
        dom.currencySymbol.textContent = meta.symbol;
        dom.modeIndicator.textContent = isAdv ? `${state.subMode.toUpperCase()} MODE` : `${m.toUpperCase()} MODE`;

        const totalSteps = isAdv ? (state.subMode === "npv" ? 2 : 1) : 3;
        dom.stepIndicator.textContent = m === "basic" ? "" : `${state.currentStep + 1} / ${totalSteps}`;

        if (m === "basic") dom.nextBtn.textContent = "=";
        else if (isAdv) {
            const last = state.subMode === "npv" ? state.currentStep === 1 : state.currentStep === 0;
            dom.nextBtn.textContent = last ? "ADD CASH FLOW" : "NEXT STEP";
        } else {
            dom.nextBtn.textContent = state.currentStep === 2 ? "CALCULATE" : "NEXT STEP";
        }

        adjustFontSize(dom.displayValue);
        updateSummaryStrip();
        dom.insightCard.style.display = m === "basic" ? "none" : "";
    }

    function formatIndian(n) {
        if (!n) return "";
        const str = String(n);
        const negative = str.startsWith("-");
        const cleaned = negative ? str.slice(1) : str;
        const parts = cleaned.split(".");
        const integer = parts[0] || "";
        const decimal = parts[1];
        if (!integer) return str;
        let lastThree = integer.substring(integer.length - 3);
        const otherNumbers = integer.substring(0, integer.length - 3);
        if (otherNumbers !== "") lastThree = "," + lastThree;
        const res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
        return (negative ? "-" : "") + res + (decimal !== undefined ? "." + decimal : "");
    }

    function adjustFontSize(el) {
        const len = el.textContent.length;
        const isSmall = window.innerHeight < 700;
        let size = isSmall ? 2.4 : 3.2;
        if (len > 12) size = isSmall ? 1.4 : 1.8;
        else if (len > 10) size = isSmall ? 1.6 : 2.2;
        else if (len > 8)  size = isSmall ? 1.9 : 2.6;
        el.style.fontSize = `${size}rem`;
    }

    function updateSummaryStrip() {
        if (state.mode === "basic") { dom.summaryStrip.textContent = ""; return; }

        let inputs, labels;
        if (state.mode === "advanced") {
            inputs = state.inputs.advanced[state.subMode];
            labels = META.advanced[state.subMode];
        } else {
            inputs = state.inputs[state.mode];
            labels = META[state.mode];
        }

        const summary = [];
        labels.forEach((meta, i) => {
            if (inputs[i] && i !== state.currentStep) {
                summary.push(`${meta.label}: ${inputs[i]}${meta.symbol}`);
            }
        });
        dom.summaryStrip.textContent = summary.join(" | ");
    }

    // ---------- CALCULATIONS ----------
    function calculateFinancials() {
        if (state.mode === "loan") {
            const [p, r, t] = state.inputs.loan.map(v => parseFloat(v) || 0);
            if (p && r && t) {
                const monthlyRate = r / 12 / 100;
                const months = t * 12;
                const emi = (p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                const totalPayable = emi * months;
                const totalInterest = totalPayable - p;
                renderResults([
                    { label: "Monthly EMI",    value: emi,           icon: "💸" },
                    { label: "Total Interest", value: totalInterest, icon: "📈" },
                    { label: "Total Payable",  value: totalPayable,  icon: "🧾" }
                ]);
                generateLoanInsight(p, totalInterest, emi);
            } else clearResults();
        }
        else if (state.mode === "invest") {
            const [p, r, t] = state.inputs.invest.map(v => parseFloat(v) || 0);
            if (p && r && t) {
                const maturity = p * Math.pow(1 + r / 100, t);
                const wealth = maturity - p;
                renderResults([
                    { label: "Maturity Value", value: maturity, icon: "💎" },
                    { label: "Wealth Gain",    value: wealth,   icon: "💰" },
                    { label: "Initial Sum",    value: p,        icon: "🪙" }
                ]);
                generateInvestInsight(p, r, t, wealth, maturity);
            } else clearResults();
        }
        else if (state.mode === "advanced") {
            if (state.subMode === "npv") {
                const rate = (parseFloat(state.inputs.advanced.npv[0]) || 0) / 100;
                const initial = parseFloat(state.inputs.advanced.npv[1]) || 0;
                if (initial > 0) {
                    let npv = -initial;
                    state.cashFlows.forEach((cf, i) => { npv += cf / Math.pow(1 + rate, i + 1); });
                    renderResults([
                        { label: "Net Present Value", value: npv,                                        icon: "📊" },
                        { label: "Initial Outlay",    value: -initial,                                   icon: "📉" },
                        { label: "Total Inflow",      value: state.cashFlows.reduce((a, b) => a + b, 0),icon: "📈" }
                    ]);
                    generateAdvancedInsight("npv", npv);
                } else clearResults();
            } else {
                const initial = parseFloat(state.inputs.advanced.irr[0]) || 0;
                if (initial > 0 && state.cashFlows.length > 0) {
                    const irr = calculateIRR(-initial, state.cashFlows);
                    renderResults([
                        { label: "Internal Return", value: `${(irr * 100).toFixed(2)}%`, icon: "🚀", isRaw: true },
                        { label: "Initial Outlay",  value: -initial,                     icon: "📉" },
                        { label: "Years",           value: state.cashFlows.length,       icon: "⏳", isRaw: true }
                    ]);
                    generateAdvancedInsight("irr", irr);
                } else clearResults();
            }
        }
        else {
            clearResults();
        }
    }

    function calculateIRR(initial, flows) {
        let guess = 0.1;
        for (let i = 0; i < 30; i++) {
            let npv = initial, dNpv = 0;
            flows.forEach((cf, t) => {
                npv  += cf / Math.pow(1 + guess, t + 1);
                dNpv -= ((t + 1) * cf) / Math.pow(1 + guess, t + 2);
            });
            if (dNpv === 0) break;
            const next = guess - npv / dNpv;
            if (Math.abs(next - guess) < 0.0001) return next;
            guess = next;
        }
        return guess;
    }

    function renderResults(items) {
        dom.resultsRow.innerHTML = items.map(item => `
            <div class="result-card">
                <span class="result-icon">${item.icon}</span>
                <span class="result-label">${item.label}</span>
                <span class="result-value">${item.isRaw ? item.value : "₹" + formatIndian(item.value.toFixed(0))}</span>
            </div>
        `).join("");
    }

    function clearResults() {
        dom.resultsRow.innerHTML = "";
        dom.insightContent.textContent = "Complete all steps to unlock financial analysis.";
    }

    function generateLoanInsight(p, interest, emi) {
        const intPercent = (interest / p * 100).toFixed(0);
        const savings = (emi * 0.1).toFixed(0);
        const savedInt = (interest * 0.15).toFixed(0);
        dom.insightContent.innerHTML =
            `You are paying <strong>${intPercent}% extra</strong> as interest. <br>` +
            `💡 Tip: Adding <strong>₹${formatIndian(savings)}</strong> to your monthly EMI can save you approx. ` +
            `<strong>₹${formatIndian(savedInt)}</strong> in total interest!`;
    }

    function generateInvestInsight(p, r, t, wealth, mat) {
        const multiplier = (wealth / p).toFixed(1);
        const plusOne = p * Math.pow(1 + r / 100, t + 1) - mat;
        dom.insightContent.innerHTML =
            `Your wealth will grow <strong>${multiplier}x</strong>. <br>` +
            `🚀 Power of Compounding: Staying invested for just 1 more year could add ` +
            `<strong>₹${formatIndian(plusOne.toFixed(0))}</strong> to your portfolio!`;
    }

    function generateAdvancedInsight(type, val) {
        if (type === "npv") {
            dom.insightContent.innerHTML = val > 0
                ? `✅ <strong>Positive NPV:</strong> This project adds <strong>₹${formatIndian(val.toFixed(0))}</strong> value. It's a profitable investment!`
                : `⚠️ <strong>Negative NPV:</strong> This project might not meet your return expectations. Consider re-evaluating.`;
        } else {
            const irrVal = val * 100;
            dom.insightContent.innerHTML = irrVal > 7
                ? `🚀 <strong>High Return:</strong> Your IRR of <strong>${irrVal.toFixed(1)}%</strong> is higher than typical savings (7%). Great opportunity!`
                : `🐢 <strong>Moderate Return:</strong> Your IRR of <strong>${irrVal.toFixed(1)}%</strong> is similar to a bank FD. Check for lower-risk alternatives.`;
        }
    }

    // ---------- START ----------
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
