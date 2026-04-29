/**
 * Jayesh Ahuja - Financial Companion Pro
 * Premium Logic & Financial Intelligence
 */

const state = {
    mode: 'loan', // 'loan', 'invest', 'advanced', 'basic'
    subMode: 'npv', // for advanced mode
    currentStep: 0,
    inputs: {
        loan: ['', '', ''], // Principal, Rate, Tenure
        invest: ['', '', ''], // Initial, Rate, Tenure
        advanced: {
            npv: ['', ''], // Rate, Initial
            irr: [''] // Initial
        },
        basic: '0'
    },
    cashFlows: [], // Array of numbers [50000, 60000, ...]
    meta: {
        loan: [
            { label: 'Principal', hint: 'Enter Loan Amount', symbol: '₹' },
            { label: 'Interest Rate', hint: 'Now enter Interest Rate', symbol: '%' },
            { label: 'Tenure', hint: 'Finally, enter Time (Years)', symbol: 'yrs' }
        ],
        invest: [
            { label: 'Investment', hint: 'Enter Starting Amount', symbol: '₹' },
            { label: 'Return Rate', hint: 'Expected Annual Return', symbol: '%' },
            { label: 'Horizon', hint: 'Investment Period (Years)', symbol: 'yrs' }
        ],
        advanced: {
            npv: [
                { label: 'Discount Rate', hint: 'Enter Annual Discount Rate', symbol: '%' },
                { label: 'Initial Investment', hint: 'Enter Outflow (t=0)', symbol: '₹' }
            ],
            irr: [
                { label: 'Initial Investment', hint: 'Enter Outflow (t=0)', symbol: '₹' }
            ]
        },
        basic: [
            { label: 'Standard', hint: 'Basic Calculations', symbol: '' }
        ]
    },
    basicCalc: {
        prevValue: null,
        operator: null,
        waitingForSecond: false
    }
};

// DOM Cache
const dom = {
    displayValue: document.getElementById('display-value'),
    displayHint: document.getElementById('display-hint'),
    activeLabel: document.getElementById('active-field-label'),
    currencySymbol: document.getElementById('currency-symbol'),
    modeIndicator: document.getElementById('mode-indicator'),
    stepIndicator: document.getElementById('step-indicator'),
    summaryStrip: document.getElementById('summary-strip'),
    resultsRow: document.getElementById('results-row'),
    insightContent: document.getElementById('insight-content'),
    nextBtn: document.getElementById('key-next'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    
    // Advanced DOM
    advancedControls: document.getElementById('advanced-controls'),
    subTabBtns: document.querySelectorAll('.sub-tab'),
    cfContainer: document.getElementById('cashflow-list-container'),
    cfList: document.getElementById('cashflow-list'),
    btnAddCF: document.getElementById('btn-add-cashflow')
};

function init() {
    setupEventListeners();
    setMode(state.mode);
}

function setupEventListeners() {
    // Tab Switching
    dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
        });
    });

    // Sub-tab Switching
    dom.subTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setSubMode(btn.dataset.submode);
        });
    });

    // Add Cash Flow
    dom.btnAddCF.addEventListener('click', () => {
        addCashFlow();
    });

    // Cash Flow List Deletion (Event Delegation)
    dom.cfList.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete');
        if (btn) {
            const index = parseInt(btn.dataset.index);
            deleteCashFlow(index);
        }
    });

    // Keypad Logic
    document.querySelector('.keypad-grid').addEventListener('click', (e) => {
        const key = e.target.closest('.key');
        if (!key) return;
        
        const action = key.dataset.key;
        handleAction(action);
        
        // Haptic feel (if available)
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    });

    // Keyboard support
    window.addEventListener('keydown', (e) => {
        const k = e.key;
        if (/[0-9]/.test(k)) handleAction(k);
        else if (k === '.') handleAction('decimal');
        else if (k === 'Backspace') handleAction('backspace');
        else if (k === 'Enter') handleAction('next');
        else if (k === '+') handleAction('add');
        else if (k === '-') handleAction('subtract');
        else if (k === '*') handleAction('multiply');
        else if (k === '/') handleAction('divide');
        else if (k === 'Escape') handleAction('clear');
    });

    // Long press Backspace = Clear All
    let bsTimer;
    const bsKey = document.getElementById('key-backspace');
    bsKey.addEventListener('mousedown', () => bsTimer = setTimeout(() => handleAction('clear'), 800));
    bsKey.addEventListener('mouseup', () => clearTimeout(bsTimer));
    bsKey.addEventListener('touchstart', () => bsTimer = setTimeout(() => handleAction('clear'), 800));
    bsKey.addEventListener('touchend', () => clearTimeout(bsTimer));
}

