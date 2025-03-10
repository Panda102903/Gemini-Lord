import CONFIG from "../config/config.js";

//Tạo quiz
async function generateQuiz() {
  const API_URL = `${CONFIG.API_URL}?key=${CONFIG.API_KEY}`;
  const prompt = document.getElementById("prompt").value.trim();
  const questionCount = document.getElementById("question-count").value;
  const language = document.getElementById("language").value;
  const difficulty = document.getElementById("difficulty").value;

  document.getElementById("quiz-popup").style.display = "none";

  if (!prompt) {
    alert("⚠️ Vui lòng nhập chủ đề!");
    return;
  }

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
  document.getElementById("quiz-popup-container").style.display = "flex";
  document.getElementById("quiz-container").innerHTML =
    "Đang tạo câu hỏi... ⏳";
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
        console.log("Quiz nhận được:", quizData);
        const quizId = Date.now();

        const quizContainer = document.getElementById("quiz-container");
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
      } else {
        console.error("Lỗi: API không trả về JSON hợp lệ!");
        document.getElementById("quiz-container").innerText =
          "API trả về dữ liệu không đúng định dạng!";
      }
    } else {
      document.getElementById("quiz-container").innerText =
        "❌ Không thể tạo câu hỏi!";
    }
  } catch (error) {
    console.error("Lỗi API:", error);
    document.getElementById("quiz-container").innerText = "❌ Lỗi khi gọi API!";
  }
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

// Hiển thị quiz
function displayQuiz(
  questionObj,
  index,
  totalQuestions,
  quizId,
  isSavedQuiz = false
) {
  const quizContainer = document.getElementById("quiz-container");

  // Quiz item
  const quizItem = document.createElement("div");
  quizItem.classList.add("quiz-item");
  quizItem.dataset.correctAnswer = questionObj.correct_answer;
  quizItem.innerHTML = `<h4>${index + 1}. ${questionObj.question}</h4>`;

  // Đáp án
  questionObj.options.forEach((option, i) => {
    const optionLabel = String.fromCharCode(65 + i); // A, B, C, D
    const inputId = `question${index}-${i}-${quizId}`; // Đảm bảo ID là duy nhất

    quizItem.innerHTML += `
          <label for="${inputId}">
              <input type="radio" id="${inputId}" name="question${index}" value="${option}" disabled>
              ${optionLabel}. ${option}
          </label><br>`;
  });

  quizContainer.appendChild(quizItem);

  if (index === totalQuestions - 1) {
    setTimeout(() => loadQuizProgress(quizId), 100);
  }
  //Nếu không phải quiz mới generate, không hiển thị Re-generate và Confirm
  // => chỉ hiển thị nút "Làm lại Quiz này" và "Nộp bài"
  if (!isSavedQuiz && index === totalQuestions - 1) {
    const buttonContainer = document.createElement("div");
    buttonContainer.id = "quiz-buttons";

    //Re-generate feature => delete quiz mới tạo và tạo quiz mới
    const regenerateButton = document.createElement("button");
    regenerateButton.textContent = "Re-generate";
    regenerateButton.onclick = () => {
      let savedQuizzes =
        JSON.parse(localStorage.getItem("quizQuestions")) || [];
      savedQuizzes = savedQuizzes.filter((quiz) => quiz.id != quizId);
      localStorage.setItem("quizQuestions", JSON.stringify(savedQuizzes));
      document.getElementById("quiz-container").innerHTML = "";
      generateQuiz();
    };

    //Confirm feature => enable quiz
    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Confirm";
    confirmButton.onclick = enableQuiz;

    buttonContainer.appendChild(regenerateButton);
    buttonContainer.appendChild(confirmButton);
    quizContainer.appendChild(buttonContainer);
  }
  // Lưu tiến trình mỗi khi có sự thay đổi lựa chọn
  quizContainer.addEventListener("change", () => saveQuizProgress(quizId));
}

//Lưu tiến trình làm bài
function saveQuizProgress() {
  const quizContainer = document.getElementById("quiz-container");
  const quizId = quizContainer.dataset.quizId; // ✅ Lấy Quiz ID từ dataset
  if (!quizId) {
    console.error("❌ Lỗi: Không tìm thấy quizId khi lưu tiến trình!");
    return;
  }

  let progress = JSON.parse(localStorage.getItem("quizProgress")) || {};
  progress[quizId] = {}; // ✅ Tạo object riêng cho quizId

  document.querySelectorAll(".quiz-item").forEach((quizItem, index) => {
    const selectedOption = document.querySelector(
      `input[name='question${index}']:checked`
    );
    if (selectedOption) {
      progress[quizId][`question${index}`] = selectedOption.value;
    }
  });

  localStorage.setItem("quizProgress", JSON.stringify(progress));
  console.log(`✅ Tiến trình của Quiz ${quizId} đã được lưu:`, progress);
}

