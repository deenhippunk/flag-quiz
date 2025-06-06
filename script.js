document.addEventListener('DOMContentLoaded', () => {
    const flagImageElement = document.getElementById('flag-image');
    const optionsContainerElement = document.getElementById('options-container');
    const levelScoreElement = document.getElementById('level-score');
    const feedbackElement = document.getElementById('feedback-area');
    const startNextButton = document.getElementById('start-next-button');
    const currentLevelElement = document.getElementById('current-level');
    const totalAccumulatedScoreElement = document.getElementById('total-accumulated-score');
    const resetLevelButton = document.getElementById('reset-level-button');
    const continueButton = document.getElementById('continue-button');
    const exitGameButton = document.getElementById('exit-game-button');
    const startNewGameButton = document.getElementById('start-new-game-button');

    const questionInfoElement = document.getElementById('question-info');
    const currentQuestionNumberElement = document.getElementById('current-question-number');
    const totalQuestionsInLevelElement = document.getElementById('total-questions-in-level');
    const questionLevelNumberElement = document.getElementById('question-level-number');
    const levelProgressStatsElement = document.getElementById('level-progress-stats');
    const correctInLevelCountElement = document.getElementById('correct-in-level-count');
    const totalUniqueQuestionsInLevelElement = document.getElementById('total-unique-questions-in-level');
    const levelProgressBarElement = document.getElementById('level-progress-bar');

    // For initial screen display
    const lastPlayedInfoElement = document.getElementById('last-played-info');
    const lastLevelElement = document.getElementById('last-level');
    const lastScoreElement = document.getElementById('last-score');
    const gameSubtitleElement = document.getElementById('game-subtitle');

    let allLoadedCountries = []; // All countries after initial load and shuffle
    let currentCorrectAnswer = null;

    let currentLevel = 0;
    let totalAccumulatedScore = 0;
    let levelScore = 0;
    // let questionsAnsweredInLevel = 0; // This tracks attempts, not essential for state restoration of question queue

    const QUESTIONS_PER_LEVEL = 10; // จำนวนคำถามต่อ Level
    const MIN_COUNTRIES_FOR_GAME = 4; // Minimum countries needed to start the game
    let gameActive = false;
    let maxLevels = 0;

    // State for current level progression with retries
    let countriesForCurrentLevelDefinition = []; // Static list of questions for the current level
    let questionsToAskInCurrentRound = []; // Questions to be asked in the current pass/round
    let incorrectlyAnsweredInCurrentRound = []; // Questions answered incorrectly in this round, to be re-asked
    let correctlyAnsweredInLevelOverall = new Set(); // countryCodes of questions answered correctly in this level (eventually)

    const GAME_STATE_KEY = 'flagQuizGameState';

    // ---- Game State Management (Local Storage) ----



    async function loadCountries() {
        try {
            const response = await fetch('data/country.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let countriesData = await response.json();
            // Filter out countries with no flag or no Thai/English name
            countriesData = countriesData.filter(country =>
                country.flagURL &&
                (country.countryNameTH || country.countryNameEN)
            );
            if (countriesData.length < MIN_COUNTRIES_FOR_GAME) {
                feedbackElement.textContent = `ข้อมูลประเทศไม่เพียงพอสำหรับเริ่มเกม (ต้องการอย่างน้อย ${MIN_COUNTRIES_FOR_GAME} ประเทศ)`;
                startNextButton.disabled = true;
                return;
            }
            allLoadedCountries = shuffleArray(countriesData); // Shuffle once for varied level progression
            maxLevels = Math.ceil(allLoadedCountries.length / QUESTIONS_PER_LEVEL);
            console.log('Country data loaded and shuffled:', allLoadedCountries.length, 'countries.', 'Max levels:', maxLevels);
            
            const savedState = loadGameState();
            if (savedState && savedState.currentLevel > 0) {
                lastLevelElement.textContent = savedState.currentLevel;
                lastScoreElement.textContent = savedState.totalAccumulatedScore;
                lastPlayedInfoElement.style.display = 'block';
                continueButton.style.display = 'inline-block';
                gameSubtitleElement.innerHTML = `พบข้อมูลการเล่นล่าสุด!`;
            } else {
                lastPlayedInfoElement.style.display = 'none';
                continueButton.style.display = 'none';
                gameSubtitleElement.innerHTML = 'มาทดสอบความรู้รอบโลกกันเถอะ!';
            }
            setupInitialScreenUI(); // Setup initial UI elements that don't depend on active game
        } catch (error) {
            console.error('Error loading country data:', error);
            feedbackElement.textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูลประเทศ';
            startNextButton.disabled = true;
        }
    }
    function startNewGame() { // Renamed from startGame to differentiate from resuming
        clearGameState();
        currentLevel = 0;
        totalAccumulatedScore = 0;
        levelScore = 0;
        // questionsAnsweredInLevel = 0;

        updateLevelDisplay();
        updateScoreDisplay(); // For level score
        updateTotalScoreDisplay();

        gameActive = false;
        // Hide initial screen elements, show game elements
        setGameScreenActive(true);
        startNextLevel();

    }

    function resumeGame(savedState) {
        allLoadedCountries = shuffleArray(allLoadedCountries); // Re-shuffle if needed or use a saved seed if implemented
        maxLevels = Math.ceil(allLoadedCountries.length / QUESTIONS_PER_LEVEL);

        currentLevel = savedState.currentLevel;
        totalAccumulatedScore = savedState.totalAccumulatedScore;

        if (savedState.activeLevelState) {
            levelScore = savedState.activeLevelState.levelScore;
            countriesForCurrentLevelDefinition = savedState.activeLevelState.countriesForCurrentLevelDefinition;
            questionsToAskInCurrentRound = savedState.activeLevelState.questionsToAskInCurrentRound;
            incorrectlyAnsweredInCurrentRound = savedState.activeLevelState.incorrectlyAnsweredInCurrentRound;
            correctlyAnsweredInLevelOverall = new Set(savedState.activeLevelState.correctlyAnsweredInLevelOverall || []);
            // questionsAnsweredInLevel = savedState.activeLevelState.questionsAnsweredInLevelDisplay || 0; // Not critical for queue restoration

            updateLevelDisplay();
            updateScoreDisplay();
            updateTotalScoreDisplay();
            updateLevelProgressDisplay();

            if (questionsToAskInCurrentRound.length > 0 || incorrectlyAnsweredInCurrentRound.length > 0) {
                 gameActive = true;
                 startNextButton.textContent = 'คำถามถัดไป';
                 resetLevelButton.style.display = 'inline-block';
                 resetLevelButton.disabled = false;
                 continueButton.style.display = 'none';
                 startNewGameButton.style.display = 'none';
                 exitGameButton.style.display = 'inline-block';
                 displayNextQuestion();
            } else { // Level was completed, but game was saved before moving to next
                endLevel(); // This will set up for next level or end game
            }
        } else {
            // Should not happen if savedState.currentLevel > 0, but as a fallback:
            startNewGame();

        }
    }

    function saveGameState() {
        const gameState = {
            currentLevel: currentLevel,
            totalAccumulatedScore: totalAccumulatedScore,
            activeLevelState: gameActive && currentLevel > 0 ? {
                levelScore: levelScore, // Score for correct answers in this level
                countriesForCurrentLevelDefinition: countriesForCurrentLevelDefinition,
                questionsToAskInCurrentRound: questionsToAskInCurrentRound,
                incorrectlyAnsweredInCurrentRound: incorrectlyAnsweredInCurrentRound,
                correctlyAnsweredInLevelOverall: Array.from(correctlyAnsweredInLevelOverall),
                // questionsAnsweredInLevelDisplay: questionsAnsweredInLevel, // Not strictly needed if restoring queues
            } : null
        };
        localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
        console.log("Game state saved.");
    }

    function loadGameState() {
        const savedState = localStorage.getItem(GAME_STATE_KEY);
        if (savedState) {
            try {
                return JSON.parse(savedState);
            } catch (e) {
                console.error("Error parsing saved game state:", e);
                clearGameState();
                return null;
            }
        }
        return null;
    }

    function clearGameState() {
        localStorage.removeItem(GAME_STATE_KEY);
        console.log("Game state cleared.");
    }

    function setGameScreenActive(isActive) {
        if (isActive) {
            // Show game elements, hide initial screen elements
            gameSubtitleElement.textContent = "นี่คือธงชาติของประเทศอะไร?"; // Or similar game instruction
            lastPlayedInfoElement.style.display = 'none';
            startNewGameButton.style.display = 'none';
            continueButton.style.display = 'none';

            document.getElementById('game-stats').style.display = 'block'; // Assuming it's initially hidden or part of game screen
            flagImageElement.style.display = 'block'; // Or as needed by displayNextQuestion
            optionsContainerElement.style.display = 'grid'; // Or 'block'
            feedbackElement.style.display = 'block';
            levelProgressStatsElement.style.display = 'block'; // Or as needed
            exitGameButton.style.display = 'inline-block';
            resetLevelButton.style.display = 'inline-block'; // If applicable
            startNextButton.style.display = 'inline-block'; // This is the main game progression button
        } else {
            // Show initial screen elements, hide game elements
            document.getElementById('game-stats').style.display = 'none';
            flagImageElement.style.display = 'none';
            optionsContainerElement.style.display = 'none';
            feedbackElement.innerHTML = ''; // Clear feedback
            questionInfoElement.style.display = 'none';
            levelProgressStatsElement.style.display = 'none';
            exitGameButton.style.display = 'none';
            resetLevelButton.style.display = 'none';
            startNextButton.style.display = 'none'; // Hide the game's next button
            startNewGameButton.style.display = 'inline-block'; // Show "Start New Game"
        }
    }
    function setupInitialScreenUI() { // Called once after countries are loaded, and after exiting a game
        updateLevelDisplay(); // Shows '-' if level 0
        updateScoreDisplay();
        updateTotalScoreDisplay();
        setGameScreenActive(false); // Ensure initial screen is shown
    }

    function updateQuestionInfoDisplay() {
        // Calculate current question number based on initial set for level minus those still in queue for current round
        // and those pending retry. Add 1 because it's 1-indexed.
        const questionsPresentedThisRound = countriesForCurrentLevelDefinition.length - 
                                           (questionsToAskInCurrentRound.length + 
                                           incorrectlyAnsweredInCurrentRound.filter(q => !correctlyAnsweredInLevelOverall.has(q.countryCode)).length);
        currentQuestionNumberElement.textContent = Math.min(questionsPresentedThisRound +1, countriesForCurrentLevelDefinition.length);
        totalQuestionsInLevelElement.textContent = countriesForCurrentLevelDefinition.length;
        questionLevelNumberElement.textContent = currentLevel;
        questionInfoElement.style.display = 'block';
    }

    function startNextLevel() {
        currentLevel++;
        if (currentLevel > maxLevels || allLoadedCountries.length === 0) {
            endGame();
            return;
        }

        levelScore = 0;
        // questionsAnsweredInLevel = 0;
        correctlyAnsweredInLevelOverall.clear();
        incorrectlyAnsweredInCurrentRound = [];

        updateLevelDisplay();
        updateScoreDisplay();

        const startIndex = (currentLevel - 1) * QUESTIONS_PER_LEVEL;
        const endIndex = startIndex + QUESTIONS_PER_LEVEL;
        countriesForCurrentLevelDefinition = allLoadedCountries.slice(startIndex, endIndex);

        if (countriesForCurrentLevelDefinition.length === 0) {
            feedbackElement.textContent = 'ไม่มีคำถามสำหรับ Level นี้แล้ว';
            endGame(true); // Indicate an issue
            return;
        }
        questionsToAskInCurrentRound = shuffleArray([...countriesForCurrentLevelDefinition]); // Start with all questions for the level, shuffled
        updateLevelProgressDisplay(); // Initialize progress display for the new level

        gameActive = true;
        startNextButton.textContent = 'คำถามถัดไป';
        resetLevelButton.style.display = 'inline-block';
        resetLevelButton.disabled = false;
        continueButton.style.display = 'none'; // Hide continue button once game starts
        startNewGameButton.style.display = 'none';
        exitGameButton.style.display = 'inline-block';
        levelProgressStatsElement.style.display = 'block';
        displayNextQuestion();
    }

    function displayNextQuestion() {
        if (questionsToAskInCurrentRound.length === 0) {
            // Current round is finished, check if there are incorrect answers to retry
            if (incorrectlyAnsweredInCurrentRound.length > 0) {
                questionsToAskInCurrentRound = shuffleArray([...incorrectlyAnsweredInCurrentRound]);
                incorrectlyAnsweredInCurrentRound = []; // Clear for the new round of retries
                feedbackElement.innerHTML = 'มาลองตอบคำถามที่ตอบผิดอีกครั้ง!';
            } else {
                // All questions in the level are now correctly answered
                endLevel();
                return;
            }
        }

        if (questionsToAskInCurrentRound.length === 0 && incorrectlyAnsweredInCurrentRound.length === 0) {
             // This case means all questions in the level are correctly answered.
            endLevel(); // Handles logic for moving to next level or finishing game
            return;
        }

        feedbackElement.innerHTML = '';
        optionsContainerElement.innerHTML = '';
        flagImageElement.style.display = 'block';

        updateQuestionInfoDisplay();

        // Pick the next question from the current round's queue
        currentCorrectAnswer = questionsToAskInCurrentRound.shift(); // Get and remove the first question

        // Get 3 distractor options from the entire pool of countries, excluding the correct answer
        let distractors = [];
        const tempCountryPool = allLoadedCountries.filter(c => c.countryCode !== currentCorrectAnswer.countryCode);
        const shuffledDistractorPool = shuffleArray([...tempCountryPool]); // Use a copy

        for (let i = 0; i < 3 && i < shuffledDistractorPool.length; i++) {
            distractors.push(shuffledDistractorPool[i]);
        }

        if (distractors.length < 3 && allLoadedCountries.length >= 4) {
            console.warn("Could not find 3 unique distractors, trying to fill...");
             // Attempt to fill with any other country not already chosen
            for (const country of allLoadedCountries) {
                if (distractors.length >= 3) break;
                if (country.countryCode !== currentCorrectAnswer.countryCode && !distractors.some(d => d.countryCode === country.countryCode)) {
                    distractors.push(country);
                }
            }
        }

        const optionsForQuestion = shuffleArray([currentCorrectAnswer, ...distractors]);

        if (optionsForQuestion.length < 1) { // Should have at least the correct answer
            console.error("Failed to generate any options for the question.");
            feedbackElement.textContent = 'เกิดข้อผิดพลาดในการสร้างตัวเลือกคำถาม';
            endLevel(); // End the current level attempt due to error
            return;
        }

        flagImageElement.src = currentCorrectAnswer.flagURL;
        flagImageElement.alt = `Flag of ${getCountryName(currentCorrectAnswer)}`;

        // Shuffle options
        optionsForQuestion.forEach(country => {
            const button = document.createElement('button');
            button.classList.add('btn', 'btn-outline-secondary', 'btn-lg', 'btn-option');
            button.textContent = getCountryName(country);
            button.addEventListener('click', () => handleAnswer(country));
            optionsContainerElement.appendChild(button);
        });
        // questionsAnsweredInLevel tracks attempts in a round, or unique questions presented.
        // For "X of Y" display, it's better to calculate based on countriesForCurrentLevelDefinition.length and remaining questions.
        startNextButton.disabled = true; // Disable next until an answer is chosen
    }

    function getCountryName(country) {
        return country.countryNameTH && country.countryNameTH.trim() !== '' ? country.countryNameTH : country.countryNameEN;
    }

    function handleAnswer(selectedCountry) {
        if (!gameActive) return;

        // Disable all option buttons
        const optionButtons = optionsContainerElement.querySelectorAll('button');
        optionButtons.forEach(btn => btn.disabled = true);

        // questionsAnsweredInLevel++; // Increment for each answer attempt - not used for core logic restoration

        if (selectedCountry.countryCode === currentCorrectAnswer.countryCode) {
            if (!correctlyAnsweredInLevelOverall.has(currentCorrectAnswer.countryCode)) {
                levelScore++; // Only increment level score if it's the first time getting this question right
                totalAccumulatedScore++;
                correctlyAnsweredInLevelOverall.add(currentCorrectAnswer.countryCode);
            }
            feedbackElement.innerHTML = '<span class="feedback-correct">ถูกต้อง!</span>';
            // If it was in incorrectlyAnsweredInCurrentRound, it's now correct, so it won't be added back.
        } else {
            feedbackElement.innerHTML = `<span class="feedback-incorrect">ผิด!</span> คำตอบที่ถูกต้องคือ: ${getCountryName(currentCorrectAnswer)}`;
            if (!incorrectlyAnsweredInCurrentRound.some(c => c.countryCode === currentCorrectAnswer.countryCode) &&
                !correctlyAnsweredInLevelOverall.has(currentCorrectAnswer.countryCode)) {
                // Add to retry list only if not already there from this round and not already marked as overall correct
                incorrectlyAnsweredInCurrentRound.push(currentCorrectAnswer);
            }
        }
        updateScoreDisplay();
        updateTotalScoreDisplay();
        updateLevelProgressDisplay();

        saveGameState(); // Save after every answer
        startNextButton.disabled = false; // Enable next button

        if (questionsToAskInCurrentRound.length === 0 && incorrectlyAnsweredInCurrentRound.length === 0) {
            if (currentLevel < maxLevels) {
                startNextButton.textContent = 'Level ถัดไป';
            } else {
                startNextButton.textContent = 'ดูผลสรุป';
            }
            resetLevelButton.disabled = true; // Can't reset a completed level until next one starts or game restarts
        } else {
            startNextButton.textContent = 'คำถามถัดไป';
        }
    }

    // --- UI Update Functions ---
    function updateScoreDisplay() {
        levelScoreElement.textContent = levelScore;
    }

    function updateLevelDisplay() {
        currentLevelElement.textContent = currentLevel > 0 ? currentLevel : "-";
    }

    function updateTotalScoreDisplay() {
        totalAccumulatedScoreElement.textContent = totalAccumulatedScore;
    }

    function updateLevelProgressDisplay() {
        const totalQuestions = countriesForCurrentLevelDefinition.length;
        const correctAnswers = correctlyAnsweredInLevelOverall.size;
        correctInLevelCountElement.textContent = correctAnswers;
        totalUniqueQuestionsInLevelElement.textContent = totalQuestions > 0 ? totalQuestions : QUESTIONS_PER_LEVEL;

        const progressPercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
        levelProgressBarElement.style.width = `${progressPercentage}%`;
        levelProgressBarElement.setAttribute('aria-valuenow', progressPercentage);
    }
    // --- Helper Functions ---

    function shuffleArray(array) {
        let newArray = [...array]; // Create a copy to avoid mutating the original
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // --- Game Flow Functions ---
    function endGame(dataError = false) {
        gameActive = false;
        flagImageElement.style.display = 'none';
        optionsContainerElement.innerHTML = '';
        if (!dataError) {
            feedbackElement.innerHTML = `<h2>จบเกม!</h2><p>คะแนนรวมทั้งหมดของคุณคือ: ${totalAccumulatedScore}</p>`;
        } else {
            feedbackElement.innerHTML += `<p>มีปัญหาในการดำเนินเกมต่อ</p>`;
        }
        startNextButton.textContent = 'เริ่มเกมใหม่ทั้งหมด';
        startNextButton.disabled = false;
        resetLevelButton.style.display = 'none';
        continueButton.style.display = 'none'; // Hide continue button
        startNewGameButton.style.display = 'inline-block'; // Show start new game button
        exitGameButton.style.display = 'none';
        questionInfoElement.style.display = 'none';
        levelProgressStatsElement.style.display = 'none';
        clearGameState();
    }

    function endLevel() { // Called when all questions in a level are answered or no more available
        gameActive = false; // Pause game flow until user action
        feedbackElement.innerHTML = `<h3>Level ${currentLevel} เสร็จสิ้น!</h3><p>คุณตอบถูกทุกข้อใน Level นี้แล้ว</p>`;
        optionsContainerElement.innerHTML = ''; // Clear options
        questionInfoElement.style.display = 'none';
        // flagImageElement.style.display = 'none'; // Keep last flag or hide

        if (currentLevel < maxLevels) {
            startNextButton.textContent = 'Level ถัดไป';
        } else {
            startNextButton.textContent = 'ดูผลสรุป';
        }
        startNextButton.disabled = false;
        resetLevelButton.disabled = true; // Can't reset once level is officially "ended" this way
        saveGameState(); // Save progress after completing a level
    }

    function resetCurrentLevel() {
        if (currentLevel === 0) return; // No level to reset

        // Subtract points earned *only for questions correctly answered for the first time* in this level's attempt
        totalAccumulatedScore -= levelScore; // levelScore only counts first-time correct answers in this level
        updateTotalScoreDisplay();


        levelScore = 0;
        questionsAnsweredInLevel = 0;
        updateScoreDisplay();

        correctlyAnsweredInLevelOverall.clear();
        incorrectlyAnsweredInCurrentRound = [];
        questionsToAskInCurrentRound = shuffleArray([...countriesForCurrentLevelDefinition]); // Reset questions for the level
        updateLevelProgressDisplay();

        gameActive = true;
        startNextButton.textContent = 'คำถามถัดไป';
        resetLevelButton.disabled = false; // It's active again
        displayNextQuestion();
        saveGameState(); // Save state after reset
    }

    function exitGameAndSaveProgress() {
        if (gameActive) {
            saveGameState(); // Ensure the very latest state is saved
        }
        gameActive = false;
        setupInitialScreenUI(); // Reset UI to initial screen
        gameSubtitleElement.innerHTML = 'เกมถูกบันทึกแล้ว!'; // Update subtitle
        const savedState = loadGameState(); // Check if state was actually saved
        if (savedState && savedState.currentLevel > 0) {
            lastLevelElement.textContent = savedState.currentLevel;
            lastScoreElement.textContent = savedState.totalAccumulatedScore;
            lastPlayedInfoElement.style.display = 'block';
            continueButton.style.display = 'inline-block';
        }
    }

    // --- Event Listeners ---

    startNextButton.addEventListener('click', () => {
        const buttonText = startNextButton.textContent;
        // This button is now primarily for in-game progression
        if (buttonText === 'Level ถัดไป') {
            startNextLevel();
        } else if (buttonText === 'คำถามถัดไป') {
            displayNextQuestion();
        } else if (buttonText === 'ดูผลสรุป' || buttonText === 'เริ่มเกมใหม่ทั้งหมด') {
            startNewGame(); // This will reset and start a new game.
        }
    });

    startNewGameButton.addEventListener('click', () => {
        startNewGame();
    });


    continueButton.addEventListener('click', () => {
        const savedState = loadGameState();
        if (savedState) {
            setGameScreenActive(true); // Transition to game screen
            resumeGame(savedState);
            continueButton.style.display = 'none';
        } else {
            // Should not happen if button is visible, but as a fallback
            feedbackElement.textContent = 'ไม่พบข้อมูลการเล่นล่าสุด';
            continueButton.style.display = 'none';
        }
    });


    resetLevelButton.addEventListener('click', resetCurrentLevel);
    exitGameButton.addEventListener('click', exitGameAndSaveProgress);

    // Load countries when the script runs
    loadCountries();
});
