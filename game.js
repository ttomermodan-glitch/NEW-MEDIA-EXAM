// game.js

// מפתח לשמירה מקומית
const GAME_STORAGE_KEY = "nm_game_state_v2";

// תוויות לזירות לתצוגה
const ZONE_LABELS = {
  1: "זירה 1 - יסודות תקשורת",
  2: "זירה 2 - גלובליזציה",
  3: "זירה 3 - הצגת המציאות",
  4: "זירה 4 - הומור וסאטירה",
  5: "זירה 5 - תרבות דיגיטלית",
  9: "זירה 9 - פרסום וצרכנות"
};

// מצב משחק בזיכרון
let state = {
  points: 0,
  questionsAnswered: 0,
  mastered: [], // [{zone, code}]
  answers: {},  // {"zone-code": "טקסט תשובה"}
  current: null // {zone, code}
};

// עוזר: יצירת מפתח אחיד לקוד
function conceptKey(zone, code) {
  return zone + "-" + code;
}

// טעינת מצב מ-localStorage
function loadState() {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = Object.assign(state, parsed);
    }
  } catch (e) {
    console.error("failed to load state", e);
  }
}

// שמירת מצב ל-localStorage
function saveState() {
  try {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("failed to save state", e);
  }
}

// עוזר: בדיקה אם מושג כבר ב-MASTERED
function isMastered(zone, code) {
  return state.mastered.some(function (c) {
    return c.zone === zone && c.code === code;
  });
}

// הוספה ל-MASTERED
function addMastered(zone, code) {
  if (!isMastered(zone, code)) {
    state.mastered.push({ zone: zone, code: code });
  }
}

// הסרה מ-MASTERED
function removeMastered(zone, code) {
  state.mastered = state.mastered.filter(function (c) {
    return !(c.zone === zone && c.code === code);
  });
}

// החזרת רשימת מושגים לפי בחירה ב-select
function getConceptPool(selectedValue) {
  const pool = [];

  if (typeof conceptsByZone !== "object") {
    console.error("conceptsByZone is missing from data.js");
    return pool;
  }

  // אם "all" - כל הזירות
  if (selectedValue === "all") {
    Object.keys(conceptsByZone).forEach(function (z) {
      const zoneId = parseInt(z, 10);
      const arr = conceptsByZone[z] || [];
      arr.forEach(function (entry) {
        // entry יכול להיות מספר או אובייקט עם code
        if (typeof entry === "number" || typeof entry === "string") {
          pool.push({ zone: zoneId, code: String(entry) });
        } else if (entry && typeof entry === "object" && "code" in entry) {
          pool.push({ zone: zoneId, code: String(entry.code) });
        }
      });
    });
    return pool;
  }

  // זירה ספציפית
  const zoneId = parseInt(selectedValue, 10);
  const arr = conceptsByZone[zoneId] || [];
  arr.forEach(function (entry) {
    if (typeof entry === "number" || typeof entry === "string") {
      pool.push({ zone: zoneId, code: String(entry) });
    } else if (entry && typeof entry === "object" && "code" in entry) {
      pool.push({ zone: zoneId, code: String(entry.code) });
    }
  });

  return pool;
}

// רנדומלי מתוך מערך
function pickRandom(array) {
  if (!array.length) return null;
  const idx = Math.floor(Math.random() * array.length);
  return array[idx];
}

// עדכון כל הטקסטים של הסטטיסטיקה והקוד הנוכחי
function updateStatsUI() {
  const questionsCount = document.getElementById("questionsCount");
  const masteredCount = document.getElementById("masteredCount");
  const currentCodeLabel = document.getElementById("currentCodeLabel");
  const currentZoneLabel = document.getElementById("currentZoneLabel");
  const conceptCode = document.getElementById("conceptCode");
  const conceptMeta = document.getElementById("conceptMeta");
  const chatPromptExample = document.getElementById("chatPromptExample");

  if (questionsCount) questionsCount.textContent = String(state.questionsAnswered);
  if (masteredCount) masteredCount.textContent = String(state.mastered.length);

  if (state.current) {
    const z = state.current.zone;
    const c = state.current.code;
    const zoneLabel = ZONE_LABELS[z] || ("זירה " + z);

    if (currentCodeLabel) currentCodeLabel.textContent = c;
    if (currentZoneLabel) currentZoneLabel.textContent = zoneLabel;
    if (conceptCode) conceptCode.textContent = c;
    if (conceptMeta) {
      conceptMeta.textContent =
        zoneLabel + " – הגדר את המושג במילים שלך, בלי להסתכל בסיכום.";
    }
    if (chatPromptExample) {
      chatPromptExample.textContent = c + " - " + "התיאור שלך למושג";
    }
  } else {
    if (currentCodeLabel) currentCodeLabel.textContent = "-";
    if (currentZoneLabel) currentZoneLabel.textContent = "-";
    if (conceptCode) conceptCode.textContent = 'לחץ על "סיבוב גלגל"';
    if (conceptMeta) {
      conceptMeta.textContent =
        "המערכת תגריל קוד מתוך הזירה שנבחרת ותציג כאן.";
    }
    if (chatPromptExample) {
      chatPromptExample.textContent = "107 - מה שהמוען מנסה להעביר לנמען";
    }
  }
}

