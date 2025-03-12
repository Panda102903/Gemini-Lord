import CONFIG from "../config/config.js";

async function generateQuiz() {
  const API_URL = `${CONFIG.API_URL}?key=${CONFIG.API_KEY}`;
  const prompt = document.getElementById("prompt").value.trim();
  const questionCount = document.getElementById("question-count").value;
  const language = document.getElementById("language").value;
  const difficulty = document.getElementById("difficulty").value;
  const quizContainer = document.getElementById("quiz-container");
  quizContainer.style.display = "none";
  quizContainer.innerHTML = "";

  if (!prompt) {
    showPopup("Please enter a topic!", "warning");
    return;
  }

  showPopup("Generating quiz...", "loading");

  const basePrompt = `
    Hãy tạo ${questionCount} câu hỏi trắc nghiệm bằng ngôn ngữ ${language} có độ khó ${difficulty} với chủ đề: "${prompt}".
    Mỗi câu hỏi cần có 4 phương án ABCD và hãy đảo vị trí của đáp án đúng. Định dạng JSON như sau:
    [
      {
        "question": "Sự kiện nào đánh dấu mốc quan trọng trong quá trình kết thúc chiến tranh ở Việt Nam sau năm 1975?",
        "options": ["Hiệp định Paris 1973", "Chiến dịch Hồ Chí Minh 1975", "Chiến dịch Điện Biên Phủ 1954", "Hiệp định Genève 1954"],
        "correct_answer": "Chiến dịch Hồ Chí Minh 1975"
      },
      ...
    ]
    Chỉ trả về JSON, không có giải thích gì thêm.
  `;

  const requestBody = {
    contents: [{ parts: [{ text: basePrompt }] }],
  };

  document.getElementById("quiz-container").style.display = "flex";
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      const rawText = data.candidates[0].content.parts[0].text;
      const cleanText = rawText.replace(/\*\*/g, "").trim();
      const jsonMatch = cleanText.match(/```json\n([\s\S]+)\n```/);

      if (jsonMatch) {
        const jsonString = jsonMatch[1];
        let quizData = JSON.parse(jsonString);
        const quizId = Date.now();

        quizContainer.innerHTML = "";
        quizContainer.dataset.quizId = quizId;

        const sanitizedQuiz = quizData.map((q) => ({
          question: escapeHTML(q.question),
          options: q.options.map(escapeHTML),
          correct_answer: escapeHTML(q.correct_answer),
        }));

        sanitizedQuiz.forEach((q, index) =>
          displayQuiz(q, index, sanitizedQuiz.length, quizId)
        );

        let quizList = JSON.parse(localStorage.getItem("quizQuestions")) || [];
        quizList.push({ id: quizId, title: prompt, questions: sanitizedQuiz });
        localStorage.setItem("quizQuestions", JSON.stringify(quizList));

        displaySavedQuizzes(true);
        loadQuizProgress(quizId);
        showPopup("Quiz generated successfully!", "success", () => {
          quizContainer.style.display = "flex";
          quizContainer.scrollIntoView({ behavior: "smooth" });
          document.getElementById("quiz-popup").style.display = "none";
        });
        
      } else {
        showPopup("Response is not in the right format!", "error");
      }
    } else {
      showPopup("Cannot generate quiz!", "error");
    }
  } catch (error) {
    showPopup("API Error!", "error");
  }
}

function showPopup(message, type = "info", callback = null) {
  const popup = document.getElementById("alert-popup");
  const popupContent = document.getElementById("alert-popup-content");
  const popupIcon = document.getElementById("alert-popup-icon");

  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    loading: "⏳",
    info: "ℹ️",
  };

  popupIcon.textContent = icons[type] || "ℹ️";
  popupContent.textContent = message;
  popup.style.display = "flex";

  if (type === "loading") return;

  setTimeout(() => {
    popup.style.display = "none";
    if (callback) callback();
  }, 1200);
}