function setMode(mode) {
    state.mode = mode;
    state.currentStep = 0;
    dom.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    
    // Toggle advanced UI visibility
    dom.advancedControls.style.display = mode === 'advanced' ? 'flex' : 'none';
    dom.cfContainer.style.display = mode === 'advanced' ? 'block' : 'none';
    
    if (mode === 'advanced') renderCashFlows();
    
    updateUI();
}

function setSubMode(subMode) {
    state.subMode = subMode;
    state.currentStep = 0;
    dom.subTabBtns.forEach(b => b.classList.toggle('active', b.dataset.submode === subMode));
    updateUI();
}

function addCashFlow() {
    if (state.mode !== 'advanced') return;
    
    const displayVal = parseFloat(state.inputs.advanced[state.subMode][state.currentStep]) || 0;
    if (displayVal !== 0) {
        state.cashFlows.push(displayVal);
        state.inputs.advanced[state.subMode][state.currentStep] = ''; // Clear for next CF
        renderCashFlows();
        calculateFinancials();
        updateUI();
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
                <button class="cf-btn delete" data-index="${i}">✕</button>
            </div>
        </div>
    `).join('');
}

function handleAction(action) {
    if (state.mode === 'basic') {
        handleBasicAction(action);
    } else {
        handleFinancialAction(action);
    }
}

function handleFinancialAction(action) {
    const isAdvanced = state.mode === 'advanced';
    const currentInput = isAdvanced ? state.inputs.advanced[state.subMode][state.currentStep] : state.inputs[state.mode][state.currentStep];

    if (/[0-9]/.test(action) || action === 'decimal') {
        let val = currentInput || '';
        if (action === 'decimal') {
            if (!val.includes('.')) val = val === '' ? '0.' : val + '.';
        } else {
            val = val === '0' ? action : val + action;
        }
        if (isAdvanced) state.inputs.advanced[state.subMode][state.currentStep] = val;
        else state.inputs[state.mode][state.currentStep] = val;
    } 
    else if (action === 'backspace') {
        const newVal = (currentInput || '').slice(0, -1);
        if (isAdvanced) state.inputs.advanced[state.subMode][state.currentStep] = newVal;
        else state.inputs[state.mode][state.currentStep] = newVal;
    } 
    else if (action === 'clear') {
        if (isAdvanced) {
            state.inputs.advanced[state.subMode] = state.subMode === 'npv' ? ['', ''] : [''];
            state.cashFlows = [];
            renderCashFlows();
        } else {
            state.inputs[state.mode] = ['', '', ''];
        }
        state.currentStep = 0;
    } 
    else if (action === 'next') {
        const maxSteps = isAdvanced ? (state.subMode === 'npv' ? 1 : 0) : 2;
        if (state.currentStep < maxSteps) {
            state.currentStep++;
        } else {
            if (isAdvanced) {
                addCashFlow();
            } else {
                state.currentStep = 0;
            }
        }
    }

    updateUI();
    calculateFinancials();
}

function handleBasicAction(action) {
    let val = state.inputs.basic;

    if (/[0-9]/.test(action) || action === 'decimal') {
        if (state.basicCalc.waitingForSecond) {
            val = action === 'decimal' ? '0.' : action;
            state.basicCalc.waitingForSecond = false;
        } else {
            if (action === 'decimal') {
                if (!val.includes('.')) val += '.';
            } else {
                val = val === '0' ? action : val + action;
            }
        }
        state.inputs.basic = val;
    } 
    else if (['add', 'subtract', 'multiply', 'divide'].includes(action)) {
        processOperator(action);
    }
    else if (action === 'next') { // Equals
        processOperator(null);
    }
    else if (action === 'backspace') {
        state.inputs.basic = val.length > 1 ? val.slice(0, -1) : '0';
    }
    else if (action === 'clear') {
        state.inputs.basic = '0';
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
        state.inputs.basic = res.toString();
    }
    state.basicCalc.operator = op;
    state.basicCalc.waitingForSecond = !!op;
}

function compute(a, b, op) {
    switch(op) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': return b !== 0 ? a / b : 0;
        default: return b;
    }
}

// --- UI Engine ---
function updateUI() {
    const m = state.mode;
    const isAdv = m === 'advanced';
    const meta = isAdv ? state.meta.advanced[state.subMode][state.currentStep] : state.meta[m][state.currentStep];
    const val = m === 'basic' ? state.inputs.basic : (isAdv ? state.inputs.advanced[state.subMode][state.currentStep] : state.inputs[m][state.currentStep]);

    // Text Content
    dom.displayValue.textContent = formatIndian(val) || '0';
    dom.displayHint.textContent = meta.hint;
    dom.activeLabel.textContent = meta.label;
    dom.currencySymbol.textContent = meta.symbol;
    dom.modeIndicator.textContent = isAdv ? `${state.subMode.toUpperCase()} MODE` : `${m.toUpperCase()} MODE`;
    
    const totalSteps = isAdv ? (state.subMode === 'npv' ? 2 : 1) : 3;
    dom.stepIndicator.textContent = m === 'basic' ? '' : `${state.currentStep + 1} / ${totalSteps}`;

    // Next Button State
    if (m === 'basic') {
        dom.nextBtn.textContent = '=';
    } else if (isAdv) {
        const isLastInputStep = state.subMode === 'npv' ? state.currentStep === 1 : state.currentStep === 0;
        dom.nextBtn.textContent = isLastInputStep ? 'ADD CASH FLOW' : 'NEXT STEP';
    } else {
        dom.nextBtn.textContent = state.currentStep === 2 ? 'CALCULATE' : 'NEXT STEP';
    }

    // Auto-font Scaling
    adjustFontSize(dom.displayValue);

    // Summary Strip
    updateSummaryStrip();
}

function formatIndian(n) {
    if (!n) return '';
    let [integer, decimal] = n.split('.');
    let lastThree = integer.substring(integer.length - 3);
    let otherNumbers = integer.substring(0, integer.length - 3);
    if (otherNumbers != '') lastThree = ',' + lastThree;
    let res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    return res + (decimal !== undefined ? '.' + decimal : '');
}

function adjustFontSize(el) {
    const len = el.textContent.length;
    let size = 3.5;
    if (len > 12) size = 1.8;
    else if (len > 10) size = 2.2;
    else if (len > 8) size = 2.8;
    el.style.fontSize = `${size}rem`;
}

function updateSummaryStrip() {
    if (state.mode === 'basic') {
        dom.summaryStrip.textContent = '';
        return;
    }
    
    if (state.mode === 'advanced') {
        const inputs = state.inputs.advanced[state.subMode];
        const labels = state.meta.advanced[state.subMode];
        let summary = [];
        labels.forEach((meta, i) => {
            if (inputs[i] && i !== state.currentStep) {
                summary.push(`${meta.label}: ${inputs[i]}${meta.symbol}`);
            }
        });
        dom.summaryStrip.textContent = summary.join(' | ');
        return;
    }

    const inputs = state.inputs[state.mode];
    const labels = state.meta[state.mode];
    let summary = [];
    inputs.forEach((v, i) => {
        if (v && i !== state.currentStep) {
            summary.push(`${labels[i].label}: ${v}${labels[i].symbol}`);
        }
    });
    dom.summaryStrip.textContent = summary.join(' | ');
}

// --- Calculation & Insights ---
function calculateFinancials() {
    if (state.mode === 'loan') {
        const [p, r, t] = state.inputs.loan.map(v => parseFloat(v) || 0);
        if (p && r && t) {
            const monthlyRate = r / 12 / 100;
            const months = t * 12;
            const emi = (p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
            const totalPayable = emi * months;
            const totalInterest = totalPayable - p;

            renderResults([
                { label: 'Monthly EMI', value: emi, icon: '💸' },
                { label: 'Total Interest', value: totalInterest, icon: '📈' },
                { label: 'Total Payable', value: totalPayable, icon: '🧾' }
            ]);

            generateLoanInsight(p, r, t, totalInterest, emi);
        } else {
            clearResults();
        }
    } 
    else if (state.mode === 'invest') {
        const [p, r, t] = state.inputs.invest.map(v => parseFloat(v) || 0);
        if (p && r && t) {
            const maturity = p * Math.pow(1 + (r / 100), t);
            const wealth = maturity - p;

            renderResults([
                { label: 'Maturity Value', value: maturity, icon: '💎' },
                { label: 'Wealth Gain', value: wealth, icon: '💰' },
                { label: 'Initial Sum', value: p, icon: '🪙' }
            ]);

            generateInvestInsight(p, r, t, wealth, maturity);
        } else {
            clearResults();
        }
    }
    else if (state.mode === 'advanced') {
        if (state.subMode === 'npv') {
            const rate = (parseFloat(state.inputs.advanced.npv[0]) || 0) / 100;
            const initial = parseFloat(state.inputs.advanced.npv[1]) || 0;
            const flows = state.cashFlows;
            
            if (initial > 0) {
                let npv = -initial;
                flows.forEach((cf, i) => {
                    npv += cf / Math.pow(1 + rate, i + 1);
                });

                renderResults([
                    { label: 'Net Present Value', value: npv, icon: '📊' },
                    { label: 'Initial Outlay', value: -initial, icon: '📉' },
                    { label: 'Total Inflow', value: flows.reduce((a, b) => a + b, 0), icon: '📈' }
                ]);
                generateAdvancedInsight('npv', npv);
            } else {
                clearResults();
            }
        } 
        else if (state.subMode === 'irr') {
            const initial = parseFloat(state.inputs.advanced.irr[0]) || 0;
            const flows = state.cashFlows;
            
            if (initial > 0 && flows.length > 0) {
                const irr = calculateIRR(-initial, flows);
                renderResults([
                    { label: 'Internal Return', value: irr ? (irr * 100).toFixed(2) + '%' : 'N/A', icon: '🚀', isRaw: true },
                    { label: 'Initial Outlay', value: -initial, icon: '📉' },
                    { label: 'Years', value: flows.length, icon: '⏳', isRaw: true }
                ]);
                generateAdvancedInsight('irr', irr);
            } else {
                clearResults();
            }
        }
    }
}

function calculateIRR(initial, flows) {
    let guess = 0.1;
    for (let i = 0; i < 20; i++) {
        let npv = initial;
        let dNpv = 0;
        flows.forEach((cf, t) => {
            npv += cf / Math.pow(1 + guess, t + 1);
            dNpv -= (t + 1) * cf / Math.pow(1 + guess, t + 2);
        });
        let nextGuess = guess - npv / dNpv;
        if (Math.abs(nextGuess - guess) < 0.0001) return nextGuess;
        guess = nextGuess;
    }
    return guess;
}

function generateAdvancedInsight(type, val) {
    if (type === 'npv') {
        if (val > 0) {
            dom.insightContent.innerHTML = `✅ <strong>Positive NPV:</strong> This project adds <strong>₹${formatIndian(val.toFixed(0))}</strong> value. It's a profitable investment!`;
        } else {
            dom.insightContent.innerHTML = `⚠️ <strong>Negative NPV:</strong> This project might not meet your return expectations. Consider re-evaluating.`;
        }
    } else {
        const irrVal = val * 100;
        if (irrVal > 7) {
            dom.insightContent.innerHTML = `🚀 <strong>High Return:</strong> Your IRR of <strong>${irrVal.toFixed(1)}%</strong> is higher than typical savings (7%). Great opportunity!`;
        } else {
            dom.insightContent.innerHTML = `🐢 <strong>Moderate Return:</strong> Your IRR of <strong>${irrVal.toFixed(1)}%</strong> is similar to a bank FD. Check for lower-risk alternatives.`;
        }
    }
}

