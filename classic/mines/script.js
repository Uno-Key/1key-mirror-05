const cards = document.querySelectorAll('.card');
const betBtn = document.querySelector('.btn3');
const minesSelect = document.querySelector('select[name="Mines"]');
const betInput = document.querySelector('.bet input[type="text"]');
const halfBtn = document.querySelector('.betinp .half');
const dblBtn = document.querySelector('.betinp .dbl');
const minesCol = document.querySelector('.mines-col');
const gemsCol = document.querySelector('.gems-col');
const gemsInput = document.getElementById('gems-input');
const profitField = document.querySelector('.profit-field');
const profitInput = document.getElementById('profit-input');
const pickRandomBtn = document.querySelector('.pick-random-btn');
const betDiv = document.querySelector('.bet');
const navCash = document.querySelector('nav .cash h3'); // <-- move to top-level

const cashoutPopup = document.getElementById('cashout-popup');
const cashoutMultiplier = cashoutPopup ? cashoutPopup.querySelector('.cashout-multiplier') : null;
const cashoutTotal = cashoutPopup ? cashoutPopup.querySelector('.cashout-total') : null;

let mineIndices = [];
let gameActive = false;
let clickedIndices = [];
let mineHit = false; // Add this flag
let gems = 0;
let profit = 0;
let betPlacedAmount = 0; // Track current bet amount
const TOTAL_TILES = cards.length;
const MAX_MINES = Math.max(1, TOTAL_TILES - 1);

const CARD_ASSETS = {
    clicked: {
        mine: './assets/BIG BOMB.png',
        gem: './assets/GEM.png'
    },
    reveal: {
        mine: './assets/SMALL BOMB.png',
        gem: './assets/small gem.png'
    }
};

// Multiplier table for gems clicked
const gemMultipliers = [
    0,      // 0 gems
    1.03,   // 1
    1.08,   // 2
    1.12,   // 3
    1.18,   // 4
    1.24,   // 5
    1.30,   // 6
    1.37,   // 7
    1.46,   // 8
    1.55,   // 9
    1.65,   // 10
    1.77,   // 11
    1.90,   // 12
    2.06,   // 13
    2.25,   // 14
    2.47,   // 15
    2.75,   // 16
    3.09,   // 17
    3.54,   // 18
    4.13,   // 19
    4.95,   // 20
    6.19,   // 21
    8.25,   // 22
    12.38,  // 23
    24.75   // 24
];

// Helper to shuffle and pick N unique indices
function getRandomIndices(total, count) {
    const arr = Array.from({length: total}, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, count);
}

function createCardImage(isMine, mode = 'clicked') {
    const img = document.createElement('img');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.src = isMine ? CARD_ASSETS[mode].mine : CARD_ASSETS[mode].gem;
    return img;
}

function getSelectedMineCount() {
    const parsed = parseInt(minesSelect.value, 10);
    const clamped = Number.isNaN(parsed) ? 1 : Math.min(MAX_MINES, Math.max(1, parsed));
    if (minesSelect.value !== String(clamped)) {
        minesSelect.value = String(clamped);
    }
    return clamped;
}

// Reset all cards to initial state
function resetCards() {
    cards.forEach(card => {
        card.innerHTML = '';
        card.classList.remove('popanimate', 'revealed', 'untouched-reveal', 'noshadow');
        card.style.backgroundColor = '';
        card.disabled = false;
        card.style.pointerEvents = ''; // <-- Ensure pointer events are reset
    });
    clickedIndices = [];
}

function setBettingFieldsDisabled(disabled) {
    betInput.disabled = disabled;
    minesSelect.disabled = disabled;
    setHalfDblButtonsDisabled(disabled); // <-- add this line
    // Hide SVG arrow by removing background-image when disabled
    if (disabled) {
        minesSelect.style.backgroundImage = 'none';
        minesSelect.style.backgroundColor = '#2F4553';
    } else {
        minesSelect.style.backgroundImage = '';
        minesSelect.style.backgroundColor = '';
    }
}

function setHalfDblButtonsDisabled(disabled) {
    [halfBtn, dblBtn].forEach(btn => {
        btn.disabled = disabled;
        if (disabled) {
            btn.classList.add('disabled');
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            btn.style.cursor = 'default';
        } else {
            btn.classList.remove('disabled');
            btn.style.pointerEvents = '';
            btn.style.opacity = '';
            btn.style.cursor = '';
        }
    });
}

// Half button: halve the bet input value (min 0.01)
halfBtn.addEventListener('click', () => {
    if (gameActive) return;
    let val = parseFloat(betInput.value);
    if (isNaN(val) || val <= 0) val = 0;
    else val = Math.max(0.01, val / 2);
    betInput.value = val.toFixed(2);
});

