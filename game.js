// game.js - לוגיקה של המשחק והלימוד

// מצב כללי
let currentZone = null;
let currentRoundConcepts = [];
let currentQuestionIndex = 0;

let score = 0;
let targetScore = 50;
let timerSeconds = 300; // 5 דקות
let timerInterval = null;

let totalConceptCount = 0;
let hasWinPopupShown = false;

// מצב לימוד
let allConceptsFlat = [];
let studyFiltered = [];
let studyIndex = 0;

// טעויות שנשמרות למצב לימוד
let mistakesList = []; // { zone, name, definition }

function loadMistakesFromStorage() {
  try {
    const raw = localStorage.getItem("nm_mistakes_v1");
    mistakesList = raw ? JSON.parse(raw) : [];
  } catch (e) {
    mistakesList = [];
  }
}

function saveMistakesToStorage() {
  try {
    localStorage.setItem("nm_mistakes_v1", JSON.stringify(mistakesList));
  } catch (e) {}
}

// בניית רשימת כל המושגים לכל הזירות (כולל 2 ו-9)
function buildAllConceptsFlat() {
  allConceptsFlat = [];
  totalConceptCount = 0;

  Object.keys(conceptsByZone).forEach((zoneKey) => {
    const zoneNum = Number(zoneKey);
    const arr = conceptsByZone[zoneKey] || [];
    totalConceptCount += arr.length;
    arr.forEach((c) => {
      allConceptsFlat.push({
        zone: zoneNum,
        name: c.name,
        definition: c.definition
      });
    });
  });

  targetScore = Math.max(30, Math.round(totalConceptCount * 1.2));
  const label = document.getElementById("target-score-label");
  if (label) {
    label.textContent = "מטרה: " + targetScore + " נקודות";
  }

  console.log("zones length debug:", {
    1: conceptsByZone[1]?.length,
    2: conceptsByZone[2]?.length,
    3: conceptsByZone[3]?.length,
    4: conceptsByZone[4]?.length,
    5: conceptsByZone[5]?.length,
    9: conceptsByZone[9]?.length
  });
}

// ניקוד
function updateScoreView() {
  const scoreEl = document.getElementById("score");
  if (scoreEl) {
    scoreEl.textContent = "⭐ ניקוד: " + score;
  }

  if (score >= targetScore && !hasWinPopupShown) {
    hasWinPopupShown = true;
    openWinOverlay();
  }
}

// טיימר
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (m < 10 ? "0" + m : "" + m) + ":" + (s < 10 ? "0" + s : "" + s);
}

function updateTimerView() {
  const t = document.getElementById("timer");
  if (t) {
    t.textContent = "⏱️ " + formatTime(timerSeconds);
  }
}

function startMainTimerIfNeeded() {
  if (timerInterval) return;
  timerSeconds = 300;
  updateTimerView();

  timerInterval = setInterval(() => {
    timerSeconds--;
    if (timerSeconds < 0) timerSeconds = 0;
    updateTimerView();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      onTimeOverGlobal();
    }
  }, 1000);
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerSeconds = 300;
  updateTimerView();
}

function onTimeOverGlobal() {
  const result = document.getElementById("game-result");
  if (result) {
    result.textContent = "נגמר הזמן הכללי של המשחק. אפשר לאפס ניקוד ולהתחיל סיבוב חדש.";
    result.classList.remove("win");
    result.classList.add("lose");
  }

  const spinBtn = document.getElementById("btn-spin");
  if (spinBtn) spinBtn.disabled = true;

  setScoreButtonsEnabled(false);
}

// הפעלת כפתורי ניקוד
function setScoreButtonsEnabled(enabled) {
  document.querySelectorAll(".score-btn").forEach((btn) => {
    btn.disabled = !enabled;
  });
}

// זירות מסומנות בפילטר
function getSelectedZonesFromFilters() {
  const boxes = document.querySelectorAll(".zone-filter");
  const selected = [];
  boxes.forEach((cb) => {
    if (cb.checked) {
      const val = Number(cb.value);
      if (!Number.isNaN(val)) selected.push(val);
    }
  });
  return selected;
}

