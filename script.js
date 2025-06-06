document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
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

    // --- Constants ---
    const QUESTIONS_PER_LEVEL = 10;
    const MIN_COUNTRIES_FOR_GAME = 4;
    const GAME_STATE_KEY = 'flagQuizGameState';

    // --- Audio Management ---
    const sounds = {
        correct: new Audio('assets/sounds/correct.mp3'),
        incorrect: new Audio('assets/sounds/incorrect.mp3'),
        levelUp: new Audio('assets/sounds/level-up.mp3'),
        gameStart: new Audio('assets/sounds/game-start.mp3'),
        gameIntro: new Audio('assets/sounds/game-intro.mp3')
    };
    if (sounds.gameIntro) {
        sounds.gameIntro.loop = true;
        sounds.gameIntro.volume = 0.1; // Adjust as needed
    }


    // --- Game State Variables ---
    let allLoadedCountries = [];
    let currentCorrectAnswer = null;
    let currentLevel = 0;
    let totalAccumulatedScore = 0;
    let levelScore = 0;
    let gameActive = false;
    let maxLevels = 0;

    let countriesForCurrentLevelDefinition = [];
    let questionsToAskInCurrentRound = [];
    let incorrectlyAnsweredInCurrentRound = [];
    let correctlyAnsweredInLevelOverall = new Set();

    // --- Web Speech API for Text-to-Speech ---
    let voices = [];
    const synth = window.speechSynthesis;

    function populateVoiceList() {
        voices = synth.getVoices();
        console.log("Available voices:", voices);
    }

    populateVoiceList();
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = populateVoiceList;
    }

    // --- Local Storage Manager Object ---
    const storageManager = {
        saveState: function() {
            const gameState = {
                currentLevel: currentLevel,
                totalAccumulatedScore: totalAccumulatedScore,
                activeLevelState: gameActive && currentLevel > 0 ? {
                    levelScore: levelScore,
                    countriesForCurrentLevelDefinition: countriesForCurrentLevelDefinition,
                    questionsToAskInCurrentRound: questionsToAskInCurrentRound,
                    incorrectlyAnsweredInCurrentRound: incorrectlyAnsweredInCurrentRound,
                    correctlyAnsweredInLevelOverall: Array.from(correctlyAnsweredInLevelOverall),
                } : null
            };
            localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
            console.log("Game state saved.");
        },
        loadState: function() {
            const savedState = localStorage.getItem(GAME_STATE_KEY);
            if (savedState) {
                try {
                    return JSON.parse(savedState);
                } catch (e) {
                    console.error("Error parsing saved game state:", e);
                    this.clearState();
                    return null;
                }
            }
            return null;
        },
        clearState: function() {
            localStorage.removeItem(GAME_STATE_KEY);
            console.log("Game state cleared.");
        }
    };

    // --- UI Manager Object ---
    const uiManager = {
        setGameScreenActive: function(isActive) {
            if (isActive) {
                gameSubtitleElement.textContent = "นี่คือธงชาติของประเทศอะไร?";
                lastPlayedInfoElement.style.display = 'none';
                startNewGameButton.style.display = 'none';
                continueButton.style.display = 'none';

                document.getElementById('game-stats').style.display = 'block';
                flagImageElement.style.display = 'block';
                optionsContainerElement.style.display = 'grid';
                feedbackElement.style.display = 'block';
                levelProgressStatsElement.style.display = 'block';
                exitGameButton.style.display = 'inline-block';
                resetLevelButton.style.display = 'inline-block';
                startNextButton.style.display = 'inline-block';
            } else {
                document.getElementById('game-stats').style.display = 'none';
                flagImageElement.style.display = 'none';
                optionsContainerElement.innerHTML = '';
                optionsContainerElement.style.display = 'none';
                feedbackElement.innerHTML = '';
                questionInfoElement.style.display = 'none';
                levelProgressStatsElement.style.display = 'none';
                exitGameButton.style.display = 'none';
                resetLevelButton.style.display = 'none';
                startNextButton.style.display = 'none';

                Object.values(sounds).forEach(sound => {
                    if (sound && sound !== sounds.gameIntro && sound.pause) sound.pause();
                });
                if (sounds.gameIntro) {
                    sounds.gameIntro.currentTime = 0;
                    sounds.gameIntro.play().catch(e => console.log("Intro sound autoplay blocked on initial screen:", e));
                }
                startNewGameButton.style.display = 'inline-block';
            }
        },
        setupInitialScreen: function() {
            this.updateLevelDisplay(currentLevel > 0 ? currentLevel : "-");
            this.updateLevelScore(levelScore);
            this.updateTotalScore(totalAccumulatedScore);
            this.setGameScreenActive(false);
        },
        updateLevelDisplay: function(level) {
            currentLevelElement.textContent = level;
        },
        updateLevelScore: function(score) {
            levelScoreElement.textContent = score;
        },
        updateTotalScore: function(score) {
            totalAccumulatedScoreElement.textContent = score;
        },
        updateQuestionInfo: function(currentQ, totalQ, level) {
            currentQuestionNumberElement.textContent = currentQ;
            totalQuestionsInLevelElement.textContent = totalQ;
            questionLevelNumberElement.textContent = level;
            questionInfoElement.style.display = 'block';
        },
        updateLevelProgress: function(correctAnswers, totalQuestionsInLevelDef) {
            const totalQ = totalQuestionsInLevelDef > 0 ? totalQuestionsInLevelDef : QUESTIONS_PER_LEVEL;
            correctInLevelCountElement.textContent = correctAnswers;
            totalUniqueQuestionsInLevelElement.textContent = totalQ;
            const progressPercentage = totalQ > 0 ? (correctAnswers / totalQ) * 100 : 0;
            levelProgressBarElement.style.width = `${progressPercentage}%`;
            levelProgressBarElement.setAttribute('aria-valuenow', progressPercentage);
        },
        displayOptions: function(options, answerHandler) {
            optionsContainerElement.innerHTML = '';
            options.forEach(country => {
                const button = document.createElement('button');
                button.classList.add('btn', 'btn-outline-secondary', 'btn-lg', 'btn-option');

                const countryNameSpan = document.createElement('span');
                countryNameSpan.textContent = getCountryName(country);
                button.appendChild(countryNameSpan);

                const speakButton = document.createElement('button');
                speakButton.classList.add('btn', 'btn-sm', 'btn-light', 'ms-2');
                speakButton.textContent = '🔊';
                speakButton.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent triggering the answer selection
                    // Determine language for speaking. Prioritize Thai if available, else English.
                    let textToSpeak = country.countryNameTH && country.countryNameTH.trim() !== '' ? country.countryNameTH : country.countryNameEN;
                    let langToSpeak = country.countryNameTH && country.countryNameTH.trim() !== '' ? 'th-TH' : 'en-US';
                    
                    // If only English name is available, ensure we use English for speaking
                    if (!country.countryNameTH || country.countryNameTH.trim() === '') {
                        textToSpeak = country.countryNameEN;
                        langToSpeak = 'en-US';
                    }
                    speakText(textToSpeak, langToSpeak);
                });
                button.appendChild(speakButton);

                button.addEventListener('click', () => answerHandler(country));
                optionsContainerElement.appendChild(button);
            });
        },
        showFeedback: function(message, isCorrect) {
            feedbackElement.innerHTML = `<span class="feedback-${isCorrect ? 'correct' : 'incorrect'}">${message}</span>`;
        },
        disableOptionButtons: function() {
            optionsContainerElement.querySelectorAll('button').forEach(btn => btn.disabled = true);
        }
    };

    // --- Text-to-Speech Function ---
    function speakText(text, lang) {
        if (synth.speaking) {
            console.error('SpeechSynthesis.speaking');
            return;
        }
        if (text !== '') {
            console.log("Speaking:", text, lang);
            const utterThis = new SpeechSynthesisUtterance(text);
            utterThis.onend = function (event) {
                console.log('SpeechSynthesisUtterance.onend');
            }
            utterThis.onerror = function (event) {
                console.error('SpeechSynthesisUtterance.onerror', event);
            }
            let selectedVoice = voices.find(voice => voice.lang === lang);
            if (!selectedVoice && lang.includes('-')) { // Try finding a more generic voice if specific (e.g. en-US) is not found
                selectedVoice = voices.find(voice => voice.lang.startsWith(lang.split('-')[0]));
            }
            if (selectedVoice) utterThis.voice = selectedVoice;
            else console.warn(`No specific voice found for ${lang}, using default.`);
            synth.speak(utterThis);
        }
    }
    // --- Game Logic Functions ---
    async function loadCountries() {
        try {
            const response = await fetch('data/country.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let countriesData = await response.json();
            countriesData = countriesData.filter(country =>
                country.flagURL && (country.countryNameTH || country.countryNameEN)
            );
            if (countriesData.length < MIN_COUNTRIES_FOR_GAME) {
                feedbackElement.textContent = `ข้อมูลประเทศไม่เพียงพอสำหรับเริ่มเกม (ต้องการอย่างน้อย ${MIN_COUNTRIES_FOR_GAME} ประเทศ)`;
                startNewGameButton.disabled = true; // Disable start new game if not enough data
                return;
            }
            allLoadedCountries = shuffleArray(countriesData);
            maxLevels = Math.ceil(allLoadedCountries.length / QUESTIONS_PER_LEVEL);
            console.log('Country data loaded:', allLoadedCountries.length, 'countries. Max levels:', maxLevels);

            const savedState = storageManager.loadState();
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
            uiManager.setupInitialScreen();
        } catch (error) {
            console.error('Error loading country data:', error);
            feedbackElement.textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูลประเทศ';
            if(startNewGameButton) startNewGameButton.disabled = true;
        }
    }

    function startNewGame() {
        storageManager.clearState();
        currentLevel = 0;
        totalAccumulatedScore = 0;
        levelScore = 0;

        uiManager.updateLevelDisplay(currentLevel > 0 ? currentLevel : "-");
        uiManager.updateLevelScore(levelScore);
        uiManager.updateTotalScore(totalAccumulatedScore);

        gameActive = false; // Will be set to true in startNextLevel
        if (sounds.gameIntro) sounds.gameIntro.pause();
        sounds.gameStart.play().catch(e => console.log("Game start sound play failed:", e));
        uiManager.setGameScreenActive(true);
        startNextLevel();
    }

    function resumeGame(savedState) {
        // allLoadedCountries might need to be re-shuffled or use a saved seed if strict non-repetition across sessions is desired
        // For now, we assume allLoadedCountries is already populated and shuffled from loadCountries
        maxLevels = Math.ceil(allLoadedCountries.length / QUESTIONS_PER_LEVEL);

        currentLevel = savedState.currentLevel;
        totalAccumulatedScore = savedState.totalAccumulatedScore;

        if (savedState.activeLevelState) {
            levelScore = savedState.activeLevelState.levelScore;
            countriesForCurrentLevelDefinition = savedState.activeLevelState.countriesForCurrentLevelDefinition;
            questionsToAskInCurrentRound = savedState.activeLevelState.questionsToAskInCurrentRound;
            incorrectlyAnsweredInCurrentRound = savedState.activeLevelState.incorrectlyAnsweredInCurrentRound;
            correctlyAnsweredInLevelOverall = new Set(savedState.activeLevelState.correctlyAnsweredInLevelOverall || []);

            uiManager.updateLevelDisplay(currentLevel);
            uiManager.updateLevelScore(levelScore);
            uiManager.updateTotalScore(totalAccumulatedScore);
            uiManager.updateLevelProgress(correctlyAnsweredInLevelOverall.size, countriesForCurrentLevelDefinition.length);

            if (questionsToAskInCurrentRound.length > 0 || incorrectlyAnsweredInCurrentRound.length > 0) {
                gameActive = true;
                startNextButton.textContent = 'คำถามถัดไป';
                resetLevelButton.style.display = 'inline-block';
                resetLevelButton.disabled = false;
                // continueButton and startNewGameButton are already hidden by setGameScreenActive(true)
                exitGameButton.style.display = 'inline-block';
                displayNextQuestion();
            } else { // Level was completed, game saved before "Next Level" click
                finalizeLevelCompletion();
            }
        } else {
            // Fallback if activeLevelState is missing but currentLevel > 0
            console.warn("Resuming game but activeLevelState is missing. Starting new game as fallback.");
            startNewGame();
        }
    }

    function startNextLevel() {
        currentLevel++;
        if (currentLevel > maxLevels || allLoadedCountries.length === 0) {
            endGame();
            return;
        }

        levelScore = 0;
        correctlyAnsweredInLevelOverall.clear();
        incorrectlyAnsweredInCurrentRound = [];

        uiManager.updateLevelDisplay(currentLevel);
        uiManager.updateLevelScore(levelScore);

        const startIndex = (currentLevel - 1) * QUESTIONS_PER_LEVEL;
        const endIndex = startIndex + QUESTIONS_PER_LEVEL;
        countriesForCurrentLevelDefinition = allLoadedCountries.slice(startIndex, endIndex);

        if (countriesForCurrentLevelDefinition.length === 0) {
            feedbackElement.textContent = 'ไม่มีคำถามสำหรับ Level นี้แล้ว';
            endGame(true);
            return;
        }
        questionsToAskInCurrentRound = shuffleArray([...countriesForCurrentLevelDefinition]);
        uiManager.updateLevelProgress(0, countriesForCurrentLevelDefinition.length);

        gameActive = true;
        startNextButton.textContent = 'คำถามถัดไป';
        resetLevelButton.style.display = 'inline-block';
        resetLevelButton.disabled = false;
        exitGameButton.style.display = 'inline-block';
        levelProgressStatsElement.style.display = 'block';
        displayNextQuestion();
    }

    function displayNextQuestion() {
        if (!gameActive) return;

        if (questionsToAskInCurrentRound.length === 0) {
            if (incorrectlyAnsweredInCurrentRound.length > 0) {
                questionsToAskInCurrentRound = shuffleArray([...incorrectlyAnsweredInCurrentRound]);
                incorrectlyAnsweredInCurrentRound = [];
                feedbackElement.innerHTML = 'มาลองตอบคำถามที่ตอบผิดอีกครั้ง!';
            } else {
                console.warn("displayNextQuestion: All queues empty, but handleAnswer should have finalized level.");
                if (gameActive) finalizeLevelCompletion();
                return;
            }
        }

        feedbackElement.innerHTML = ''; // Clear previous feedback
        flagImageElement.style.display = 'block'; // Ensure flag is visible

        const currentQNum = countriesForCurrentLevelDefinition.length -
                           (questionsToAskInCurrentRound.length +
                            incorrectlyAnsweredInCurrentRound.filter(q => !correctlyAnsweredInLevelOverall.has(q.countryCode)).length) + 1;
        uiManager.updateQuestionInfo(
            Math.min(currentQNum, countriesForCurrentLevelDefinition.length),
            countriesForCurrentLevelDefinition.length,
            currentLevel
        );

        currentCorrectAnswer = questionsToAskInCurrentRound.shift();

        let distractors = [];
        const tempCountryPool = allLoadedCountries.filter(c => c.countryCode !== currentCorrectAnswer.countryCode);
        const shuffledDistractorPool = shuffleArray([...tempCountryPool]);

        for (let i = 0; i < 3 && i < shuffledDistractorPool.length; i++) {
            distractors.push(shuffledDistractorPool[i]);
        }
        // Ensure 3 distractors if possible
        if (distractors.length < 3 && allLoadedCountries.length >= MIN_COUNTRIES_FOR_GAME) {
            for (const country of allLoadedCountries) {
                if (distractors.length >= 3) break;
                if (country.countryCode !== currentCorrectAnswer.countryCode && !distractors.some(d => d.countryCode === country.countryCode) && !optionsForQuestion.some(o => o.countryCode === country.countryCode) ) {
                     distractors.push(country);
                }
            }
        }


        const optionsForQuestion = shuffleArray([currentCorrectAnswer, ...distractors]);

        if (optionsForQuestion.length < 1) {
            console.error("Failed to generate any options for the question.");
            feedbackElement.textContent = 'เกิดข้อผิดพลาดในการสร้างตัวเลือกคำถาม';
            finalizeLevelCompletion();
            return;
        }

        flagImageElement.src = currentCorrectAnswer.flagURL;
        flagImageElement.alt = `Flag of ${getCountryName(currentCorrectAnswer)}`;
        uiManager.displayOptions(optionsForQuestion, handleAnswer);

        startNextButton.disabled = true;
    }

    function getCountryName(country) {
        return country.countryNameTH && country.countryNameTH.trim() !== '' ? country.countryNameTH : country.countryNameEN;
    }

    function handleAnswer(selectedCountry) {
        if (!gameActive) return;
        uiManager.disableOptionButtons();

        if (selectedCountry.countryCode === currentCorrectAnswer.countryCode) {
            if (!correctlyAnsweredInLevelOverall.has(currentCorrectAnswer.countryCode)) {
                levelScore++;
                totalAccumulatedScore++;
                correctlyAnsweredInLevelOverall.add(currentCorrectAnswer.countryCode);
                sounds.correct.play();
            }
            uiManager.showFeedback('ถูกต้อง!', true);
        } else {
            sounds.incorrect.play();
            uiManager.showFeedback(`ผิด! คำตอบที่ถูกต้องคือ: ${getCountryName(currentCorrectAnswer)}`, false);
            if (!incorrectlyAnsweredInCurrentRound.some(c => c.countryCode === currentCorrectAnswer.countryCode) &&
                !correctlyAnsweredInLevelOverall.has(currentCorrectAnswer.countryCode)) {
                incorrectlyAnsweredInCurrentRound.push(currentCorrectAnswer);
            }
        }
        uiManager.updateLevelScore(levelScore);
        uiManager.updateTotalScore(totalAccumulatedScore);
        uiManager.updateLevelProgress(correctlyAnsweredInLevelOverall.size, countriesForCurrentLevelDefinition.length);

        storageManager.saveState();

        if (questionsToAskInCurrentRound.length === 0 && incorrectlyAnsweredInCurrentRound.length === 0) {
            finalizeLevelCompletion();
        } else {
            startNextButton.textContent = 'คำถามถัดไป';
        }
        startNextButton.disabled = false;
    }

    function shuffleArray(array) {
        let newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

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
        continueButton.style.display = 'none';
        startNewGameButton.style.display = 'inline-block';
        exitGameButton.style.display = 'none';
        questionInfoElement.style.display = 'none';
        levelProgressStatsElement.style.display = 'none';
        storageManager.clearState();
    }

    function finalizeLevelCompletion() {
        gameActive = false;
        feedbackElement.innerHTML = `<h3>Level ${currentLevel} เสร็จสิ้น!</h3><p>คุณตอบถูกทุกข้อใน Level นี้แล้ว</p>`;
        optionsContainerElement.innerHTML = '';
        questionInfoElement.style.display = 'none';

        if (currentLevel < maxLevels) {
            startNextButton.textContent = 'Level ถัดไป';
            // Sound moved to button click
        } else {
            startNextButton.textContent = 'ดูผลสรุป';
        }
        startNextButton.disabled = false;
        resetLevelButton.disabled = true;
        storageManager.saveState();
    }

    function resetCurrentLevel() {
        if (currentLevel === 0) return;
        totalAccumulatedScore -= levelScore; // Subtract points from this attempt
        uiManager.updateTotalScore(totalAccumulatedScore);

        levelScore = 0;
        uiManager.updateLevelScore(levelScore);

        correctlyAnsweredInLevelOverall.clear();
        incorrectlyAnsweredInCurrentRound = [];
        questionsToAskInCurrentRound = shuffleArray([...countriesForCurrentLevelDefinition]);
        uiManager.updateLevelProgress(0, countriesForCurrentLevelDefinition.length);

        gameActive = true;
        startNextButton.textContent = 'คำถามถัดไป';
        resetLevelButton.disabled = false;
        displayNextQuestion();
        storageManager.saveState();
    }

    function exitGameAndSaveProgress() {
        if (gameActive) {
            storageManager.saveState();
        }
        gameActive = false;
        uiManager.setupInitialScreen();
        gameSubtitleElement.innerHTML = 'เกมถูกบันทึกแล้ว!';
        const savedState = storageManager.loadState();
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
        if (buttonText === 'Level ถัดไป') {
            sounds.levelUp.play().catch(e => console.error("Level up sound play failed:", e));
            startNextLevel();
        } else if (buttonText === 'คำถามถัดไป') {
            displayNextQuestion();
        } else if (buttonText === 'ดูผลสรุป' || buttonText === 'เริ่มเกมใหม่ทั้งหมด') {
            startNewGame();
        }
    });

    startNewGameButton.addEventListener('click', () => {
        startNewGame();
    });

    continueButton.addEventListener('click', () => {
        const savedState = storageManager.loadState();
        if (savedState) {
            uiManager.setGameScreenActive(true);
            if (sounds.gameIntro) sounds.gameIntro.pause();
            sounds.gameStart.play().catch(e => console.log("Game start sound play failed:", e));
            resumeGame(savedState);
            continueButton.style.display = 'none'; // Already handled by setGameScreenActive
        } else {
            feedbackElement.textContent = 'ไม่พบข้อมูลการเล่นล่าสุด';
            continueButton.style.display = 'none';
        }
    });

    resetLevelButton.addEventListener('click', resetCurrentLevel);
    exitGameButton.addEventListener('click', exitGameAndSaveProgress);

    // Load countries when the script runs
    loadCountries();
});
