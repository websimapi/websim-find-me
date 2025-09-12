import confetti from 'canvas-confetti';

const appState = {
    screens: {
        upload: document.getElementById('upload-screen'),
        loading: document.getElementById('loading-screen'),
        game: document.getElementById('game-screen'),
        result: document.getElementById('result-screen'),
    },
    buttons: {
        generate: document.getElementById('generate-button'),
        playAgain: document.getElementById('play-again-button'),
    },
    ui: {
        imageUpload: document.getElementById('image-upload'),
        imagePreview: document.getElementById('image-preview'),
        uploadLabel: document.getElementById('upload-label'),
        loadingMessage: document.getElementById('loading-message'),
        gamePrompt: document.getElementById('game-prompt'),
        gameImageContainer: document.getElementById('game-image-container'),
        resultMessage: document.getElementById('result-message'),
    },
    game: {
        imageDataUrl: null,
        subjectDescription: '',
        targetArea: null, // { x, y, width, height } in percentages
    }
};

function switchScreen(screenName) {
    Object.values(appState.screens).forEach(screen => {
        screen.classList.remove('active');
    });
    appState.screens[screenName].classList.add('active');
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        appState.game.imageDataUrl = e.target.result;
        appState.ui.imagePreview.src = appState.game.imageDataUrl;
        appState.ui.imagePreview.classList.remove('hidden');
        appState.ui.uploadLabel.classList.add('hidden');
        appState.buttons.generate.disabled = false;
    };
    reader.readAsDataURL(file);
}

async function generateGame() {
    if (!appState.game.imageDataUrl) return;

    switchScreen('loading');

    try {
        // Step 1: Analyze the image
        appState.ui.loadingMessage.innerText = 'Analyzing your photo... (Step 1/3)';
        const analysis = await analyzeImage(appState.game.imageDataUrl);
        appState.game.subjectDescription = analysis.subject;

        // Step 2: Generate the game image
        appState.ui.loadingMessage.innerText = 'Creating a hidden world... (Step 2/3)';
        const gameImageResult = await createGameImage(analysis.subject, analysis.scene);

        // Step 3: Find the hidden subject in the new image
        appState.ui.loadingMessage.innerText = 'Hiding the treasure... (Step 3/3)';
        appState.game.targetArea = await findSubjectInImage(gameImageResult.url, analysis.subject);

        // Step 4: Setup and show the game screen
        setupGameScreen(gameImageResult.url, analysis.subject);
        switchScreen('game');

    } catch (error) {
        console.error('Error generating game:', error);
        appState.ui.resultMessage.innerText = 'Oops! Something went wrong.';
        appState.buttons.playAgain.innerText = 'Try Again';
        switchScreen('result');
    }
}

async function analyzeImage(imageDataUrl) {
    const response = await websim.chat.completions.create({
        messages: [{
            role: 'user',
            content: [{
                type: 'text',
                text: `Analyze this image. Describe the main subject and the overall scene or background in a few words.
Respond with JSON, following this schema:
{ "subject": "a description of the main subject", "scene": "a description of the scene" }`
            }, {
                type: 'image_url',
                image_url: { url: imageDataUrl },
            }],
        }, ],
        json: true,
    });
    return JSON.parse(response.content);
}

async function createGameImage(subject, scene) {
    const prompt = `Create a very dense, crowded, and chaotic 'Where's Waldo' style cartoon illustration based on the theme of "${scene}". The style should be vibrant, detailed, and full of many different characters and objects. Somewhere hidden within this chaotic scene, include a small, subtly placed "${subject}". Do not make the hidden subject obvious. The image should be fun and colorful.`;
    return await websim.imageGen({ prompt, aspect_ratio: "4:3" });
}

async function findSubjectInImage(imageUrl, subject) {
    const response = await websim.chat.completions.create({
        messages: [{
            role: 'user',
            content: [{
                type: 'text',
                text: `You are an expert object locator. Find the exact bounding box for the "${subject}" in this image.
Respond ONLY with a valid JSON object containing the coordinates as percentages from the top-left corner.
The required JSON schema is: { "x": number, "y": number, "width": number, "height": number }.
Do not include any other text, explanations, or markdown formatting. If you cannot find the object, make your best guess.`
            }, {
                type: 'image_url',
                image_url: { url: imageUrl },
            }],
        }, ],
        json: true,
    });
    return JSON.parse(response.content);
}

function setupGameScreen(imageUrl, subject) {
    appState.ui.gamePrompt.innerText = `Can you find the ${subject}?`;
    const img = document.createElement('img');
    img.src = imageUrl;
    appState.ui.gameImageContainer.innerHTML = '';
    appState.ui.gameImageContainer.appendChild(img);
}

function handleGameClick(event) {
    const rect = event.target.getBoundingClientRect();
    const clickX = ((event.clientX - rect.left) / rect.width) * 100;
    const clickY = ((event.clientY - rect.top) / rect.height) * 100;

    const { x, y, width, height } = appState.game.targetArea;
    
    if (clickX >= x && clickX <= x + width && clickY >= y && clickY <= y + height) {
        handleWin();
    } else {
        // Optional: give feedback for a miss
    }
}

function handleWin() {
    appState.ui.resultMessage.innerText = 'You found it!';
    appState.buttons.playAgain.innerText = 'Play Again';
    switchScreen('result');
    
    // Fun confetti effect!
    confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 }
    });
}

function resetGame() {
    appState.ui.imagePreview.classList.add('hidden');
    appState.ui.uploadLabel.classList.remove('hidden');
    appState.ui.imageUpload.value = '';
    appState.buttons.generate.disabled = true;
    appState.game.imageDataUrl = null;
    appState.game.targetArea = null;
    appState.game.subjectDescription = '';
    switchScreen('upload');
}


// Event Listeners
appState.ui.imageUpload.addEventListener('change', handleImageUpload);
appState.buttons.generate.addEventListener('click', generateGame);
appState.ui.gameImageContainer.addEventListener('click', handleGameClick);
appState.buttons.playAgain.addEventListener('click', resetGame);

// Initial state
switchScreen('upload');