// אילו זירות הגלגל יכול להוציא
function getWheelZones() {
  // הגלגל יכול לבחור 1–5; 9 רק אם מסומן
  const base = [1, 2, 3, 4, 5];
  const selected = getSelectedZonesFromFilters();
  const result = [];

  base.forEach((z) => {
    if (selected.includes(z)) result.push(z);
  });

  if (selected.includes(9)) result.push(9);

  return result;
}

// רנדום
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// בחירת זירה לגלגל
function pickRandomZoneForWheel() {
  const wheelZones = getWheelZones();
  if (!wheelZones.length) {
    alert("תבחר לפחות זירה אחת לפני הסיבוב");
    return null;
  }
  const idx = randomInt(0, wheelZones.length - 1);
  return wheelZones[idx];
}

// סיבוב גלגל
function spinWheel() {
  const wheel = document.getElementById("wheel");
  const msg = document.getElementById("wheel-message");
  if (!wheel) return;

  const chosenZone = pickRandomZoneForWheel();
  if (chosenZone == null) return;

  const baseRotations = 6;
  const extraDegrees = randomInt(0, 359);
  const totalDeg = baseRotations * 360 + extraDegrees;
  wheel.style.transition = "transform 2s ease-out";
  wheel.style.transform = "rotate(" + totalDeg + "deg)";

  if (msg) msg.textContent = "הגלגל מסתובב...";

  setTimeout(() => {
    currentZone = chosenZone;
    if (msg) {
      msg.textContent = "נבחרה זירה " + currentZone + ". מופיעות 3 שאלות מהזירה הזאת.";
    }
    startMainTimerIfNeeded();
    startNewRoundForZone(currentZone);
  }, 2000);
}

// סיבוב חדש לזירה
function startNewRoundForZone(zone) {
  const pool = conceptsByZone[zone];

  if (!Array.isArray(pool) || pool.length === 0) {
    console.error("אין מושגים לזירה הזאת ב conceptsByZone", zone, conceptsByZone);
    alert("יש בעיה בטעינת data.js – תבדוק שאין שגיאת כתיב במספר הזירה או שגיאת תחביר בקובץ.");
    return;
  }

  const indices = [];
  for (let i = 0; i < pool.length; i++) indices.push(i);
  indices.sort(() => Math.random() - 0.5);

  currentRoundConcepts = indices.slice(0, 3).map((i) => ({
    zone,
    name: pool[i].name,
    definition: pool[i].definition
  }));

  currentQuestionIndex = 0;
  setScoreButtonsEnabled(true);
  hasWinPopupShown = false;

  showCurrentQuestion();
}

// הצגת שאלה
function showCurrentQuestion() {
  const questionNumEl = document.getElementById("question-number");
  const questionCodeEl = document.getElementById("question-code");
  const zoneLabelEl = document.getElementById("zone-label");
  const conceptNameEl = document.getElementById("concept-name");
  const result = document.getElementById("game-result");

  if (!currentRoundConcepts.length) {
    if (questionNumEl) questionNumEl.textContent = "אין שאלה פעילה - סובב את הגלגל.";
    if (zoneLabelEl) zoneLabelEl.textContent = "זירה: -";
    if (conceptNameEl) conceptNameEl.textContent = "המתן לבחירת הזירה";
    if (questionCodeEl) questionCodeEl.textContent = "";
    setScoreButtonsEnabled(false);
    return;
  }

  if (currentQuestionIndex >= currentRoundConcepts.length) {
    if (questionNumEl) questionNumEl.textContent = "סיבוב הסתיים - סובב שוב את הגלגל לסיבוב חדש.";
    if (zoneLabelEl) zoneLabelEl.textContent = "זירה: " + currentZone;
    if (conceptNameEl) conceptNameEl.textContent = "אין עוד שאלות בסיבוב.";
    if (questionCodeEl) questionCodeEl.textContent = "";
    setScoreButtonsEnabled(false);
    return;
  }

  const q = currentRoundConcepts[currentQuestionIndex];

  if (questionNumEl) {
    questionNumEl.textContent =
      "שאלה " + (currentQuestionIndex + 1) + " מתוך " + currentRoundConcepts.length;
  }
  if (zoneLabelEl) zoneLabelEl.textContent = "זירה: " + q.zone;
  if (conceptNameEl) conceptNameEl.textContent = q.name;
  if (questionCodeEl) questionCodeEl.textContent = "";

  if (result) {
    result.textContent = "";
    result.classList.remove("win");
    result.classList.remove("lose");
  }
}

