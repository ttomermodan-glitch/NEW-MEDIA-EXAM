// ==========================
// הגדרות קבועות למשחק
// ==========================
const QUESTIONS_PER_ROUND = 3;
const QUESTION_TIME_SECONDS = 300; // 5 דקות לכל שאלה

const DEFAULT_ZONES = [1, 3, 4, 5]; // ברירת מחדל למשחק

const POINTS_CORRECT = 5;
const POINTS_PARTIAL = 3;
const POINTS_WRONG = -10;
const POINTS_TIMEOUT = -20;

const TARGET_SCORE = 50;
const FAIL_SCORE = -25;

const STORAGE_SCORE_KEY = "nmScore";
const STORAGE_WRONG_KEY = "nmWrongConcepts";
const STORAGE_MASTERED_KEY = "nmMasteredConceptCodes";

// ==========================
// משתני מצב גלובליים
// ==========================
let currentZone = null;
let currentRoundQuestions = [];
let currentQuestionIndex = 0;

let score = 0;
let timerInterval = null;
let timeLeft = QUESTION_TIME_SECONDS;

let gameActive = false;     // יש משחק פעיל
let roundActive = false;    // יש סיבוב פעיל (3 שאלות)
let isWaitingForEvaluation = false; // מחכים לסימון תשובה

// מצב לימוד
let studyList = [];
let filteredStudyList = [];
let studyIndex = 0;

// מושגים שטעיתי/חלקי/נגמר הזמן
let wrongConceptNames = new Set();
// מושגים שנענו נכון לפחות פעם אחת
let masteredConceptCodes = new Set();

// ==========================
// DOM Elements (מותאם ל-index.html שלך)
// ==========================
const homeScreen = document.getElementById("home-screen");
const gameScreen = document.getElementById("game-screen");
const studyScreen = document.getElementById("study-screen");

// כפתורי ניווט
const startGameBtn = document.getElementById("btn-start-game");
const startStudyBtn = document.getElementById("btn-study-mode");
const backFromGameBtn = document.getElementById("btn-back-home-from-game");
const backFromStudyBtn = document.getElementById("btn-back-home-from-study");

// גלגל
const wheelEl = document.getElementById("wheel");
const spinBtn = document.getElementById("btn-spin");
const zoneLabelEl = document.getElementById("zone-label");

// שאלה
const questionNumberEl = document.getElementById("question-number");
const questionConceptEl = document.getElementById("concept-name");
const questionCodeEl = document.getElementById("question-code");

// טיימר וניקוד
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");

// כפתורי ניקוד
const correctBtn = document.getElementById("btn-correct");
const partialBtn = document.getElementById("btn-partial");
const wrongBtn = document.getElementById("btn-wrong");
const timeoverBtn = document.getElementById("btn-timeover");

// פופאפ הסבר
const popupOverlayEl = document.getElementById("popup-overlay");
const popupConceptNameEl = document.getElementById("popup-concept-name");
const popupDefinitionEl = document.getElementById("popup-definition");
const popupOkBtn = document.getElementById("btn-popup-ok");

// פופאפ הצלחה
const winOverlayEl = document.getElementById("win-overlay");
const winContinueBtn = document.getElementById("btn-win-continue");
const winResetBtn = document.getElementById("btn-win-reset");

// תוצאות משחק
const resultBannerEl = document.getElementById("game-result");

// איפוס ניקוד
const resetScoreBtn = document.getElementById("btn-reset-score");

// מצב לימוד – פילטרים וניווט
const studyFilterModeEl = document.getElementById("study-source-filter");
const studyFilterZoneEl = document.getElementById("study-zone-filter");
const studySearchInputEl = document.getElementById("study-search");
const studyApplyFilterBtn = document.getElementById("btn-apply-study-filter");

const studyCounterEl = document.getElementById("study-counter");
const studyConceptNameEl = document.getElementById("study-concept-name");
const studyConceptDefinitionEl = document.getElementById("study-definition");
const studyNextBtn = document.getElementById("btn-study-next");
const studyRandomBtn = document.getElementById("btn-study-random");

