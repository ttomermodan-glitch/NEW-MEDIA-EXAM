// game.js

window.addEventListener("DOMContentLoaded", () => {
  // מסכים
  const homeScreen = document.getElementById("home-screen");
  const gameScreen = document.getElementById("game-screen");
  const studyScreen = document.getElementById("study-screen");

  // כפתורי ניווט ראשיים
  const btnStartGame = document.getElementById("btn-start-game");
  const btnStudyMode = document.getElementById("btn-study-mode");
  const btnBackHomeFromGame = document.getElementById("btn-back-home-from-game");
  const btnBackHomeFromStudy = document.getElementById("btn-back-home-from-study");

  // גלגל וזירות
  const btnSpin = document.getElementById("btn-spin");
  const wheel = document.getElementById("wheel");
  const wheelMessage = document.getElementById("wheel-message");
  const zoneCheckboxes = document.querySelectorAll(".zone-filter");
  const btnZonesAll = document.getElementById("btn-zones-all");
  const btnZonesClear = document.getElementById("btn-zones-clear");

  // שאלה וניקוד
  const timerEl = document.getElementById("timer");
  const scoreEl = document.getElementById("score");
  const targetScoreLabel = document.getElementById("target-score-label");
  const questionNumberEl = document.getElementById("question-number");
  const questionCodeEl = document.getElementById("question-code");
  const zoneLabelEl = document.getElementById("zone-label");
  const conceptNameEl = document.getElementById("concept-name");
  const resultEl = document.getElementById("game-result");

  const btnCorrect = document.getElementById("btn-correct");
  const btnPartial = document.getElementById("btn-partial");
  const btnWrong = document.getElementById("btn-wrong");
  const btnTimeOver = document.getElementById("btn-timeover");
  const btnResetScore = document.getElementById("btn-reset-score");

  // מצב לימוד
  const studySourceFilter = document.getElementById("study-source-filter");
  const studyZoneFilter = document.getElementById("study-zone-filter");
  const studySearchInput = document.getElementById("study-search");
  const btnApplyStudyFilter = document.getElementById("btn-apply-study-filter");
  const studyCounterEl = document.getElementById("study-counter");
  const studyConceptNameEl = document.getElementById("study-concept-name");
  const studyDefinitionEl = document.getElementById("study-definition");
  const btnStudyNext = document.getElementById("btn-study-next");
  const btnStudyRandom = document.getElementById("btn-study-random");

  // פופאפים
  const popupOverlay = document.getElementById("popup-overlay");
  const popupConceptName = document.getElementById("popup-concept-name");
  const popupDefinition = document.getElementById("popup-definition");
  const btnPopupOk = document.getElementById("btn-popup-ok");

  const winOverlay = document.getElementById("win-overlay");
  const btnWinContinue = document.getElementById("btn-win-continue");
  const btnWinReset = document.getElementById("btn-win-reset");

  // נתונים מה־data.js
  const conceptsByZone = window.conceptsByZone || {};
  const ROUND_QUESTIONS = 3;
  const TIME_LIMIT_SECONDS = 5 * 60;
  const SCORE_CORRECT = 5;
  const SCORE_PARTIAL = 3;
  const SCORE_WRONG = -10;
  const SCORE_TIMEOVER = -20;

  let currentScore = 0;
  let targetScore = 50;
  let timer = null;
  let remainingSeconds = TIME_LIMIT_SECONDS;

  let currentZone = null;
  let currentQuestions = [];
  let currentQuestionIndex = 0;
  let totalQuestionsAsked = 0;

  const mistakesSet = new Set(); // ids/קודים שטעית בהם

  // פונקציות עזר קטנות
  function showScreen(screen) {
    homeScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    studyScreen.classList.add("hidden");
    screen.classList.remove("hidden");
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function updateTimerDisplay() {
    timerEl.textContent = "⏱️ " + formatTime(remainingSeconds);
  }

  function startTimer() {
    stopTimer();
    remainingSeconds = TIME_LIMIT_SECONDS;
    updateTimerDisplay();
    timer = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        updateTimerDisplay();
        stopTimer();
        handleTimeOver();
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function updateScore(delta, reasonText) {
    currentScore += delta;
    scoreEl.textContent = "⭐ ניקוד: " + currentScore;
    if (reasonText) {
      resultEl.textContent = reasonText;
      resultEl.className = "";
      if (delta > 0) resultEl.classList.add("win");
      if (delta < 0) resultEl.classList.add("lose");
    }
    if (currentScore >= targetScore) {
      winOverlay.style.display = "flex";
    }
  }

  function enableScoreButtons(enabled) {
    [btnCorrect, btnPartial, btnWrong, btnTimeOver].forEach(btn => {
      btn.disabled = !enabled;
    });
  }

  function getZoneConcepts(zone) {
    const list = conceptsByZone[zone] || conceptsByZone[String(zone)] || [];
    return Array.isArray(list) ? list : [];
  }

  function normalizeConcept(concept) {
    if (!concept) return { id: null, code: "", name: "—", definition: "—" };
    const id = concept.id ?? concept.code ?? concept.key ?? null;
    const code = concept.code ?? concept.id ?? "";
    const name = concept.name || concept.term || concept.title || concept.conceptName || ("מושג " + code);
    const definition = concept.definition || concept.def || concept.text || concept.description || "";
    return { id, code, name, definition };
  }

  function pickRandomZone() {
    const active = Array.from(zoneCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    if (active.length === 0) return null;
    const idx = Math.floor(Math.random() * active.length);
    return active[idx];
  }

  function spinWheelAnimation(targetZone, callback) {
    if (!wheel) {
      callback && callback();
      return;
    }

    const zoneAngles = {
      "1": 0,
      "3": 90,
      "4": 180,
      "5": 270
      // זירה 2 ו־9 לא על הגלגל כרגע, אז רק טקסטואלית
    };

    const baseAngle = zoneAngles[targetZone] ?? 0;
    const extraSpins = 4 + Math.floor(Math.random() * 3); // 4–6 סיבובים
    const finalAngle = extraSpins * 360 + baseAngle;

    wheel.style.transition = "transform 2s ease-out";
    wheel.style.transform = `rotate(${finalAngle}deg)`;

    setTimeout(() => {
      callback && callback();
    }, 2000);
  }

  function loadQuestionsForZone(zone) {
    const concepts = getZoneConcepts(zone);
    if (concepts.length === 0) {
      questionNumberEl.textContent = "אין מושגים לזירה הזאת ב־data.js";
      questionCodeEl.textContent = "";
      conceptNameEl.textContent = "תבדוק את data.js לזירה " + zone;
      zoneLabelEl.textContent = "זירה: " + zone;
      enableScoreButtons(false);
      return;
    }

    // ערבוב פשוט
    const shuffled = [...concepts].sort(() => Math.random() - 0.5);
    currentQuestions = shuffled.slice(0, ROUND_QUESTIONS);
    currentQuestionIndex = 0;
    totalQuestionsAsked = 0;
    currentZone = zone;
    targetScore = Math.max(20, currentQuestions.length * 10);
    targetScoreLabel.textContent = "מטרה: " + targetScore + " נקודות";

    showCurrentQuestion();
    enableScoreButtons(true);
    startTimer();
  }

  function showCurrentQuestion() {
    if (!currentQuestions.length) return;
    const raw = currentQuestions[currentQuestionIndex];
    const c = normalizeConcept(raw);

    questionNumberEl.textContent = "שאלה " + (currentQuestionIndex + 1) + " מתוך " + currentQuestions.length;
    questionCodeEl.textContent = c.code ? "קוד: " + c.code : "";
    zoneLabelEl.textContent = "זירה: " + (currentZone || "-");
    conceptNameEl.textContent = c.name;
  }

  function goToNextQuestion() {
    if (!currentQuestions.length) return;
    currentQuestionIndex++;
    totalQuestionsAsked++;

    if (currentQuestionIndex >= currentQuestions.length) {
      stopTimer();
      enableScoreButtons(false);
      questionNumberEl.textContent = "הסתיימו " + currentQuestions.length + " שאלות לזירה הזאת";
      questionCodeEl.textContent = "";
      conceptNameEl.textContent = "סובב שוב את הגלגל לסיבוב חדש";
      zoneLabelEl.textContent = "זירה: " + (currentZone || "-");
      return;
    }

    showCurrentQuestion();
  }

  function getCurrentNormalizedConcept() {
    if (!currentQuestions.length) return null;
    return normalizeConcept(currentQuestions[currentQuestionIndex]);
  }

  function markMistakeForCurrent() {
    const c = getCurrentNormalizedConcept();
    if (!c) return;
    const key = c.id ?? c.code ?? c.name;
    if (key != null) mistakesSet.add(String(key));
  }

  function handleTimeOver() {
    markMistakeForCurrent();
    updateScore(SCORE_TIMEOVER, "⏰ נגמר הזמן על השאלה הזאת (־20)");
    goToNextQuestion();
  }

  // מסכי ניווט
  btnStartGame.addEventListener("click", () => {
    showScreen(gameScreen);
    resultEl.textContent = "";
    // להתחיל עם גלגל סגור, בלי שאלה
    questionNumberEl.textContent = "סובב את הגלגל כדי להתחיל סיבוב";
    questionCodeEl.textContent = "";
    conceptNameEl.textContent = "המתן לבחירת הזירה";
    zoneLabelEl.textContent = "זירה: -";
    enableScoreButtons(false);
    stopTimer();
    remainingSeconds = TIME_LIMIT_SECONDS;
    updateTimerDisplay();
  });

  btnStudyMode.addEventListener("click", () => {
    showScreen(studyScreen);
    buildStudyListAndShowFirst();
  });

  btnBackHomeFromGame.addEventListener("click", () => {
    stopTimer();
    showScreen(homeScreen);
  });

  btnBackHomeFromStudy.addEventListener("click", () => {
    showScreen(homeScreen);
  });

  // זירות כפתורי עזר
  if (btnZonesAll) {
    btnZonesAll.addEventListener("click", () => {
      zoneCheckboxes.forEach(cb => cb.checked = true);
    });
  }

  if (btnZonesClear) {
    btnZonesClear.addEventListener("click", () => {
      zoneCheckboxes.forEach(cb => cb.checked = false);
    });
  }

  // סיבוב גלגל
  if (btnSpin) {
    btnSpin.addEventListener("click", () => {
      const zone = pickRandomZone();
      if (!zone) {
        wheelMessage.textContent = "תבחר לפחות זירה אחת לפני הסיבוב";
        return;
      }
      wheelMessage.textContent = "הגלגל מסתובב...";
      spinWheelAnimation(zone, () => {
        wheelMessage.textContent = "נבחרה זירה " + zone + ". נטען שאלות...";
        loadQuestionsForZone(zone);
      });
    });
  }

  // ניקוד כפתורים
  btnCorrect.addEventListener("click", () => {
    updateScore(SCORE_CORRECT, "✅ סימנת שהגדרת נכון (+5)");
    goToNextQuestion();
  });

  btnPartial.addEventListener("click", () => {
    markMistakeForCurrent();
    updateScore(SCORE_PARTIAL, "⚖️ סימנת שההגדרה הייתה חלקית (+3)");
    goToNextQuestion();
  });

  btnWrong.addEventListener("click", () => {
    markMistakeForCurrent();
    const c = getCurrentNormalizedConcept();
    if (c && popupOverlay) {
      popupConceptName.textContent = c.name;
      popupDefinition.textContent = c.definition || "אין כרגע הגדרה מלאה במערכת.";
      popupOverlay.style.display = "flex";
    }
    updateScore(SCORE_WRONG, "❌ סימנת שהייתה טעות (־10)");
    goToNextQuestion();
  });

  btnTimeOver.addEventListener("click", () => {
    handleTimeOver();
  });

  btnResetScore.addEventListener("click", () => {
    currentScore = 0;
    scoreEl.textContent = "⭐ ניקוד: 0";
    resultEl.textContent = "";
    resultEl.className = "";
  });

  // פופאפ הסבר
  if (btnPopupOk && popupOverlay) {
    btnPopupOk.addEventListener("click", () => {
      popupOverlay.style.display = "none";
    });
  }

  // פופאפ זכייה
  if (btnWinContinue && btnWinReset && winOverlay) {
    btnWinContinue.addEventListener("click", () => {
      winOverlay.style.display = "none";
    });
    btnWinReset.addEventListener("click", () => {
      winOverlay.style.display = "none";
      currentScore = 0;
      scoreEl.textContent = "⭐ ניקוד: 0";
      resultEl.textContent = "";
      resultEl.className = "";
    });
  }

  // מצב לימוד
  let studyList = [];
  let studyIndex = 0;

  function buildStudyListAndShowFirst() {
    const all = [];

    Object.keys(conceptsByZone).forEach(zoneKey => {
      const list = getZoneConcepts(zoneKey);
      list.forEach(item => {
        const c = normalizeConcept(item);
        all.push({
          ...c,
          zone: zoneKey
        });
      });
    });

    // סינון לפי מקור/זירה/חיפוש
    const src = studySourceFilter.value;
    const zoneFilter = studyZoneFilter.value;
    const searchText = studySearchInput.value.trim();

    studyList = all.filter(c => {
      if (src === "mistakes") {
        const key = String(c.id ?? c.code ?? c.name);
        if (!mistakesSet.has(key)) return false;
      }
      if (zoneFilter !== "all" && String(c.zone) !== String(zoneFilter)) {
        return false;
      }
      if (searchText) {
        const t = searchText.toLowerCase();
        const inName = (c.name || "").toLowerCase().includes(t);
        const inDef = (c.definition || "").toLowerCase().includes(t);
        if (!inName && !inDef) return false;
      }
      return true;
    });

    if (!studyList.length) {
      studyCounterEl.textContent = "לא נמצאו מושגים לפי הסינון";
      studyConceptNameEl.textContent = "—";
      studyDefinitionEl.textContent = "נסה להרחיב את החיפוש או לשנות זירה.";
      return;
    }

    studyIndex = 0;
    showStudyConcept();
  }

  function showStudyConcept() {
    if (!studyList.length) return;
    const c = studyList[studyIndex];
    studyCounterEl.textContent = "מושג " + (studyIndex + 1) + " מתוך " + studyList.length + " (זירה " + c.zone + ")";
    studyConceptNameEl.textContent = c.name;
    studyDefinitionEl.textContent = c.definition || "";
  }

  if (btnApplyStudyFilter) {
    btnApplyStudyFilter.addEventListener("click", () => {
      buildStudyListAndShowFirst();
    });
  }

  if (btnStudyNext) {
    btnStudyNext.addEventListener("click", () => {
      if (!studyList.length) return;
      studyIndex = (studyIndex + 1) % studyList.length;
      showStudyConcept();
    });
  }

  if (btnStudyRandom) {
    btnStudyRandom.addEventListener("click", () => {
      if (!studyList.length) return;
      const idx = Math.floor(Math.random() * studyList.length);
      studyIndex = idx;
      showStudyConcept();
    });
  }

  // כשנכנסים לאתר: מסך בית
  showScreen(homeScreen);
  updateTimerDisplay();
});