// ניקוד לשאלה
function handleScoreForCurrentQuestion(type) {
  if (!currentRoundConcepts.length) return;
  if (currentQuestionIndex >= currentRoundConcepts.length) return;

  const q = currentRoundConcepts[currentQuestionIndex];
  const result = document.getElementById("game-result");

  if (type === "correct") {
    score += 5;
    if (result) {
      result.textContent = "סימנת: נכון (+5 נקודות).";
      result.classList.remove("lose");
      result.classList.add("win");
    }
  } else if (type === "partial") {
    score += 3;
    if (result) {
      result.textContent = "סימנת: נכון חלקית (+3 נקודות).";
      result.classList.remove("lose");
      result.classList.add("win");
    }
  } else if (type === "wrong") {
    score -= 10;
    if (result) {
      result.textContent = "סימנת: טעות (-10 נקודות). המושג נשמר ללמידה.";
      result.classList.remove("win");
      result.classList.add("lose");
    }
    addMistake(q);
  } else if (type === "timeover") {
    score -= 20;
    if (result) {
      result.textContent = "נגמר הזמן לשאלה (-20 נקודות). המושג נשמר ללמידה.";
      result.classList.remove("win");
      result.classList.add("lose");
    }
    addMistake(q);
  }

  updateScoreView();

  // 🔥 פותח פופאפ הסבר אוטומטית אחרי כל שאלה
  openDefinitionPopupForCurrentQuestion();

  currentQuestionIndex++;
  showCurrentQuestion();
}

  const q = currentRoundConcepts[currentQuestionIndex];
  const result = document.getElementById("game-result");

  if (type === "correct") {
    score += 5;
    if (result) {
      result.textContent = "סימנת: נכון (+5 נקודות).";
      result.classList.remove("lose");
      result.classList.add("win");
    }
  } else if (type === "partial") {
    score += 3;
    if (result) {
      result.textContent = "סימנת: נכון חלקית (+3 נקודות).";
      result.classList.remove("lose");
      result.classList.add("win");
    }
  } else if (type === "wrong") {
    score -= 10;
    if (result) {
      result.textContent = "סימנת: טעות (-10 נקודות). המושג נשמר ללמידה.";
      result.classList.remove("win");
      result.classList.add("lose");
    }
    addMistake(q);
  } else if (type === "timeover") {
    score -= 20;
    if (result) {
      result.textContent = "נגמר הזמן לשאלה (-20 נקודות). המושג נשמר ללמידה.";
      result.classList.remove("win");
      result.classList.add("lose");
    }
    addMistake(q);
  }

  updateScoreView();
  currentQuestionIndex++;
  showCurrentQuestion();
}

// הוספת מושג לרשימת טעויות
function addMistake(q) {
  const exists = mistakesList.some((m) => m.zone === q.zone && m.name === q.name);
  if (!exists) {
    mistakesList.push({
      zone: q.zone,
      name: q.name,
      definition: q.definition
    });
    saveMistakesToStorage();
  }
}

// איפוס ניקוד ומשחק
function resetScoreAndGame() {
  score = 0;
  updateScoreView();
  currentZone = null;
  currentRoundConcepts = [];
  currentQuestionIndex = 0;
  hasWinPopupShown = false;

  const result = document.getElementById("game-result");
  if (result) {
    result.textContent = "הניקוד אופס. אפשר להתחיל סיבוב חדש.";
    result.classList.remove("lose");
    result.classList.remove("win");
  }

  const spinBtn = document.getElementById("btn-spin");
  if (spinBtn) spinBtn.disabled = false;

  setScoreButtonsEnabled(false);
  resetTimer();
}