function renderResults(items) {
    dom.resultsRow.innerHTML = items.map(item => `
        <div class="result-card">
            <span class="result-icon">${item.icon}</span>
            <span class="result-label">${item.label}</span>
            <span class="result-value">${item.isRaw ? item.value : '₹' + formatIndian(item.value.toFixed(0))}</span>
        </div>
    `).join('');
}

function clearResults() {
    dom.resultsRow.innerHTML = '';
    dom.insightContent.textContent = 'Complete all steps to unlock financial analysis.';
}

function generateLoanInsight(p, r, t, interest, emi) {
    const intPercent = (interest / p * 100).toFixed(0);
    const savings = (emi * 0.1).toFixed(0);
    const savedInt = (interest * 0.15).toFixed(0);
    
    dom.insightContent.innerHTML = `
        You are paying <strong>${intPercent}% extra</strong> as interest. 
        <br>💡 Tip: Adding <strong>₹${formatIndian(savings)}</strong> to your monthly EMI can save you approx. <strong>₹${formatIndian(savedInt)}</strong> in total interest!
    `;
}

function generateInvestInsight(p, r, t, wealth, mat) {
    const multiplier = (wealth / p).toFixed(1);
    const plusOne = p * Math.pow(1 + (r / 100), t + 1) - mat;

    dom.insightContent.innerHTML = `
        Your wealth will grow <strong>${multiplier}x</strong>. 
        <br>🚀 Power of Compounding: Staying invested for just 1 more year could add <strong>₹${formatIndian(plusOne.toFixed(0))}</strong> to your portfolio!
    `;
}

// Start
init();