function displayQuiz(
  questionObj,
  index,
  totalQuestions,
  quizId,
  isSavedQuiz = false
) {
  const quizContainer = document.getElementById("quiz-container");

  const quizItem = document.createElement("div");
  quizItem.classList.add("quiz-item");
  quizItem.dataset.correctAnswer = questionObj.correct_answer;
  quizItem.innerHTML = `<h4>${index + 1}. ${questionObj.question}</h4>`;
  questionObj.options.forEach((option, i) => {
    const optionLabel = String.fromCharCode(65 + i);
    const inputId = `question${index}-${i}-${quizId}`;

    quizItem.innerHTML += `
          <label for="${inputId}">
              <input type="radio" id="${inputId}" name="question${index}" value="${option}" disabled>
              ${optionLabel}. ${option}
          </label>`;
  });

  quizContainer.appendChild(quizItem);

  if (index === totalQuestions - 1) {
    setTimeout(() => loadQuizProgress(quizId), 100);
  }
  if (!isSavedQuiz && index === totalQuestions - 1) {
    const buttonContainer = document.createElement("div");
    buttonContainer.id = "quiz-buttons-container";

    const regenerateButton = document.createElement("button");
    regenerateButton.id = "re-generate-quiz";
    regenerateButton.textContent = "Re-generate";
    regenerateButton.onclick = () => {
      let savedQuizzes =
        JSON.parse(localStorage.getItem("quizQuestions")) || [];
      savedQuizzes = savedQuizzes.filter((quiz) => quiz.id != quizId);
      localStorage.setItem("quizQuestions", JSON.stringify(savedQuizzes));
      document.getElementById("quiz-container").innerHTML = "";
      generateQuiz();
    };

    const confirmButton = document.createElement("button");
    confirmButton.id = "confirm-quiz";
    confirmButton.textContent = "Confirm";
    confirmButton.onclick = enableQuiz;

    buttonContainer.appendChild(regenerateButton);
    buttonContainer.appendChild(confirmButton);
    quizContainer.appendChild(buttonContainer);
  }
  quizContainer.addEventListener("change", () => saveQuizProgress(quizId));
}

function escapeHTML(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function enableQuiz() {
  document.getElementById("quiz-container").style.display = "flex";
  const quizContainer = document.getElementById("quiz-container");

  document.querySelectorAll(".quiz-item label").forEach((label) => {
    label.style.color = "";
    label.style.fontWeight = "";
    label.classList.remove("correct-answer");
  });

  document.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = false;
    input.checked = false;
    input.addEventListener("change", saveQuizProgress);
  });

  const resultContainer = document.getElementById("quiz-results");
  if (resultContainer) {
    resultContainer.innerHTML = "";
  }

  const quizButtons = document.getElementById("quiz-buttons-container");
  if (quizButtons) {
    quizButtons.remove();
  }

  const quizId = document.getElementById("quiz-container").dataset.quizId;

  const storedTime = localStorage.getItem(`quizTime_${quizId}`);
  const resetTime = storedTime === null;

  startCountdown(quizId, resetTime);

  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("quiz-buttons-container");

  const retryButton = document.createElement("button");
  retryButton.id = "retry-quiz";
  retryButton.textContent = "Retry this quiz";
  retryButton.onclick = () => {
    enableQuiz();
  };
  buttonContainer.appendChild(retryButton);

  const popupContainer = document.getElementById("quiz-container");
  popupContainer.style.display = "flex";

  if (!document.getElementById("submit-quiz")) {
    const submitButton = document.createElement("button");
    submitButton.id = "submit-quiz";
    submitButton.textContent = "Grade";
    submitButton.onclick = gradeQuiz;

    const resultContainer = document.createElement("div");
    resultContainer.id = "quiz-results";
    resultContainer.style.marginTop = "20px";
    resultContainer.style.fontWeight = "bold";
    buttonContainer.appendChild(submitButton);
    quizContainer.appendChild(buttonContainer);
    quizContainer.appendChild(resultContainer);
  }

  const closeButton = document.createElement("button");
  closeButton.id = "quiz-close";
  closeButton.textContent = "Close";
  closeButton.onclick = () => {
    popupContainer.style.display = "none";
    stopCountdown();
  };
  buttonContainer.appendChild(closeButton);
  
}

function disableQuiz() {
  document.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = true;
  });
}

function saveQuizProgress() {
  const quizContainer = document.getElementById("quiz-container");
  const quizId = quizContainer.dataset.quizId;
  if (!quizId) {
    return;
  }

  let progress = JSON.parse(localStorage.getItem("quizProgress")) || {};
  progress[quizId] = {};

  document.querySelectorAll(".quiz-item").forEach((quizItem, index) => {
    const selectedOption = document.querySelector(
      `input[name='question${index}']:checked`
    );
    if (selectedOption) {
      progress[quizId][`question${index}`] = selectedOption.value;
    }
  });
  localStorage.setItem("quizProgress", JSON.stringify(progress));
}