// פופאפ הגדרה
function openDefinitionPopupForCurrentQuestion() {
  if (!currentRoundConcepts.length) return;
  if (currentQuestionIndex >= currentRoundConcepts.length) return;

  const q = currentRoundConcepts[currentQuestionIndex];

  const overlay = document.getElementById("popup-overlay");
  const title = document.getElementById("popup-concept-name");
  const def = document.getElementById("popup-definition");

  if (!overlay || !title || !def) return;

  title.textContent = q.name;
  def.textContent = q.definition;
  overlay.style.display = "flex";
}

function closeDefinitionPopup() {
  const overlay = document.getElementById("popup-overlay");
  if (overlay) overlay.style.display = "none";
}

// פופאפ זכייה
function openWinOverlay() {
  const overlay = document.getElementById("win-overlay");
  if (overlay) overlay.style.display = "flex";
}

function closeWinOverlay() {
  const overlay = document.getElementById("win-overlay");
  if (overlay) overlay.style.display = "none";
}

// מצב לימוד
function applyStudyFilter() {
  const sourceSel = document.getElementById("study-source-filter");
  const zoneSel = document.getElementById("study-zone-filter");
  const searchInput = document.getElementById("study-search");

  const source = sourceSel ? sourceSel.value : "all";
  const zoneVal = zoneSel ? zoneSel.value : "all";
  const searchText = searchInput ? searchInput.value.trim() : "";

  let base = [];

  if (source === "mistakes") {
    base = mistakesList.slice();
  } else {
    base = allConceptsFlat.slice();
  }

  if (zoneVal !== "all") {
    const z = Number(zoneVal);
    base = base.filter((c) => c.zone === z);
  }

  if (searchText) {
    const lower = searchText.toLowerCase();
    base = base.filter((c) => c.name.toLowerCase().includes(lower));
  }

  studyFiltered = base;
  studyIndex = 0;
  showStudyConcept();
}

function showStudyConcept() {
  const counterEl = document.getElementById("study-counter");
  const nameEl = document.getElementById("study-concept-name");
  const defEl = document.getElementById("study-definition");

  if (!studyFiltered.length) {
    if (counterEl) counterEl.textContent = "לא נמצאו מושגים לתנאי הסינון";
    if (nameEl) nameEl.textContent = "—";
    if (defEl) defEl.textContent = "שנה פילטרים או הורד חיפוש.";
    return;
  }

  if (studyIndex < 0) studyIndex = 0;
  if (studyIndex >= studyFiltered.length) studyIndex = 0;

  const c = studyFiltered[studyIndex];

  if (counterEl) {
    counterEl.textContent =
      "מושג " + (studyIndex + 1) + " מתוך " + studyFiltered.length + " (זירה " + c.zone + ")";
  }
  if (nameEl) nameEl.textContent = c.name;
  if (defEl) defEl.textContent = c.definition;
}

function studyNext() {
  if (!studyFiltered.length) return;
  studyIndex++;
  if (studyIndex >= studyFiltered.length) studyIndex = 0;
  showStudyConcept();
}

function studyRandom() {
  if (!studyFiltered.length) return;
  studyIndex = randomInt(0, studyFiltered.length - 1);
  showStudyConcept();
}

// ניווט מסכים
function showScreenHome() {
  const home = document.getElementById("home-screen");
  const game = document.getElementById("game-screen");
  const study = document.getElementById("study-screen");

  if (home) home.classList.remove("hidden");
  if (game) game.classList.add("hidden");
  if (study) study.classList.add("hidden");

  resetTimer();
}

function showScreenGame() {
  const home = document.getElementById("home-screen");
  const game = document.getElementById("game-screen");
  const study = document.getElementById("study-screen");

  if (home) home.classList.add("hidden");
  if (game) game.classList.remove("hidden");
  if (study) study.classList.add("hidden");

  resetScoreAndGame();
}