// מילוי / ניקוי שדה התשובה לפי הקוד הנוכחי
function syncAnswerField() {
  const answerInput = document.getElementById("answerInput");
  if (!answerInput) return;

  if (!state.current) {
    answerInput.value = "";
    return;
  }

  const key = conceptKey(state.current.zone, state.current.code);
  if (state.answers[key]) {
    answerInput.value = state.answers[key];
  } else {
    answerInput.value = "";
  }
}

// הצגת הודעה בתיבת feedback
function showFeedback(type, message) {
  const feedbackBox = document.getElementById("feedbackBox");
  if (!feedbackBox) return;

  feedbackBox.style.display = "block";
  feedbackBox.textContent = message || "";

  feedbackBox.classList.remove("ok", "partial", "error");

  if (type === "ok") feedbackBox.classList.add("ok");
  else if (type === "partial") feedbackBox.classList.add("partial");
  else if (type === "error") feedbackBox.classList.add("error");
}

// בחירת מושג חדש
function spinForNewConcept() {
  const zoneSelect = document.getElementById("zoneSelect");
  if (!zoneSelect) return;

  const selected = zoneSelect.value || "all";
  const pool = getConceptPool(selected);

  if (!pool.length) {
    showFeedback("error", "לא נמצאו מושגים לזירה הזו. בדוק את data.js.");
    return;
  }

  // שלא יחזור אותו קוד פעמיים ברצף אם אפשר
  let options = pool;
  if (state.current && pool.length > 1) {
    options = pool.filter(function (c) {
      return !(c.zone === state.current.zone && c.code === state.current.code);
    });
    if (!options.length) {
      options = pool;
    }
  }

  const chosen = pickRandom(options);
  if (!chosen) {
    showFeedback("error", "בעיה בבחירת קוד. נסה שוב.");
    return;
  }

  state.current = { zone: chosen.zone, code: chosen.code };
  saveState();
  updateStatsUI();
  syncAnswerField();
  showFeedback("ok", "הוגרל קוד חדש. נסה להגדיר אותו לפני שאתה מסתכל בסיכום.");
}

// סימון תוצאה (נכון/חלקי/טעות)
function markResult(resultType) {
  if (!state.current) {
    showFeedback("error", "אין קוד פעיל. קודם סובב גלגל.");
    return;
  }

  const z = state.current.zone;
  const c = state.current.code;
  let delta = 0;
  let msg = "";

  if (resultType === "correct") {
    delta = 5;
    addMastered(z, c);
    msg = "סימנת: נכון לגמרי. קיבלת 5 נקודות והמושג נכנס ל־MASTERED.";
  } else if (resultType === "partial") {
    delta = 3;
    msg = "סימנת: נכון חלקית. קיבלת 3 נקודות, אבל המושג לא נכנס ל־MASTERED.";
  } else if (resultType === "wrong") {
    delta = -10;
    const wasMastered = isMastered(z, c);
    if (wasMastered) {
      removeMastered(z, c);
      msg = "סימנת: טעות. ירדו 10 נקודות והמושג הוסר מ־MASTERED (אם היה שם).";
    } else {
      msg = "סימנת: טעות. ירדו 10 נקודות.";
    }
  }

  state.points += delta;
  state.questionsAnswered += 1;
  saveState();
  updateStatsUI();

  if (resultType === "correct") {
    showFeedback("ok", msg);
  } else if (resultType === "partial") {
    showFeedback("partial", msg);
  } else {
    showFeedback("error", msg);
  }
}

// שמירת תשובה למושג הנוכחי
function saveAnswerForCurrent() {
  if (!state.current) {
    showFeedback("error", "אין קוד פעיל. קודם סובב גלגל.");
    return;
  }

  const answerInput = document.getElementById("answerInput");
  if (!answerInput) return;

  const text = answerInput.value.trim();
  const key = conceptKey(state.current.zone, state.current.code);

  if (!text) {
    // אם ריק - מחיקה
    delete state.answers[key];
    saveState();
    showFeedback("ok", "התשובה למושג הזה נמחקה.");
    return;
  }

  state.answers[key] = text;
  saveState();
  showFeedback(
    "ok",
    "התשובה נשמרה למושג הזה. עכשיו אפשר לשלוח לצאט בפורמט: 'קוד - תיאור'."
  );
}