// Double button: double the bet input value
dblBtn.addEventListener('click', () => {
    if (gameActive) return;
    let val = parseFloat(betInput.value);
    if (isNaN(val) || val < 0) val = 0;
    else val = val * 2;
    betInput.value = val.toFixed(2);
});

function updateProfit() {
    // Use multiplier table
    const gemsClicked = clickedIndices.length;
    let multiplier = gemMultipliers[gemsClicked] || 0;
    // Always show at least 1.00x for display
    let displayMultiplier = (gemsClicked === 0 ? 1 : multiplier).toFixed(2);

    // Profit is bet * multiplier - bet (i.e., net profit, not including bet)
    // For 0 gems, profit is 0
    if (gemsClicked === 0) {
        profit = 0;
    } else {
        profit = betPlacedAmount > 0 ? (betPlacedAmount * multiplier) - betPlacedAmount : 0;
        if (profit < 0) profit = 0;
    }
    // Always show 2 decimals
    profitInput.value = profit.toFixed(2);

    // Show multiplier in profit label
    const profitLabel = document.querySelector('.profit-field > div');
    if (profitLabel) {
        // --- Add total display on the right ---
        let total = betPlacedAmount + profit;
        let totalHtml = '';
        if (betPlacedAmount >= 0) {
            totalHtml = `<span style="float:right; color:#B1BAD3; font-size:13px; font-weight:700;"> $${total.toFixed(2)}</span>`;
        }
        // Always show multiplier, even if no card is clicked
        profitLabel.innerHTML = `Total Profit <span style="color:#B1BAD3; font-size:13px;">(${displayMultiplier}x)</span>${totalHtml}`;
    }
}

function updateGems() {
    // Show remaining gems (total gems - gems clicked)
    gemsInput.value = gems - clickedIndices.length;
}

function showBetGameUI(mineCount) {
    // 1. Bet amount input opacity
    betInput.style.opacity = '0.5';

    // 2. Mines select shrink (no label)
    minesSelect.style.width = '100%';
    minesSelect.parentElement.style.flex = '1';

    // 3. Show gems field
    gemsCol.style.display = '';
    gemsInput.disabled = true;

    // 4. Show profit field and disable editing
    profitField.style.display = '';
    profitInput.value = 0;
    profitInput.disabled = true;

    // 5. Show pick random tile button
    pickRandomBtn.style.display = '';

    // 6. Adjust cashout button margin
    betBtn.style.marginTop = '10px';
}

function hideBetGameUI() {
    betInput.style.opacity = '1';
    gemsCol.style.display = 'none';
    profitField.style.display = 'none';
    pickRandomBtn.style.display = 'none';
    betBtn.style.marginTop = '';
    gemsInput.disabled = true;
    profitInput.disabled = true;
}

function resetBetButton() {
    betBtn.textContent = 'Bet';
    betBtn.classList.remove('cashout');
    betBtn.style.backgroundColor = ''; // Reset to default
    setBettingFieldsDisabled(false);
    gameActive = false;
    hideBetGameUI();
}

function showLoaderOnButton(btn) {
    btn.disabled = true;
    btn._originalText = btn.textContent;
    btn.innerHTML = `<span class="loader-dots"><span></span><span></span><span></span></span>`;
}

function hideLoaderOnButton(btn) {
    btn.disabled = false;
    if (btn._originalText) {
        btn.textContent = btn._originalText;
        delete btn._originalText;
    }
}