function loadQuizProgress() {
  const quizContainer = document.getElementById("quiz-container");
  const quizId = quizContainer.dataset.quizId;
  if (!quizId) {
    return;
  }

  let progress = JSON.parse(localStorage.getItem("quizProgress")) || {};
  if (!progress[quizId]) return;

  document.querySelectorAll(".quiz-item").forEach((quizItem, index) => {
    const savedAnswer = progress[quizId][`question${index}`];
    if (savedAnswer) {
      const escapedAnswer = CSS.escape(savedAnswer);
      const inputToCheck = quizItem.querySelector(
        `input[value='${escapedAnswer}']`
      );
      if (inputToCheck) {
        inputToCheck.checked = true;
      }
    }
  });
}

function displaySavedQuizzes(keepVisible = false) {
  const savedQuizWrapper = document.getElementById("saved-quiz-wrapper");
  const savedQuizContainer = document.getElementById("saved-quiz-container");
  const quizContainer = document.getElementById("quiz-container");
  quizContainer.style.display = "none";
  if (!savedQuizContainer) return;

  const savedQuizzes = JSON.parse(localStorage.getItem("quizQuestions")) || [];

  if (!keepVisible && savedQuizWrapper.style.display === "block") {
    savedQuizWrapper.style.display = "none";
    quizContainer.innerHTML = "";
    return;
  }

  savedQuizWrapper.style.display = "block";
  savedQuizContainer.innerHTML = "";
  document.getElementById("quiz-container").style.display = "none";

  if (savedQuizzes.length === 0) {
    showPopup("Empty quiz!", "error")
    return;
  }

  savedQuizzes.forEach((quizEntry, index) => {
    const quizItem = document.createElement("div");
    quizItem.classList.add("quiz-card");
    quizItem.innerHTML = `
        <div class="quiz-title">${quizEntry.title}</div>
        <p class="quiz-info">Questions: ${quizEntry.questions.length}</p>
        <div class="quiz-actions">
          <button class="play-btn" onclick="stopCountdown(); viewSavedQuiz(${index})">▶ Play</button>
          <button class="delete-btn" onclick="deleteSavedQuiz(${index})">🗑 Delete</button>
        </div>
      `;
    savedQuizContainer.appendChild(quizItem);
  });
}

function gradeQuiz() {
  const quizContainer = document.getElementById("quiz-container");
  const quizId = quizContainer.dataset.quizId;

  if (!quizId) {
    return;
  }

  clearInterval(timer);
  localStorage.removeItem(`quizTime_${quizId}`);

  let score = 0;
  let totalQuestions = document.querySelectorAll(".quiz-item").length;

  document.querySelectorAll(".quiz-item").forEach((quizItem, index) => {
    const selectedOption = document.querySelector(
      `input[name='question${index}']:checked`
    );
    const correctAnswer = quizItem.dataset.correctAnswer;

    if (selectedOption) {
      if (selectedOption.value === correctAnswer) {
        score++;
        selectedOption.parentElement.style.color = "green";
      } else {
        selectedOption.parentElement.style.color = "red";
      }
    }

    let correctLabel = quizItem.querySelector(
      `input[value='${correctAnswer}']`
    );
    if (correctLabel) {
      correctLabel.parentElement.classList.add("correct-answer");
    }
  });

  let resultContainer = document.getElementById("quiz-results");
  if (!resultContainer) {
    resultContainer = document.createElement("div");
    resultContainer.id = "quiz-results";
    quizContainer.appendChild(resultContainer);
  }
  resultContainer.textContent = `You have correct ${score}/${totalQuestions} answer.`;

  disableQuiz();
  let quizProgress = JSON.parse(localStorage.getItem("quizProgress")) || {};
  delete quizProgress[quizId];
  localStorage.setItem("quizProgress", JSON.stringify(quizProgress));
}