//Khôi phục tiến trình làm bài
function loadQuizProgress() {
  const quizContainer = document.getElementById("quiz-container");
  const quizId = quizContainer.dataset.quizId; // ✅ Lấy Quiz ID từ dataset
  if (!quizId) {
    console.error("❌ Lỗi: Không tìm thấy quizId khi tải tiến trình!");
    return;
  }

  let progress = JSON.parse(localStorage.getItem("quizProgress")) || {};
  if (!progress[quizId]) return; // ✅ Nếu không có tiến trình nào cho quizId thì thoát luôn

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

  console.log(
    `✅ Tiến trình của Quiz ${quizId} đã được tải:`,
    progress[quizId]
  );
}

// Kích hoạt quiz
function enableQuiz() {
  document.querySelectorAll(".quiz-item label").forEach((label) => {
    label.style.color = "";
    label.style.fontWeight = "";
  });
  document.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = false;
    input.checked = false;
    input.addEventListener("change", saveQuizProgress); // Lưu mỗi khi chọn đáp án
  });

  const quizButtons = document.getElementById("quiz-buttons");
  if (quizButtons) {
    quizButtons.remove();
  }

  // Tạo nút "Làm lại Quiz này"
  const retryButton = document.createElement("button");
  retryButton.id = "retry-quiz";
  retryButton.textContent = "Làm lại Quiz này";
  retryButton.onclick = () => {
    enableQuiz(); // Cho phép làm lại bài quiz
  };

  //Issues: Khi bấm vào nút "Làm lại Quiz này" thì nút "Nộp bài" sẽ bị tạo lại
  //Solve: Kiểm tra nếu nút "Nộp bài" đã tồn tại thì không tạo lại
  if (!document.getElementById("submit-quiz")) {
    const submitButton = document.createElement("button");
    submitButton.id = "submit-quiz";
    submitButton.textContent = "Nộp bài";
    submitButton.onclick = gradeQuiz;
    const resultContainer = document.createElement("div");
    resultContainer.id = "quiz-results";
    resultContainer.style.marginTop = "20px";
    resultContainer.style.fontWeight = "bold";

    document.getElementById("quiz-container").appendChild(submitButton);
    document.getElementById("quiz-container").appendChild(retryButton);
    document.getElementById("quiz-container").appendChild(resultContainer);
  }
}

// Vô hiệu hóa quiz
function disableQuiz() {
  document.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = true;
  });
}

// Kiểm tra kết quả quiz
function gradeQuiz() {
  const quizContainer = document.getElementById("quiz-container");
  const quizId = quizContainer.dataset.quizId; // ✅ Lấy ID của quiz

  if (!quizId) {
    console.error("❌ Lỗi: Không xác định được ID của quiz.");
    return;
  }

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
        selectedOption.parentElement.style.color = "green"; // ✅ Đúng => xanh
      } else {
        selectedOption.parentElement.style.color = "red"; // ❌ Sai => đỏ
      }
    }
  });

  let resultContainer = document.getElementById("quiz-results");
  disableQuiz();

  if (!resultContainer) {
    resultContainer = document.createElement("div");
    resultContainer.id = "quiz-results";
    quizContainer.appendChild(resultContainer);
  }
  resultContainer.textContent = `Bạn đã trả lời đúng ${score}/${totalQuestions} câu.`;

  let quizProgress = JSON.parse(localStorage.getItem("quizProgress")) || {};
  delete quizProgress[quizId];
  localStorage.setItem("quizProgress", JSON.stringify(quizProgress));
}