// סינון זירות במשחק
const zoneFilterCheckboxes = document.querySelectorAll(".zone-filter");
const zonesAllBtn = document.getElementById("btn-zones-all");
const zonesClearBtn = document.getElementById("btn-zones-clear");

// פנימי לפופאפ – אם אחרי "הבנתי" עוברים לשאלה הבאה
let pendingNextQuestion = false;

// ==========================
// Init
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  loadScoreFromStorage();
  loadWrongConceptsFromStorage();
  loadMasteredFromStorage();
  initStudyList();

  updateScoreUI();
  resetTimer();
  disableAnswerButtons();

  setupEventListeners();
  showScreen("home");
});

// ==========================
// ניווט מסכים
// ==========================
function showScreen(screen) {
  if (homeScreen) homeScreen.classList.add("hidden");
  if (gameScreen) gameScreen.classList.add("hidden");
  if (studyScreen) studyScreen.classList.add("hidden");

  if (screen === "home" && homeScreen) homeScreen.classList.remove("hidden");
  if (screen === "game" && gameScreen) gameScreen.classList.remove("hidden");
  if (screen === "study" && studyScreen) studyScreen.classList.remove("hidden");
}

// ==========================
// טעינה / שמירה של ניקוד ומושגים שגויים / נלמדים
// ==========================
function loadScoreFromStorage() {
  const saved = localStorage.getItem(STORAGE_SCORE_KEY);
  if (saved !== null) {
    const n = parseInt(saved, 10);
    if (!isNaN(n)) {
      score = n;
    }
  }
}

function saveScoreToStorage() {
  localStorage.setItem(STORAGE_SCORE_KEY, String(score));
}

function loadWrongConceptsFromStorage() {
  const saved = localStorage.getItem(STORAGE_WRONG_KEY);
  if (!saved) return;
  try {
    const arr = JSON.parse(saved);
    if (Array.isArray(arr)) {
      wrongConceptNames = new Set(arr);
    }
  } catch (e) {
    console.error("Failed to parse wrong concepts from storage", e);
  }
}

function saveWrongConceptsToStorage() {
  localStorage.setItem(STORAGE_WRONG_KEY, JSON.stringify(Array.from(wrongConceptNames)));
}

function loadMasteredFromStorage() {
  const saved = localStorage.getItem(STORAGE_MASTERED_KEY);
  if (!saved) return;
  try {
    const arr = JSON.parse(saved);
    if (Array.isArray(arr)) {
      masteredConceptCodes = new Set(arr);
    }
  } catch (e) {
    console.error("Failed to parse mastered concepts from storage", e);
  }
}

function saveMasteredToStorage() {
  localStorage.setItem(
    STORAGE_MASTERED_KEY,
    JSON.stringify(Array.from(masteredConceptCodes))
  );
}