function viewSavedQuiz(index) {
  const savedQuizzes = JSON.parse(localStorage.getItem("quizQuestions")) || [];
  const quizData = savedQuizzes[index];

  if (!quizData) {
    showPopup("Cannot find quiz!", "error");
    return;
  }

  document.getElementById("quiz-container").style.display = "flex";
  const quizContainer = document.getElementById("quiz-container");
  quizContainer.dataset.quizId = quizData.id;
  quizContainer.innerHTML = `<h3>${quizData.title}</h3>`;

  quizData.questions.forEach((q, idx) => {
    displayQuiz(q, idx, quizData.questions.length, true);
  });

  loadQuizProgress(quizData.id);

  document.getElementById("quiz-buttons-container")?.remove();
  document.getElementById("submit-quiz")?.remove();
  document.getElementById("retry-quiz")?.remove();
  document.getElementById("quiz-close")?.remove();

  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("quiz-buttons-container");

  const retryButton = document.createElement("button");
  retryButton.id = "retry-quiz";
  retryButton.textContent = "Retry this quiz";
  retryButton.onclick = () => {
    viewSavedQuiz(index);
    enableQuiz();
    startCountdown(quizData.id);
  };
  buttonContainer.appendChild(retryButton);

  const submitButton = document.createElement("button");
  submitButton.id = "submit-quiz";
  submitButton.textContent = "Grade";
  submitButton.onclick = gradeQuiz;
  buttonContainer.appendChild(submitButton);

  const popupContainer = document.getElementById("quiz-container");
  popupContainer.style.display = "flex";
  const closeButton = document.createElement("button");
  closeButton.id = "quiz-close";
  closeButton.textContent = "Close";
  closeButton.onclick = () => {
    popupContainer.style.display = "none";
    stopCountdown();
  };
  buttonContainer.appendChild(closeButton);
  quizContainer.appendChild(buttonContainer);
  quizContainer.style.display = "flex";
  quizContainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

let timer;
function startCountdown(quizId, resetTimer = false) {
  let timeLeft = resetTimer
    ? 600
    : localStorage.getItem(`quizTime_${quizId}`) || 600; // 10 phút mặc định

  const timerElement = document.getElementById("quiz-timer");
  if (!timerElement) {
    const newTimerElement = document.createElement("div");
    newTimerElement.id = "quiz-timer";
    newTimerElement.style.fontSize = "18px";
    newTimerElement.style.fontWeight = "bold";
    newTimerElement.style.color = "red";
    document.getElementById("quiz-container").prepend(newTimerElement);
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById(
      "quiz-timer"
    ).textContent = `Time Left: ${minutes}:${
      seconds < 10 ? "0" : ""
    }${seconds}`;
  }

  updateTimerDisplay();
  clearInterval(timer);

  timer = setInterval(() => {
    timeLeft--;
    localStorage.setItem(`quizTime_${quizId}`, timeLeft);
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timer);
      gradeQuiz();
    }
  }, 1000);
}

function stopCountdown() {
  clearInterval(timer);
}

function deleteSavedQuiz(index) {
  let savedQuizzes = JSON.parse(localStorage.getItem("quizQuestions")) || [];
  let quizProgress = JSON.parse(localStorage.getItem("quizProgress")) || {};

  if (index >= 0 && index < savedQuizzes.length) {
    const quizId = savedQuizzes[index].id;
    savedQuizzes.splice(index, 1);

    if (quizId) {
      delete quizProgress[quizId];
      localStorage.removeItem(`quizTime_${quizId}`);
    }
    const popupContainer = document.getElementById("quiz-container");
    popupContainer.style.display = "none";
    localStorage.setItem("quizQuestions", JSON.stringify(savedQuizzes));
    localStorage.setItem("quizProgress", JSON.stringify(quizProgress));
  }
  displaySavedQuizzes(true);
}

function clearStorage() {
  const popup = document.getElementById("confirm-popup");
  const popupContent = document.getElementById("popup-content");

  popup.style.display = "flex";
  popupContent.innerHTML = `
    <p>⚠ Are you sure you want to delete all saved quizzes?</p>
    <button id="confirm-yes">Yes</button>
    <button id="confirm-no">No</button>
  `;

  document.getElementById("confirm-yes").onclick = function () {
    localStorage.clear();
    displaySavedQuizzes();
    popupContent.innerHTML = `
      <p>✅ All saved quizzes and progress have been deleted.</p>
      <button id="close-popup">OK</button>
    `;

    document.getElementById("close-popup").onclick = function () {
      popup.style.display = "none";
    };
  };

  document.getElementById("confirm-no").onclick = function () {
    popup.style.display = "none";
  };
}

window.generateQuiz = generateQuiz;
window.displayQuiz = displayQuiz;
window.enableQuiz = enableQuiz;
window.disableQuiz = disableQuiz;
window.loadQuizProgress = loadQuizProgress;
window.saveQuizProgress = saveQuizProgress;
window.displaySavedQuizzes = displaySavedQuizzes;
window.gradeQuiz = gradeQuiz;
window.viewSavedQuiz = viewSavedQuiz;
window.deleteSavedQuiz = deleteSavedQuiz;
window.clearStorage = clearStorage;
window.stopCountdown = stopCountdown;
document.addEventListener("DOMContentLoaded", displaySavedQuizzes);