// ניקוי שדה התשובה בלבד
function clearAnswerField() {
  const answerInput = document.getElementById("answerInput");
  if (!answerInput) return;
  answerInput.value = "";
  if (state.current) {
    const key = conceptKey(state.current.zone, state.current.code);
    delete state.answers[key];
    saveState();
  }
  showFeedback("ok", "שדה התשובה נוקה. אם הייתה תשובה שמורה למושג הזה, היא נמחקה.");
}

// איפוס מידע של המושג הנוכחי בלבד
function resetCurrentConceptData() {
  if (!state.current) {
    showFeedback("error", "אין קוד פעיל לאיפוס.");
    return;
  }
  const z = state.current.zone;
  const c = state.current.code;
  const key = conceptKey(z, c);

  removeMastered(z, c);
  delete state.answers[key];

  saveState();
  syncAnswerField();
  updateStatsUI();
  showFeedback(
    "ok",
    "נתוני המושג הנוכחי אופסו (תשובה שמורה וסטטוס MASTERED). הנקודות ההיסטוריות לא שונו."
  );
}

// איפוס כל הנתונים
function resetAllData() {
  const ok = window.confirm("לאפס את כל הנתונים במכשיר הזה? נקודות, MASTERED ותשובות יימחקו.");
  if (!ok) return;

  state = {
    points: 0,
    questionsAnswered: 0,
    mastered: [],
    answers: {},
    current: null
  };
  saveState();
  updateStatsUI();
  syncAnswerField();
  showFeedback("ok", "כל הנתונים אופסו בהצלחה.");
}

// חיבור כל האירועים
document.addEventListener("DOMContentLoaded", function () {
  // טעינת מצב קודם
  loadState();

  // התאמת תווית מצב לפי מכשיר שנשמר (סתם קוסמטי)
  try {
    const device = localStorage.getItem("nm_device_mode");
    const modeLabel = document.getElementById("modeLabel");
    if (modeLabel) {
      if (device === "mobile") {
        modeLabel.textContent = "קודים ללמידה (תצוגת נייד)";
      } else if (device === "desktop") {
        modeLabel.textContent = "קודים ללמידה (תצוגת מחשב)";
      } else {
        modeLabel.textContent = "קודים לזכירה";
      }
    }
  } catch (e) {}

  // לחצנים ושדות
  const spinButton = document.getElementById("spinButton");
  const skipButton = document.getElementById("skipButton");
  const markCorrectBtn = document.getElementById("markCorrect");
  const markPartialBtn = document.getElementById("markPartial");
  const markWrongBtn = document.getElementById("markWrong");
  const submitAnswerBtn = document.getElementById("submitAnswer");
  const clearAnswerBtn = document.getElementById("clearAnswer");
  const resetCurrentBtn = document.getElementById("resetCurrent");
  const resetAllBtn = document.getElementById("resetAll");
  const zoneSelect = document.getElementById("zoneSelect");

  if (spinButton) {
    spinButton.addEventListener("click", function () {
      spinForNewConcept();
    });
  }

  if (skipButton) {
    skipButton.addEventListener("click", function () {
      spinForNewConcept();
      showFeedback("partial", "דילגת על המושג הקודם. לא נוספו או נגרעו נקודות.");
    });
  }

  if (markCorrectBtn) {
    markCorrectBtn.addEventListener("click", function () {
      markResult("correct");
    });
  }

  if (markPartialBtn) {
    markPartialBtn.addEventListener("click", function () {
      markResult("partial");
    });
  }

  if (markWrongBtn) {
    markWrongBtn.addEventListener("click", function () {
      markResult("wrong");
    });
  }

  if (submitAnswerBtn) {
    submitAnswerBtn.addEventListener("click", function () {
      saveAnswerForCurrent();
    });
  }

  if (clearAnswerBtn) {
    clearAnswerBtn.addEventListener("click", function () {
      clearAnswerField();
    });
  }

  if (resetCurrentBtn) {
    resetCurrentBtn.addEventListener("click", function () {
      resetCurrentConceptData();
    });
  }

  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", function () {
      resetAllData();
    });
  }

  if (zoneSelect) {
    zoneSelect.addEventListener("change", function () {
      // כשמשנים זירה רק מוחקים הודעת משוב וקצת טקסט
      const feedbackBox = document.getElementById("feedbackBox");
      if (feedbackBox) {
        feedbackBox.style.display = "none";
      }
    });
  }

  // עדכון ראשוני של ה־UI לפי מצב טעון
  updateStatsUI();
  syncAnswerField();
});