// ==========================
// UI Updates
// ==========================
function updateScoreUI() {
  if (!scoreEl) return;
  scoreEl.textContent = `⭐ ניקוד: ${score}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateTimerUI() {
  if (timerEl) {
    timerEl.textContent = `⏱️ ${formatTime(timeLeft)}`;
  }
}

function showResultBanner(text, type = "") {
  if (!resultBannerEl) return;
  resultBannerEl.textContent = text;
  resultBannerEl.classList.remove("win", "lose");
  if (type) {
    resultBannerEl.classList.add(type);
  }
}

// ==========================
// טיימר – לכל שאלה
// ==========================
function resetTimer() {
  clearInterval(timerInterval);
  timeLeft = QUESTION_TIME_SECONDS;
  updateTimerUI();
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimerUI();
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateTimerUI();
      clearInterval(timerInterval);
      onTimeOver();
    } else {
      updateTimerUI();
    }
  }, 1000);
}

function onTimeOver() {
  if (!roundActive || !isWaitingForEvaluation) return;
  const concept = currentRoundQuestions[currentQuestionIndex];
  isWaitingForEvaluation = false;
  disableAnswerButtons();
  applyScore(POINTS_TIMEOUT);
  markConceptAsWrong(concept);

  showDefinitionPopup(
    concept,
    "נגמר הזמן ⏰\nקיבלת -20 נקודות.\nשים לב להגדרה המדויקת:"
  );

  pendingNextQuestion = true;
}

// ==========================
// כפתורי תשובה – הפעלה/כיבוי
// ==========================
function enableAnswerButtons() {
  if (correctBtn) correctBtn.disabled = false;
  if (partialBtn) partialBtn.disabled = false;
  if (wrongBtn) wrongBtn.disabled = false;
  if (timeoverBtn) timeoverBtn.disabled = false;
}

function disableAnswerButtons() {
  if (correctBtn) correctBtn.disabled = true;
  if (partialBtn) partialBtn.disabled = true;
  if (wrongBtn) wrongBtn.disabled = true;
  if (timeoverBtn) timeoverBtn.disabled = true;
}

// ==========================
// בחירת זירות – מהפאנל
// ==========================
function getActiveZones() {
  const zones = [];
  if (zoneFilterCheckboxes && zoneFilterCheckboxes.length) {
    zoneFilterCheckboxes.forEach(cb => {
      if (cb.checked) {
        const z = parseInt(cb.value, 10);
        if (!isNaN(z)) zones.push(z);
      }
    });
  }
  // אם לא סומנה אף זירה – חוזרים לברירת המחדל (1,3,4,5)
  if (zones.length === 0) return DEFAULT_ZONES.slice();
  return zones;
}

// ==========================
// משחק – התחלה, סיבוב, שאלות
// ==========================
function startGame() {
  gameActive = true;
  roundActive = false;
  currentZone = null;
  currentRoundQuestions = [];
  currentQuestionIndex = 0;
  isWaitingForEvaluation = false;
  resetTimer();
  updateTimerUI();
  showResultBanner("התחלת משחק! סובב את הגלגל לבחירת זירה 🎯");
  updateSpinButtonState();
  disableAnswerButtons();

  if (questionNumberEl) {
    questionNumberEl.textContent = "עדיין אין שאלה – סובב את הגלגל";
  }
  if (questionConceptEl) {
    questionConceptEl.textContent = "המתן לבחירת הזירה";
  }
  if (questionCodeEl) {
    questionCodeEl.textContent = "";
  }
  if (zoneLabelEl) {
    zoneLabelEl.textContent = "זירה: -";
  }
}

function updateSpinButtonState() {
  if (!spinBtn) return;
  spinBtn.disabled = !gameActive || roundActive;
}

function spinWheel() {
  if (!spinBtn || spinBtn.disabled) return;
  if (!gameActive) return;

  const zone = pickRandomZone();
  currentZone = zone;
  roundActive = true;
  updateSpinButtonState();

  // אנימציה בסיסית ל"גלגל"
  if (wheelEl) {
    const extraTurns = 360 * 5;
    const randomAngle = Math.floor(Math.random() * 360);
    const totalAngle = extraTurns + randomAngle;
    wheelEl.style.transition = "transform 2s ease-out";
    wheelEl.style.transform = `rotate(${totalAngle}deg)`;
  }

  if (zoneLabelEl) {
    zoneLabelEl.textContent = `זירה: ${zone}`;
  }

  setTimeout(() => {
    startRound(zone);
  }, 2000);
}

function pickRandomZone() {
  const zones = getActiveZones();
  const idx = Math.floor(Math.random() * zones.length);
  return zones[idx];
}

function startRound(zone) {
  currentRoundQuestions = getRandomQuestionsFromZone(zone, QUESTIONS_PER_ROUND);
  currentQuestionIndex = 0;
  showResultBanner(`התחיל סיבוב חדש – זירה ${zone}`);
  startQuestion();
}

function startQuestion() {
  if (currentQuestionIndex >= currentRoundQuestions.length) {
    endRound();
    return;
  }

  const concept = currentRoundQuestions[currentQuestionIndex];

  if (questionNumberEl) {
    questionNumberEl.textContent = `שאלה ${currentQuestionIndex + 1} מתוך ${QUESTIONS_PER_ROUND}`;
  }
  if (questionConceptEl) {
    questionConceptEl.textContent = concept.name;
  }
  if (questionCodeEl) {
    const code = concept.code || `Z${currentZone}-Q${currentQuestionIndex + 1}`;
    questionCodeEl.textContent = `קוד שאלה: ${code}`;
  }

  isWaitingForEvaluation = true;
  enableAnswerButtons();
  resetTimer();
  startTimer();
}

function goToNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= currentRoundQuestions.length) {
    endRound();
  } else {
    startQuestion();
  }
}

function endRound() {
  roundActive = false;
  isWaitingForEvaluation = false;
  clearInterval(timerInterval);
  disableAnswerButtons();
  updateSpinButtonState();
  showResultBanner("סיבוב הסתיים. אפשר לסובב שוב את הגלגל 🎡");
}

// ==========================
// בחירת שאלות מהזירה
// ==========================
function getRandomQuestionsFromZone(zone, count) {
  const list = conceptsByZone && conceptsByZone[zone] ? conceptsByZone[zone] : [];
  if (!list.length) return [];

  // מוסיפים לכל מושג קוד קבוע לפי המיקום שלו בזירה
  const withCodes = list.map((concept, index) => {
    const codeNumber = zone * 100 + (index + 1); // לדוגמה: זירה 5, מושג 14 -> 514
    return {
      ...concept,
      code: codeNumber
    };
  });

  // מסננים מושגים שכבר נענו נכון פעם אחת
  let pool = withCodes.filter(item => !masteredConceptCodes.has(item.code));

  // אם אין כבר "חדשים" – משתמשים בכל המושגים כדי שהמשחק לא ייתקע
  if (pool.length === 0) {
    pool = withCodes.slice();
  }

  // מערבבים את הרשימה (Fisher–Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // מחזיר רק את כמות השאלות לסיבוב
  return pool.slice(0, count);
}

// ==========================
// ניקוד + סוף משחק
// ==========================
function applyScore(delta) {
  score += delta;
  updateScoreUI();
  saveScoreToStorage();
  checkEndConditions();
}

function checkEndConditions() {
  if (score >= TARGET_SCORE) {
    showResultBanner(`הגעת ל-${TARGET_SCORE} נקודות! 🏆`, "win");
    showWinPopup();
  }
  if (score <= FAIL_SCORE) {
    showResultBanner("הגעת ל-25- נקודות. נכשלת במשחק הזה ❌", "lose");
    gameActive = false;
    roundActive = false;
    clearInterval(timerInterval);
    updateSpinButtonState();
    disableAnswerButtons();
  }
}

function resetScore() {
  score = 0;
  wrongConceptNames.clear();
  masteredConceptCodes.clear();
  saveScoreToStorage();
  saveWrongConceptsToStorage();
  saveMasteredToStorage();
  updateScoreUI();
  showResultBanner("הניקוד אופס. אפשר להתחיל מחדש 👌");
}

// ==========================
// פופאפ הצלחה – המשך / איפוס
// ==========================
function showWinPopup() {
  if (winOverlayEl) {
    winOverlayEl.style.display = "flex";
  }
}

function hideWinPopup() {
  if (winOverlayEl) {
    winOverlayEl.style.display = "none";
  }
}

// ==========================
// טיפול בתשובה: נכון / חלקי / טעות
// ==========================
function handleCorrect() {
  if (!roundActive || !isWaitingForEvaluation) return;
  const concept = currentRoundQuestions[currentQuestionIndex];
  isWaitingForEvaluation = false;
  disableAnswerButtons();
  clearInterval(timerInterval);
  applyScore(POINTS_CORRECT);
  markConceptAsMastered(concept);
  showResultBanner("תשובה נכונה! +5 ✅", "win");
  goToNextQuestion();
}

function handlePartial() {
  if (!roundActive || !isWaitingForEvaluation) return;
  const concept = currentRoundQuestions[currentQuestionIndex];
  isWaitingForEvaluation = false;
  disableAnswerButtons();
  clearInterval(timerInterval);
  applyScore(POINTS_PARTIAL);
  markConceptAsWrong(concept);

  showDefinitionPopup(
    concept,
    "תשובה חלקית ⚠️\nקיבלת 3 נקודות, אבל שים לב להגדרה המלאה:"
  );
  pendingNextQuestion = true;
}

function handleWrong() {
  if (!roundActive || !isWaitingForEvaluation) return;
  const concept = currentRoundQuestions[currentQuestionIndex];
  isWaitingForEvaluation = false;
  disableAnswerButtons();
  clearInterval(timerInterval);
  applyScore(POINTS_WRONG);
  markConceptAsWrong(concept);

  showDefinitionPopup(
    concept,
    "תשובה שגויה ❌\nקיבלת -10 נקודות. הנה ההגדרה המדויקת:"
  );
  pendingNextQuestion = true;
}

function handleTimeoverButton() {
  if (!roundActive || !isWaitingForEvaluation) return;
  clearInterval(timerInterval);
  timeLeft = 0;
  updateTimerUI();
  onTimeOver();
}

function markConceptAsWrong(concept) {
  if (!concept || !concept.name) return;
  wrongConceptNames.add(concept.name);
  saveWrongConceptsToStorage();
}

function markConceptAsMastered(concept) {
  if (!concept || typeof concept.code === "undefined") return;
  masteredConceptCodes.add(concept.code);
  saveMasteredToStorage();

  // אם היה ברשימת טעויות – ננקה
  if (concept.name && wrongConceptNames.has(concept.name)) {
    wrongConceptNames.delete(concept.name);
    saveWrongConceptsToStorage();
  }
}

// ==========================
// פופאפ הסבר
// ==========================
function showDefinitionPopup(concept, prefixText = "") {
  if (!popupOverlayEl || !popupConceptNameEl || !popupDefinitionEl) return;
  popupConceptNameEl.textContent = concept.name || "מושג";
  popupDefinitionEl.textContent = prefixText + "\n\n" + (concept.definition || "");
  popupOverlayEl.style.display = "flex";
}

function closeDefinitionPopup() {
  if (!popupOverlayEl) return;
  popupOverlayEl.style.display = "none";
  if (pendingNextQuestion) {
    pendingNextQuestion = false;
    goToNextQuestion();
  }
}

// ==========================
// מצב לימוד – בנייה וסינון
// ==========================
function initStudyList() {
  studyList = [];
  if (!conceptsByZone) return;

  Object.keys(conceptsByZone).forEach(zoneKey => {
    const z = parseInt(zoneKey, 10);
    const arr = conceptsByZone[zoneKey];
    if (Array.isArray(arr)) {
      arr.forEach((concept, index) => {
        const codeNumber = z * 100 + (index + 1); // כמו במשחק
        studyList.push({
          zone: z,
          name: concept.name,
          definition: concept.definition,
          code: codeNumber
        });
      });
    }
  });

  applyStudyFilters();
}

function applyStudyFilters() {
  if (!studyList.length) {
    filteredStudyList = [];
    updateStudyUI();
    return;
  }

  const mode = studyFilterModeEl ? studyFilterModeEl.value : "all";
  const zoneFilter = studyFilterZoneEl ? studyFilterZoneEl.value : "all";
  const searchText = studySearchInputEl ? studySearchInputEl.value.trim().toLowerCase() : "";

  filteredStudyList = studyList.filter(item => {
    if (zoneFilter !== "all") {
      const z = parseInt(zoneFilter, 10);
      if (item.zone !== z) return false;
    }

    if (mode === "mistakes") {
      if (!wrongConceptNames.has(item.name)) return false;
    }

    if (searchText) {
      if (!item.name || !item.name.toLowerCase().includes(searchText)) {
        return false;
      }
    }

    return true;
  });

  if (filteredStudyList.length === 0) {
    studyIndex = 0;
  } else if (studyIndex >= filteredStudyList.length) {
    studyIndex = 0;
  }

  updateStudyUI();
}

function updateStudyUI() {
  if (!studyConceptNameEl || !studyConceptDefinitionEl || !studyCounterEl) return;

  if (filteredStudyList.length === 0) {
    studyCounterEl.textContent = "אין תוצאות לתנאי החיפוש";
    studyConceptNameEl.textContent = "—";
    studyConceptDefinitionEl.textContent = "";
    return;
  }

  const item = filteredStudyList[studyIndex];
  const codeText = item.code ? `קוד שאלה: ${item.code} • ` : "";

  studyCounterEl.textContent = `${codeText}מושג ${studyIndex + 1} מתוך ${filteredStudyList.length}`;
  studyConceptNameEl.textContent = `זירה ${item.zone} – ${item.name}`;
  studyConceptDefinitionEl.textContent = item.definition;
}

function studyNext() {
  if (!filteredStudyList.length) return;
  studyIndex = (studyIndex + 1) % filteredStudyList.length;
  updateStudyUI();
}

function studyRandom() {
  if (!filteredStudyList.length) return;
  const newIndex = Math.floor(Math.random() * filteredStudyList.length);
  studyIndex = newIndex;
  updateStudyUI();
}

// ==========================
// Event Listeners
// ==========================
function setupEventListeners() {
  if (startGameBtn) {
    startGameBtn.addEventListener("click", () => {
      showScreen("game");
      startGame();
      updateSpinButtonState();
    });
  }

  if (startStudyBtn) {
    startStudyBtn.addEventListener("click", () => {
      showScreen("study");
      applyStudyFilters();
    });
  }

  if (backFromGameBtn) {
    backFromGameBtn.addEventListener("click", () => {
      showScreen("home");
    });
  }

  if (backFromStudyBtn) {
    backFromStudyBtn.addEventListener("click", () => {
      showScreen("home");
    });
  }

  if (spinBtn) {
    spinBtn.addEventListener("click", spinWheel);
  }

  if (correctBtn) {
    correctBtn.addEventListener("click", handleCorrect);
  }

  if (partialBtn) {
    partialBtn.addEventListener("click", handlePartial);
  }

  if (wrongBtn) {
    wrongBtn.addEventListener("click", handleWrong);
  }

  if (timeoverBtn) {
    timeoverBtn.addEventListener("click", handleTimeoverButton);
  }

  if (popupOkBtn) {
    popupOkBtn.addEventListener("click", closeDefinitionPopup);
  }

  if (resetScoreBtn) {
    resetScoreBtn.addEventListener("click", resetScore);
  }

  // מצב לימוד – פילטרים
  if (studyFilterModeEl) {
    studyFilterModeEl.addEventListener("change", applyStudyFilters);
  }
  if (studyFilterZoneEl) {
    studyFilterZoneEl.addEventListener("change", applyStudyFilters);
  }
  if (studySearchInputEl) {
    studySearchInputEl.addEventListener("input", applyStudyFilters);
  }
  if (studyApplyFilterBtn) {
    studyApplyFilterBtn.addEventListener("click", applyStudyFilters);
  }
  if (studyNextBtn) {
    studyNextBtn.addEventListener("click", studyNext);
  }
  if (studyRandomBtn) {
    studyRandomBtn.addEventListener("click", studyRandom);
  }

  // פאנל זירות – כפתורי "כל הזירות" / "אפס בחירה"
  if (zonesAllBtn && zoneFilterCheckboxes.length) {
    zonesAllBtn.addEventListener("click", () => {
      zoneFilterCheckboxes.forEach(cb => cb.checked = true);
    });
  }

  if (zonesClearBtn && zoneFilterCheckboxes.length) {
    zonesClearBtn.addEventListener("click", () => {
      zoneFilterCheckboxes.forEach(cb => cb.checked = false);
    });
  }

  // פופאפ הצלחה
  if (winContinueBtn) {
    winContinueBtn.addEventListener("click", () => {
      hideWinPopup(); // ממשיך לשחק עם אותו ניקוד
    });
  }

  if (winResetBtn) {
    winResetBtn.addEventListener("click", () => {
      hideWinPopup();
      resetScore();   // מאפס ניקוד + מושגים "נלמדים"
    });
  }
}