// Hiển thị danh sách quiz đã lưu
function displaySavedQuizzes(keepVisible = false) {
  const savedQuizWrapper = document.getElementById("saved-quiz-wrapper");
  const savedQuizContainer = document.getElementById("saved-quiz-container");
  const quizContainer = document.getElementById("quiz-container");

  if (!savedQuizContainer) return;

  const savedQuizzes = JSON.parse(localStorage.getItem("quizQuestions")) || [];

  // Nếu danh sách đang hiển thị và không yêu cầu giữ nguyên, thì ẩn đi
  if (!keepVisible && savedQuizWrapper.style.display === "block") {
    savedQuizWrapper.style.display = "none";
    quizContainer.innerHTML = ""; // Ẩn luôn phần viewSavedQuiz
    return;
  }

  // Hiển thị phần chứa danh sách quiz
  savedQuizWrapper.style.display = "block";
  savedQuizContainer.innerHTML = ""; // Xóa nội dung cũ

  if (savedQuizzes.length === 0) {
    savedQuizContainer.innerHTML = "<p>Không có quiz nào được lưu!</p>";
    return;
  }

  savedQuizzes.forEach((quizEntry, index) => {
    const quizItem = document.createElement("div");
    quizItem.classList.add("quiz-card");
    quizItem.innerHTML = `
      <div class="quiz-title">${quizEntry.title}</div>
      <p class="quiz-info">Questions: ${quizEntry.questions.length}</p>
      <div class="quiz-actions">
        <button class="play-btn" onclick="viewSavedQuiz(${index})">▶ Play</button>
        <button class="delete-btn" onclick="deleteSavedQuiz(${index})">🗑 Delete</button>
      </div>
    `;
    savedQuizContainer.appendChild(quizItem);
  });
}

//Xem từng quiz đã lưu
function viewSavedQuiz(index) {
  const savedQuizzes = JSON.parse(localStorage.getItem("quizQuestions")) || [];
  const quizData = savedQuizzes[index];

  if (!quizData) {
    alert("❌ Không tìm thấy quiz!");
    return;
  }

  document.getElementById("quiz-popup-container").style.display = "flex";
  const quizContainer = document.getElementById("quiz-container");
  quizContainer.dataset.quizId = quizData.id; // ✅ Đặt ID cho Quiz đang xem
  quizContainer.innerHTML = `<h3>${quizData.title}</h3>`;

  quizData.questions.forEach((q, idx) => {
    displayQuiz(q, idx, quizData.questions.length, true);
  });

  loadQuizProgress(quizData.id); // ✅ Tải đúng tiến trình
  // Xóa các nút cũ để tránh trùng lặp
  document.getElementById("quiz-buttons")?.remove();
  document.getElementById("submit-quiz")?.remove();
  document.getElementById("retry-quiz")?.remove();

  // Thêm nút "Làm lại Quiz này"
  const retryButton = document.createElement("button");
  retryButton.id = "retry-quiz";
  retryButton.textContent = "Làm lại Quiz này";
  retryButton.onclick = () => {
    viewSavedQuiz(index);
    enableQuiz();
  };
  quizContainer.appendChild(retryButton);

  // Thêm nút "Nộp bài"
  const submitButton = document.createElement("button");
  submitButton.id = "submit-quiz";
  submitButton.textContent = "Nộp bài";
  submitButton.onclick = gradeQuiz;
  quizContainer.appendChild(submitButton);
}

//Xóa từng quiz đã lưu
function deleteSavedQuiz(index) {
  let savedQuizzes = JSON.parse(localStorage.getItem("quizQuestions")) || [];
  let quizProgress = JSON.parse(localStorage.getItem("quizProgress")) || {};

  if (index >= 0 && index < savedQuizzes.length) {
    const quizId = savedQuizzes[index].id; // ✅ Lấy quizId của quiz cần xóa
    savedQuizzes.splice(index, 1); // ✅ Xóa Quiz khỏi danh sách

    // 📌 Xóa tiến trình của Quiz nếu có
    if (quizId && quizProgress[quizId]) {
      delete quizProgress[quizId];
      localStorage.setItem("quizProgress", JSON.stringify(quizProgress));
      console.log(`✅ Đã xóa tiến trình của Quiz ID: ${quizId}`);
    }

    // 📌 Cập nhật lại danh sách quiz
    localStorage.setItem("quizQuestions", JSON.stringify(savedQuizzes));
  }

  displaySavedQuizzes(true); // ✅ Cập nhật danh sách quiz
}

// Xóa dữ liệu trong Local Storage
function clearStorage() {
  if (confirm("Bạn có chắc chắn muốn xóa tất cả các quiz đã lưu?")) {
    localStorage.removeItem("quizQuestions");
    localStorage.removeItem("quizProgress");
    displaySavedQuizzes();
  }
}

window.loadQuizProgress = loadQuizProgress;
window.saveQuizProgress = saveQuizProgress;
window.clearStorage = clearStorage;
window.generateQuiz = generateQuiz;
window.displaySavedQuizzes = displaySavedQuizzes;
window.displayQuiz = displayQuiz;
window.enableQuiz = enableQuiz;
window.gradeQuiz = gradeQuiz;
window.viewSavedQuiz = viewSavedQuiz;
window.deleteSavedQuiz = deleteSavedQuiz;
window.disableQuiz = disableQuiz;
document.addEventListener("DOMContentLoaded", displaySavedQuizzes);