function getWalletBalance() {
    return parseInt(localStorage.getItem('wallet_balance') || '5000', 10);
}
function setWalletBalance(amount) {
    localStorage.setItem('wallet_balance', amount);
}
function updateNavWallet() {
    const bal = getWalletBalance();
    navCash.textContent = `${bal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Helper functions for bet persistence
function saveCurrentBet(amount, mineIndicesArr, clickedArr, mineHitFlag, mineCount) {
    localStorage.setItem('current_bet', JSON.stringify({
        amount,
        mineIndices: mineIndicesArr,
        clickedIndices: clickedArr,
        mineHit: mineHitFlag,
        mineCount
    }));
}
function clearCurrentBet() {
    localStorage.removeItem('current_bet');
}
function loadCurrentBet() {
    const data = localStorage.getItem('current_bet');
    return data ? JSON.parse(data) : null;
}

// Helper to hide cashout popup and remove close handler
function forceHideCashoutPopup() {
    if (cashoutPopup && cashoutPopup.style.display === 'flex') {
        cashoutPopup.style.display = 'none';
        // Remove any closePopup event listeners
        document.onmousedown = null;
        // Remove any anonymous event listeners (fallback)
        document.removeEventListener('mousedown', forceHideCashoutPopup, true);
    }
}

// On Bet button click: randomize mines and reset cards
betBtn.addEventListener('click', () => {
    // Always hide loader immediately on click (for both Bet and Cashout)
    hideLoaderOnButton(betBtn);

    // If not in game, this is a Bet
    if (!gameActive) {
        // Validate bet amount
        const betValue = parseFloat(betInput.value);
        // Allow 0.00 as valid, but not negative or NaN
        if (isNaN(betValue) || betValue < 0) {
            betInput.style.borderColor = "#ff4d4f";
            betInput.value = "";
            betInput.placeholder = "0.00";
            hideLoaderOnButton(betBtn);
            return;
        }
        betInput.style.borderColor = ""; // reset

        // Check wallet balance
        const walletBal = getWalletBalance();
        if (betValue > walletBal) {
            betInput.style.borderColor = "#ff4d4f";
            betInput.value = "";
            betInput.placeholder = "0.00";
            hideLoaderOnButton(betBtn);
            return;
        }

        // Prevent double click
        betBtn.disabled = true;
        showLoaderOnButton(betBtn);
        setTimeout(() => {
            hideLoaderOnButton(betBtn); // Already hidden above, but keep for safety

            // --- FIX: Hide popup and remove close handler before resetting cards ---
            forceHideCashoutPopup();

            // Deduct from wallet and update UI (only now, after loader)
            setWalletBalance(getWalletBalance() - betValue);
            updateNavWallet();
            betPlacedAmount = betValue;

            // Always reset cards before starting a new game to fix unclickable bug
            resetCards();

            // Start game
            const mineCount = getSelectedMineCount();
            mineIndices = getRandomIndices(cards.length, mineCount);
            gameActive = true;
            // resetCards(); <-- already called above
            betBtn.textContent = 'Cashout';
            betBtn.classList.add('cashout');
            setBettingFieldsDisabled(true);
            // Set gems to total tiles - mines and keep disabled
            gems = TOTAL_TILES - mineCount;
            gemsInput.value = gems;
            gemsInput.disabled = true;
            showBetGameUI(mineCount);
            profit = 0;
            updateProfit();
            // Set cashout button bg to #108F22 until first card click
            betBtn.style.backgroundColor = '#108F22';
            betBtn.disabled = true;

            // Save bet state to localStorage
            saveCurrentBet(betPlacedAmount, mineIndices, [], false, mineCount);
        }, 200);
    } else {
        // Cashout
        // Credit bet + profit to wallet

        // --- Show cashout popup ---
        if (cashoutPopup && cashoutMultiplier && cashoutTotal) {
            // Calculate multiplier and total
            const gemsClicked = clickedIndices.length;
            let multiplier = gemMultipliers[gemsClicked] || 1;
            let total = betPlacedAmount + profit;
            cashoutMultiplier.textContent = `${multiplier.toFixed(2)}x`;
            cashoutTotal.textContent = `$${total.toFixed(2)}`;
            cashoutPopup.style.display = 'flex';

            // --- Reveal all cards on cashout (just like mine hit) ---
            cards.forEach((c, i) => {
                // Add popanimate for smooth pop effect
                c.classList.add('pop'); // <-- fix: use correct class
                setTimeout(() => {
                    c.classList.remove('pop');
                }, 360);

                if (clickedIndices.includes(i)) {
                    // Clicked cards: full size, full opacity
                    c.classList.add('revealed', 'noshadow');
                    c.classList.remove('untouched-reveal');
                    c.style.backgroundColor = '#071824';
                    const img = createCardImage(mineIndices.includes(i), 'clicked');
                    c.innerHTML = '';
                    c.appendChild(img);
                } else {
                    // Unclicked: small/faded
                    c.classList.add('revealed', 'untouched-reveal', 'noshadow');
                    c.style.backgroundColor = '#071824';
                    const revealImg = createCardImage(mineIndices.includes(i), 'reveal');
                    c.innerHTML = '';
                    c.appendChild(revealImg);
                }
            });

            // Instantly end the bet and reset everything (do not wait for popup to hide)
            const walletBal = getWalletBalance();
            setWalletBalance(walletBal + betPlacedAmount + profit);
            updateNavWallet();
            betPlacedAmount = 0;
            resetBetButton();
            // DO NOT call resetCards() here! Wait until popup is closed.
            clearCurrentBet();
            hideLoaderOnButton(betBtn);

            // Add event listener to close popup on click (just hides popup, then reset cards)
            const closePopup = (e) => {
                if (cashoutPopup.style.display === 'flex') {
                    cashoutPopup.style.display = 'none';
                    resetCards(); // <-- Now reset cards after popup closes
                    document.removeEventListener('mousedown', closePopup);
                }
            };
            setTimeout(() => {
                document.addEventListener('mousedown', closePopup);
            }, 0);
        } else {
            // fallback: just do cashout if popup not found
            const walletBal = getWalletBalance();
            setWalletBalance(walletBal + betPlacedAmount + profit);
            updateNavWallet();
            betPlacedAmount = 0;
            resetBetButton();
            resetCards();
            clearCurrentBet();
            hideLoaderOnButton(betBtn); // Ensure loader is hidden on cashout as well
        }
    }
});

// Card click logic
cards.forEach((card, idx) => {
    card.addEventListener('click', () => {
        if (!gameActive || card.classList.contains('revealed') || mineHit) return;

        // Remove loader if present (do NOT show loader on card click)
        hideLoaderOnButton(betBtn);

        // On first card click, revert cashout button bg to normal
        if (clickedIndices.length === 0) {
            betBtn.style.backgroundColor = ''; // Remove inline style, revert to CSS
        }

        // If this card is a mine, immediately block further clicks
        if (mineIndices.includes(idx)) {
            mineHit = true;
            cards.forEach(c => c.style.pointerEvents = 'none');
        }

        card.classList.add('popanimate');
        card.classList.add('revealed');
        card.classList.add('noshadow');
        card.style.pointerEvents = 'none'; // Prevent further clicks on this card
        clickedIndices.push(idx);

        // Save bet state after each click
        saveCurrentBet(betPlacedAmount, mineIndices, clickedIndices, mineHit, minesSelect.value);

        setTimeout(() => {
            card.classList.remove('popanimate');
            const img = createCardImage(mineIndices.includes(idx), 'clicked');
            img.classList.add('img-pop');
            card.style.backgroundColor = '#071824';
            if (mineIndices.includes(idx)) {
                card.innerHTML = '';
                card.appendChild(img);

                // Reveal all cards on mine
                setTimeout(() => {
                    cards.forEach((c, i) => {
                        if (!c.classList.contains('revealed')) {
                            // Add popanimate for smooth pop effect
                            c.classList.add('pop');
                            setTimeout(() => {
                                c.classList.remove('pop');
                            }, 360);

                            c.classList.add('revealed', 'untouched-reveal', 'noshadow');
                            c.style.backgroundColor = '#071824';
                            const revealImg = createCardImage(mineIndices.includes(i), 'reveal');
                            c.innerHTML = '';
                            c.appendChild(revealImg);
                        }
                    });
                    // On mine hit, bet is lost, do not refund
                    betPlacedAmount = 0;
                    resetBetButton();
                    // Restore pointer events and flag for next game
                    cards.forEach(c => c.style.pointerEvents = '');
                    mineHit = false;
                    hideLoaderOnButton(betBtn); // Hide loader after all is done
                    clearCurrentBet(); // Clear bet on mine hit
                }, 500);
            } else {
                card.innerHTML = '';
                card.appendChild(img);
                // Update gems and profit
                updateGems();
                updateProfit();
                // No loader hiding here, already handled above
            }
        }, 360);

    });
});

// Update gems field when mines selection changes (before bet starts)
minesSelect.addEventListener('input', () => {
    if (!gameActive) {
        const mines = getSelectedMineCount();
        gems = TOTAL_TILES - mines;
        gemsInput.value = gems;
        gemsInput.disabled = true;
    }
});

// Always prevent editing
gemsInput.addEventListener('input', (e) => {
    gemsInput.value = gems;
});
profitInput.addEventListener('input', (e) => {
    profitInput.value = profit; // Always prevent editing
});

// Pick random tile button logic
pickRandomBtn.addEventListener('click', () => {
    if (!gameActive || mineHit) return;
    // Pick any random unrevealed card (not just safe ones)
    const unclickedIndices = Array.from(cards).map((c, i) => (!c.classList.contains('revealed')) ? i : null).filter(i => i !== null);
    if (unclickedIndices.length === 0) return;
    const randIdx = unclickedIndices[Math.floor(Math.random() * unclickedIndices.length)];
    cards[randIdx].click();
});

// Always format bet input as 0.00 style
betInput.addEventListener('blur', () => {
    let val = parseFloat(betInput.value);
    if (isNaN(val) || val < 0) val = 0;
    betInput.value = val.toFixed(2);
});

// Auto-select all text on focus/click for bet input
betInput.addEventListener('focus', function() {
    this.select();
});

// On page load, set bet input to 0.00 if empty or invalid
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    if (isNaN(parseFloat(betInput.value)) || betInput.value === "" || parseFloat(betInput.value) < 0) {
        betInput.value = "0.00";
    } else {
        betInput.value = parseFloat(betInput.value).toFixed(2);
    }
    // ...existing code...

    // Restore bet if present in localStorage
    const savedBet = loadCurrentBet();
    if (savedBet && savedBet.amount > 0) {
        // Restore state
        betPlacedAmount = savedBet.amount;
        const restoredMineIndices = Array.isArray(savedBet.mineIndices) ? savedBet.mineIndices.filter(Number.isInteger) : [];
        clickedIndices = savedBet.clickedIndices || [];
        mineHit = savedBet.mineHit || false;
        const mineCount = Math.min(MAX_MINES, Math.max(1, savedBet.mineCount || restoredMineIndices.length || 1));
        mineIndices = restoredMineIndices.slice(0, mineCount);
        if (mineIndices.length !== mineCount) {
            mineIndices = getRandomIndices(cards.length, mineCount);
        }
        gameActive = true;

        // Set UI
        betInput.value = betPlacedAmount.toFixed(2);
        minesSelect.value = String(mineCount);
        setBettingFieldsDisabled(true);
        gems = TOTAL_TILES - mineCount;
        gemsInput.value = gems - clickedIndices.length;
        gemsInput.disabled = true;
        showBetGameUI(mineCount);
        profit = 0;
        resetCards();

        // Reveal previously clicked cards
        clickedIndices.forEach(idx => {
            const card = cards[idx];
            card.classList.add('revealed', 'noshadow');
            card.style.pointerEvents = 'none';
            card.style.backgroundColor = '#071824';
            const img = createCardImage(mineIndices.includes(idx), 'clicked');
            img.classList.add('img-pop');
            card.innerHTML = '';
            card.appendChild(img);
        });

        updateGems();
        updateProfit();
        betBtn.textContent = 'Cashout';
        betBtn.classList.add('cashout');
        betBtn.style.backgroundColor = clickedIndices.length === 0 ? '#108F22' : '';
        betBtn.disabled = false;
    }

    // On load, ensure half/dbl buttons are enabled
    setHalfDblButtonsDisabled(false);

    // --- WALLET PANEL LOGIC ---
    const walletContainer = document.querySelector('.bigcash');
    const walletBtn = document.querySelector('.wallet');
    const walletPanel = document.getElementById('wallet-panel');
    const quickAddButtons = document.querySelectorAll('.wallet-quick-btn');
    const walletLoaderArea = document.getElementById('wallet-loader-area');
    const walletError = document.getElementById('wallet-error');

    if (walletContainer && walletBtn && walletPanel) {
        function setWalletPanelOpen(isOpen) {
            walletPanel.hidden = !isOpen;
            walletBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                walletLoaderArea.textContent = '';
                walletError.textContent = '';
            }
        }

        walletBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setWalletPanelOpen(walletPanel.hidden);
        });

        quickAddButtons.forEach((button) => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                walletError.textContent = '';
                const amount = parseInt(button.dataset.amount || '0', 10);
                if (!amount || amount < 0) {
                    walletError.textContent = 'Invalid amount.';
                    return;
                }

                const prev = getWalletBalance();
                setWalletBalance(prev + amount);
                updateNavWallet();
                walletLoaderArea.textContent = `Added $${amount.toLocaleString('en-US')}`;
            });
        });

        document.addEventListener('click', (e) => {
            if (!walletPanel.hidden && !walletContainer.contains(e.target)) {
                setWalletPanelOpen(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !walletPanel.hidden) {
                setWalletPanelOpen(false);
            }
        });

        if (!walletPanel.hidden) {
            setWalletPanelOpen(false);
        } else {
            walletBtn.setAttribute('aria-expanded', 'false');
            walletLoaderArea.textContent = '';
            walletError.textContent = '';
        }

        updateNavWallet();
    }
});

// Prevent right-click and drag on cards and card images
cards.forEach(card => {
    card.addEventListener('contextmenu', e => e.preventDefault());
    card.addEventListener('dragstart', e => e.preventDefault());
    card.addEventListener('mousedown', e => { if (e.detail > 1) e.preventDefault(); }); // prevent double click selection
});
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.card img').forEach(img => {
        img.addEventListener('contextmenu', e => e.preventDefault());
        img.addEventListener('dragstart', e => e.preventDefault());
    });
});