function showScreenStudy() {
  const home = document.getElementById("home-screen");
  const game = document.getElementById("game-screen");
  const study = document.getElementById("study-screen");

  if (home) home.classList.add("hidden");
  if (game) game.classList.add("hidden");
  if (study) study.classList.remove("hidden");

  applyStudyFilter();
}

// חיבור כל הכפתורים
window.addEventListener("DOMContentLoaded", function () {
  loadMistakesFromStorage();
  buildAllConceptsFlat();
  updateScoreView();
  updateTimerView();

  const btnStartGame = document.getElementById("btn-start-game");
  const btnStudyMode = document.getElementById("btn-study-mode");
  const btnBackHomeFromGame = document.getElementById("btn-back-home-from-game");
  const btnBackHomeFromStudy = document.getElementById("btn-back-home-from-study");

  if (btnStartGame) btnStartGame.addEventListener("click", showScreenGame);
  if (btnStudyMode) btnStudyMode.addEventListener("click", showScreenStudy);
  if (btnBackHomeFromGame) btnBackHomeFromGame.addEventListener("click", showScreenHome);
  if (btnBackHomeFromStudy) btnBackHomeFromStudy.addEventListener("click", showScreenHome);

  const btnSpin = document.getElementById("btn-spin");
  if (btnSpin) btnSpin.addEventListener("click", spinWheel);

  const btnZonesAll = document.getElementById("btn-zones-all");
  const btnZonesClear = document.getElementById("btn-zones-clear");
  if (btnZonesAll) {
    btnZonesAll.addEventListener("click", () => {
      document.querySelectorAll(".zone-filter").forEach((cb) => (cb.checked = true));
    });
  }
  if (btnZonesClear) {
    btnZonesClear.addEventListener("click", () => {
      document.querySelectorAll(".zone-filter").forEach((cb) => (cb.checked = false));
    });
  }

  const btnCorrect = document.getElementById("btn-correct");
  const btnPartial = document.getElementById("btn-partial");
  const btnWrong = document.getElementById("btn-wrong");
  const btnTimeover = document.getElementById("btn-timeover");

  if (btnCorrect) btnCorrect.addEventListener("click", () => handleScoreForCurrentQuestion("correct"));
  if (btnPartial) btnPartial.addEventListener("click", () => handleScoreForCurrentQuestion("partial"));
  if (btnWrong) btnWrong.addEventListener("click", () => handleScoreForCurrentQuestion("wrong"));
  if (btnTimeover) btnTimeover.addEventListener("click", () => handleScoreForCurrentQuestion("timeover"));

  const btnResetScore = document.getElementById("btn-reset-score");
  if (btnResetScore) btnResetScore.addEventListener("click", resetScoreAndGame);

  const questionBox = document.getElementById("question-box");
  if (questionBox) questionBox.addEventListener("click", openDefinitionPopupForCurrentQuestion);

  const btnPopupOk = document.getElementById("btn-popup-ok");
  if (btnPopupOk) btnPopupOk.addEventListener("click", closeDefinitionPopup);

  const btnWinContinue = document.getElementById("btn-win-continue");
  const btnWinReset = document.getElementById("btn-win-reset");
  if (btnWinContinue) btnWinContinue.addEventListener("click", () => closeWinOverlay());
  if (btnWinReset) btnWinReset.addEventListener("click", () => {
    closeWinOverlay();
    resetScoreAndGame();
  });

  const btnApplyStudyFilter = document.getElementById("btn-apply-study-filter");
  const btnStudyNext = document.getElementById("btn-study-next");
  const btnStudyRandom = document.getElementById("btn-study-random");

  if (btnApplyStudyFilter) btnApplyStudyFilter.addEventListener("click", applyStudyFilter);
  if (btnStudyNext) btnStudyNext.addEventListener("click", studyNext);
  if (btnStudyRandom) btnStudyRandom.addEventListener("click", studyRandom);

  showScreenHome();
});
