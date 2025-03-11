import CONFIG from '../config/config.js'

async function generateQuiz() {
  const API_URL = `${CONFIG.API_URL}?key=${CONFIG.API_KEY}`
  const prompt = document.getElementById('prompt').value.trim()
  const questionCount = document.getElementById('question-count').value
  const language = document.getElementById('language').value
  const difficulty = document.getElementById('difficulty').value

  document.getElementById('quiz-popup').style.display = 'none'

  if (!prompt) {
    alert('⚠️Please enter a topic!')
    return
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
    `

  const requestBody = {
    contents: [{ parts: [{ text: basePrompt }] }]
  }
  document.getElementById('quiz-popup-container').style.display = 'flex'
  document.getElementById('quiz-container').innerHTML = 'Generate quiz..... ⏳'
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (data.candidates && data.candidates.length > 0) {
      const rawText = data.candidates[0].content.parts[0].text
      const cleanText = rawText.replace(/\*\*/g, '').trim()
      const jsonMatch = cleanText.match(/```json\n([\s\S]+)\n```/)

      if (jsonMatch) {
        const jsonString = jsonMatch[1]
        let quizData = JSON.parse(jsonString)
        const quizId = Date.now()

        const quizContainer = document.getElementById('quiz-container')
        quizContainer.innerHTML = ''
        quizContainer.dataset.quizId = quizId

        const sanitizedQuiz = quizData.map((q) => ({
          question: escapeHTML(q.question),
          options: q.options.map(escapeHTML),
          correct_answer: escapeHTML(q.correct_answer)
        }))

        sanitizedQuiz.forEach((q, index) => displayQuiz(q, index, sanitizedQuiz.length, quizId))

        let quizList = JSON.parse(localStorage.getItem('quizQuestions')) || []
        quizList.push({ id: quizId, title: prompt, questions: sanitizedQuiz })
        localStorage.setItem('quizQuestions', JSON.stringify(quizList))
        displaySavedQuizzes(true);
        loadQuizProgress(quizId);

      } else {
        document.getElementById('quiz-container').innerText = 'Response is not in the right format!'
      }
    } else {
      document.getElementById('quiz-container').innerText = '❌ Cannot generate quiz!'
    }
  } catch (error) {
    document.getElementById('quiz-container').innerText = '❌ API Error!'
  }
}

function displayQuiz(questionObj, index, totalQuestions, quizId, isSavedQuiz = false) {
  const quizContainer = document.getElementById('quiz-container')

  const quizItem = document.createElement('div')
  quizItem.classList.add('quiz-item')
  quizItem.dataset.correctAnswer = questionObj.correct_answer
  quizItem.innerHTML = `<h4>${index + 1}. ${questionObj.question}</h4>`
  questionObj.options.forEach((option, i) => {
    const optionLabel = String.fromCharCode(65 + i)
    const inputId = `question${index}-${i}-${quizId}`

    quizItem.innerHTML += `
          <label for="${inputId}">
              <input type="radio" id="${inputId}" name="question${index}" value="${option}" disabled>
              ${optionLabel}. ${option}
          </label>`
  })

  quizContainer.appendChild(quizItem)

  if (index === totalQuestions - 1) {
    setTimeout(() => loadQuizProgress(quizId), 100)
  }
  if (!isSavedQuiz && index === totalQuestions - 1) {
    const buttonContainer = document.createElement('div')
    buttonContainer.id = 'quiz-buttons'

    const regenerateButton = document.createElement('button')
    regenerateButton.textContent = 'Re-generate'
    regenerateButton.onclick = () => {
      let savedQuizzes = JSON.parse(localStorage.getItem('quizQuestions')) || []
      savedQuizzes = savedQuizzes.filter((quiz) => quiz.id != quizId)
      localStorage.setItem('quizQuestions', JSON.stringify(savedQuizzes))
      document.getElementById('quiz-container').innerHTML = ''
      generateQuiz()
    }

    const confirmButton = document.createElement('button')
    confirmButton.textContent = 'Confirm'
    confirmButton.onclick = enableQuiz

    buttonContainer.appendChild(regenerateButton)
    buttonContainer.appendChild(confirmButton)
    quizContainer.appendChild(buttonContainer)
  }
  quizContainer.addEventListener('change', () => saveQuizProgress(quizId))
}

function escapeHTML(text) {
  if (typeof text !== 'string') return text
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function enableQuiz() {
  document.querySelectorAll('.quiz-item label').forEach((label) => {
    label.style.color = ''
    label.style.fontWeight = ''
    label.classList.remove('correct-answer')
  })
  document.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = false
    input.checked = false
    input.addEventListener('change', saveQuizProgress)
  })

  const resultContainer = document.getElementById('quiz-results');
  if (resultContainer) {
    resultContainer.innerHTML = '';
  }

  const quizButtons = document.getElementById('quiz-buttons')
  if (quizButtons) {
    quizButtons.remove()
  }

  const retryButton = document.createElement('button')
  retryButton.id = 'retry-quiz'
  retryButton.textContent = 'Retry this quiz'
  retryButton.onclick = () => {
    enableQuiz()
  }

  const popupContainer = document.getElementById('quiz-popup-container')
  popupContainer.style.display = 'flex'
  const closeButton = document.createElement('button')
  closeButton.id = 'quiz-popup-close'
  closeButton.textContent = 'Close'
  closeButton.onclick = () => {
    popupContainer.style.display = "none"
  }
  

  if (!document.getElementById('submit-quiz')) {
    const submitButton = document.createElement('button')
    submitButton.id = 'submit-quiz'
    submitButton.textContent = 'Grade'
    submitButton.onclick = gradeQuiz
    const resultContainer = document.createElement('div')
    resultContainer.id = 'quiz-results'
    resultContainer.style.marginTop = '20px'
    resultContainer.style.fontWeight = 'bold'

    document.getElementById('quiz-container').appendChild(submitButton)
    document.getElementById('quiz-container').appendChild(retryButton)
    document.getElementById('quiz-container').appendChild(closeButton)
    document.getElementById('quiz-container').appendChild(resultContainer)
  }
}

function disableQuiz() {
  document.querySelectorAll("input[type='radio']").forEach((input) => {
    input.disabled = true
  })
}

function saveQuizProgress() {
  const quizContainer = document.getElementById('quiz-container')
  const quizId = quizContainer.dataset.quizId
  if (!quizId) {
    return
  }

  let progress = JSON.parse(localStorage.getItem('quizProgress')) || {}
  progress[quizId] = {}

  document.querySelectorAll('.quiz-item').forEach((quizItem, index) => {
    const selectedOption = document.querySelector(`input[name='question${index}']:checked`)
    if (selectedOption) {
      progress[quizId][`question${index}`] = selectedOption.value
    }
  })
  localStorage.setItem('quizProgress', JSON.stringify(progress))
}

function loadQuizProgress() {
  const quizContainer = document.getElementById('quiz-container')
  const quizId = quizContainer.dataset.quizId
  if (!quizId) {
    return
  }

  let progress = JSON.parse(localStorage.getItem('quizProgress')) || {}
  if (!progress[quizId]) return

  document.querySelectorAll('.quiz-item').forEach((quizItem, index) => {
    const savedAnswer = progress[quizId][`question${index}`]
    if (savedAnswer) {
      const escapedAnswer = CSS.escape(savedAnswer)
      const inputToCheck = quizItem.querySelector(`input[value='${escapedAnswer}']`)
      if (inputToCheck) {
        inputToCheck.checked = true
      }
    }
  })
}

function displaySavedQuizzes(keepVisible = false) {
  const savedQuizWrapper = document.getElementById('saved-quiz-wrapper')
  const savedQuizContainer = document.getElementById('saved-quiz-container')
  const quizContainer = document.getElementById('quiz-container')

  if (!savedQuizContainer) return

  const savedQuizzes = JSON.parse(localStorage.getItem('quizQuestions')) || []

  if (!keepVisible && savedQuizWrapper.style.display === 'block') {
    savedQuizWrapper.style.display = 'none'
    quizContainer.innerHTML = ''
    return
  }

  savedQuizWrapper.style.display = 'block'
  savedQuizContainer.innerHTML = ''

  if (savedQuizzes.length === 0) {
    savedQuizContainer.innerHTML = '<p>Empty quiz!</p>'
    return
  }

  savedQuizzes.forEach((quizEntry, index) => {
    const quizItem = document.createElement('div')
    quizItem.classList.add('quiz-card')
    quizItem.innerHTML = `
      <div class="quiz-title">${quizEntry.title}</div>
      <p class="quiz-info">Questions: ${quizEntry.questions.length}</p>
      <div class="quiz-actions">
        <button class="play-btn" onclick="viewSavedQuiz(${index})">▶ Play</button>
        <button class="delete-btn" onclick="deleteSavedQuiz(${index})">🗑 Delete</button>
      </div>
    `
    savedQuizContainer.appendChild(quizItem)
  })
}

function gradeQuiz() {
  const quizContainer = document.getElementById('quiz-container')
  const quizId = quizContainer.dataset.quizId

  if (!quizId) {
    return
  }

  let score = 0
  let totalQuestions = document.querySelectorAll('.quiz-item').length

  document.querySelectorAll('.quiz-item').forEach((quizItem, index) => {
    const selectedOption = document.querySelector(`input[name='question${index}']:checked`)
    const correctAnswer = quizItem.dataset.correctAnswer

    if (selectedOption) {
      if (selectedOption.value === correctAnswer) {
        score++
        selectedOption.parentElement.style.color = 'green'
      } else {
        selectedOption.parentElement.style.color = 'red'
      }
    }

    let correctLabel = quizItem.querySelector(`input[value='${correctAnswer}']`)
    if (correctLabel) {
      correctLabel.parentElement.classList.add('correct-answer')
    }
  })

  let resultContainer = document.getElementById('quiz-results')
  disableQuiz()

  if (!resultContainer) {
    resultContainer = document.createElement('div')
    resultContainer.id = 'quiz-results'
    quizContainer.appendChild(resultContainer)
  }
  resultContainer.textContent = `You have correct ${score}/${totalQuestions} answer.`

  let quizProgress = JSON.parse(localStorage.getItem('quizProgress')) || {}
  delete quizProgress[quizId]
  localStorage.setItem('quizProgress', JSON.stringify(quizProgress))
}

function viewSavedQuiz(index) {
  const savedQuizzes = JSON.parse(localStorage.getItem('quizQuestions')) || []
  const quizData = savedQuizzes[index]

  if (!quizData) {
    alert('❌ Cannot find quiz!')
    return
  }

  document.getElementById('quiz-popup-container').style.display = 'flex'
  const quizContainer = document.getElementById('quiz-container')
  quizContainer.dataset.quizId = quizData.id
  quizContainer.innerHTML = `<h3>${quizData.title}</h3>`

  quizData.questions.forEach((q, idx) => {
    displayQuiz(q, idx, quizData.questions.length, true)
  })

  loadQuizProgress(quizData.id)
  document.getElementById('quiz-buttons')?.remove()
  document.getElementById('submit-quiz')?.remove()
  document.getElementById('retry-quiz')?.remove()
  document.getElementById('quiz-popup-close')?.remove()

  const retryButton = document.createElement('button')
  retryButton.id = 'retry-quiz'
  retryButton.textContent = 'Retry this quiz'
  retryButton.onclick = () => {
    viewSavedQuiz(index)
    enableQuiz()
  }
  quizContainer.appendChild(retryButton)

  const submitButton = document.createElement('button')
  submitButton.id = 'submit-quiz'
  submitButton.textContent = 'Grade'
  submitButton.onclick = gradeQuiz
  quizContainer.appendChild(submitButton)

  const popupContainer = document.getElementById('quiz-popup-container')
  popupContainer.style.display = 'flex'
  const closeButton = document.createElement('button')
  closeButton.id = 'quiz-popup-close'
  closeButton.textContent = 'Close'
  closeButton.onclick = () => {
    popupContainer.style.display = "none"
  }
  quizContainer.appendChild(closeButton)
}

function deleteSavedQuiz(index) {
  let savedQuizzes = JSON.parse(localStorage.getItem('quizQuestions')) || []
  let quizProgress = JSON.parse(localStorage.getItem('quizProgress')) || {}

  if (index >= 0 && index < savedQuizzes.length) {
    const quizId = savedQuizzes[index].id
    savedQuizzes.splice(index, 1)

    if (quizId && quizProgress[quizId]) {
      delete quizProgress[quizId]
      localStorage.setItem('quizProgress', JSON.stringify(quizProgress))
    }

    localStorage.setItem('quizQuestions', JSON.stringify(savedQuizzes))
  }

  displaySavedQuizzes(true)
}

function clearStorage() {
  if (confirm('Are you sure?')) {
    localStorage.removeItem('quizQuestions')
    localStorage.removeItem('quizProgress')
    displaySavedQuizzes()
  }
}

window.generateQuiz = generateQuiz
window.displayQuiz = displayQuiz
window.enableQuiz = enableQuiz
window.disableQuiz = disableQuiz
window.loadQuizProgress = loadQuizProgress
window.saveQuizProgress = saveQuizProgress
window.displaySavedQuizzes = displaySavedQuizzes
window.gradeQuiz = gradeQuiz
window.viewSavedQuiz = viewSavedQuiz
window.deleteSavedQuiz = deleteSavedQuiz
window.clearStorage = clearStorage
document.addEventListener("DOMContentLoaded", displaySavedQuizzes)